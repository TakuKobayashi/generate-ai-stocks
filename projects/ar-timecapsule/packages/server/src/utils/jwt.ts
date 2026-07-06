import type { JwtPayload, UserRole } from "../types/common";

const ALGORITHM = { name: "HMAC", hash: "SHA-256" };

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), ALGORITHM, false, ["sign", "verify"]);
}

function b64UrlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64UrlDecode(str: string): Uint8Array {
  const raw = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
}

export async function signJwt(payload: Omit<JwtPayload, "iat" | "exp">, secret: string, expiresIn: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const full: JwtPayload = { ...payload, iat: now, exp: now + expiresIn };
  const enc = new TextEncoder();
  const header = b64UrlEncode(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body   = b64UrlEncode(enc.encode(JSON.stringify(full)));
  const key    = await importKey(secret);
  const sig    = await crypto.subtle.sign(ALGORITHM, key, enc.encode(`${header}.${body}`));
  return `${header}.${body}.${b64UrlEncode(new Uint8Array(sig))}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const [header, body, signature] = parts as [string, string, string];
  const key = await importKey(secret);
  const valid = await crypto.subtle.verify(ALGORITHM, key, b64UrlDecode(signature), new TextEncoder().encode(`${header}.${body}`));
  if (!valid) throw new Error("Invalid JWT signature");
  const payload = JSON.parse(new TextDecoder().decode(b64UrlDecode(body))) as JwtPayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("JWT expired");
  return payload;
}

export function generateId(): string { return crypto.randomUUID(); }

export async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export type TokenPair = {
  accessToken: string; refreshToken: string;
  accessExpiresAt: number; refreshExpiresAt: number;
};

export async function issueTokenPair(userId: string, email: string, role: UserRole, secret: string, accessExp: number, refreshExp: number): Promise<TokenPair> {
  const now = Math.floor(Date.now() / 1000);
  const accessToken  = await signJwt({ sub: userId, email, role }, secret, accessExp);
  const refreshToken = generateRefreshToken();
  return { accessToken, refreshToken, accessExpiresAt: now + accessExp, refreshExpiresAt: now + refreshExp };
}
