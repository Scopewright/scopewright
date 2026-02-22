import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Verify JWT via Supabase Auth (algorithm-agnostic, survives key rotations)
async function verifyAuth(req: Request): Promise<{ supabase: any; error: Response | null }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { supabase: null, error: new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    }) };
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );
  const { error } = await supabase.auth.getUser();
  if (error) {
    return { supabase: null, error: new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    }) };
  }
  return { supabase, error: null };
}

// Load prompt overrides from app_config (fallback to hardcoded defaults if missing)
async function loadPromptOverrides(supabase: any): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase
      .from("app_config")
      .select("key, value")
      .in("key", [
        "ai_prompt_fiche_optimize", "ai_prompt_fiche_translate_fr_en", "ai_prompt_fiche_translate_en_fr",
        "ai_prompt_client_text_catalogue", "ai_prompt_explication_catalogue",
        "ai_prompt_json_catalogue", "ai_prompt_pres_rule", "ai_prompt_calc_rule",
        "ai_prompt_description_calculateur", "ai_prompt_import_components"
      ]);
    if (error || !data) return {};
    const overrides: Record<string, string> = {};
    for (const row of data) {
      if (row.value && typeof row.value === "string" && row.value.trim()) {
        overrides[row.key] = row.value;
      }
    }
    return overrides;
  } catch {
    return {};
  }
}

const OPTIMIZE_SYSTEM = `Tu fais du nettoyage technique + mise au format Stele pour des descriptions de meubles d'ébénisterie sur mesure. PAS de réécriture stylistique. Tu retournes du HTML formaté.

FORMAT HTML OBLIGATOIRE :
- Chaque catégorie principale en <strong> suivi du texte sur la même ligne : <p><strong>Caisson :</strong> ME1</p>
- Les catégories possibles : Caisson, Façades et panneaux apparents, Tiroirs Legrabox, Poignées, Détails, Exclusions (et autres si pertinent)
- Détails : <p><strong>Détails :</strong></p> suivi d'une liste <ul><li>...</li></ul>
- Exclusions : <p><strong>Exclusions :</strong> texte sur la même ligne</p> — JAMAIS de puces
- Paragraphes informatifs sans catégorie : <p>texte</p>
- NE PAS utiliser <h1>, <h2>, <h3> — uniquement <p>, <strong>, <ul>, <li>
- NE PAS envelopper dans <div> ou <html> ou <body>

CORRECTIONS :
- Orthographe, accents, pluriels, concordances simples
- Typo technique (½, 1 ¼", po, pi, etc.)
- Garder le ton original, la logique, la façon de structurer
- Clarifier SEULEMENT si une phrase est ambiguë, un mot essentiel manque, ou incohérence technique évidente

RÈGLES STRICTES :
- Pas de puces dans Exclusions
- Pas de reformulation marketing
- Pas de ton artificiel
- Pas de créativité non demandée
- Ne pas inventer de contenu`;

const TRANSLATE_SYSTEM = `You are a professional translator for Stele, a high-end custom cabinetry company. Translate French to English. Keep the same professional tone, be concise. If the text contains HTML tags, preserve ALL HTML tags and structure exactly — only translate the text content inside the tags.`;

const TRANSLATE_EN_TO_FR_SYSTEM = `You are a professional translator for Scopewright, a premium estimation platform for high-end cabinetry and millwork shops. Translate English to French (Canadian French). Keep the same professional tone, be concise. Preserve any HTML tags exactly — only translate the text content.`;

const CATALOGUE_CLIENT_TEXT_SYSTEM = `Tu es un rédacteur technique pour Stele, un atelier d'ébénisterie haut de gamme sur mesure.
Tu reçois la description interne d'un article du catalogue et tu dois rédiger un fragment de texte de présentation client.

RÈGLES :
- Fragment de phrase (pas une phrase complète) — commence en minuscule, pas de point final
- Ton professionnel et concis — pas de marketing, pas d'adjectifs superflus
- Inclure les informations techniques pertinentes (matériau, finition, mécanisme)
- Exemples : "placage de chêne blanc FC, laque au polyuréthane clair", "tiroirs Legrabox à fermeture douce"
- Si le texte existant est fourni, corrige l'orthographe et améliore la clarté sans changer le sens

ENVELOPPE DE RÉPONSE OBLIGATOIRE (JSON) :
{
  "status": "ok" | "needs_review" | "error",
  "warnings": [],
  "text": "le fragment de texte client"
}
- "ok" : résultat fiable, aucun doute
- "needs_review" : résultat généré mais doutes (données ambiguës, infos manquantes, incertitude)
- "error" : impossible de générer un résultat valide
- "warnings" : max 3 messages courts en français expliquant les doutes
- Retourne UNIQUEMENT le JSON valide, sans markdown, sans backticks`;

const CATALOGUE_EXPLICATION_SYSTEM = `Tu es un spécialiste en documentation technique pour Stele, atelier d'ébénisterie haut de gamme.
Tu rédiges ou améliores l'explication technique (champ presentation_rule_human) d'un article du catalogue.

RÔLE DE CE CHAMP :
Ce texte explique à l'AI comment présenter cet article dans une description client de soumission.
Il décrit l'ordre de mention, les préfixes, ce qu'il faut inclure ou exclure.

FORMAT :
- Phrases courtes et impératives
- Exemples : "Le matériau apparaît en premier avec le préfixe 'en'.", "Ne pas mentionner les pattes ni la bande de chant au client."
- Si du texte existe déjà, améliore la clarté et la structure sans inventer de contenu
- Retourne UNIQUEMENT le texte d'explication, sans commentaire externe`;

const CATALOGUE_JSON_SYSTEM = `Tu es un ingénieur de règles pour Scopewright, la plateforme d'estimation de Stele.
Tu reçois l'explication en langage naturel (calculation_rule_human) d'un article du catalogue et tu dois générer la règle structurée JSON correspondante (calculation_rule_ai).

FORMAT JSON ATTENDU :
{
  "cascade": [
    { "target": "CODE-XXX", "qty": "formula or number", "condition": "optional" }
  ],
  "ask": ["dimension1", "dimension2"],
  "notes": "optional notes for the AI"
}

RÈGLES :
- "cascade" : articles auto-ajoutés quand cet article est sélectionné
- "qty" peut être un nombre fixe (ex: 4) ou une formule (ex: "ceil(L/24)")
- "condition" : condition optionnelle (ex: "H > 24")
- Les codes articles doivent correspondre à des codes existants du catalogue
- Si l'explication mentionne des articles sans code, utilise un placeholder "[CODE]"
- Retourne UNIQUEMENT le JSON valide, sans markdown, sans backticks`;

const CALCULATEUR_DESCRIPTION_SYSTEM = `Tu es un rédacteur technique pour Stele, un atelier d'ébénisterie haut de gamme sur mesure au Québec.
Tu rédiges ou améliores les descriptions client des pièces/meubles dans les soumissions.

FORMAT HTML OBLIGATOIRE :
- Chaque catégorie en <strong> suivi du texte : <p><strong>Caisson :</strong> ME1</p>
- Catégories : Caisson, Façades et panneaux apparents, Tiroirs Legrabox, Poignées, Détails, Exclusions
- Détails : <p><strong>Détails :</strong></p> suivi de <ul><li>...</li></ul>
- Exclusions : <p><strong>Exclusions :</strong> texte</p> — JAMAIS de puces
- Uniquement <p>, <strong>, <ul>, <li> — pas de <h1-h3>, <div>, <html>

MODE GÉNÉRATION (description vide) :
- Analyse les articles de la pièce fournis en contexte
- Utilise les client_text et presentation_rule des articles du catalogue
- Assemble une description professionnelle et structurée

MODE RÉVISION (description existante) :
- Corrige orthographe, accents, pluriels, concordances
- Améliore la structure et la clarté
- Ne change PAS le sens ni n'invente de contenu

Retourne UNIQUEMENT le HTML de la description, sans explication.`;

const IMPORT_COMPONENTS_SYSTEM = `Tu es un assistant d'import pour Stele, un atelier d'ébénisterie haut de gamme.
Tu reçois des données fournisseur (screenshot de liste de prix, photo de catalogue, ou texte en vrac) et tu extrais les composantes structurées.

ENVELOPPE DE RÉPONSE OBLIGATOIRE (JSON) :
{
  "status": "ok" | "needs_review" | "error",
  "warnings": [],
  "components": [
    {
      "supplier_name": "Nom du fournisseur (si identifiable)",
      "supplier_sku": "Code produit fournisseur",
      "description": "Description de la composante",
      "expense_category": "Catégorie de dépense la plus appropriée",
      "qty_per_unit": 1,
      "unit_cost": 12.50
    }
  ],
  "notes": "Notes optionnelles (ex: prix en USD, taxes incluses, etc.)"
}

RÈGLES :
- Extraire TOUTES les composantes visibles dans les données
- Les prix doivent être en nombres (pas de symbole $)
- Si le fournisseur est identifiable (logo, en-tête), le mettre dans supplier_name
- Si un code produit/SKU est visible, le mettre dans supplier_sku
- qty_per_unit = 1 par défaut sauf si une quantité est indiquée
- expense_category doit correspondre à une des catégories fournies dans le contexte
- "status" : "ok" si extraction fiable, "needs_review" si doutes (image floue, prix ambigus, catégories incertaines), "error" si impossible
- "warnings" : max 3 messages courts en français expliquant les doutes
- Retourne UNIQUEMENT le JSON valide, sans markdown, sans backticks`;

const CATALOGUE_PRES_RULE_SYSTEM = `Tu es un spécialiste en documentation pour Stele, atelier d'ébénisterie haut de gamme.
Tu reçois l'explication de présentation client d'un article du catalogue.
Tu dois faire DEUX choses :
1. Reformuler/corriger le texte d'explication (phrases claires, impératives, concises)
2. Générer la règle JSON structurée correspondante pour que l'AI sache comment présenter cet article

ENVELOPPE DE RÉPONSE OBLIGATOIRE (JSON) :
{
  "status": "ok" | "needs_review" | "error",
  "warnings": [],
  "explication": "Le texte d'explication reformulé et corrigé",
  "json": {
    "order": ["matériau", "finition"],
    "prefix": "en",
    "include": ["éléments à toujours mentionner"],
    "exclude": ["éléments à ne jamais mentionner"],
    "notes": "instructions supplémentaires optionnelles"
  }
}

RÈGLES :
- "order" : ordre d'apparition des éléments dans la description client
- "prefix" : mot introductif si applicable (ex: "en", "avec", "de")
- "include" : éléments à toujours mentionner au client
- "exclude" : éléments à ne jamais mentionner au client
- Le texte d'explication doit être en phrases courtes et impératives
- Le JSON doit refléter fidèlement les instructions de l'explication
- "status" : "ok" si résultat fiable, "needs_review" si doutes (données ambiguës, infos manquantes), "error" si impossible
- "warnings" : max 3 messages courts en français expliquant les doutes
- Retourne UNIQUEMENT le JSON valide, sans markdown, sans backticks`;

const CATALOGUE_CALC_RULE_SYSTEM = `Tu es un ingénieur de règles pour Scopewright, la plateforme d'estimation de Stele.
Tu reçois l'explication en langage naturel des règles de calcul d'un article du catalogue.
Tu dois faire DEUX choses :
1. Reformuler/corriger le texte d'explication (phrases claires, techniques, concises)
2. Générer la règle de calcul JSON structurée correspondante

ENVELOPPE DE RÉPONSE OBLIGATOIRE (JSON) :
{
  "status": "ok" | "needs_review" | "error",
  "warnings": [],
  "explication": "Le texte d'explication reformulé et corrigé",
  "json": {
    "cascade": [
      { "target": "CODE-XXX", "qty": "formula or number", "condition": "optional" }
    ],
    "ask": ["dimension1", "dimension2"],
    "notes": "optional notes for the AI"
  }
}

RÈGLES :
- "cascade" : articles auto-ajoutés quand cet article est sélectionné
- "qty" peut être un nombre fixe (ex: 4) ou une formule (ex: "ceil(L/24)")
- "condition" : condition optionnelle (ex: "H > 24")
- Les codes articles doivent correspondre à des codes existants du catalogue
- Si l'explication mentionne des articles sans code, utilise un placeholder "[CODE]"
- Le texte d'explication doit être clair, concis et technique
- Le JSON doit refléter fidèlement les instructions de l'explication
- "status" : "ok" si résultat fiable, "needs_review" si doutes (données ambiguës, codes inconnus, infos manquantes), "error" si impossible
- "warnings" : max 3 messages courts en français expliquant les doutes
- Retourne UNIQUEMENT le JSON valide, sans markdown, sans backticks`;

// Prompt map for action → override key + default prompt
const PROMPT_MAP: Record<string, { key: string; prompt: string }> = {
  optimize:                { key: "ai_prompt_fiche_optimize", prompt: OPTIMIZE_SYSTEM },
  translate:               { key: "ai_prompt_fiche_translate_fr_en", prompt: TRANSLATE_SYSTEM },
  en_to_fr:                { key: "ai_prompt_fiche_translate_en_fr", prompt: TRANSLATE_EN_TO_FR_SYSTEM },
  catalogue_client_text:   { key: "ai_prompt_client_text_catalogue", prompt: CATALOGUE_CLIENT_TEXT_SYSTEM },
  catalogue_explication:   { key: "ai_prompt_explication_catalogue", prompt: CATALOGUE_EXPLICATION_SYSTEM },
  catalogue_json:          { key: "ai_prompt_json_catalogue", prompt: CATALOGUE_JSON_SYSTEM },
  catalogue_pres_rule:     { key: "ai_prompt_pres_rule", prompt: CATALOGUE_PRES_RULE_SYSTEM },
  catalogue_calc_rule:     { key: "ai_prompt_calc_rule", prompt: CATALOGUE_CALC_RULE_SYSTEM },
  calculateur_description: { key: "ai_prompt_description_calculateur", prompt: CALCULATEUR_DESCRIPTION_SYSTEM },
  import_components:       { key: "ai_prompt_import_components", prompt: IMPORT_COMPONENTS_SYSTEM },
};

// Retry fetch with exponential backoff for overloaded (529) and rate limit (429)
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, options);
    if (resp.status === 529 || resp.status === 429) {
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000); // 1s, 2s, 4s, 8s
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
    }
    return resp;
  }
  // Should never reach here, but TypeScript needs it
  throw new Error("Max retries exceeded");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify JWT via Supabase Auth (not signature-based — survives key rotations)
    const { supabase, error: authErr } = await verifyAuth(req);
    if (authErr) return authErr;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { texts, action = "translate", images } = await req.json();

    if (!texts || texts.length === 0) {
      return new Response(JSON.stringify({ translations: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nonEmpty = texts.filter(
      (t: { key: string; text: string }) => t.text && t.text.trim()
    );
    if (nonEmpty.length === 0) {
      return new Response(JSON.stringify({ translations: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load prompt overrides from app_config (fallback to hardcoded defaults)
    const overrides = await loadPromptOverrides(supabase);
    const mapping = PROMPT_MAP[action] || PROMPT_MAP.translate;
    const systemPrompt = overrides[mapping.key] || mapping.prompt;

    // Use Sonnet for JSON generation and vision tasks, Haiku for the rest (speed)
    const SONNET_ACTIONS = ["catalogue_json", "catalogue_pres_rule", "catalogue_calc_rule", "import_components"];
    const model = SONNET_ACTIONS.includes(action)
      ? "claude-sonnet-4-20250514"
      : "claude-haiku-4-5-20251001";

    const apiHeaders = {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    };

    // For single text: simpler prompt, no JSON wrapping needed
    if (nonEmpty.length === 1) {
      const userMsg =
        action === "optimize"
          ? `Optimise ce texte. Retourne UNIQUEMENT le texte optimisé, sans explication, sans markdown :\n\n${nonEmpty[0].text}`
          : action === "en_to_fr"
          ? `Translate this English text to French (Canadian French). Return ONLY the translated text, no explanation, no markdown:\n\n${nonEmpty[0].text}`
          : action === "catalogue_client_text"
          ? `Voici les détails de l'article.\n\n${nonEmpty[0].text}\n\nRetourne UNIQUEMENT le fragment de texte client.`
          : action === "catalogue_explication"
          ? `Voici les détails de l'article.\n\n${nonEmpty[0].text}\n\nRetourne UNIQUEMENT le texte d'explication.`
          : action === "catalogue_json"
          ? `Voici l'explication de l'article.\n\n${nonEmpty[0].text}\n\nRetourne UNIQUEMENT le JSON valide.`
          : action === "catalogue_pres_rule"
          ? `Voici les détails de l'article.\n\n${nonEmpty[0].text}\n\nReformule l'explication et génère le JSON de règle de présentation. Retourne UNIQUEMENT le JSON valide.`
          : action === "catalogue_calc_rule"
          ? `Voici l'explication de l'article.\n\n${nonEmpty[0].text}\n\nReformule l'explication et génère le JSON de règle de calcul. Retourne UNIQUEMENT le JSON valide.`
          : action === "calculateur_description"
          ? nonEmpty[0].text
          : action === "import_components"
          ? `Extrais les composantes fournisseur depuis les données ci-dessous (texte et/ou image jointe).\n\n${nonEmpty[0].text}\n\nRetourne UNIQUEMENT le JSON valide.`
          : `Translate this French text to English. Return ONLY the translated text, no explanation, no markdown:\n\n${nonEmpty[0].text}`;

      // Build multimodal content when images are provided (for import_components with vision)
      let userContent: any = userMsg;
      if (images && Array.isArray(images) && images.length > 0) {
        const contentParts: any[] = [];
        for (const img of images) {
          if (img.media_type && img.data) {
            contentParts.push({
              type: "image",
              source: { type: "base64", media_type: img.media_type, data: img.data }
            });
          }
        }
        contentParts.push({ type: "text", text: userMsg });
        userContent = contentParts;
      }

      // Actions that require strict JSON output: use assistant prefill to force JSON
      const JSON_ACTIONS = ["catalogue_client_text", "catalogue_pres_rule", "catalogue_calc_rule", "import_components"];
      const useJsonPrefill = JSON_ACTIONS.includes(action);
      const messages: any[] = [{ role: "user", content: userContent }];
      if (useJsonPrefill) {
        messages.push({ role: "assistant", content: "{" });
      }

      const resp = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          model: model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: messages,
        }),
      });

      const data = await resp.json();

      if (data.error) {
        return new Response(
          JSON.stringify({ error: data.error.message || JSON.stringify(data.error), debug: data }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let result = data.content?.[0]?.text || "";
      // Prepend the "{" we used as prefill so the JSON is complete
      if (useJsonPrefill) {
        result = "{" + result;
      }
      const translations: Record<string, string> = {};
      translations[nonEmpty[0].key] = result.trim();

      return new Response(JSON.stringify({ translations, debug: { model: data.model, stop_reason: data.stop_reason, result_length: result.length } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For multiple texts: use ===SEPARATOR=== delimiter instead of JSON
    const delimiter = "===SEPARATOR===";
    const numbered = nonEmpty
      .map(
        (t: { key: string; text: string }, i: number) =>
          `--- TEXT ${i} ---\n${t.text}`
      )
      .join("\n\n");

    const userMsg =
      action === "optimize"
        ? `Optimise chacun des textes suivants. Retourne les textes optimisés séparés par la ligne exacte "${delimiter}" (un par texte, même ordre). Pas de numérotation, pas de markdown, pas d'explication.\n\n${numbered}`
        : action === "en_to_fr"
        ? `Translate each of the following English texts to French (Canadian French). Return the translations separated by the exact line "${delimiter}" (one per text, same order). No numbering, no markdown, no explanation.\n\n${numbered}`
        : `Translate each of the following French texts to English. Return the translations separated by the exact line "${delimiter}" (one per text, same order). No numbering, no markdown, no explanation.\n\n${numbered}`;

    const resp = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify({
        model: model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    const data = await resp.json();

    if (data.error) {
      return new Response(
        JSON.stringify({ error: data.error.message || JSON.stringify(data.error) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const content = data.content?.[0]?.text || "";

    // Split by delimiter
    const parts = content.split(delimiter).map((s: string) => s.trim());

    const translations: Record<string, string> = {};
    nonEmpty.forEach((t: { key: string; text: string }, i: number) => {
      translations[t.key] = parts[i] || "";
    });

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
