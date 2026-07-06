import { createMiddleware } from "hono/factory";
import type { Env } from "../types/env";
import { errorResponse, ErrorCode } from "../utils/response";

type Config = { requests: number; windowSeconds: number; keyPrefix?: string };

export function rateLimitMiddleware(config?: Partial<Config>) {
  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const requests = config?.requests ?? parseInt(c.env.RATE_LIMIT_REQUESTS, 10);
    const windowSec = config?.windowSeconds ?? parseInt(c.env.RATE_LIMIT_WINDOW, 10);
    const prefix = config?.keyPrefix ?? "rl";
    const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
    const cacheKey = `https://rate-limit.internal/${prefix}:${ip}`;
    const cache = await caches.open("rate-limit");
    const cached = await cache.match(cacheKey);
    let count = 0;
    if (cached) {
      const d = await cached.json<{ count: number; resetAt: number }>();
      if (Date.now() < d.resetAt) count = d.count;
    }
    count += 1;
    if (count > requests) return errorResponse(c, 429, ErrorCode.RATE_LIMIT_EXCEEDED, `Rate limit exceeded`);
    const resetAt = Date.now() + windowSec * 1000;
    c.executionCtx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify({ count, resetAt }), {
      headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${windowSec}` },
    })));
    c.header("X-RateLimit-Limit", String(requests));
    c.header("X-RateLimit-Remaining", String(Math.max(0, requests - count)));
    await next();
  });
}
