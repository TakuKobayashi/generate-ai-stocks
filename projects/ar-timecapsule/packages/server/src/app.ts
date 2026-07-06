import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import type { Env } from "./types/env";
import { registerRoutes } from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { rateLimitMiddleware } from "./middleware/rateLimit";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", secureHeaders());
  app.use("*", cors({ origin: ["*"], allowMethods: ["GET","POST","PUT","DELETE","OPTIONS"], allowHeaders: ["Content-Type","Authorization"], maxAge: 86400 }));
  app.use("*", logger());
  app.use("*", errorHandler);
  app.use("/api/*", rateLimitMiddleware());
  app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));
  registerRoutes(app);
  app.notFound((c) => {
    if (!c.req.path.startsWith("/api/")) return c.env.ASSETS.fetch(c.req.raw);
    return c.json({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } }, 404);
  });
  return app;
}
