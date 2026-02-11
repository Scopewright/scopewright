import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const { texts } = await req.json();
    // texts = [{ key: 'room_xxx', text: 'French text...' }, ...]

    if (!texts || texts.length === 0) {
      return new Response(JSON.stringify({ translations: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out empty texts
    const nonEmpty = texts.filter(
      (t: { key: string; text: string }) => t.text && t.text.trim()
    );
    if (nonEmpty.length === 0) {
      return new Response(JSON.stringify({ translations: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a single prompt with all texts numbered
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
            content: `Translate each of the following French texts to English. These are descriptions for a custom cabinetry/millwork quote document. Keep the same professional tone, be concise. Preserve line breaks and formatting. Return ONLY a valid JSON object where keys are the index numbers (as strings) and values are the English translations. No markdown fences, no explanation.\n\n${numbered}`,
          },
        ],
      }),
    });

    const data = await resp.json();
    const content = data.content?.[0]?.text || "{}";

    // Parse the translations
    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(content);
    } catch (_e) {
      // Try to extract JSON from the response
      const match = content.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    // Map back to original keys
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
