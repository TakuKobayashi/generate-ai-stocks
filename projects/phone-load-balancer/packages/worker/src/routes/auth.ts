import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Env } from "../types";
import { createDb, schema } from "../db";
import { signToken } from "../middleware/auth";

const auth = new Hono<{ Bindings: Env }>();

// POST /api/auth/login
auth.post("/login", async (c) => {
  const { username, password } = await c.req.json<{
    username: string;
    password: string;
  }>();

  if (!username || !password) {
    return c.json({ error: "Username and password are required" }, 400);
  }

  const db = createDb(c.env.DB);
  const user = await db.query.adminUsers.findFirst({
    where: eq(schema.adminUsers.username, username),
  });

  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  // Verify password hash using Web Crypto
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  if (hashHex !== user.passwordHash) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await signToken(
    { sub: String(user.id), username: user.username },
    c.env.JWT_SECRET
  );

  return c.json({ token, username: user.username });
});

// POST /api/auth/setup - Create initial admin (only if no users exist)
auth.post("/setup", async (c) => {
  const db = createDb(c.env.DB);
  const existing = await db.query.adminUsers.findFirst();
  if (existing) {
    return c.json({ error: "Admin already configured" }, 403);
  }

  const { username, password } = await c.req.json<{
    username: string;
    password: string;
  }>();

  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  await db.insert(schema.adminUsers).values({ username, passwordHash });
  return c.json({ message: "Admin created successfully" });
});

export default auth;
