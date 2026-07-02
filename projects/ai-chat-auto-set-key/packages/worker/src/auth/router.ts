import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { Env, KV_KEYS } from "../types";
import {
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  generateChallenge,
  bufferToBase64url,
  base64urlToBuffer,
  StoredCredential,
  StoredUser,
} from "./crypto";

const SESSION_SECRET_KEY = "session_secret";
const COOKIE_NAME = "session";

export const authRouter = new Hono<{ Bindings: Env }>();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSessionSecret(env: Env): Promise<string> {
  let secret = await env.KV.get(SESSION_SECRET_KEY);
  if (!secret) {
    // Auto-generate on first use
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    secret = bufferToBase64url(bytes.buffer);
    await env.KV.put(SESSION_SECRET_KEY, secret);
  }
  return secret;
}

async function getStoredUser(env: Env): Promise<StoredUser | null> {
  const raw = await env.KV.get(KV_KEYS.AUTH_USER);
  return raw ? JSON.parse(raw) : null;
}

async function getStoredCredentials(env: Env): Promise<StoredCredential[]> {
  const raw = await env.KV.get(KV_KEYS.PASSKEY_CREDENTIALS);
  return raw ? JSON.parse(raw) : [];
}

export async function requireAuth(
  env: Env,
  token: string | undefined
): Promise<boolean> {
  if (!token) return false;
  const secret = await getSessionSecret(env);
  const claims = await verifySessionToken(token, secret);
  return claims !== null;
}

// ── Check if user exists ───────────────────────────────────────────────────────

authRouter.get("/status", async (c) => {
  const user = await getStoredUser(c.env);
  const token = getCookie(c, COOKIE_NAME);
  const secret = await getSessionSecret(c.env);
  const authed = token ? (await verifySessionToken(token, secret)) !== null : false;

  return c.json({
    userExists: user !== null,
    authenticated: authed,
    hasPasskey: (await getStoredCredentials(c.env)).length > 0,
  });
});

// ── Password login ────────────────────────────────────────────────────────────

authRouter.post("/login", async (c) => {
  const { username, password } = await c.req.json<{
    username: string;
    password: string;
  }>();

  const user = await getStoredUser(c.env);
  if (!user || user.username !== username) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const valid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const secret = await getSessionSecret(c.env);
  const token = await createSessionToken(user.userId, secret);

  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return c.json({ ok: true });
});

// ── Logout ────────────────────────────────────────────────────────────────────

authRouter.post("/logout", (c) => {
  setCookie(c, COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return c.json({ ok: true });
});

// ── Passkey: Registration start ───────────────────────────────────────────────

authRouter.post("/passkey/register/start", async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!(await requireAuth(c.env, token))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await getStoredUser(c.env);
  if (!user) return c.json({ error: "No user found" }, 400);

  const challenge = generateChallenge();
  // Store challenge with 5 minute TTL
  await c.env.KV.put(KV_KEYS.PASSKEY_CHALLENGE, challenge, {
    expirationTtl: 300,
  });

  const origin = new URL(c.req.url).origin;
  const rpId = new URL(origin).hostname;

  return c.json({
    challenge,
    rp: { name: "GitHub KV Chat", id: rpId },
    user: {
      id: bufferToBase64url(new TextEncoder().encode(user.userId).buffer),
      name: user.username,
      displayName: user.username,
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },  // ES256
      { type: "public-key", alg: -257 }, // RS256
    ],
    timeout: 60000,
    attestation: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "required",
    },
  });
});

// ── Passkey: Registration finish ──────────────────────────────────────────────

authRouter.post("/passkey/register/finish", async (c) => {
  const token = getCookie(c, COOKIE_NAME);
  if (!(await requireAuth(c.env, token))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { id, rawId, response: attestationResponse } = await c.req.json<{
    id: string;
    rawId: string;
    response: {
      clientDataJSON: string;
      attestationObject: string;
    };
  }>();

  const storedChallenge = await c.env.KV.get(KV_KEYS.PASSKEY_CHALLENGE);
  if (!storedChallenge) {
    return c.json({ error: "Challenge expired or not found" }, 400);
  }

  // Verify clientDataJSON
  const clientData = JSON.parse(
    atob(attestationResponse.clientDataJSON.replace(/-/g, "+").replace(/_/g, "/"))
  );

  if (clientData.type !== "webauthn.create") {
    return c.json({ error: "Invalid clientData type" }, 400);
  }

  const receivedChallenge = clientData.challenge;
  if (receivedChallenge !== storedChallenge) {
    return c.json({ error: "Challenge mismatch" }, 400);
  }

  // Store the credential (public key extraction is simplified here;
  // in production use a library like @simplewebauthn/server)
  const credential: StoredCredential = {
    credentialId: rawId,
    publicKey: attestationResponse.attestationObject, // raw; parse CBOR in production
    counter: 0,
    createdAt: new Date().toISOString(),
  };

  const existing = await getStoredCredentials(c.env);
  existing.push(credential);
  await c.env.KV.put(KV_KEYS.PASSKEY_CREDENTIALS, JSON.stringify(existing));
  await c.env.KV.delete(KV_KEYS.PASSKEY_CHALLENGE);

  return c.json({ ok: true });
});

// ── Passkey: Authentication start ─────────────────────────────────────────────

authRouter.post("/passkey/auth/start", async (c) => {
  const credentials = await getStoredCredentials(c.env);
  if (credentials.length === 0) {
    return c.json({ error: "No passkeys registered" }, 400);
  }

  const challenge = generateChallenge();
  await c.env.KV.put(KV_KEYS.PASSKEY_CHALLENGE, challenge, {
    expirationTtl: 300,
  });

  const origin = new URL(c.req.url).origin;
  const rpId = new URL(origin).hostname;

  return c.json({
    challenge,
    rpId,
    allowCredentials: credentials.map((cred) => ({
      type: "public-key",
      id: cred.credentialId,
    })),
    timeout: 60000,
    userVerification: "required",
  });
});

// ── Passkey: Authentication finish ────────────────────────────────────────────

authRouter.post("/passkey/auth/finish", async (c) => {
  const { id, rawId, response: assertionResponse } = await c.req.json<{
    id: string;
    rawId: string;
    response: {
      clientDataJSON: string;
      authenticatorData: string;
      signature: string;
      userHandle: string;
    };
  }>();

  const storedChallenge = await c.env.KV.get(KV_KEYS.PASSKEY_CHALLENGE);
  if (!storedChallenge) {
    return c.json({ error: "Challenge expired" }, 400);
  }

  const clientData = JSON.parse(
    atob(assertionResponse.clientDataJSON.replace(/-/g, "+").replace(/_/g, "/"))
  );

  if (clientData.type !== "webauthn.get") {
    return c.json({ error: "Invalid clientData type" }, 400);
  }

  if (clientData.challenge !== storedChallenge) {
    return c.json({ error: "Challenge mismatch" }, 400);
  }

  // In production: verify signature against stored public key with @simplewebauthn/server
  // Here we do a simplified check: credential ID must exist
  const credentials = await getStoredCredentials(c.env);
  const cred = credentials.find((c) => c.credentialId === rawId);
  if (!cred) {
    return c.json({ error: "Unknown credential" }, 400);
  }

  await c.env.KV.delete(KV_KEYS.PASSKEY_CHALLENGE);

  const user = await getStoredUser(c.env);
  if (!user) return c.json({ error: "No user" }, 400);

  const secret = await getSessionSecret(c.env);
  const token = await createSessionToken(user.userId, secret);

  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return c.json({ ok: true });
});
