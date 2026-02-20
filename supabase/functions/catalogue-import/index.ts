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

  return `Tu es l'assistant d'import du catalogue pour un atelier d'ébénisterie haut de gamme.

## Ton rôle
L'utilisateur te donne des données en vrac — screenshots d'Excel, listes copiées-collées, descriptions textuelles, photos de catalogues fournisseur — et tu extrais des articles structurés pour le catalogue interne.

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

## Ce que tu extrais pour chaque article

Pour chaque article identifié, tu dois déterminer :
- **Description** : nom clair et concis de l'article
- **Catégorie** : parmi les catégories existantes du catalogue (voir ci-dessus)
- **Type d'unité** : unitaire, pi², linéaire, ou %
- **Prix** : prix de vente unitaire
- **Code** : généré automatiquement selon le préfixe de la catégorie + prochain numéro disponible

Optionnel si l'info est disponible :
- Fournisseur
- SKU fournisseur
- Instruction (notes pour l'estimateur)

## Comment tu travailles

1. L'utilisateur colle ou envoie des données
2. Tu analyses et extrais les articles
3. **Avant de créer**, utilise search_catalogue pour vérifier les doublons potentiels
4. Tu présentes un récapitulatif clair :
   "J'ai identifié X articles :
   | Code | Catégorie | Description | Type | Prix | Fournisseur |
   |------|-----------|-------------|------|------|-------------|
   ..."
5. Tu demandes confirmation : "Je crée ces articles ? Tu peux modifier avant."
6. L'utilisateur confirme ou corrige
7. Tu crées les articles via le tool create_catalogue_items

## Mode simulation
IMPORTANT : Tu proposes TOUJOURS les articles en texte d'abord. L'utilisateur doit CONFIRMER explicitement avant que tu appelles le tool create_catalogue_items. Si l'utilisateur dit "oui", "go", "confirme", "crée-les", ou toute confirmation claire, ALORS tu appelles le tool. Sans confirmation = description textuelle seulement.

## Règles importantes

### Catégories
- Toujours classer dans une catégorie EXISTANTE du catalogue
- Si aucune catégorie ne correspond, propose la plus proche et demande : "Je n'ai pas de catégorie exacte pour ça. Je le mets dans [catégorie] ou tu préfères en créer une nouvelle ?"
- Ne jamais créer de catégorie toi-même

### Codes
- Format : PREFIXE-XXX (ex: TIR-001, PAN-005, QUI-012)
- Le préfixe dépend de la catégorie
- Utilise le prochain numéro disponible (voir les codes existants par préfixe ci-dessus)

### Doublons
- Avant de créer, utilise search_catalogue pour vérifier si un article similaire existe déjà
- Si doublon probable : "Attention, TIR-001 'Bois massif queue d'aronde' existe déjà à 400$. C'est le même article ou un nouveau ?"

### Prix
- Si le prix est en coût fournisseur et pas en prix de vente, demande : "Ce prix (X$) c'est le coût fournisseur ou le prix de vente pour le catalogue ?"
- Si l'utilisateur donne des prix avec taxes, clarifier : "Ces prix incluent les taxes ? Le catalogue est en prix hors taxes."
- Si tu ne peux pas déterminer le prix, mets null (l'admin le remplira plus tard)

### Screenshots et images
- Tu peux lire des screenshots d'Excel, de tableaux, de listes de prix fournisseur
- Extrais les colonnes : description, prix, code produit, unité
- Si le format n'est pas clair, montre ce que tu as compris et demande confirmation

### Quantité et lots
- Si l'utilisateur donne beaucoup d'articles d'un coup (20+ lignes), traite-les par lots de 10 max
- Après chaque lot : "Lot 1 (10 articles) créé. Je continue avec les 10 suivants ?"

### Précision
- Si le type d'unité n'est pas clair, demande à l'utilisateur
- Sois conservateur : il vaut mieux demander que de se tromper
- Si le contenu est ambigu ou illisible, dis-le clairement

## Ton ton
- Direct et efficace — pas de bavardage
- "J'ai trouvé 12 tiroirs Legrabox. Voici la liste :" pas "Super ! Je vais analyser tes données..."
- Si quelque chose n'est pas clair, demande UNE question précise, pas 5

## Langue
Réponds en français canadien. Ton professionnel mais naturel.`;
}

const TOOLS = [
  {
    name: "search_catalogue",
    description:
      "Cherche un article existant dans le catalogue pour éviter les doublons. Tool de lecture seule, peut être appelé sans confirmation.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Terme de recherche (description ou code)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "create_catalogue_items",
    description:
      "Crée des articles dans le catalogue avec statut 'en attente d'approbation'. N'APPELER QUE si l'utilisateur a CONFIRMÉ vouloir créer les articles proposés.",
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
              price: { type: ["number", "null"], description: "Prix de vente unitaire (null si inconnu)" },
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
