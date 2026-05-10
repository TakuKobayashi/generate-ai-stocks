import { createMiddleware } from "hono/factory";
import type { Env } from "../env";
import { getSession, getUserById } from "../utils/kv";

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
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice(7);
  const now = new Date().toISOString();

  const session = await getSession(c.env, token);
  if (!session || session.expiresAt < now) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await getUserById(c.env, session.userId);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("userId", user.id);
  c.set("displayName", user.displayName);
  c.set("email", user.email);
  await next();
});
