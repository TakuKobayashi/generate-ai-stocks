import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { Env, KV_KEYS } from "../types";
import { requireAuth } from "../auth/router";

export const kvRouter = new Hono<{ Bindings: Env }>();

// Get the latest README table data
kvRouter.get("/readme-table", async (c) => {
  const token = getCookie(c, "session");
  if (!(await requireAuth(c.env, token))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const raw = await c.env.KV.get(KV_KEYS.README_TABLE);
  if (!raw) {
    return c.json({ data: null, message: "No data fetched yet" });
  }

  return c.json({ data: JSON.parse(raw) });
});

// Manually trigger a README fetch (for testing)
kvRouter.post("/readme-table/refresh", async (c) => {
  const token = getCookie(c, "session");
  if (!(await requireAuth(c.env, token))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { handleCron } = await import("../cron/index");
  await handleCron(c.env);

  return c.json({ ok: true, message: "Refresh triggered" });
});
