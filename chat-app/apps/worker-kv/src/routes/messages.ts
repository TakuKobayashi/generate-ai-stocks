import { Hono } from "hono";
import type { Env } from "../env";
import { getMessages } from "../utils/kv";
import { authMiddleware } from "../middleware/auth";

type Variables = { userId: string; displayName: string; email: string };

const messagesRoute = new Hono<{ Bindings: Env; Variables: Variables }>();

messagesRoute.use("*", authMiddleware);

messagesRoute.get("/:roomId/messages", async (c) => {
  const roomId = c.req.param("roomId");
  const limit = Number(c.req.query("limit") ?? 100);
  const msgs = await getMessages(c.env, roomId, limit);
  return c.json({ data: msgs });
});

export default messagesRoute;
