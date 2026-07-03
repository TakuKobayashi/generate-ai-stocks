import { createMiddleware } from "hono/factory";
import { importSPKI, jwtVerify, SignJWT } from "jose";
import type { Env } from "../types";

export type AuthPayload = {
  sub: string;
  username: string;
};

const getSecret = (secret: string) =>
  new TextEncoder().encode(secret);

export async function signToken(
  payload: Omit<AuthPayload, never>,
  secret: string
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret(secret));
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<AuthPayload> {
  const { payload } = await jwtVerify(token, getSecret(secret));
  return payload as unknown as AuthPayload;
}

export const authMiddleware = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.slice(7);
    try {
      const payload = await verifyToken(token, c.env.JWT_SECRET);
      c.set("authPayload" as never, payload);
      await next();
    } catch {
      return c.json({ error: "Invalid or expired token" }, 401);
    }
  }
);
