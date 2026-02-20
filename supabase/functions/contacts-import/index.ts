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
// key: ai_prompt_contacts
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_STATIC_PROMPT = `Tu es l'Assistant Scopewright pour la gestion des contacts d'un atelier d'ébénisterie haut de gamme.

## Ton rôle

L'utilisateur te donne des données en vrac - screenshots de carnets d'adresses, exports Excel, listes de courriels, cartes d'affaires en photo, courriels avec signatures - et tu extrais des contacts et entreprises structurés. Tu peux aussi modifier et entretenir les contacts existants.

## Ce que tu extrais

### Pour une personne (contact)
- Prénom et nom
- Courriel
- Téléphone / mobile
- Titre ou poste
- Entreprise (liée à une company existante ou nouvelle)
- Notes

### Pour une entreprise (company)
- Nom de l'entreprise
- Adresse complète (rue, ville, province, code postal)
- Téléphone
- Site web
- Type : client, fournisseur, entrepreneur, architecte, compétiteur, sous-traitant
- Notes

## Comment tu travailles

### Mode import (créer des contacts)

1. L'utilisateur colle ou envoie des données
2. Tu analyses et extrais les contacts
3. Tu vérifies les doublons via search_contacts AVANT de proposer
4. Tu présentes un récapitulatif clair :
   "J'ai identifié 8 contacts :
   1. Jean Tremblay - Architecte chez ABC Architecture - jean@abc.com
   2. Marie Dubois - Entrepreneur chez Construction XYZ - marie@xyz.com"
5. Tu signales les entreprises à créer vs celles qui existent déjà :
   "ABC Architecture existe déjà. Je vais y lier Jean Tremblay.
   Construction XYZ est nouvelle. Je vais la créer."
6. Tu demandes confirmation
7. Tu crées via create_company puis create_contact

### Mode correction

1. L'utilisateur décrit le changement
2. Tu cherches via search_contacts
3. Tu montres le changement :
   "Jean Tremblay : courriel jean@ancien.com -> jean@nouveau.com"
4. Tu attends confirmation
5. Tu modifies via update_contact ou update_company

### Mode entretien

- Marquer comme compétiteur : "Construction XYZ est un compétiteur"
- Audit : "Quels contacts n'ont pas de courriel ?"
- Fusion : "Il y a deux Jean Tremblay, fusionne-les"
- Catégoriser : "Marque tous les contacts de ce lot comme fournisseurs"

## Règles critiques

- JAMAIS créer sans vérifier les doublons d'abord
- JAMAIS modifier sans montrer le changement
- JAMAIS supprimer sans confirmation explicite
- Si un nom est ambigu, demander clarification
- Si une entreprise existe déjà, TOUJOURS lier au lieu de créer un doublon

## Doublons

Les doublons sont le problème #1. Avant chaque création :
- Cherche par nom (exact et partiel)
- Cherche par courriel
- Cherche par entreprise
- Si doublon probable : "Jean Tremblay existe déjà chez ABC. C'est la même personne ?"

## Lecture de données

- Screenshots de carnets d'adresses (Outlook, Google Contacts, téléphone)
- Exports Excel / CSV de listes de contacts
- Cartes d'affaires en photo
- Signatures de courriels
- Listes copiées-collées
- Si format pas clair, montre ce que tu as compris et demande confirmation

## Lots

- Plus de 15 contacts : traite par lots de 10 max
- Après chaque lot : "Lot 1 (10 contacts) créé. Je continue ?"

## Ton

- Direct et efficace, pas de bavardage
- "J'ai trouvé 8 contacts et 3 nouvelles entreprises :"
- Si pas clair, demande UNE question précise

## Langue
Réponds en français canadien. Ton professionnel mais naturel.`;

// Load single prompt override from app_config
async function loadPromptOverride(supabase: any): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "ai_prompt_contacts")
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
  const staticPrompt = staticOverride || DEFAULT_STATIC_PROMPT;

  const contactCount = (context.contacts || []).length;
  const companyCount = (context.companies || []).length;
  const companyTypesStr = (context.companyTypes || []).join(", ");
  const contactRolesStr = (context.contactRoles || []).join(", ");

  const dynamicContext = `

## Base de données actuelle
- ${contactCount} contacts
- ${companyCount} entreprises

## Types d'entreprise configurés
${companyTypesStr || 'Aucun configuré'}

## Rôles de contacts configurés
${contactRolesStr || 'Aucun configuré'}`;

  return staticPrompt + dynamicContext;
}

const TOOLS = [
  {
    name: "search_contacts",
    description:
      "Cherche des contacts et entreprises existants pour éviter les doublons. Tool de lecture seule, peut être appelé sans confirmation.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Terme de recherche (nom, courriel, entreprise)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "create_contact",
    description:
      "Créer un nouveau contact. N'APPELER QUE si l'utilisateur a CONFIRMÉ.",
    input_schema: {
      type: "object",
      properties: {
        first_name: { type: "string", description: "Prénom" },
        last_name: { type: "string", description: "Nom de famille" },
        email: { type: "string", description: "Courriel" },
        phone: { type: "string", description: "Téléphone" },
        address: { type: "string", description: "Adresse" },
        preferred_contact: { type: "string", description: "Mode de contact préféré : email, phone, text" },
        notes: { type: "string", description: "Notes" },
      },
      required: ["first_name", "last_name"],
    },
  },
  {
    name: "create_company",
    description:
      "Créer une nouvelle entreprise. N'APPELER QUE si l'utilisateur a CONFIRMÉ.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom de l'entreprise" },
        company_type: { type: "string", description: "Type : client, fournisseur, entrepreneur, architecte, etc." },
        address: { type: "string", description: "Adresse complète" },
        phone: { type: "string", description: "Téléphone" },
        email: { type: "string", description: "Courriel" },
        website: { type: "string", description: "Site web" },
        notes: { type: "string", description: "Notes" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_contact",
    description:
      "Modifier un contact existant. Toujours montrer l'ancien vs le nouveau AVANT de modifier.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "UUID du contact" },
        updates: {
          type: "object",
          description: "Champs à modifier",
          properties: {
            first_name: { type: "string" },
            last_name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            address: { type: "string" },
            preferred_contact: { type: "string" },
            notes: { type: "string" },
          },
        },
      },
      required: ["contact_id", "updates"],
    },
  },
  {
    name: "update_company",
    description:
      "Modifier une entreprise existante. Toujours montrer l'ancien vs le nouveau AVANT de modifier.",
    input_schema: {
      type: "object",
      properties: {
        company_id: { type: "string", description: "UUID de l'entreprise" },
        updates: {
          type: "object",
          description: "Champs à modifier",
          properties: {
            name: { type: "string" },
            company_type: { type: "string" },
            address: { type: "string" },
            phone: { type: "string" },
            email: { type: "string" },
            website: { type: "string" },
            notes: { type: "string" },
          },
        },
      },
      required: ["company_id", "updates"],
    },
  },
  {
    name: "delete_contact",
    description:
      "Supprimer un contact. Toujours demander confirmation explicite.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "UUID du contact à supprimer" },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "delete_company",
    description:
      "Supprimer une entreprise. Toujours demander confirmation explicite.",
    input_schema: {
      type: "object",
      properties: {
        company_id: { type: "string", description: "UUID de l'entreprise à supprimer" },
      },
      required: ["company_id"],
    },
  },
  {
    name: "link_contact_company",
    description:
      "Lier un contact à une entreprise. N'APPELER QUE si l'utilisateur a CONFIRMÉ.",
    input_schema: {
      type: "object",
      properties: {
        contact_id: { type: "string", description: "UUID du contact" },
        company_id: { type: "string", description: "UUID de l'entreprise" },
        role: { type: "string", description: "Rôle du contact dans l'entreprise" },
        work_email: { type: "string", description: "Courriel professionnel" },
        work_phone: { type: "string", description: "Téléphone professionnel" },
        is_primary_contact: { type: "boolean", description: "Contact principal de l'entreprise" },
      },
      required: ["contact_id", "company_id"],
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const authErr = await verifyAuth(authHeader, supabase);
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

    const staticOverride = await loadPromptOverride(supabase);
    const systemPrompt = buildSystemPrompt(context || {}, staticOverride);

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
