import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJWT, getCorsHeaders, authErrorResponse } from "../_shared/auth.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const DEFAULT_MASTER_PROMPT = `Tu es l'Agent Maître de Scopewright — un conseiller architecture et système senior.

RÔLE :
- Analyser le système Scopewright (architecture, code, configuration, prompts AI)
- Identifier incohérences, risques, bugs potentiels, opportunités d'amélioration
- Répondre aux questions techniques sur n'importe quel aspect du système
- Proposer des plans d'action concrets et priorisés

RÈGLES :
- Tu es en LECTURE SEULE — tu ne modifies rien, tu conseilles
- Tes réponses sont en français
- Sois direct et concis — pas de prose narrative
- Utilise des listes et tableaux quand c'est plus clair
- Cite les fichiers et fonctions par nom exact
- Indique le niveau de criticité (CRITIQUE / IMPORTANT / MOYEN / FAIBLE)
- Si tu identifies un risque de sécurité, mentionne l'ID d'audit correspondant (SEC-xx, BUG-xx, etc.)

CONTEXTE SYSTÈME :
Tu as accès à deux documents de référence :
1. MASTER_CONTEXT.md — synthèse complète du système (architecture, tables, agents, risques)
2. CLAUDE.md — instructions projet détaillées (conventions, patterns, systèmes)

Utilise ces documents pour répondre avec précision. Si une information n'est pas dans les documents, dis-le clairement.`;

// Load master documents from app_config
async function loadMasterDocs(supabase: any): Promise<Record<string, string>> {
  try {
    const { data } = await supabase
      .from("app_config")
      .select("key, value")
      .in("key", [
        "master_context",
        "master_claude_md",
        "ai_prompt_master"
      ]);
    if (!data) return {};
    const docs: Record<string, string> = {};
    for (const row of data) {
      if (row.value && typeof row.value === "string" && row.value.trim()) {
        docs[row.key] = row.value;
      }
    }
    return docs;
  } catch {
    return {};
  }
}

// Load organizational learnings
async function loadLearnings(supabase: any): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("ai_learnings")
      .select("rule")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(50);
    return (data || []).map((r: any) => r.rule);
  } catch {
    return [];
  }
}

function buildSystemPrompt(docs: Record<string, string>, learnings: string[]): string {
  const staticPrompt = docs["ai_prompt_master"] || DEFAULT_MASTER_PROMPT;

  const sections: string[] = [staticPrompt];

  // Inject MASTER_CONTEXT.md
  if (docs["master_context"]) {
    sections.push("\n\n--- MASTER_CONTEXT.md ---\n" + docs["master_context"]);
  }

  // Inject CLAUDE.md
  if (docs["master_claude_md"]) {
    sections.push("\n\n--- CLAUDE.md ---\n" + docs["master_claude_md"]);
  }

  // Inject learnings
  if (learnings.length > 0) {
    sections.push("\n\n--- RÈGLES ORGANISATIONNELLES APPRISES ---");
    learnings.forEach((r, i) => sections.push(`${i + 1}. ${r}`));
  }

  return sections.join("\n");
}

serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
  }

  // Authenticate
  let auth;
  try {
    auth = await verifyJWT(req);
  } catch (err) {
    return authErrorResponse(err as Error, req);
  }

  // Parse request
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { messages } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages array required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Create Supabase client
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Load docs and learnings in parallel
  const [docs, learnings] = await Promise.all([
    loadMasterDocs(supabase),
    loadLearnings(supabase),
  ]);

  const systemPrompt = buildSystemPrompt(docs, learnings);

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
      }),
    });

    if (!apiResp.ok) {
      const errText = await apiResp.text();
      console.error("Anthropic API error:", apiResp.status, errText);

      // Rate limit / overloaded → forward status
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
