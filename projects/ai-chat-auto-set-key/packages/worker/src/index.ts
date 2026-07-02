import { Hono } from "hono";
import { cors } from "hono/cors";
import { Env } from "./types";
import { authRouter } from "./auth/router";
import { chatRouter } from "./api/chat";
import { kvRouter } from "./api/kv";
import { handleCron } from "./cron/index";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "/api/*",
  cors({
    origin: (origin) => origin, // echo origin; tighten in production
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  })
);

// ── API routes ────────────────────────────────────────────────────────────────
app.route("/api/auth", authRouter);
app.route("/api/chat", chatRouter);
app.route("/api/kv", kvRouter);

// ── Static assets (Next.js SSG output) ───────────────────────────────────────
app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

// ── Cloudflare Workers export ─────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(handleCron(env));
  },
};
