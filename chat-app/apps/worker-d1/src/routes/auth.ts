import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, gt } from "drizzle-orm";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { Env } from "../env";
import { getDB } from "../db";
import { users, passkeys, challenges, sessions } from "../db/schema";
import { hashPassword, verifyPassword, generateId, generateSessionToken } from "../utils/crypto";

const auth = new Hono<{ Bindings: Env }>();

const SESSION_TTL_HOURS = 24 * 7; // 7 days

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
    const db = getDB(c.env.DB);
    const now = new Date().toISOString();

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .get();

    if (existing) {
      return c.json({ error: "Email already registered" }, 409);
    }

    const passwordHash = await hashPassword(password);
    const userId = generateId();

    await db.insert(users).values({
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      displayName,
      createdAt: now,
      updatedAt: now,
    });

    const sessionId = generateSessionToken();
    await db.insert(sessions).values({
      id: sessionId,
      userId,
      expiresAt: sessionExpiresAt(),
      createdAt: now,
    });

    return c.json({
      token: sessionId,
      user: { id: userId, email: email.toLowerCase(), displayName, createdAt: now, updatedAt: now },
    });
  }
);

// --- Email/Password Login ---
auth.post(
  "/login",
  zValidator(
    "json",
    z.object({
      email: z.string().email(),
      password: z.string(),
    })
  ),
  async (c) => {
    const { email, password } = c.req.valid("json");
    const db = getDB(c.env.DB);
    const now = new Date().toISOString();

    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .get();

    if (!user || !user.passwordHash) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const sessionId = generateSessionToken();
    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      expiresAt: sessionExpiresAt(),
      createdAt: now,
    });

    return c.json({
      token: sessionId,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  }
);

// --- Passkey Registration Options ---
auth.post(
  "/passkey/register/options",
  zValidator(
    "json",
    z.object({
      userId: z.string(),
      displayName: z.string(),
    })
  ),
  async (c) => {
    const { userId, displayName } = c.req.valid("json");
    const db = getDB(c.env.DB);
    const now = new Date().toISOString();

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const userPasskeys = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.userId, userId))
      .all();

    const options = await generateRegistrationOptions({
      rpName: c.env.RP_NAME,
      rpID: c.env.RP_ID,
      userID: new TextEncoder().encode(userId),
      userName: user.email,
      userDisplayName: displayName,
      excludeCredentials: userPasskeys.map((p) => ({
        id: p.credentialId,
        transports: p.transports
          ? (JSON.parse(p.transports) as AuthenticatorTransport[])
          : [],
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    // Store challenge
    const challengeId = generateId();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 5);

    await db.insert(challenges).values({
      id: challengeId,
      challenge: options.challenge,
      userId,
      expiresAt: expires.toISOString(),
      createdAt: now,
    });

    return c.json({ options, challengeId });
  }
);

// --- Passkey Registration Verify ---
auth.post(
  "/passkey/register/verify",
  zValidator(
    "json",
    z.object({
      challengeId: z.string(),
      response: z.any(),
    })
  ),
  async (c) => {
    const { challengeId, response } = c.req.valid("json");
    const db = getDB(c.env.DB);
    const now = new Date().toISOString();

    const challengeRecord = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .get();

    if (!challengeRecord || !challengeRecord.userId) {
      return c.json({ error: "Invalid or expired challenge" }, 400);
    }

    if (challengeRecord.expiresAt < now) {
      return c.json({ error: "Challenge expired" }, 400);
    }

    try {
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: c.env.RP_ORIGIN,
        expectedRPID: c.env.RP_ID,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return c.json({ error: "Verification failed" }, 400);
      }

      const { credential, credentialDeviceType, credentialBackedUp } =
        verification.registrationInfo;

      const passkeyId = generateId();
      await db.insert(passkeys).values({
        id: passkeyId,
        userId: challengeRecord.userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports
          ? JSON.stringify(credential.transports)
          : null,
        createdAt: now,
      });

      // Clean up challenge
      await db.delete(challenges).where(eq(challenges.id, challengeId));

      return c.json({ verified: true });
    } catch (e) {
      return c.json({ error: "Verification failed" }, 400);
    }
  }
);

// --- Passkey Authentication Options ---
auth.post(
  "/passkey/auth/options",
  zValidator(
    "json",
    z.object({
      email: z.string().email().optional(),
    })
  ),
  async (c) => {
    const { email } = c.req.valid("json");
    const db = getDB(c.env.DB);
    const now = new Date().toISOString();

    let allowCredentials: { id: string; transports?: AuthenticatorTransport[] }[] = [];
    let userId: string | undefined;

    if (email) {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .get();

      if (user) {
        userId = user.id;
        const userPasskeys = await db
          .select()
          .from(passkeys)
          .where(eq(passkeys.userId, user.id))
          .all();

        allowCredentials = userPasskeys.map((p) => ({
          id: p.credentialId,
          transports: p.transports
            ? (JSON.parse(p.transports) as AuthenticatorTransport[])
            : [],
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

    await db.insert(challenges).values({
      id: challengeId,
      challenge: options.challenge,
      userId: userId ?? null,
      expiresAt: expires.toISOString(),
      createdAt: now,
    });

    return c.json({ options, challengeId });
  }
);

// --- Passkey Authentication Verify ---
auth.post(
  "/passkey/auth/verify",
  zValidator(
    "json",
    z.object({
      challengeId: z.string(),
      response: z.any(),
    })
  ),
  async (c) => {
    const { challengeId, response } = c.req.valid("json");
    const db = getDB(c.env.DB);
    const now = new Date().toISOString();

    const challengeRecord = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .get();

    if (!challengeRecord || challengeRecord.expiresAt < now) {
      return c.json({ error: "Invalid or expired challenge" }, 400);
    }

    // Find passkey by credentialId
    const passkey = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.credentialId, response.id))
      .get();

    if (!passkey) {
      return c.json({ error: "Passkey not found" }, 404);
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: c.env.RP_ORIGIN,
        expectedRPID: c.env.RP_ID,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(passkey.publicKey as ArrayBuffer),
          counter: passkey.counter,
          transports: passkey.transports
            ? (JSON.parse(passkey.transports) as AuthenticatorTransport[])
            : [],
        },
      });

      if (!verification.verified) {
        return c.json({ error: "Verification failed" }, 400);
      }

      // Update counter
      await db
        .update(passkeys)
        .set({ counter: verification.authenticationInfo.newCounter })
        .where(eq(passkeys.id, passkey.id));

      // Clean up challenge
      await db.delete(challenges).where(eq(challenges.id, challengeId));

      // Create session
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, passkey.userId))
        .get();

      if (!user) {
        return c.json({ error: "User not found" }, 404);
      }

      const sessionId = generateSessionToken();
      await db.insert(sessions).values({
        id: sessionId,
        userId: user.id,
        expiresAt: sessionExpiresAt(),
        createdAt: now,
      });

      return c.json({
        token: sessionId,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (e) {
      return c.json({ error: "Verification failed" }, 400);
    }
  }
);

// --- Logout ---
auth.post("/logout", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const db = getDB(c.env.DB);
    await db.delete(sessions).where(eq(sessions.id, token));
  }
  return c.json({ success: true });
});

// --- Get current user ---
auth.get("/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice(7);
  const db = getDB(c.env.DB);
  const now = new Date().toISOString();

  const result = await db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .get();

  if (!result || result.expiresAt < now) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  return c.json({
    user: {
      id: result.userId,
      email: result.email,
      displayName: result.displayName,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    },
  });
});

export default auth;
