import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { Env } from "../env";
import {
  getUserByEmail,
  saveUser,
  getPasskeysByUserId,
  getPasskeyByCredentialId,
  savePasskey,
  updatePasskeyCounter,
  saveChallenge,
  getChallenge,
  deleteChallenge,
  saveSession,
  deleteSession,
  getSession,
  getUserById,
} from "../utils/kv";
import {
  hashPassword,
  verifyPassword,
  generateId,
  generateSessionToken,
} from "../utils/crypto";

const auth = new Hono<{ Bindings: Env }>();

const SESSION_TTL_HOURS = 24 * 7;

function sessionExpiresAt(): string {
  const d = new Date();
  d.setHours(d.getHours() + SESSION_TTL_HOURS);
  return d.toISOString();
}

// --- Email/Password Registration ---
auth.post(
  "/register",
  zValidator(
    "json",
    z.object({
      email: z.string().email(),
      password: z.string().min(8),
      displayName: z.string().min(1).max(50),
    })
  ),
  async (c) => {
    const { email, password, displayName } = c.req.valid("json");
    const now = new Date().toISOString();
    const existing = await getUserByEmail(c.env, email);
    if (existing) return c.json({ error: "Email already registered" }, 409);

    const passwordHash = await hashPassword(password);
    const userId = generateId();
    const user = {
      id: userId,
      email: email.toLowerCase(),
      displayName,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    await saveUser(c.env, user);

    const sessionId = generateSessionToken();
    await saveSession(c.env, {
      id: sessionId,
      userId,
      expiresAt: sessionExpiresAt(),
      createdAt: now,
    });

    return c.json({
      token: sessionId,
      user: { id: userId, email: user.email, displayName, createdAt: now, updatedAt: now },
    });
  }
);

// --- Email/Password Login ---
auth.post(
  "/login",
  zValidator(
    "json",
    z.object({ email: z.string().email(), password: z.string() })
  ),
  async (c) => {
    const { email, password } = c.req.valid("json");
    const now = new Date().toISOString();
    const user = await getUserByEmail(c.env, email);
    if (!user || !user.passwordHash)
      return c.json({ error: "Invalid credentials" }, 401);

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return c.json({ error: "Invalid credentials" }, 401);

    const sessionId = generateSessionToken();
    await saveSession(c.env, {
      id: sessionId,
      userId: user.id,
      expiresAt: sessionExpiresAt(),
      createdAt: now,
    });

    return c.json({
      token: sessionId,
      user: { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt, updatedAt: user.updatedAt },
    });
  }
);

// --- Passkey Register Options ---
auth.post(
  "/passkey/register/options",
  zValidator("json", z.object({ userId: z.string(), displayName: z.string() })),
  async (c) => {
    const { userId, displayName } = c.req.valid("json");
    const now = new Date().toISOString();
    const user = await getUserById(c.env, userId);
    if (!user) return c.json({ error: "User not found" }, 404);

    const userPasskeys = await getPasskeysByUserId(c.env, userId);
    const options = await generateRegistrationOptions({
      rpName: c.env.RP_NAME,
      rpID: c.env.RP_ID,
      userID: new TextEncoder().encode(userId),
      userName: user.email,
      userDisplayName: displayName,
      excludeCredentials: userPasskeys.map((p) => ({
        id: p.credentialId,
        transports: (p.transports ?? []) as AuthenticatorTransport[],
      })),
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
    });

    const challengeId = generateId();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 5);
    await saveChallenge(c.env, { id: challengeId, challenge: options.challenge, userId, expiresAt: expires.toISOString() });

    return c.json({ options, challengeId });
  }
);

// --- Passkey Register Verify ---
auth.post(
  "/passkey/register/verify",
  zValidator("json", z.object({ challengeId: z.string(), response: z.any() })),
  async (c) => {
    const { challengeId, response } = c.req.valid("json");
    const now = new Date().toISOString();
    const challengeRecord = await getChallenge(c.env, challengeId);
    if (!challengeRecord?.userId || challengeRecord.expiresAt < now)
      return c.json({ error: "Invalid or expired challenge" }, 400);

    try {
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: c.env.RP_ORIGIN,
        expectedRPID: c.env.RP_ID,
      });
      if (!verification.verified || !verification.registrationInfo)
        return c.json({ error: "Verification failed" }, 400);

      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      await savePasskey(c.env, {
        id: generateId(),
        userId: challengeRecord.userId,
        credentialId: credential.id,
        publicKey: Array.from(credential.publicKey),
        counter: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports ?? [],
        createdAt: now,
      });
      await deleteChallenge(c.env, challengeId);
      return c.json({ verified: true });
    } catch {
      return c.json({ error: "Verification failed" }, 400);
    }
  }
);

// --- Passkey Auth Options ---
auth.post(
  "/passkey/auth/options",
  zValidator("json", z.object({ email: z.string().email().optional() })),
  async (c) => {
    const { email } = c.req.valid("json");
    let allowCredentials: { id: string; transports?: AuthenticatorTransport[] }[] = [];
    let userId: string | undefined;

    if (email) {
      const user = await getUserByEmail(c.env, email);
      if (user) {
        userId = user.id;
        const userPasskeys = await getPasskeysByUserId(c.env, user.id);
        allowCredentials = userPasskeys.map((p) => ({
          id: p.credentialId,
          transports: (p.transports ?? []) as AuthenticatorTransport[],
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: c.env.RP_ID,
      allowCredentials,
      userVerification: "preferred",
    });

    const challengeId = generateId();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 5);
    await saveChallenge(c.env, { id: challengeId, challenge: options.challenge, userId, expiresAt: expires.toISOString() });

    return c.json({ options, challengeId });
  }
);

// --- Passkey Auth Verify ---
auth.post(
  "/passkey/auth/verify",
  zValidator("json", z.object({ challengeId: z.string(), response: z.any() })),
  async (c) => {
    const { challengeId, response } = c.req.valid("json");
    const now = new Date().toISOString();
    const challengeRecord = await getChallenge(c.env, challengeId);
    if (!challengeRecord || challengeRecord.expiresAt < now)
      return c.json({ error: "Invalid or expired challenge" }, 400);

    const passkey = await getPasskeyByCredentialId(c.env, response.id);
    if (!passkey) return c.json({ error: "Passkey not found" }, 404);

    try {
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: c.env.RP_ORIGIN,
        expectedRPID: c.env.RP_ID,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: passkey.counter,
          transports: (passkey.transports ?? []) as AuthenticatorTransport[],
        },
      });
      if (!verification.verified) return c.json({ error: "Verification failed" }, 400);

      await updatePasskeyCounter(c.env, passkey, verification.authenticationInfo.newCounter);
      await deleteChallenge(c.env, challengeId);

      const user = await getUserById(c.env, passkey.userId);
      if (!user) return c.json({ error: "User not found" }, 404);

      const sessionId = generateSessionToken();
      await saveSession(c.env, { id: sessionId, userId: user.id, expiresAt: sessionExpiresAt(), createdAt: now });

      return c.json({
        token: sessionId,
        user: { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt, updatedAt: user.updatedAt },
      });
    } catch {
      return c.json({ error: "Verification failed" }, 400);
    }
  }
);

// --- Logout ---
auth.post("/logout", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    await deleteSession(c.env, authHeader.slice(7));
  }
  return c.json({ success: true });
});

// --- Get current user ---
auth.get("/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);
  const token = authHeader.slice(7);
  const now = new Date().toISOString();
  const session = await getSession(c.env, token);
  if (!session || session.expiresAt < now) return c.json({ error: "Unauthorized" }, 401);
  const user = await getUserById(c.env, session.userId);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return c.json({ user: { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt, updatedAt: user.updatedAt } });
});

export default auth;
