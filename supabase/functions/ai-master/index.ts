import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJWT, getCorsHeaders, authErrorResponse } from "../_shared/auth.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

// ── Default system prompt ──
const DEFAULT_MASTER_PROMPT = `Tu es l'Agent Maître de Scopewright — un conseiller architecture et système senior.

RÔLE :
- Analyser le système Scopewright (architecture, code, configuration, prompts AI)
- Identifier incohérences, risques, bugs potentiels, opportunités d'amélioration
- Répondre aux questions techniques sur n'importe quel aspect du système
- Gérer la mémoire organisationnelle (ai_learnings) : lire, auditer, proposer corrections
- Proposer des modifications chirurgicales aux prompts AI (format diff, jamais de réécriture complète)
- Comparer les prompts entre agents pour détecter incohérences et opportunités

RÈGLES :
- Tes réponses sont en français
- Sois direct et concis — pas de prose narrative
- Utilise des listes et tableaux quand c'est plus clair
- Cite les fichiers et fonctions par nom exact
- Indique le niveau de criticité (CRITIQUE / IMPORTANT / MOYEN / FAIBLE)
- Si tu identifies un risque de sécurité, mentionne l'ID d'audit (SEC-xx, BUG-xx, etc.)

OUTILS DISPONIBLES :
- list_learnings : lire toutes les règles mémoire (auto-exécuté, lecture seule)
- read_prompt : lire un prompt spécifique (auto-exécuté, lecture seule)
- list_all_prompts : lire tous les prompts pour comparaison (auto-exécuté, lecture seule)
- update_learning : modifier une règle — TOUJOURS proposer d'abord, appliquer après approbation
- delete_learning : supprimer une règle — TOUJOURS proposer d'abord, appliquer après approbation
- update_prompt_section : modifier une section d'un prompt — format diff obligatoire :
  AGENT CIBLÉ : [nom]
  SECTION : [nom section]
  REMPLACER : [texte actuel exact]
  PAR : [nouveau texte]
  RAISON : [explication courte]
  TOUJOURS proposer en texte d'abord, appliquer après approbation.
- log_prompt_change : auto-appelé après update_prompt_section (pas d'approbation)

JAMAIS de modification sans approbation explicite de l'utilisateur.
JAMAIS de réécriture complète d'un prompt — toujours un delta chirurgical.

CONTEXTE ROUTING :
Quand tu prépares des recommandations pour un agent spécifique, filtre le contexte pour ne garder que ce qui est pertinent. Indique ce que tu as retiré et pourquoi.

CONTEXTE SYSTÈME :
Tu as accès à deux documents de référence injectés ci-dessous (sections pertinentes selon ta question).`;

// ── Section-based context loading ──
// MASTER_CONTEXT.md sections are identified by "## N. TITLE" headers
const SECTION_KEYWORDS: Record<string, string[]> = {
  "IDENTITÉ": ["identité", "stack", "architecture", "netlify", "supabase", "déploiement"],
  "FICHIERS": ["fichier", "html", "shared", "calculateur", "catalogue", "admin", "approbation", "clients", "quote"],
  "TABLES": ["table", "base", "supabase", "room_items", "catalogue_items", "app_config", "colonne", "JSONB"],
  "RLS": ["rls", "sécurité", "permission", "policy", "anon"],
  "EDGE": ["edge", "function", "deploy", "translate", "ai-assistant", "ai-master", "import"],
  "AGENTS": ["agent", "assistant", "estimateur", "approbation", "contacts", "maître"],
  "PROMPTS": ["prompt", "clé", "ai_prompt", "override", "haiku", "sonnet"],
  "SYSTÈMES": ["cascade", "dm", "matériau", "prix", "barème", "workflow", "pipeline", "pdf"],
  "CONVENTIONS": ["convention", "code", "select", "date", "escapeHtml", "skipCascade", "token"],
  "PERMISSIONS": ["permission", "rôle", "admin", "approve", "bypass"],
  "RISQUES": ["risque", "sec-", "bug-", "arch-", "critique", "vulnérab"],
  "BUGS": ["bug", "race", "orphelin", "débordement"],
  "DÉCISIONS": ["décision", "dec-", "refactor"],
  "RENDU": ["rendu", "snapshot", "preview", "quote", "pdf", "email"],
  "TESTS": ["test", "assertion", "cascade-engine", "fixture"],
  "SYNC": ["sync", "master_context", "master_claude_md", "app_config"],
};

function selectRelevantSections(masterContext: string, userMessage: string): string {
  if (!masterContext || !userMessage) return masterContext || "";

  const msgLower = userMessage.toLowerCase();

  // Split into sections by "## N." pattern
  const sectionRegex = /^## \d+\./gm;
  const parts: { header: string; content: string; index: number }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const indices: number[] = [];

  // Find all section start positions
  while ((match = sectionRegex.exec(masterContext)) !== null) {
    indices.push(match.index);
  }

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i < indices.length - 1 ? indices[i + 1] : masterContext.length;
    const sectionText = masterContext.slice(start, end);
    const headerMatch = sectionText.match(/^## \d+\.\s*(.+)/);
    const header = headerMatch ? headerMatch[1].trim() : "";
    parts.push({ header, content: sectionText, index: i });
  }

  if (parts.length === 0) return masterContext;

  // Preamble (before first section)
  const preamble = masterContext.slice(0, indices[0] || 0);

  // Score each section
  const selected: typeof parts = [];
  for (const part of parts) {
    let score = 0;
    const headerUpper = part.header.toUpperCase();

    for (const [sectionKey, keywords] of Object.entries(SECTION_KEYWORDS)) {
      if (headerUpper.includes(sectionKey)) {
        // Check if any keyword matches the user message
        for (const kw of keywords) {
          if (msgLower.includes(kw.toLowerCase())) {
            score += 2;
          }
        }
      }
    }

    // Also check content keywords directly
    const contentLower = part.content.toLowerCase().slice(0, 500);
    const msgWords = msgLower.split(/\s+/).filter(w => w.length > 3);
    for (const word of msgWords) {
      if (contentLower.includes(word)) score++;
    }

    if (score > 0) selected.push(part);
  }

  // If nothing matched or it's a broad query, include everything
  if (selected.length === 0 || msgLower.includes("analyse") || msgLower.includes("système") || msgLower.includes("incohérence")) {
    return masterContext;
  }

  // Build filtered document
  return preamble + "\n" + selected.map(s => s.content).join("\n");
}

// ── Load docs from app_config ──
async function loadMasterDocs(supabase: any): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase
      .from("app_config")
      .select("key, value")
      .in("key", [
        "master_context",
        "master_claude_md",
        "ai_prompt_master"
      ]);
    if (error) {
      console.error("loadMasterDocs error:", error.message);
      return {};
    }
    if (!data) return {};
    const docs: Record<string, string> = {};
    for (const row of data) {
      if (row.value && typeof row.value === "string" && row.value.trim()) {
        docs[row.key] = row.value;
      }
    }
    // #147-fix: Log confirmation of loaded docs
    console.log(`[ai-master] Docs loaded: master_context=${(docs["master_context"] || "").length} chars, master_claude_md=${(docs["master_claude_md"] || "").length} chars, ai_prompt_master=${(docs["ai_prompt_master"] || "").length > 0 ? "custom" : "default"}`);
    return docs;
  } catch (err) {
    console.error("loadMasterDocs exception:", err);
    return {};
  }
}

// ── Load learnings ──
async function loadLearnings(supabase: any): Promise<any[]> {
  try {
    const { data } = await supabase
      .from("ai_learnings")
      .select("id, rule, source_context, is_active, created_at")
      .order("created_at", { ascending: true })
      .limit(50);
    return data || [];
  } catch {
    return [];
  }
}

// ── Load all prompts ──
async function loadAllPrompts(supabase: any): Promise<Record<string, string>> {
  try {
    const { data } = await supabase
      .from("app_config")
      .select("key, value")
      .like("key", "ai_prompt_%");
    if (!data) return {};
    const prompts: Record<string, string> = {};
    for (const row of data) {
      if (row.value && typeof row.value === "string") {
        prompts[row.key] = row.value;
      }
    }
    return prompts;
  } catch {
    return {};
  }
}

// ── Build system prompt with section-based context ──
function buildSystemPrompt(
  docs: Record<string, string>,
  learnings: any[],
  lastUserMessage: string
): string {
  const staticPrompt = docs["ai_prompt_master"] || DEFAULT_MASTER_PROMPT;
  const sections: string[] = [staticPrompt];

  // Inject MASTER_CONTEXT.md (filtered by relevance)
  if (docs["master_context"]) {
    const filtered = selectRelevantSections(docs["master_context"], lastUserMessage);
    sections.push("\n\n--- MASTER_CONTEXT.md (sections pertinentes) ---\n" + filtered);
  } else {
    sections.push("\n\n⚠ MASTER_CONTEXT.md non chargé — cliquer 'Synchroniser les docs' dans le drawer.");
  }

  // Inject CLAUDE.md (always full — it's the authoritative reference)
  if (docs["master_claude_md"]) {
    sections.push("\n\n--- CLAUDE.md ---\n" + docs["master_claude_md"]);
  } else {
    sections.push("\n\n⚠ CLAUDE.md non chargé — cliquer 'Synchroniser les docs' dans le drawer.");
  }

  // Inject learnings
  if (learnings.length > 0) {
    sections.push("\n\n--- RÈGLES ORGANISATIONNELLES (ai_learnings) ---");
    for (const l of learnings) {
      sections.push(`- [id=${l.id}] ${l.rule} (source: ${l.source_context || "?"}, active: ${l.is_active})`);
    }
  }

  return sections.join("\n");
}

// ── Tool definitions ──
const TOOLS = [
  {
    name: "list_learnings",
    description: "Lister toutes les règles de mémoire organisationnelle (ai_learnings). Lecture seule.",
    input_schema: { type: "object" as const, properties: {}, required: [] as string[] }
  },
  {
    name: "read_prompt",
    description: "Lire le contenu d'un prompt AI depuis app_config.",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt_key: { type: "string", description: "Clé du prompt (ex: ai_prompt_estimateur)" }
      },
      required: ["prompt_key"]
    }
  },
  {
    name: "list_all_prompts",
    description: "Lister tous les prompts AI avec leur contenu pour comparaison inter-agents.",
    input_schema: { type: "object" as const, properties: {}, required: [] as string[] }
  },
  {
    name: "update_learning",
    description: "Modifier une règle de mémoire existante. Nécessite approbation utilisateur.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "UUID de la règle à modifier" },
        rule: { type: "string", description: "Nouveau texte de la règle" }
      },
      required: ["id", "rule"]
    }
  },
  {
    name: "delete_learning",
    description: "Supprimer une règle de mémoire. Nécessite approbation utilisateur.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "UUID de la règle à supprimer" }
      },
      required: ["id"]
    }
  },
  {
    name: "update_prompt_section",
    description: "Modifier chirurgicalement une section d'un prompt AI. Format diff : old_text → new_text. Nécessite approbation utilisateur.",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt_key: { type: "string", description: "Clé du prompt (ex: ai_prompt_estimateur)" },
        old_text: { type: "string", description: "Texte exact à remplacer (doit exister dans le prompt)" },
        new_text: { type: "string", description: "Nouveau texte de remplacement" },
        reason: { type: "string", description: "Raison courte de la modification" }
      },
      required: ["prompt_key", "old_text", "new_text", "reason"]
    }
  },
  {
    name: "log_prompt_change",
    description: "Logger automatiquement un changement de prompt dans prompt_change_log. Auto-exécuté après update_prompt_section.",
    input_schema: {
      type: "object" as const,
      properties: {
        prompt_key: { type: "string" },
        section: { type: "string" },
        reason: { type: "string" }
      },
      required: ["prompt_key", "reason"]
    }
  }
];

// Read-only tools that are auto-executed server-side
const READ_ONLY_TOOLS = ["list_learnings", "read_prompt", "list_all_prompts"];

serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
  }

  let auth;
  try {
    auth = await verifyJWT(req);
  } catch (err) {
    return authErrorResponse(err as Error, req);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { messages, page_context } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages array required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Extract last user message for context filtering
  let lastUserMsg = "";
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      const c = messages[i].content;
      lastUserMsg = typeof c === "string" ? c : (Array.isArray(c) ? c.map((b: any) => b.text || "").join(" ") : "");
      break;
    }
  }

  const [docs, learnings] = await Promise.all([
    loadMasterDocs(supabase),
    loadLearnings(supabase),
  ]);

  // Build system prompt with page context
  let systemPrompt = buildSystemPrompt(docs, learnings, lastUserMsg);

  // Inject page context if present
  if (page_context) {
    systemPrompt += "\n\n--- CONTEXTE PAGE COURANTE ---\n" + JSON.stringify(page_context, null, 2);
  }

  // Filter empty messages
  const cleanMessages = messages.filter((m: any) => {
    if (!m.content) return false;
    if (typeof m.content === "string") return m.content.trim().length > 0;
    if (Array.isArray(m.content)) return m.content.length > 0;
    return false;
  });

  // Call Anthropic API
  try {
    const apiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: systemPrompt,
        messages: cleanMessages,
        tools: TOOLS,
      }),
    });

    if (!apiResp.ok) {
      const errText = await apiResp.text();
      console.error("Anthropic API error:", apiResp.status, errText);
      if (apiResp.status === 429 || apiResp.status === 529) {
        return new Response(JSON.stringify({ error: "API busy", detail: errText }), {
          status: apiResp.status,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Anthropic API error", detail: errText }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const result = await apiResp.json();

    // Check for read-only tool calls that should be auto-executed server-side
    const toolUses = (result.content || []).filter((b: any) => b.type === "tool_use");
    const readOnlyUses = toolUses.filter((t: any) => READ_ONLY_TOOLS.includes(t.name));

    if (readOnlyUses.length > 0 && readOnlyUses.length === toolUses.length) {
      // All tools are read-only → execute server-side and loop back
      const toolResults: any[] = [];
      for (const tool of readOnlyUses) {
        let resultData: any;
        if (tool.name === "list_learnings") {
          resultData = learnings;
        } else if (tool.name === "read_prompt") {
          const key = tool.input?.prompt_key;
          if (key) {
            const { data } = await supabase
              .from("app_config")
              .select("value")
              .eq("key", key)
              .single();
            resultData = { key, value: data?.value || "(vide)", length: (data?.value || "").length };
          } else {
            resultData = { error: "prompt_key requis" };
          }
        } else if (tool.name === "list_all_prompts") {
          resultData = await loadAllPrompts(supabase);
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: JSON.stringify(resultData).slice(0, 50000),
        });
      }

      // Loop back to Anthropic with tool results
      const followUpMessages = [
        ...cleanMessages,
        { role: "assistant", content: result.content },
        { role: "user", content: toolResults },
      ];

      const followUpResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 4096,
          system: systemPrompt,
          messages: followUpMessages,
          tools: TOOLS,
        }),
      });

      if (followUpResp.ok) {
        const followUpResult = await followUpResp.json();
        return new Response(JSON.stringify({
          content: followUpResult.content,
          stop_reason: followUpResult.stop_reason,
          usage: followUpResult.usage,
        }), {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    // Return response as-is (client handles write tools with approval buttons)
    return new Response(JSON.stringify({
      content: result.content,
      stop_reason: result.stop_reason,
      usage: result.usage,
    }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("ai-master error:", err);
    return new Response(JSON.stringify({ error: "Internal error", detail: (err as Error).message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
