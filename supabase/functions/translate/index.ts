import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PROMPTS: Record<string, string> = {
  translate: `Translate each of the following French texts to English. These are descriptions for a custom cabinetry/millwork quote document. Keep the same professional tone, be concise. Preserve line breaks and formatting. Return ONLY a valid JSON object where keys are the index numbers (as strings) and values are the English translations. No markdown fences, no explanation.`,

  optimize: `Tu fais du nettoyage technique + mise au format Stele pour des descriptions de meubles d'ébénisterie sur mesure. PAS de réécriture stylistique.

STRUCTURE STANDARD à respecter :
- Caisson : texte sur la même ligne
- Façades et panneaux apparents : texte sur la même ligne
- Tiroirs Legrabox : texte sur la même ligne
- Poignées : texte sur la même ligne
- Détails : titre seul → contenu en puces dessous
- Exclusions : texte sur la même ligne (pas de puces)

CORRECTIONS :
- Orthographe, accents, pluriels, concordances simples
- Typo technique (½, 1 ¼", po, pi, etc.)
- Garder le ton original, la logique, la façon de structurer
- Clarifier SEULEMENT si une phrase est ambiguë, un mot essentiel manque, ou incohérence technique évidente. Sinon, ne pas toucher.

COMPACTAGE :
- Fusionner des lignes quand c'est trop long
- Regrouper les informations répétitives
- Éviter les retours à la ligne inutiles

RÈGLES STRICTES :
- Pas de puces dans Exclusions
- Pas de reformulation marketing
- Pas de ton artificiel
- Pas de créativité non demandée
- Ne pas inventer de contenu

Retourne UNIQUEMENT un objet JSON valide où les clés sont les numéros d'index (comme strings) et les valeurs sont les textes optimisés. Pas de blocs markdown, pas d'explication.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const { texts, action = "translate" } = await req.json();

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

    const prompt = PROMPTS[action] || PROMPTS.translate;
    const numbered = nonEmpty
      .map((t: { key: string; text: string }, i: number) => `[${i}] ${t.text}`)
      .join("\n\n");

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `${prompt}\n\n${numbered}`,
          },
        ],
      }),
    });

    const data = await resp.json();
    const content = data.content?.[0]?.text || "{}";

    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(content);
    } catch (_e) {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    const translations: Record<string, string> = {};
    nonEmpty.forEach((t: { key: string; text: string }, i: number) => {
      translations[t.key] = parsed[String(i)] || "";
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
