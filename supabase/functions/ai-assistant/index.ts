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

// Règles de formatage partagées avec la Edge Function translate/optimize
const DESCRIPTION_FORMAT_RULES = `
FORMAT HTML OBLIGATOIRE :
- Chaque catégorie principale en <strong> suivi du texte sur la même ligne : <p><strong>Caisson :</strong> ME1</p>
- Les catégories possibles : Caisson, Façades et panneaux apparents, Tiroirs Legrabox, Poignées, Détails, Exclusions (et autres si pertinent)
- Détails : <p><strong>Détails :</strong></p> suivi d'une liste <ul><li>...</li></ul>
- Exclusions : <p><strong>Exclusions :</strong> texte sur la même ligne</p> — JAMAIS de puces
- Paragraphes informatifs sans catégorie : <p>texte</p>
- NE PAS utiliser <h1>, <h2>, <h3> — uniquement <p>, <strong>, <ul>, <li>
- NE PAS envelopper dans <div> ou <html> ou <body>`;

function buildSystemPrompt(context: any): string {
  const tauxStr = (context.tauxHoraires || [])
    .map((t: any) => `${t.department}: ${t.taux_horaire}$/h (salaire ${t.salaire}$/h, frais fixes ${t.frais_fixe}$/h)`)
    .join("\n");

  const matStr = (context.expenseCategories || [])
    .map((c: any) => `${c.name}: markup ${c.markup}%, perte ${c.waste}%`)
    .join("\n");

  const roomsStr = (context.rooms || [])
    .map((r: any) => `- ${r.name}: ${r.itemCount} articles, sous-total ${r.subtotal}$${r.installationIncluded ? ' (inst. incluse)' : ''}${r.hasDescription ? ' [desc. rédigée]' : ''}`)
    .join("\n");

  const benchmarks = context.benchmarks ? `\n## Barèmes de comparaison\n${JSON.stringify(context.benchmarks, null, 2)}` : '';

  const defaultMaterials = context.defaultMaterials ? `\n## Matériaux par défaut de la soumission\n${JSON.stringify(context.defaultMaterials, null, 2)}` : '';

  const clientFile = context.clientFile ? `\n## Fiche client\nNom: ${context.clientFile.name || 'N/A'}\nEntreprise: ${context.clientFile.company || 'N/A'}\nNotes: ${context.clientFile.notes || 'Aucune'}\nPréférences: ${context.clientFile.preferences || 'Aucune'}\nHistorique: ${context.clientFile.history || 'Aucun'}` : '';

  let calcRulesStr = '';
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
    calcRulesStr = `\n## Règles de calcul automatique
Certains articles du catalogue ont une règle de calcul pour déterminer automatiquement la quantité.

**Comportement attendu :**
1. Quand tu ajoutes un article qui a une règle, utilise la formule pour calculer la quantité
2. Variables avec source "demander" → demande la valeur à l'estimateur AVANT de calculer
3. Variables avec source "defaut_silencieux" → utilise la valeur par défaut SANS demander (sauf si l'estimateur la spécifie)
4. Applique le facteur de perte APRÈS le calcul de base
5. Si la règle a des scénarios, choisis le bon selon le contexte ou demande à l'estimateur
6. Si la règle a des conditions, vérifie-les avant d'appliquer

${rulesLines}`;
  }

  const tagPrefixStr = (context.tagPrefixes || [])
    .map((t: any) => `${t.prefix} = ${t.label_fr} (${t.label_en})`)
    .join(", ");

  let focusStr = '';
  if (context.focusRoomDetail) {
    const f = context.focusRoomDetail;
    const itemsStr = (f.items || []).map((it: any, i: number) =>
      `  ${i}. ${it.tag ? '[' + it.tag + '] ' : ''}${it.description} — ${it.qty}× ${it.unitPrice}$ = ${it.lineTotal}$`
    ).join("\n");
    focusStr = `\n## Pièce en focus : ${f.name}
Installation: ${f.installationIncluded ? 'Oui' : 'Non'}
Description client: ${f.clientDescription || '(vide)'}
Articles:
${itemsStr}
Sous-total: ${f.subtotal}$
Rentabilité: marge ${f.rentability?.margeReelle?.toFixed(1) || '?'}%, profit ${f.rentability?.profitNet?.toFixed(2) || '?'}$`;
  }

  return `Tu es l'assistant intelligent de Scopewright, la plateforme d'estimation pour Stele, un atelier d'ébénisterie haut de gamme sur mesure basé au Québec. Tu aides les designers à estimer, analyser et optimiser leurs projets de meubles sur mesure.

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

## Départements et taux horaires
${tauxStr || 'Non disponible'}

## Catégories de dépenses (matériaux)
${matStr || 'Non disponible'}

## Tags et désignations
Les articles dans le calculateur peuvent avoir un tag qui identifie l'élément physique sur le plan.
Préfixes : ${tagPrefixStr || 'C = Caisson, F = Filler, P = Panneau, T = Tiroir, M = Moulure, A = Accessoire'}
Exemples : C1 = premier caisson, F2 = deuxième filler, P1 = premier panneau

**Comportement attendu :**
- TOUJOURS utiliser les tags dans tes réponses quand ils existent. Dis "C3 n'a pas de filler à sa droite" plutôt que "le troisième caisson".
- Quand l'estimateur dit "Fais-moi le C1" ou "Estime C1 à C4", tu dois comprendre qu'il parle des caissons identifiés par ces tags et proposer les articles appropriés pour chacun.
- Si des images/plans sont disponibles, réfère-toi aux tags visibles sur le plan pour faire le lien avec les articles.
- Si un tag est mentionné mais n'existe pas encore dans la pièce, signale-le : "Le tag C5 n'existe pas encore dans cette pièce. Voulez-vous que je l'ajoute?"
- Quand tu proposes des articles pour un tag spécifique, regroupe-les clairement sous le tag concerné.

## Règles pour les descriptions client
Quand tu écris ou optimises une description, respecte ces règles exactement :
${DESCRIPTION_FORMAT_RULES}
- Orthographe, accents, pluriels, concordances simples
- Garder le ton original, pas de reformulation marketing
- Pas de créativité non demandée, pas de contenu inventé
${benchmarks}${defaultMaterials}${clientFile}${calcRulesStr}

## Contexte actuel
Projet : ${context.project?.name || 'N/A'}
Client : ${context.project?.client || 'N/A'}
Designer : ${context.project?.designer || 'N/A'}
Soumission #${context.submission?.number || '?'} — Statut : ${context.submission?.status || '?'}
Total estimé : ${context.grandTotal || 0}$

## Pièces
${roomsStr || 'Aucune pièce'}
${focusStr}

## Articles par défaut (★)
Les articles marqués ★ dans le catalogue sont les go-to de l'atelier — les matériaux, quincailleries et composantes que Stele utilise par défaut sur la majorité des projets.

**Comportement attendu :**
- Quand tu suggères des articles, propose TOUJOURS les articles ★ en premier
- Ne propose des alternatives non-★ QUE si l'estimateur le demande explicitement ou si le contexte l'exige (ex: projet commercial nécessitant un matériau spécifique)
- Si l'estimateur ne précise pas de matériau, assume l'article ★ de la catégorie
- Quand tu listes des options, mets les ★ en premier avec la mention "(par défaut)"

## Efficacité
Tu es un outil de travail pour des estimateurs occupés. Sois efficace :
- Ne pose PAS de questions dont la réponse est évidente ou disponible dans le contexte
- Si l'estimateur donne des dimensions et un type de meuble, tu as assez d'info pour proposer — fais-le
- Regroupe tes questions quand tu en as plusieurs, plutôt que de les poser une par une
- Montre les résultats directement (articles, quantités, prix) plutôt que de décrire ce que tu "pourrais faire"
- Si tu utilises une valeur par défaut silencieuse, mentionne-la brièvement mais ne demande pas de confirmation
- Quand l'estimateur dit "ajoute X", propose la liste complète d'articles en une seule réponse, pas un par un

## Langue
Réponds dans la langue de l'utilisateur (français canadien par défaut). Ton professionnel mais naturel, comme un collègue expérimenté en ébénisterie.

## Limitations
- Tu ne peux PAS modifier les taux horaires ou catégories de dépenses
- Tu ne peux PAS approuver ou changer le statut des soumissions
- Tu ne peux PAS accéder aux projets d'autres utilisateurs
- Si on te demande quelque chose hors scope, dis-le clairement`;
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
          description: "ID de l'article catalogue",
        },
        quantity: {
          type: "number",
          description: "Quantité à ajouter",
          default: 1,
        },
      },
      required: ["room_name", "catalogue_item_id"],
    },
  },
  {
    name: "update_item_quantity",
    description:
      "Modifie la quantité d'une ligne existante dans une pièce. N'APPELER QUE si l'utilisateur a CONFIRMÉ la modification.",
    input_schema: {
      type: "object",
      properties: {
        room_name: {
          type: "string",
          description: "Nom de la pièce",
        },
        item_index: {
          type: "number",
          description: "Index de la ligne dans la pièce (0-based)",
        },
        new_quantity: { type: "number", description: "Nouvelle quantité" },
      },
      required: ["room_name", "item_index", "new_quantity"],
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
    // Verify JWT via Supabase Auth (not signature-based — survives key rotations)
    const authErr = await verifyAuth(req);
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

    const systemPrompt = buildSystemPrompt(context || {});

    // Inject catalogue summary into context if provided
    let enrichedSystem = systemPrompt;
    if (context?.catalogueSummary) {
      enrichedSystem += `\n\n## Catalogue disponible (résumé)\nLes articles marqués ★ sont les articles PAR DÉFAUT de l'atelier — utilise-les en priorité sauf indication contraire de l'estimateur. Les articles sans ★ sont des alternatives disponibles mais non privilégiées.\n${context.catalogueSummary}`;
    }

    const body: any = {
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: enrichedSystem,
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
