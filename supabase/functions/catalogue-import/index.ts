import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyJWT, getCorsHeaders, authErrorResponse } from "../_shared/auth.ts";

// ═══════════════════════════════════════════════════════════════════════
// DEFAULT STATIC PROMPT — Single editable block, stored in app_config
// key: ai_prompt_catalogue_import
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_STATIC_PROMPT = `Tu es l'assistant d'import du catalogue pour un atelier d'ébénisterie haut de gamme.

## Ton rôle
L'utilisateur te donne des données en vrac — screenshots d'Excel, listes copiées-collées, descriptions textuelles, photos de catalogues fournisseur — et tu extrais des articles structurés pour le catalogue interne.

## Ce que tu extrais pour chaque article

Pour chaque article identifié, tu dois déterminer :
- **Description** : nom clair et concis de l'article
- **Catégorie** : parmi les catégories existantes du catalogue (voir contexte)
- **Type d'unité** : unitaire, pi², pied_lineaire, ou autre selon le contexte
- **Code** : généré automatiquement selon le préfixe de la catégorie + prochain numéro disponible

Et le **PRIX COMPOSÉ** qui se divise en deux volets :

### Minutes main-d'œuvre (par département)
Les départements sont ceux listés dans les taux horaires (voir contexte). Les plus courants :
- Gestion/dessin, Coupe/edge, Assemblage, Machinage, Sablage, Peinture, Installation

### Coûts matériaux (par catégorie de dépense)
Les catégories de dépenses sont listées dans le contexte. Exemples : Quincaillerie, Panneau mélamine, Panneau MDF, Bois brut, Finition, etc.

Important : la liste des catégories de dépenses est chargée dynamiquement du contexte. Utilise SEULEMENT les catégories qui existent dans le système.

Optionnel si l'info est disponible :
- Fournisseur + SKU fournisseur + coût (composante fournisseur)
- Instruction (notes pour l'estimateur)
- Texte présentation client (fragment de phrase pour la soumission, minuscule, pas de point)

## Comment tu travailles

1. L'utilisateur colle ou envoie des données
2. Tu analyses et extrais les articles
3. **Avant de créer**, utilise search_catalogue pour vérifier les doublons potentiels
4. Tu présentes un récapitulatif clair :
   "J'ai identifié X articles :
   1. [CODE] Description — Type
      MO: Gestion 5min, Assemblage 10min
      Mat: Quincaillerie 12.50$
   2. [CODE] Description — Type
      MO: Gestion 3min, Coupe 8min
      Mat: Panneau mélamine 5.00$
   ..."
5. Tu demandes confirmation : "Je crée ces articles ? Tu peux modifier avant."
6. L'utilisateur confirme ou corrige
7. Tu crées les articles via le tool create_catalogue_item

## Mode simulation
IMPORTANT : Tu proposes TOUJOURS les articles en texte d'abord. L'utilisateur doit CONFIRMER explicitement avant que tu appelles un tool de modification (create, update, delete). Si l'utilisateur dit "oui", "go", "confirme", "crée-les", ou toute confirmation claire, ALORS tu appelles le tool. Sans confirmation = description textuelle seulement.

## Règles importantes

### Catégories
- Toujours classer dans une catégorie EXISTANTE du catalogue
- Si aucune catégorie ne correspond, propose la plus proche et demande : "Je n'ai pas de catégorie exacte pour ça. Je le mets dans [catégorie] ou tu préfères en créer une nouvelle ?"
- Ne jamais créer de catégorie toi-même

### Codes
- Format : PREFIXE-XXX (ex: TIR-001, PAN-005, QUI-012)
- Le préfixe dépend de la catégorie
- Utilise le prochain numéro disponible (voir les codes existants dans le contexte)

### Doublons
- Avant de créer, vérifie si un article similaire existe déjà dans le catalogue
- Si doublon probable : "Attention, TIR-001 'Bois massif queue d'aronde' existe déjà à 400$. C'est le même article ou un nouveau ?"

### Prix composé et prix de vente
- Le prix de vente est CALCULÉ automatiquement : (minutes × taux horaire) + (matériaux × (1 + markup + waste))
- Ne JAMAIS demander le prix de vente — remplis les minutes et matériaux, le système calcule
- Si l'utilisateur donne un prix de vente sans détails, demande : "Tu as le détail des minutes et matériaux ? Le prix de vente se calcule automatiquement à partir du prix composé."
- Si l'utilisateur insiste pour donner juste un prix global sans détails, mets tout dans la catégorie matériaux la plus logique et 0 minutes — l'admin complétera
- Si le prix est en coût fournisseur, demande : "Ce prix (X$) c'est le coût fournisseur ou le prix de vente ?"
- Si l'utilisateur donne des prix avec taxes, clarifier : "Ces prix incluent les taxes ? Le catalogue est en prix hors taxes."

### Champs optionnels mais importants
- **Instruction** : notes internes pour l'estimateur (ex: "Vérifier disponibilité avant de proposer")
- **Texte présentation client** : fragment de phrase pour la soumission client (ex: "tiroirs en érable massif à queues d'aronde"). Minuscule, pas de point.
- **Article par défaut ★** : si l'utilisateur dit "c'est notre go-to" ou "celui qu'on utilise toujours", mettre is_default: true
- **Composantes fournisseur** : si l'utilisateur donne un fournisseur + SKU + coût, les stocker comme composante

### Screenshots et images
- Tu peux lire des screenshots d'Excel, de tableaux, de listes de prix fournisseur
- Extrais les colonnes : description, prix, code produit, unité
- Si le format n'est pas clair, montre ce que tu as compris et demande confirmation

### Quantité et lots
- Si l'utilisateur donne beaucoup d'articles d'un coup (ex: 20+ lignes d'Excel), traite-les par lots de 10 max
- Après chaque lot : "Lot 1 (10 articles) créé. Je continue avec les 10 suivants ?"

### Précision
- Si le type d'unité n'est pas clair, demande à l'utilisateur
- Sois conservateur : il vaut mieux demander que de se tromper
- Si le contenu est ambigu ou illisible, dis-le clairement

### Règles d'utilisation des tools
- **create** : toujours proposer le récapitulatif AVANT de créer. Attendre confirmation.
- **update** : toujours montrer l'ancien vs le nouveau AVANT de modifier. "TIR-001 : Assemblage 10min → 15min. Confirmer ?"
- **delete** : toujours demander confirmation explicite. "Supprimer TIR-001 'Tiroir 4x12 plaine' ? Cette action est irréversible."
- **update en lot** : si l'utilisateur dit "change tous les tiroirs de 10 à 15 minutes assemblage", lister les articles affectés et demander confirmation avant d'appliquer.

## Filtrage de la table
Quand l'utilisateur demande de chercher, filtrer, trier, ou montrer certains articles :
- TOUJOURS utiliser le tool filter_catalogue — il met à jour la table directement
- Ne JAMAIS lister les résultats dans le chat — le tool filtre la table visible
- Réponds juste un court message de confirmation : "Filtré : 11 tiroirs affichés" ou "Trié par prix décroissant"
- Si l'utilisateur dit "montre tout" ou "enlève le filtre", utilise reset: true
- Pour les articles en attente d'approbation : utilise filter_catalogue avec status: "pending"
- Pour "commence par X", "les articles en B", "montre les M" → utilise starts_with (PAS search)
- Pour "articles sans prix", "sans texte client" → utilise missing_field. Pour "articles avec image", "qui ont un fournisseur" → utilise has_field
- "avec fiche client", "qui ont une fiche" → has_field: "has_sales_sheet". "sans fiche client" → missing_field: "has_sales_sheet"
- Exemples : "montre les articles en attente" → filter_catalogue({status: "pending"}), "les tiroirs" → filter_catalogue({search: "tiroir"}), "qui commence par B" → filter_catalogue({starts_with: "B"}), "articles sans texte client" → filter_catalogue({missing_field: "client_text"}), "avec image" → filter_catalogue({has_field: "image_url"}), "les matériaux" → filter_catalogue({item_type: "materiau"}), "avec fiche client" → filter_catalogue({has_field: "has_sales_sheet"})

## Classification des articles
Chaque article est classé :
- **fabrication** : ce qu'on fabrique (caisson, panneau, filler, moulure, comptoir). A des dimensions, des règles de calcul, du temps atelier.
- **materiau** : ce qu'on utilise pour fabriquer (plywood, mélamine, placage, quincaillerie, finition). A un prix unitaire (pi², pl, unité). Est consommé par les articles fabrication.

Toujours classifier les nouveaux articles. Exemples :
- Caisson base 24" → fabrication
- Panneau MDF ¾" → materiau
- Moulure couronne → fabrication
- Charnière Blum → materiau
- Finition polyuréthane → materiau
- Comptoir → fabrication
- Placage noyer → materiau

## Format de réponse
- Quand tu listes des articles (hors filtrage), utilise TOUJOURS le format tableau markdown avec colonnes Code, Description, Prix
- NE PAS utiliser de listes à bullets pour les articles
- Les tableaux seront automatiquement convertis en cards visuelles côté client

## Mode reverse pricing (prix inversé)
Quand l'utilisateur donne un prix de vente cible (ex: "un compétiteur vend ça 485$") et veut bâtir le coûtant :
1. Utilise les barèmes de l'atelier (taux horaires, markups, waste factors) fournis dans le contexte
2. Utilise tes connaissances en ébénisterie pour proposer une répartition réaliste des minutes par département et des coûts matériaux
3. Calcule : Prix = Σ(minutes/60 × taux_horaire) + Σ(coût_mat × (1 + markup/100 + waste/100))
4. Itère avec l'utilisateur : "Avec ces minutes et matériaux, le prix calculé est 478$. Écart : -7$ (1.4%). Tu veux ajuster ?"
5. Une fois validé, crée l'article avec create_catalogue_item incluant labor_minutes et material_costs

Tu connais les temps typiques de production (coupe, assemblage, machinage, sablage, finition), les coûts matériaux courants (MDF, érable, placage, quincaillerie), et les standards industriels. Propose un point de départ réaliste, l'estimateur ajustera à sa réalité.

## Articles dormants et utilisation
- Tu as accès au tool **check_usage** pour analyser l'utilisation des articles dans les soumissions envoyées
- Modes : dormant (pas utilisé depuis N jours), never_used (jamais inclus dans une soumission envoyée), most_used (les plus populaires), by_item (stats d'un article)
- Seules les soumissions ENVOYÉES au client comptent — les brouillons sont exclus
- Si l'utilisateur demande "articles dormants", "articles jamais utilisés", "articles populaires", utilise check_usage
- Tu peux aussi combiner avec filter_catalogue pour afficher les résultats dans la table

## Audit des noms clients (présentation client)
- Tu as accès au tool **audit_client_names** pour détecter les incohérences dans les champs client_text
- Le tool regroupe les textes similaires (casse, accents, typos Levenshtein ≤ 2) et retourne les groupes avec variantes
- Chaque groupe a une forme canonique (la plus fréquente) et les variantes avec leurs articles
- Présente les groupes clairement, propose la forme canonique, et applique via update_catalogue_item après confirmation
- Modes : all (scan complet), category (filtrer par catégorie)
- Tu peux aussi auditer les descriptions internes en passant field: "description"

## Ton ton
- Direct et efficace — pas de bavardage
- "J'ai trouvé 12 tiroirs Legrabox. Voici la liste :" pas "Super ! Je vais analyser tes données..."
- Si quelque chose n'est pas clair, demande UNE question précise, pas 5

## Langue
Réponds en français canadien. Ton professionnel mais naturel.`;

// Load single prompt override from app_config
async function loadPromptOverride(supabase: any): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "ai_prompt_catalogue_import")
      .single();
    if (error || !data) return null;
    if (data.value && typeof data.value === "string" && data.value.trim()) {
      return data.value;
    }
    return null;
  } catch {
    return null;
  }
}

function buildSystemPrompt(context: any, staticOverride: string | null): string {
  // Use override or default for the static instructions
  const staticPrompt = staticOverride || DEFAULT_STATIC_PROMPT;

  // Build dynamic context
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

  // Open article context (if user has an article open in the edit modal)
  let openArticleStr = '';
  if (context.openArticle) {
    const a = context.openArticle;
    const moStr = a.labor_minutes ? Object.entries(a.labor_minutes).filter(([,v]: [string, any]) => v > 0).map(([k,v]: [string, any]) => `${k}: ${v}min`).join(', ') : 'aucune';
    const matStr = a.material_costs ? Object.entries(a.material_costs).filter(([,v]: [string, any]) => v > 0).map(([k,v]: [string, any]) => `${k}: ${v}$`).join(', ') : 'aucun';
    openArticleStr = `

## Article actuellement ouvert dans le modal
L'utilisateur a cet article ouvert. Si il dit "celui-ci", "cet article", "change le prix", etc., c'est de cet article qu'il parle.
- Code: ${a.code}
- Description: ${a.description}
- Catégorie: ${a.category}
- Type: ${a.type}
- Prix: ${a.price != null ? a.price + '$' : 'N/A'}
- MO: ${moStr}
- Mat: ${matStr}
- Instruction: ${a.instruction || 'aucune'}
- Client text: ${a.client_text || 'aucun'}
- Par défaut: ${a.is_default ? 'oui ★' : 'non'}`;
  }

  const totalItems = context.totalItems || 0;
  const pendingCount = context.pendingCount || 0;
  const approvedCount = context.approvedCount || 0;

  const usage = context.usageSummary || {};
  const usageStr = usage.neverUsed != null
    ? `\n- ${usage.neverUsed} articles jamais utilisés dans une soumission envoyée\n- ${usage.dormant60days || 0} articles dormants (pas utilisés depuis 60+ jours)\n- ${usage.activeLastMonth || 0} articles actifs (utilisés dans les 30 derniers jours)`
    : '';

  const dynamicContext = `

## Catalogue actuel
- ${totalItems} articles au total
- ${approvedCount} approuvés
- ${pendingCount} en attente d'approbation${usageStr}

## Catégories existantes
${categoriesStr || 'Aucune'}

## Codes existants par préfixe
${codesStr || 'Aucun'}

## Types d'unité disponibles
${unitTypesStr || 'pi², unitaire, linéaire, %'}

## Catégories de dépenses (matériaux)
${expStr || 'Non disponible'}

## Taux horaires
${tauxStr || 'Non disponible'}${openArticleStr}`;

  return staticPrompt + dynamicContext;
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
    name: "create_catalogue_item",
    description:
      "Créer un nouvel article dans le catalogue avec statut 'à approuver'. N'APPELER QUE si l'utilisateur a CONFIRMÉ vouloir créer les articles proposés.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Code article (ex: TIR-001). Généré auto si non fourni." },
        category: { type: "string", description: "Catégorie du catalogue" },
        item_type: { type: "string", enum: ["fabrication", "materiau"], description: "Classification: fabrication (ce qu'on fabrique) ou materiau (ce qu'on utilise pour fabriquer)" },
        description: { type: "string", description: "Nom/description de l'article" },
        unit_type: { type: "string", description: "Type d'unité : pi², unitaire, linéaire, %" },
        instruction: { type: "string", description: "Notes internes pour l'estimateur (optionnel)" },
        client_text: { type: "string", description: "Fragment de texte pour la présentation client. Minuscule, pas de point. Ex: 'tiroirs en érable massif à queues d'aronde' (optionnel)" },
        is_default: { type: "boolean", description: "Article par défaut ★ de l'atelier (optionnel, default false)" },
        visible_calculator: { type: "boolean", description: "Visible dans le calculateur (optionnel, default true)" },
        has_sales_sheet: { type: "boolean", description: "Ce produit a une fiche de vente (optionnel, default false)" },
        labor_minutes: {
          type: "object",
          description: "Minutes main-d'œuvre par département. Seuls les départements avec des minutes > 0 sont nécessaires. Les clés sont les noms des départements tels qu'ils existent dans les taux horaires.",
          additionalProperties: { type: "number" },
        },
        material_costs: {
          type: "object",
          description: "Coûts matériaux par catégorie de dépense. Seules les catégories avec un coût > 0 sont nécessaires. Les clés sont les noms des catégories telles qu'elles existent dans le système.",
          additionalProperties: { type: "number" },
        },
        supplier_components: {
          type: "array",
          description: "Composantes fournisseur (optionnel)",
          items: {
            type: "object",
            properties: {
              supplier_name: { type: "string", description: "Nom du fournisseur" },
              supplier_sku: { type: "string", description: "Code/SKU fournisseur" },
              cost: { type: "number", description: "Coût unitaire" },
              category: { type: "string", description: "Catégorie de dépense matériaux" },
            },
          },
        },
      },
      required: ["code", "category", "description", "unit_type"],
    },
  },
  {
    name: "update_catalogue_item",
    description:
      "Modifier un article existant dans le catalogue. Toujours montrer l'ancien vs le nouveau AVANT de modifier et attendre confirmation.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Code de l'article à modifier" },
        updates: {
          type: "object",
          description: "Champs à modifier. Seuls les champs présents sont mis à jour, les autres restent inchangés.",
          properties: {
            description: { type: "string" },
            category: { type: "string" },
            item_type: { type: "string", enum: ["fabrication", "materiau"] },
            unit_type: { type: "string" },
            instruction: { type: "string" },
            client_text: { type: "string" },
            is_default: { type: "boolean" },
            visible_calculator: { type: "boolean" },
            labor_minutes: { type: "object", additionalProperties: { type: "number" } },
            material_costs: { type: "object", additionalProperties: { type: "number" } },
          },
        },
      },
      required: ["code", "updates"],
    },
  },
  {
    name: "delete_catalogue_item",
    description:
      "Supprimer un article du catalogue. Toujours demander confirmation explicite avant de supprimer. Cette action est irréversible.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Code de l'article à supprimer" },
      },
      required: ["code"],
    },
  },
  {
    name: "filter_catalogue",
    description:
      "Filtrer et trier la table du catalogue. Tool de lecture seule — s'exécute immédiatement sans confirmation. Utilise ce tool quand l'utilisateur demande de chercher, filtrer, trier ou montrer certains articles dans la table.",
    input_schema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Terme de recherche textuel (cherche dans code, description, catégorie)" },
        starts_with: { type: "string", description: "Filtrer les articles dont le code OU la description commence par cette lettre/préfixe (ex: 'A', 'BUD')" },
        category: { type: "string", description: "Filtrer par catégorie exacte" },
        status: { type: "string", enum: ["pending", "approved"], description: "Filtrer par statut d'approbation" },
        item_type: { type: "string", enum: ["fabrication", "materiau"], description: "Filtrer par classification (fabrication = ce qu'on fabrique, materiau = ce qu'on utilise)" },
        has_field: { type: "string", enum: ["price", "client_text", "instruction", "image_url", "labor_minutes", "material_costs", "supplier_name", "has_sales_sheet"], description: "Garder les articles où ce champ est rempli (non vide/non null/true)" },
        missing_field: { type: "string", enum: ["price", "client_text", "instruction", "image_url", "labor_minutes", "material_costs", "supplier_name", "has_sales_sheet"], description: "Garder les articles où ce champ est vide/null/0/false" },
        sort_by: { type: "string", enum: ["code", "description", "type", "price"], description: "Colonne de tri" },
        sort_dir: { type: "string", enum: ["asc", "desc"], description: "Direction du tri" },
        reset: { type: "boolean", description: "Remettre la table à son état initial (enlever tous les filtres AI)" },
      },
    },
  },
  {
    name: "check_usage",
    description:
      "Vérifie l'utilisation des articles du catalogue dans les soumissions envoyées aux clients. Tool de lecture seule — s'exécute immédiatement sans confirmation. Utilise ce tool pour identifier les articles dormants, jamais utilisés, ou les plus populaires.",
    input_schema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["dormant", "never_used", "most_used", "by_item"],
          description: "Mode de recherche : dormant = pas utilisé depuis N jours, never_used = jamais utilisé dans une soumission envoyée, most_used = les plus utilisés, by_item = stats d'un article spécifique",
        },
        days_threshold: {
          type: "number",
          description: "Seuil en jours pour le mode 'dormant' (ex: 60 = pas utilisé depuis 60 jours). Défaut: 60.",
        },
        catalogue_item_id: {
          type: "string",
          description: "Code de l'article pour le mode 'by_item' (ex: TIR-001)",
        },
        category: {
          type: "string",
          description: "Filtrer par catégorie (optionnel, applicable à tous les modes sauf by_item)",
        },
        limit: {
          type: "number",
          description: "Nombre max de résultats (défaut: 20)",
        },
      },
      required: ["mode"],
    },
  },
  {
    name: "audit_client_names",
    description:
      "Scanne les noms de présentation client (client_text) du catalogue pour détecter les incohérences : variations de casse, accents manquants, typos. Tool de lecture seule — s'exécute immédiatement sans confirmation. Retourne les groupes de textes similaires avec variantes.",
    input_schema: {
      type: "object",
      properties: {
        field: {
          type: "string",
          enum: ["client_text", "description"],
          description: "Champ à auditer. Défaut: client_text",
        },
        category: {
          type: "string",
          description: "Filtrer par catégorie (optionnel)",
        },
      },
    },
  },
];

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    // Verify JWT signature cryptographically
    try {
      await verifyJWT(req);
    } catch (err) {
      return authErrorResponse(err as Error, req);
    }

    // Create Supabase client with the original token (RLS needs it)
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { messages, context } = await req.json();

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "No messages provided" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Load single prompt override from app_config (fallback to default if missing)
    const staticOverride = await loadPromptOverride(supabase);

    const systemPrompt = buildSystemPrompt(context || {}, staticOverride);

    const body: any = {
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages,
      tools: TOOLS,
      stream: true,
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

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: "Anthropic API error: " + resp.status + " " + errText }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Relay SSE stream from Anthropic to client
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ") || line.startsWith("event: ")) {
              await writer.write(encoder.encode(line + "\n"));
            } else if (line.trim() === "") {
              await writer.write(encoder.encode("\n"));
            }
          }
        }
        if (buffer.trim()) {
          await writer.write(encoder.encode(buffer + "\n\n"));
        }
      } catch (e) {
        // Stream error — write error event
        await writer.write(encoder.encode("data: " + JSON.stringify({ type: "error", error: { message: (e as Error).message } }) + "\n\n"));
      } finally {
        writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        ...cors,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});

