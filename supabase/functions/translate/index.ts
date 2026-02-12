import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OPTIMIZE_SYSTEM = `Tu fais du nettoyage technique + mise au format Stele pour des descriptions de meubles d'ébénisterie sur mesure. PAS de réécriture stylistique.

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
- Ne pas inventer de contenu`;

const TRANSLATE_SYSTEM = `You are a professional translator for Stele, a high-end custom cabinetry company. Translate French to English. Keep the same professional tone, be concise. Preserve line breaks and formatting.`;

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

    const systemPrompt =
      action === "optimize" ? OPTIMIZE_SYSTEM : TRANSLATE_SYSTEM;

    // For single text: simpler prompt, no JSON wrapping needed
    if (nonEmpty.length === 1) {
      const userMsg =
        action === "optimize"
          ? `Optimise ce texte. Retourne UNIQUEMENT le texte optimisé, sans explication, sans markdown :\n\n${nonEmpty[0].text}`
          : `Translate this French text to English. Return ONLY the translated text, no explanation, no markdown:\n\n${nonEmpty[0].text}`;

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
          system: systemPrompt,
          messages: [{ role: "user", content: userMsg }],
        }),
      });

      const data = await resp.json();
      const result = data.content?.[0]?.text || "";
      const translations: Record<string, string> = {};
      translations[nonEmpty[0].key] = result.trim();

      return new Response(JSON.stringify({ translations }), {
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
        : `Translate each of the following French texts to English. Return the translations separated by the exact line "${delimiter}" (one per text, same order). No numbering, no markdown, no explanation.\n\n${numbered}`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    const data = await resp.json();
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
