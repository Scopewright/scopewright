/**
 * Edge Function: pdf-export
 *
 * Receives a complete HTML document string, sends it to PDFShift API
 * for server-side PDF rendering (Chromium), and returns the binary PDF.
 *
 * Request body: { html: string }
 * Response: application/pdf binary (or JSON error)
 *
 * Secrets required: PDFSHIFT_API_KEY
 */

import { verifyJWT, getCorsHeaders, authErrorResponse } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  // ── CORS preflight ──
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  // ── Auth ──
  let _auth;
  try {
    _auth = await verifyJWT(req);
  } catch (err) {
    return authErrorResponse(err as Error, req);
  }

  // ── Parse request ──
  let body: { html: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  if (!body.html || typeof body.html !== "string") {
    return new Response(
      JSON.stringify({ error: "Missing or invalid 'html' field" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  // ── PDFShift API call ──
  const apiKey = Deno.env.get("PDFSHIFT_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "PDFSHIFT_API_KEY not configured" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }

  try {
    const pdfResp = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa("api:" + apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: body.html,
        format: "Letter",
        landscape: true,
        margin: "0",
        use_print: true,
        wait_for: "network",
      }),
    });

    if (!pdfResp.ok) {
      const errText = await pdfResp.text();
      console.error("[pdf-export] PDFShift error:", pdfResp.status, errText);
      return new Response(
        JSON.stringify({ error: "PDF generation failed", detail: errText }),
        { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Return the binary PDF
    const pdfBuffer = await pdfResp.arrayBuffer();
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment",
      },
    });
  } catch (err) {
    console.error("[pdf-export] Fetch error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to reach PDFShift API", detail: (err as Error).message }),
      { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
