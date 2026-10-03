import { SignJWT, jwtVerify } from "jose";

/**
 * Session handling. Uses only Web Crypto (via `jose` and `crypto.subtle`) so it
 * runs unchanged on the Edge runtime, the Node runtime, and inside `proxy.ts`.
 */

export const SESSION_COOKIE = "nd_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short (min 16 chars).");
  }
  return encoder.encode(secret);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_S}s`)
    .setIssuer("narrators-desk")
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
      issuer: "narrators-desk",
    });
    return payload.sub === "owner";
  } catch {
    return false;
  }
}

/**
 * Constant-time string comparison that works without node:crypto.
 * Both inputs are HMAC'd with a per-call random key first, so the comparison
 * runs over fixed-length digests and leaks neither content nor length.
 */
export async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const [da, db] = await Promise.all([
    crypto.subtle.sign("HMAC", key, encoder.encode(a)),
    crypto.subtle.sign("HMAC", key, encoder.encode(b)),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE_S) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

/** Reads the session cookie from a raw Cookie header (for route handlers). */
export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}

export async function isAuthed(request: Request): Promise<boolean> {
  return verifySessionToken(readCookie(request.headers.get("cookie"), SESSION_COOKIE));
}
