import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Verify JWT via Supabase Auth (algorithm-agnostic, survives key rotations)
async function verifyAuth(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );
  const { error } = await supabase.auth.getUser();
  if (error) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null; // Auth OK
}

function buildSystemPrompt(context: any): string {
  const categoriesStr = (context.categories || []).join(", ");

  const codesStr = Object.entries(context.existingCodes || {})
    .map(([prefix, nums]: [string, any]) => `${prefix}: ${(nums as string[]).join(", ")}`)
    .join("\n");

  const unitTypesStr = (context.unitTypes || []).join(", ");

  const expStr = (context.expenseCategories || [])
    .map((c: any) => `${c.name}: markup ${c.markup}%, perte ${c.waste}%`)
    .join(", ");

  const tauxStr = (context.tauxHoraires || [])
    .map((t: any) => `${t.department}: ${t.taux_horaire}$/h`)
    .join(", ");

  return `Tu es l'assistant d'importation du catalogue Stele. Ton rôle est d'extraire des articles de catalogue à partir de texte, screenshots (Excel, PDF, listes) ou descriptions en vrac.

## Catégories existantes
${categoriesStr || 'Aucune'}

## Codes existants par préfixe
${codesStr || 'Aucun'}

## Types d'unité disponibles
${unitTypesStr || 'pi², unitaire, linéaire, %'}

## Catégories de dépenses (matériaux)
${expStr || 'Non disponible'}

## Taux horaires
${tauxStr || 'Non disponible'}

## Règles d'extraction

1. **Analyse le contenu** fourni (texte, screenshot, image) et identifie les articles potentiels
2. **Propose** les articles sous forme de tableau markdown AVANT toute action
3. **Attends la confirmation** explicite de l'utilisateur avant d'appeler le tool
4. Pour chaque article, détermine :
   - **category** : utilise une catégorie existante si possible, sinon propose-en une nouvelle
   - **id** (code) : auto-incrémente à partir du dernier code connu pour le préfixe. Si nouvelle catégorie, génère un préfixe de 3 lettres (ex: "Quincaillerie" → "QUI-001")
   - **description** : description claire et concise en français
   - **type** : pi² | unitaire | linéaire | %
   - **price** : prix unitaire extrait ou estimé (si le prix est clairement indiqué, utilise-le ; sinon mets null)
   - **instruction** : note d'utilisation pour l'estimateur (optionnel)
   - **supplier_name** : nom du fournisseur si identifiable (optionnel)
   - **supplier_sku** : code/SKU fournisseur si identifiable (optionnel)

## Format de proposition
Quand tu proposes des articles, utilise ce format :
| Code | Catégorie | Description | Type | Prix | Fournisseur |
|------|-----------|-------------|------|------|-------------|
| QUI-001 | Quincaillerie | Charnière 110° | unitaire | 12.50$ | Blum |

Puis demande : "Voulez-vous que je crée ces X articles ?"

## Mode simulation
IMPORTANT : Tu proposes TOUJOURS les articles en texte d'abord. L'utilisateur doit CONFIRMER explicitement avant que tu appelles le tool create_catalogue_items. Si l'utilisateur dit "oui", "go", "confirme", "crée-les", ou toute confirmation claire, ALORS tu appelles le tool.

## Précision
- Si tu ne peux pas déterminer le prix, mets null (l'admin le remplira plus tard)
- Si le type d'unité n'est pas clair, demande à l'utilisateur
- Sois conservateur : il vaut mieux demander que de se tromper
- Si le contenu est ambigu ou illisible, dis-le clairement

## Langue
Réponds en français canadien. Ton professionnel mais naturel.`;
}

const TOOLS = [
  {
    name: "create_catalogue_items",
    description:
      "Crée des articles dans le catalogue avec statut 'en attente'. N'APPELER QUE si l'utilisateur a CONFIRMÉ vouloir créer les articles proposés.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Liste des articles à créer",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Code de l'article (ex: BUD-008)" },
              category: { type: "string", description: "Catégorie du catalogue" },
              description: { type: "string", description: "Description de l'article" },
              type: { type: "string", enum: ["pi²", "unitaire", "linéaire", "%"], description: "Type d'unité" },
              price: { type: ["number", "null"], description: "Prix unitaire (null si inconnu)" },
              instruction: { type: "string", description: "Note d'utilisation pour l'estimateur" },
              supplier_name: { type: "string", description: "Nom du fournisseur" },
              supplier_sku: { type: "string", description: "Code/SKU fournisseur" },
            },
            required: ["id", "category", "description", "type"],
          },
        },
      },
      required: ["items"],
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authErr = await verifyAuth(req);
    if (authErr) return authErr;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages, context } = await req.json();

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "No messages provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = buildSystemPrompt(context || {});

    const body: any = {
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages,
      tools: TOOLS,
    };

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json();

    if (data.error) {
      return new Response(
        JSON.stringify({ error: data.error.message || JSON.stringify(data.error) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        content: data.content,
        stop_reason: data.stop_reason,
        usage: data.usage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
