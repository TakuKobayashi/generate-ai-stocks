import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import type { Env } from "../types";
import { createDb, schema } from "../db";
import { authMiddleware } from "../middleware/auth";

const callLogs = new Hono<{ Bindings: Env }>();

callLogs.use("*", authMiddleware);

// GET /api/call-logs?tenantId=&limit=&offset=
callLogs.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const tenantIdParam = c.req.query("tenantId");
  const limit = parseInt(c.req.query("limit") ?? "50");
  const offset = parseInt(c.req.query("offset") ?? "0");

  const logs = tenantIdParam
    ? await db.query.callLogs.findMany({
        where: eq(schema.callLogs.tenantId, parseInt(tenantIdParam)),
        orderBy: desc(schema.callLogs.createdAt),
        limit,
        offset,
      })
    : await db.query.callLogs.findMany({
        orderBy: desc(schema.callLogs.createdAt),
        limit,
        offset,
      });

  return c.json(logs);
});

// GET /api/call-legs - active calls
callLogs.get("/active", async (c) => {
  const db = createDb(c.env.DB);
  const activeCalls = await db.query.callLegs.findMany({
    where: (cl, { inArray }) =>
      inArray(cl.status, ["ringing", "connected", "queued"]),
    orderBy: (cl, { desc }) => [desc(cl.createdAt)],
  });
  return c.json(activeCalls);
});

export default callLogs;
