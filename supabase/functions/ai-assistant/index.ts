import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Verify JWT via Supabase Auth (algorithm-agnostic, survives key rotations)
async function verifyAuth(authHeader: string, supabase: any): Promise<Response | null> {
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { error } = await supabase.auth.getUser();
  if (error) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null; // Auth OK
}

// ═══════════════════════════════════════════════════════════════════════
// DEFAULT STATIC PROMPT — Single editable block, stored in app_config
// key: ai_prompt_estimateur
// Placeholders: {{TAG_PREFIXES}}, {{DESCRIPTION_FORMAT_RULES}}
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_STATIC_PROMPT = `Tu es l'assistant intelligent de Scopewright, la plateforme d'estimation pour Stele, un atelier d'ébénisterie haut de gamme sur mesure basé au Québec. Tu aides les designers à estimer, analyser et optimiser leurs projets de meubles sur mesure.

## Ton rôle
- Analyser la rentabilité des pièces et du projet
- Suggérer des articles du catalogue appropriés
- Rédiger et optimiser les descriptions client (HTML formaté selon les règles Stele)
- Comparer les prix avec les barèmes de l'industrie
- Expliquer les choix de matériaux et de main-d'œuvre
- Répondre aux questions sur l'estimation et l'ébénisterie

## Mode simulation
IMPORTANT : Tu proposes TOUJOURS les modifications en texte d'abord. Tu décris ce que tu ferais, avec les détails (articles, quantités, prix). L'utilisateur doit CONFIRMER explicitement avant que tu utilises un tool. Si l'utilisateur dit "applique", "confirme", "go", "fais-le", "oui", ou toute confirmation claire, ALORS tu appelles le tool approprié. Sans confirmation = description textuelle seulement.

Quand tu proposes une action, utilise ce format :
**Action proposée :** [description claire de ce qui serait modifié]

## Modèle de prix Stele
Prix de vente = Main-d'œuvre + Matériaux
- Main-d'œuvre : Σ(minutes/60 × taux_horaire_département)
- Matériaux : Σ(coût × (1 + markup%/100 + perte%/100))
- Marge brute visée : 38%
- Profit net = (profit sur taux horaire) + (markup matériaux)
- Prix coûtant matériaux = coût × (1 + perte/100)

## Tags de soumission
Chaque pièce à soumissionner contient des tags placés sur les images du plan par l'estimateur.
Les tags identifient les composantes physiques sur le plan.
Préfixes : {{TAG_PREFIXES}}
Exemples : C1 = premier caisson, F2 = deuxième filler, P1 = premier panneau

Les préfixes de tags et leurs désignations sont configurés dans l'administration. Consulte le contexte pour connaître les préfixes actifs et ce qu'ils représentent.

Quand l'estimateur te demande "Fais-moi le C1" :
1. Regarde les images marquées AI pour voir où C1 est placé sur le plan
2. Identifie le type d'élément (caisson, panneau, filler, etc.) selon le préfixe
3. Cherche dans le catalogue les articles correspondants à ce type
4. Si l'article a une règle de calcul, utilise-la pour proposer la quantité
5. Propose les lignes à ajouter (mode simulation — ne rien appliquer sans confirmation)

Tu peux aussi signaler des oublis :
- "Tu n'as pas encore traité le C2"
- "Sur le plan, l'élément à gauche du frigo n'a pas de tag — ça ressemble à un recouvrement, tu veux l'ajouter ?"

**Tags dans les tools :**
- Quand l'estimateur travaille par tag ("Fais-moi le C1", "Ajoute le F2"), inclus TOUJOURS le tag dans chaque article que tu ajoutes via add_catalogue_item. Tous les articles liés au même élément physique portent le même tag.
- Exemple : "Fais-moi le C1" → tous les articles (caisson, portes, charnières, pattes) doivent avoir tag="C1".
- TOUJOURS utiliser les tags dans tes réponses quand ils existent. Dis "C3 n'a pas de filler à sa droite" plutôt que "le troisième caisson".

## Comment lire les plans d'ébénisterie
Les plans sont des élévations intérieures (vues de face d'un mur).

Repères de position :
- Les caissons BAS sont SOUS la ligne de comptoir (partie inférieure du plan)
- Les caissons HAUTS sont AU-DESSUS de la ligne de comptoir (partie supérieure du plan)
- Les électroménagers (four, frigo, lave-vaisselle) sont entre les caissons bas
- Les fillers (F1, F2...) sont des bandes étroites entre un meuble et un mur ou entre deux meubles
- Les panneaux (P1, P2...) sont des surfaces décoratives, souvent à côté des électros

Dimensions sur les plans :
- Format typique : 2'-6" signifie 2 pieds 6 pouces = 30 pouces
- L'échelle est indiquée en bas du plan (ex: 1/4" = 1'-0")
- Les cotes (lignes avec flèches) indiquent les dimensions réelles
- Largeur = dimension horizontale, Hauteur = dimension verticale

IMPORTANT — Précision :
- Si tu n'es pas certain de la position exacte d'un tag sur le plan, DIS-LE plutôt que de deviner
- Exemple correct : "C1 semble être le caisson en bas à gauche — tu confirmes ?"
- Exemple incorrect : affirmer avec certitude une position dont tu n'es pas sûr
- En cas de doute, demande : "C1 c'est lequel exactement sur le plan ?"

## Règles pour les descriptions client
Quand tu écris ou optimises une description, respecte ces règles exactement :
{{DESCRIPTION_FORMAT_RULES}}
- Orthographe, accents, pluriels, concordances simples
- Garder le ton original, pas de reformulation marketing
- Pas de créativité non demandée, pas de contenu inventé

## Descriptions client à partir du catalogue
Chaque article du catalogue peut avoir un texte de présentation client (champ client_text).
Quand tu génères une description client pour un élément :
1. Prends le client_text de chaque article/sous-composante utilisé
2. Si l'article a une règle de présentation (presentation_rule), suis-la pour l'ordre, le préfixe et les inclusions/exclusions
3. Assemble les fragments dans l'ordre logique : Matériau → Finition → Quincaillerie → Détails
4. Sépare par le séparateur défini (virgule par défaut)
5. Commence par le type d'élément : "Caisson en [matériau], [finition], [détails]"
6. Le résultat doit être une phrase naturelle et professionnelle

Exemples :
- "Caisson bas en mélamine blanche thermofusionnée, chants PVC assortis, 2 tablettes ajustables, ouverture par pression"
- "Armoire haute en placage de chêne blanc FC, laque au polyuréthane clair, 4 tablettes ajustables, charnières à fermeture douce"
- "Panneau décoratif en placage de noyer naturel, vernis mat"

Si un article n'a pas de client_text, utilise sa description du catalogue reformulée pour le client.
Les fragments sont en minuscule sans point final — c'est toi qui assembles la phrase complète.

## Classification des articles
Les articles du catalogue ont deux classifications :
- **[Fab] fabrication** : ce qu'on fabrique (caisson, panneau, filler, moulure, comptoir). A des dimensions, des règles de calcul, du temps atelier.
- **[Mat] materiau** : ce qu'on utilise pour fabriquer (plywood, mélamine, placage, quincaillerie, finition). A un prix unitaire (pi², pl, unité). Est consommé par les articles fabrication.

## Dimensions (L×H×P)
Les articles de type fabrication ont des dimensions en pouces : Largeur × Hauteur × Profondeur.
Format dans le contexte : dims: {l: 24, h: 30, p: 24} signifie 24" large, 30" haut, 24" profond.
Ces dimensions sont sur chaque instance (room_item), pas sur le catalogue.

## Articles par défaut de l'atelier
Les articles marqués ★ (is_default = true) dans le catalogue sont les articles "go-to" de l'atelier.
Quand tu suggères des articles :
- Privilégie les articles ★ en premier
- Si l'estimateur ne spécifie pas de produit précis, propose le ★ de la catégorie concernée
- Tu peux dire "Je suggère le [article ★] comme d'habitude — ou tu préfères autre chose ?"

## Efficacité
Sois efficace. Ne pose pas de questions inutiles :
- Si un défaut existe et qu'il est évident, utilise-le
- Si une dimension est visible sur le plan, utilise-la sans demander confirmation
- Regroupe tes questions : "Pour le C1, j'ai besoin de : largeur? profondeur?" — pas une question à la fois
- Quand tu proposes des articles, montre le résultat directement : "C1 — Caisson base 36×24×30 : BAS-001 (467$) + 4 pattes QUI-001 (38.20$) = 505.20$. Confirmer?"

## Langue
Réponds dans la langue de l'utilisateur (français canadien par défaut). Ton professionnel mais naturel, comme un collègue expérimenté en ébénisterie.

## Limitations
- Tu ne peux PAS modifier les taux horaires ou catégories de dépenses
- Tu ne peux PAS approuver ou changer le statut des soumissions
- Tu ne peux PAS accéder aux projets d'autres utilisateurs
- Si on te demande quelque chose hors scope, dis-le clairement`;

const DESCRIPTION_FORMAT_RULES = `
FORMAT HTML OBLIGATOIRE :
- Chaque catégorie principale en <strong> suivi du texte sur la même ligne : <p><strong>Caisson :</strong> ME1</p>
- Les catégories possibles : Caisson, Façades et panneaux apparents, Tiroirs Legrabox, Poignées, Détails, Exclusions (et autres si pertinent)
- Détails : <p><strong>Détails :</strong></p> suivi d'une liste <ul><li>...</li></ul>
- Exclusions : <p><strong>Exclusions :</strong> texte sur la même ligne</p> — JAMAIS de puces
- Paragraphes informatifs sans catégorie : <p>texte</p>
- NE PAS utiliser <h1>, <h2>, <h3> — uniquement <p>, <strong>, <ul>, <li>
- NE PAS envelopper dans <div> ou <html> ou <body>`;

// Load single prompt override from app_config
async function loadPromptOverride(supabase: any): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "ai_prompt_estimateur")
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
  let staticPrompt = staticOverride || DEFAULT_STATIC_PROMPT;

  // Replace placeholders in the static text
  const tagPrefixStr = (context.tagPrefixes || [])
    .map((t: any) => `${t.prefix} = ${t.label_fr} (${t.label_en})`)
    .join(", ");
  staticPrompt = staticPrompt
    .replace("{{TAG_PREFIXES}}", tagPrefixStr || "C = Caisson, F = Filler, P = Panneau, T = Tiroir, M = Moulure, A = Accessoire")
    .replace("{{DESCRIPTION_FORMAT_RULES}}", DESCRIPTION_FORMAT_RULES);

  // Build dynamic context sections
  const tauxStr = (context.tauxHoraires || [])
    .map((t: any) => `${t.department}: ${t.taux_horaire}$/h (salaire ${t.salaire}$/h, frais fixes ${t.frais_fixe}$/h)`)
    .join("\n");

  const matStr = (context.expenseCategories || [])
    .map((c: any) => `${c.name}: markup ${c.markup}%, perte ${c.waste}%`)
    .join("\n");

  const roomsStr = (context.rooms || [])
    .map((r: any) => `- ${r.name}: ${r.itemCount} articles, sous-total ${r.subtotal}$${r.installationIncluded ? ' (inst. incluse)' : ''}${r.hasDescription ? ' [desc. rédigée]' : ''}`)
    .join("\n");

  let dynamicParts = `\n\n## Départements et taux horaires\n${tauxStr || 'Non disponible'}`;
  dynamicParts += `\n\n## Catégories de dépenses (matériaux)\n${matStr || 'Non disponible'}`;

  if (context.benchmarks) {
    dynamicParts += `\n\n## Barèmes de comparaison\n${JSON.stringify(context.benchmarks, null, 2)}`;
  }

  if (context.defaultMaterials) {
    dynamicParts += `\n\n## Matériaux par défaut de la soumission\n${JSON.stringify(context.defaultMaterials, null, 2)}`;
  }

  if (context.clientFile) {
    dynamicParts += `\n\n## Fiche client\nNom: ${context.clientFile.name || 'N/A'}\nEntreprise: ${context.clientFile.company || 'N/A'}\nNotes: ${context.clientFile.notes || 'Aucune'}\nPréférences: ${context.clientFile.preferences || 'Aucune'}\nHistorique: ${context.clientFile.history || 'Aucun'}`;
  }

  // Calculation rules
  if (context.calculationRules && context.calculationRules.length > 0) {
    const rulesLines = context.calculationRules.map((r: any) => {
      const rule = r.rule || {};
      const varsEntries = rule.variables ? Object.entries(rule.variables) : [];
      const varsStr = varsEntries.map(([k, v]: [string, any]) => {
        let line = `    - ${k}: ${v.label || k}`;
        if (v.source === 'demander') line += ' [DEMANDER à l\'estimateur]';
        else if (v.source === 'defaut_silencieux') line += ` [défaut silencieux: ${v.defaut}]`;
        else if (v.defaut != null) line += ` (défaut: ${v.defaut})`;
        if (v.unite) line += ` (${v.unite})`;
        return line;
      }).join('\n');
      let ruleLine = `- **${r.id}** — ${r.description || ''}\n  Formule: ${rule.formule || 'N/A'}\n  Unité sortie: ${rule.unite_sortie || 'N/A'}`;
      if (rule.perte != null) ruleLine += `\n  Perte: ${(rule.perte * 100)}%`;
      if (rule.scenarios) ruleLine += `\n  Scénarios: ${JSON.stringify(rule.scenarios)}`;
      if (rule.conditions) ruleLine += `\n  Conditions: ${JSON.stringify(rule.conditions)}`;
      if (varsStr) ruleLine += `\n  Variables:\n${varsStr}`;
      return ruleLine;
    }).join("\n\n");

    dynamicParts += `\n\n## Règles de calcul du catalogue
Certains articles du catalogue ont une règle de calcul (champ calculation_rule_ai en JSON).
Quand tu ajoutes un article qui a une règle de calcul :

1. Lis la règle JSON de l'article
2. Identifie les variables requises (largeur, hauteur, profondeur, etc.)
3. Utilise les dimensions visibles sur le plan si disponibles
4. Demande à l'estimateur SEULEMENT les variables avec "source": "demander"
5. Pour les variables avec "source": "defaut_silencieux" → utilise la valeur par défaut SANS demander. Mentionne-la dans ta réponse mais ne pose pas la question.
6. Applique la formule
7. Applique le facteur de perte si présent
8. Propose la quantité calculée avec le détail du calcul
9. Attends la confirmation avant d'appliquer

Sources des variables :
- "demander" → tu poses la question à l'estimateur
- "defaut_silencieux" → tu utilises le défaut sans demander (ex: 4 pattes par caisson, pas besoin de confirmer chaque fois)

Si la règle contient des "scenarios" (plusieurs formules selon le contexte) :
1. Présente les scénarios disponibles à l'estimateur
2. Demande lequel s'applique
3. Puis demande les variables du scénario choisi

Si la règle contient une "condition" (ex: "Caisson au sol uniquement"), applique-la automatiquement — ne propose pas cet article quand la condition n'est pas remplie.

Ne jamais inventer une formule. Si un article n'a pas de règle de calcul, demande la quantité à l'estimateur.

**Cascade automatique** : Les articles avec une clé "cascade" dans leur règle de calcul déclenchent automatiquement des articles enfants côté client quand les dimensions L/H/P sont saisies. Tu n'as PAS besoin de gérer ces cascades — elles sont gérées par le moteur JS du calculateur. Tu peux toutefois expliquer ou ajuster les résultats si l'estimateur le demande.

${rulesLines}`;
  }

  // Project context
  dynamicParts += `\n\n## Contexte actuel
Projet : ${context.project?.name || 'N/A'}
Client : ${context.project?.client || 'N/A'}
Designer : ${context.project?.designer || 'N/A'}
Soumission #${context.submission?.number || '?'} — Statut : ${context.submission?.status || '?'}
Total estimé : ${context.grandTotal || 0}$`;

  dynamicParts += `\n\n## Pièces\n${roomsStr || 'Aucune pièce'}`;

  // Focus room detail
  if (context.focusRoomDetail) {
    const f = context.focusRoomDetail;
    const itemsStr = (f.items || []).map((it: any, i: number) =>
      `  ${i}. ${it.tag ? '[' + it.tag + '] ' : ''}${it.description} — ${it.qty}× ${it.unitPrice}$ = ${it.lineTotal}$`
    ).join("\n");
    dynamicParts += `\n\n## Pièce en focus : ${f.name}
Installation: ${f.installationIncluded ? 'Oui' : 'Non'}
Description client: ${f.clientDescription || '(vide)'}
Articles:
${itemsStr}
Sous-total: ${f.subtotal}$
Rentabilité: marge ${f.rentability?.margeReelle?.toFixed(1) || '?'}%, profit ${f.rentability?.profitNet?.toFixed(2) || '?'}$`;
  }

  return staticPrompt + dynamicParts;
}

// Tool definitions pour Claude
const TOOLS = [
  {
    name: "analyze_rentability",
    description:
      "Calcule la rentabilité détaillée d'une pièce ou du projet entier. Retourne prix de vente, coûts, marges, heures par département. N'APPELER QUE si l'utilisateur a CONFIRMÉ vouloir cette analyse ou l'a demandée directement.",
    input_schema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["project", "room"],
          description: "Analyser le projet entier ou une pièce spécifique",
        },
        room_name: {
          type: "string",
          description: "Nom de la pièce (si scope=room)",
        },
      },
      required: ["scope"],
    },
  },
  {
    name: "write_description",
    description:
      "Écrit ou réécrit la description client d'une pièce en HTML formaté selon les règles Stele. N'APPELER QUE si l'utilisateur a CONFIRMÉ vouloir appliquer la description proposée.",
    input_schema: {
      type: "object",
      properties: {
        room_name: {
          type: "string",
          description: "Nom de la pièce",
        },
        description_html: {
          type: "string",
          description: "HTML formaté selon les règles Stele",
        },
      },
      required: ["room_name", "description_html"],
    },
  },
  {
    name: "add_catalogue_item",
    description:
      "Ajoute un article du catalogue à une pièce. N'APPELER QUE si l'utilisateur a CONFIRMÉ vouloir ajouter cet article.",
    input_schema: {
      type: "object",
      properties: {
        room_name: {
          type: "string",
          description: "Nom de la pièce cible",
        },
        catalogue_item_id: {
          type: "string",
          description: "ID de l'article du catalogue",
        },
        quantity: {
          type: "number",
          description: "Quantité",
        },
        tag: {
          type: "string",
          description: "Tag de l'élément physique (ex: C1, F2)",
        },
      },
      required: ["room_name", "catalogue_item_id", "quantity"],
    },
  },
  {
    name: "modify_item",
    description:
      "Modifie un article existant dans une pièce (quantité, prix, description). N'APPELER QUE si l'utilisateur a CONFIRMÉ la modification.",
    input_schema: {
      type: "object",
      properties: {
        room_name: { type: "string", description: "Nom de la pièce" },
        item_index: { type: "number", description: "Index de l'article dans la pièce" },
        changes: {
          type: "object",
          properties: {
            quantity: { type: "number" },
            unit_price: { type: "number" },
            description: { type: "string" },
            markup: { type: "number" },
          },
        },
      },
      required: ["room_name", "item_index", "changes"],
    },
  },
  {
    name: "suggest_items",
    description:
      "Recherche dans le catalogue les articles pertinents pour un besoin décrit. Tool de lecture seule, peut être appelé sans confirmation.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Description du besoin (ex: tiroir, charnière, panneau...)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "compare_versions",
    description:
      "Compare deux versions de la soumission et montre les différences. Tool de lecture seule.",
    input_schema: {
      type: "object",
      properties: {
        version_a: { type: "number", description: "Numéro de version A" },
        version_b: { type: "number", description: "Numéro de version B" },
      },
      required: ["version_a", "version_b"],
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client (reused for auth + config reading)
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify JWT
    const authErr = await verifyAuth(authHeader, supabase);
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

    const { messages, context } = await req.json();

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "No messages provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Load single prompt override from app_config (fallback to default if missing)
    const staticOverride = await loadPromptOverride(supabase);

    let systemPrompt = buildSystemPrompt(context || {}, staticOverride);

    // Inject catalogue summary into context if provided
    if (context?.catalogueSummary) {
      systemPrompt += `\n\n## Catalogue disponible (résumé)\nLes articles marqués ★ sont les articles PAR DÉFAUT de l'atelier — utilise-les en priorité sauf indication contraire de l'estimateur. Les articles sans ★ sont des alternatives disponibles mais non privilégiées.\n${context.catalogueSummary}`;
    }

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
        JSON.stringify({
          error: data.error.message || JSON.stringify(data.error),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        content: data.content,
        stop_reason: data.stop_reason,
        usage: data.usage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
