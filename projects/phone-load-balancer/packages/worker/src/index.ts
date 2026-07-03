import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import authRoutes from "./routes/auth";
import tenantsRoutes from "./routes/tenants";
import forwardNumbersRoutes from "./routes/forwardNumbers";
import webhookRoutes from "./routes/webhooks";
import callLogsRoutes from "./routes/callLogs";
export { CallQueueDO } from "./durable-objects/CallQueueDO";

const app = new Hono<{ Bindings: Env }>();

// CORS for API routes
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:3000", "https://*.workers.dev"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// API routes
app.route("/api/auth", authRoutes);
app.route("/api/tenants", tenantsRoutes);
app.route("/api/tenants/:tenantId/forward-numbers", forwardNumbersRoutes);
app.route("/api/webhooks", webhookRoutes);
app.route("/api/call-logs", callLogsRoutes);

// Health check
app.get("/api/health", (c) => c.json({ ok: true, ts: Date.now() }));

// Serve static assets (Next.js SSG output) for everything else
app.get("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
