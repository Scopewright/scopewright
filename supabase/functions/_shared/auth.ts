import { jwtVerify, importJWK } from "https://esm.sh/jose@5";

// ── ES256 (JWKS) — primary method for Supabase Auth v2 tokens ──
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const JWKS_URL = SUPABASE_URL ? `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` : "";

// Cache the imported CryptoKey to avoid fetching JWKS on every request
let _es256Key: CryptoKey | null = null;
let _es256KeyFetchedAt = 0;
const JWKS_CACHE_TTL = 3600_000; // 1 hour

async function getES256Key(): Promise<CryptoKey | null> {
  if (_es256Key && Date.now() - _es256KeyFetchedAt < JWKS_CACHE_TTL) return _es256Key;
  if (!JWKS_URL) return null;
  try {
    const resp = await fetch(JWKS_URL);
    if (!resp.ok) return null;
    const jwks = await resp.json();
    const key = jwks.keys?.[0];
    if (!key) return null;
    _es256Key = (await importJWK(key, "ES256")) as CryptoKey;
    _es256KeyFetchedAt = Date.now();
    return _es256Key;
  } catch {
    return null;
  }
}

// ── HS256 (shared secret) — fallback for legacy tokens ──
const JWT_SECRET = Deno.env.get("JWT_SECRET");
const hs256Key = JWT_SECRET ? new TextEncoder().encode(JWT_SECRET) : null;

export interface AuthResult {
  userId: string;
  email?: string;
  role?: string;
}

function extractResult(payload: any): AuthResult {
  if (!payload.sub) {
    throw new Error("JWT missing sub claim");
  }
  return {
    userId: payload.sub as string,
    email: payload.email as string | undefined,
    role: payload.role as string | undefined,
  };
}

/**
 * Vérifie le JWT Supabase avec validation cryptographique de la signature.
 * Essaie d'abord ES256 via JWKS (Supabase Auth v2), puis HS256 en fallback.
 */
export async function verifyJWT(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.replace("Bearer ", "");

  // 1) Try ES256 via JWKS (Supabase Auth v2 default)
  const es256 = await getES256Key();
  if (es256) {
    try {
      const { payload } = await jwtVerify(token, es256, {
        algorithms: ["ES256"],
        clockTolerance: 30,
      });
      return extractResult(payload);
    } catch (err) {
      if ((err as any).code === "ERR_JWT_EXPIRED") {
        throw new Error("Token expired");
      }
      // Fall through to HS256
    }
  }

  // 2) Fallback to HS256 with shared secret
  if (hs256Key) {
    try {
      const { payload } = await jwtVerify(token, hs256Key, {
        algorithms: ["HS256"],
        clockTolerance: 30,
      });
      return extractResult(payload);
    } catch (err) {
      if ((err as any).code === "ERR_JWT_EXPIRED") {
        throw new Error("Token expired");
      }
      if ((err as any).code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED") {
        throw new Error("JWT signature verification failed");
      }
      throw new Error(`JWT verification failed: ${(err as Error).message}`);
    }
  }

  throw new Error("Server configuration error: no JWT verification method available");
}

/**
 * Origines autorisées pour les headers CORS.
 */
const ALLOWED_ORIGINS = ["https://scopewright.ca", "https://www.scopewright.ca"];

/**
 * Headers CORS dynamiques — valide l'Origin de la requête contre la liste autorisée.
 */
export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

/**
 * Réponse d'erreur standardisée pour les erreurs d'authentification.
 * Token expired → 401 (permet le refresh côté client via authenticatedFetch).
 * Autres erreurs → 403.
 */
export function authErrorResponse(error: Error, req: Request): Response {
  const status = error.message.includes("expired") ? 401 : 403;
  return new Response(
    JSON.stringify({ error: error.message }),
    {
      status,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    }
  );
}
