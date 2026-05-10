import { createMiddleware } from "hono/factory";
import { eq, gt } from "drizzle-orm";
import type { Env } from "../env";
import { getDB } from "../db";
import { sessions, users } from "../db/schema";

type Variables = {
  userId: string;
  displayName: string;
  email: string;
};

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice(7);
  const db = getDB(c.env.DB);
  const now = new Date().toISOString();

  const result = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .get();

  if (!result || result.expiresAt < now) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("userId", result.userId);
  c.set("displayName", result.displayName);
  c.set("email", result.email);
  await next();
});
