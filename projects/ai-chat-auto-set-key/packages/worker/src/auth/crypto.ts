// Minimal WebAuthn (Passkey) helpers using Web Crypto API.
// Compatible with Cloudflare Workers runtime.

export interface StoredCredential {
  credentialId: string; // base64url
  publicKey: string; // base64url COSE key
  counter: number;
  createdAt: string;
}

export interface StoredUser {
  username: string;
  passwordHash: string; // bcrypt-style, but we use PBKDF2 in Workers
  passwordSalt: string;
  userId: string;
  createdAt: string;
}

// ── Encoding helpers ──────────────────────────────────────────────────────────

export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function base64urlToBuffer(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
  const str = atob(padded);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
}

// ── Password hashing (PBKDF2) ─────────────────────────────────────────────────

export async function hashPassword(
  password: string,
  salt?: string
): Promise<{ hash: string; salt: string }> {
  const saltBytes = salt
    ? (base64urlToBuffer(salt) as ArrayBuffer)
    : crypto.getRandomValues(new Uint8Array(16)).buffer;

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: 100000 },
    keyMaterial,
    256
  );

  return {
    hash: bufferToBase64url(derived),
    salt: bufferToBase64url(saltBytes),
  };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  const { hash } = await hashPassword(password, storedSalt);
  return hash === storedHash;
}

// ── JWT session token (HS256 via HMAC-SHA256) ─────────────────────────────────

const JWT_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 days

function base64urlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function createSessionToken(
  userId: string,
  secret: string
): Promise<string> {
  const header = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64urlEncode(
    JSON.stringify({
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + JWT_EXPIRY_SECONDS,
    })
  );

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${header}.${payload}`)
  );

  return `${header}.${payload}.${bufferToBase64url(sig)}`;
}

export async function verifySessionToken(
  token: string,
  secret: string
): Promise<{ sub: string } | null> {
  try {
    const [header, payload, signature] = token.split(".");
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlToBuffer(signature),
      new TextEncoder().encode(`${header}.${payload}`)
    );

    if (!valid) return null;

    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;

    return { sub: claims.sub };
  } catch {
    return null;
  }
}

// ── WebAuthn challenge ────────────────────────────────────────────────────────

export function generateChallenge(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bufferToBase64url(bytes.buffer);
}
