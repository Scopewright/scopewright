import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PROMPTS: Record<string, string> = {
  translate: `Translate each of the following French texts to English. These are descriptions for a custom cabinetry/millwork quote document. Keep the same professional tone, be concise. Preserve line breaks and formatting. Return ONLY a valid JSON object where keys are the index numbers (as strings) and values are the English translations. No markdown fences, no explanation.`,

  optimize: `Tu es un rédacteur professionnel pour Stele, une entreprise d'ébénisterie sur mesure haut de gamme. Optimise chacun des textes français suivants en appliquant ces règles :
- Corrige toutes les fautes d'orthographe et de grammaire
- Utilise un ton professionnel, concis et élégant
- Uniformise la nomenclature : "mélamine" (pas melamine), "MDF", "placage", "laqué", "quincaillerie", "soft-close", "panneau", "tiroir", "tablette", "caisson", "façade", "comptoir", "dosseret", "moulure", "fini"
- Utilise le système métrique et les conventions québécoises (ex: "po" pour pouces si mentionné)
- Garde le sens original intact — ne pas inventer de contenu
- Préserve les retours de ligne
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
