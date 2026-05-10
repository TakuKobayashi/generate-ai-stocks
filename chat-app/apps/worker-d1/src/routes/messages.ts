import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import type { Env } from "../env";
import { getDB } from "../db";
import { messages } from "../db/schema";
import { authMiddleware } from "../middleware/auth";

type Variables = { userId: string; displayName: string; email: string };

const messagesRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

messagesRoute.use("*", authMiddleware);

// Get messages for a room (last 100)
messagesRoute.get("/:roomId/messages", async (c) => {
  const db = getDB(c.env.DB);
  const roomId = c.req.param("roomId");
  const limit = Number(c.req.query("limit") ?? 100);

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.roomId, roomId))
    .orderBy(desc(messages.createdAt))
    .limit(Math.min(limit, 200))
    .all();

  return c.json({ data: msgs.reverse() });
});

export default messagesRoute;
