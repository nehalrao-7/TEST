// Lightweight admin auth: a single shared password (ADMIN_PASSWORD) exchanged
// for a signed, expiring session cookie. No external service, no user table —
// enough to gate the owner-only admin. Uses Web Crypto so the same verify runs
// in both the Edge middleware and Node server actions.

const COOKIE_NAME = "g6_admin";
const TTL_MS = 1000 * 60 * 60 * 12; // 12h
const encoder = new TextEncoder();

function getSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || "dev-insecure-secret-change-me";
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toHex(sig);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const ADMIN_COOKIE = COOKIE_NAME;
export const ADMIN_COOKIE_MAX_AGE = Math.floor(TTL_MS / 1000);

export async function createSessionToken(): Promise<string> {
  const exp = Date.now() + TTL_MS;
  const payload = String(exp);
  const sig = await sign(payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await sign(payload);
  if (!safeEqual(sig, expected)) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > Date.now();
}

// Checks a submitted password against ADMIN_PASSWORD (constant-time-ish).
export function passwordMatches(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false; // refuse login until a password is configured
  return safeEqual(input, expected);
}
