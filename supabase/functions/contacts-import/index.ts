import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Auth check — deployed with --no-verify-jwt. Verifies JWT is present, decodable, not expired.
function checkAuthHeader(authHeader: string): Response | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.sub) throw new Error("No sub");
    if (payload.exp && payload.exp < Date.now() / 1000 - 30) {
      return new Response(JSON.stringify({ error: "Token expired" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid token format" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
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

## Filtrage de la table
Quand l'utilisateur demande de chercher ou filtrer des contacts/entreprises dans la table :
- Utilise le tool filter_contacts — il met à jour la table directement
- Ne liste PAS les résultats dans le chat
- Réponds juste : "Filtré : 8 contacts affichés" ou "Entreprises de type Architecte affichées"
- Pour "commence par A", "les contacts en M", "montre les B" → utilise starts_with (PAS search)
- Pour "entreprises sans email", "contacts sans téléphone" → utilise missing_field. Pour "avec adresse", "qui ont un site web" → utilise has_field
- Si l'utilisateur dit "montre tout" ou "enlève le filtre", utilise reset: true

## Format de réponse
- Quand tu listes des contacts ou entreprises (hors filtrage), utilise le format tableau markdown
- NE PAS utiliser de listes à bullets

## Ton

- Direct et efficace, pas de bavardage
- "J'ai trouvé 8 contacts et 3 nouvelles entreprises :"
- Si pas clair, demande UNE question précise

## Mémoire organisationnelle
Si l'utilisateur te corrige ou t'apprend quelque chose de spécifique à son organisation, propose de l'enregistrer comme règle permanente :
"Je note : [résumé de la règle]. Enregistrer pour le futur ?"
Après confirmation, appelle le tool save_learning.

## Langue
Réponds en français canadien. Ton professionnel mais naturel.`;

// Load organizational learnings from ai_learnings table
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

function buildSystemPrompt(context: any, staticOverride: string | null, learnings: string[] = []): string {
  const staticPrompt = staticOverride || DEFAULT_STATIC_PROMPT;

  const contactCount = context.contactCount || (context.contacts || []).length;
  const companyCount = context.companyCount || (context.companies || []).length;
  const companyTypesStr = (context.companyTypes || []).join(", ");
  const contactRolesStr = (context.contactRoles || []).join(", ");

  let dynamicContext = `

## Base de données actuelle
- ${contactCount} contacts
- ${companyCount} entreprises

## Types d'entreprise configurés
${companyTypesStr || 'Aucun configuré'}

## Rôles de contacts configurés
${contactRolesStr || 'Aucun configuré'}`;

  if (learnings.length > 0) {
    dynamicContext += "\n\n## Règles apprises de cette organisation\nCes règles ont été établies par des utilisateurs et DOIVENT être respectées :\n"
      + learnings.map((r, i) => `${i + 1}. ${r}`).join("\n");
  }

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
  {
    name: "filter_contacts",
    description:
      "Filtrer et trier les contacts ou entreprises dans la table. Tool de lecture seule — s'exécute immédiatement sans confirmation.",
    input_schema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Terme de recherche" },
        starts_with: { type: "string", description: "Filtrer les noms qui commencent par cette lettre/préfixe (ex: 'A', 'Mar')" },
        tab: { type: "string", enum: ["contacts", "companies"], description: "Onglet à afficher" },
        company_type: { type: "string", description: "Filtrer les entreprises par type" },
        has_field: { type: "string", enum: ["email", "phone", "address", "website", "notes"], description: "Garder les entrées où ce champ est rempli (non vide)" },
        missing_field: { type: "string", enum: ["email", "phone", "address", "website", "notes"], description: "Garder les entrées où ce champ est vide/manquant" },
        reset: { type: "boolean", description: "Enlever les filtres AI" },
      },
    },
  },
  {
    name: "save_learning",
    description:
      "Enregistre une règle organisationnelle apprise d'une correction utilisateur. N'APPELER QUE APRÈS confirmation explicite.",
    input_schema: {
      type: "object",
      properties: {
        rule: { type: "string", description: "La règle résumée, claire et concise" },
        source_context: { type: "string", enum: ["estimateur", "approbation", "contacts", "catalogue", "general"], description: "L'assistant source" },
        example: { type: "string", description: "L'échange original résumé" },
      },
      required: ["rule"],
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

    const authErr = checkAuthHeader(authHeader);
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

    const [staticOverride, learnings] = await Promise.all([
      loadPromptOverride(supabase),
      loadLearnings(supabase),
    ]);
    const systemPrompt = buildSystemPrompt(context || {}, staticOverride, learnings);

    const body: any = {
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages,
      tools: TOOLS,
      stream: true,
    };

    // Call Anthropic with retry on 429 rate limit
    let resp: Response | null = null;
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });
      if (resp.status === 429 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      break;
    }

    if (!resp!.ok) {
      const errText = await resp!.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: "Anthropic API error: " + resp!.status + " " + errText }),
        { status: resp!.status === 429 ? 429 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Relay SSE stream from Anthropic to client
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      const reader = resp!.body!.getReader();
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
        await writer.write(encoder.encode("data: " + JSON.stringify({ type: "error", error: { message: (e as Error).message } }) + "\n\n"));
      } finally {
        writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
