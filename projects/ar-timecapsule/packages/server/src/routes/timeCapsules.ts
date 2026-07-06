import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../types/env";
import type { AuthUser } from "../types/common";
import { TimeCapsuleService } from "../services/timeCapsuleService";
import { createDb } from "../db";
import { createTimeCapsuleSchema, nearbySearchSchema } from "../validators/timeCapsule";
import { successResponse, errorResponse, ErrorCode } from "../utils/response";
import { authMiddleware, optionalAuthMiddleware, requireRole } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rateLimit";

type V = { user: AuthUser };
const r = new Hono<{ Bindings: Env; Variables: V }>();

const mkSvc = (c: { env: Env }) => new TimeCapsuleService(createDb(c.env.DB), {
  r2AccountId: c.env.R2_ACCOUNT_ID, r2AccessKeyId: c.env.R2_ACCESS_KEY_ID,
  r2SecretAccessKey: c.env.R2_SECRET_ACCESS_KEY, r2BucketName: "ar-timecapsule-audio",
  signedUrlExpiresIn: parseInt(c.env.SIGNED_URL_EXPIRES_IN, 10),
  maxCapsulesPerDay:  parseInt(c.env.MAX_CAPSULES_PER_USER_PER_DAY, 10),
  maxRadiusMeters:    parseInt(c.env.NEARBY_SEARCH_MAX_RADIUS_KM, 10) * 1000,
});

function handleErr(c: Parameters<typeof errorResponse>[0], err: unknown): Response {
  if (err instanceof Error && "code" in err) {
    const code = (err as { code: string }).code;
    if (code === "NOT_FOUND")            return errorResponse(c, 404, ErrorCode.NOT_FOUND,            err.message);
    if (code === "FORBIDDEN")            return errorResponse(c, 403, ErrorCode.FORBIDDEN,            err.message);
    if (code === "CAPSULE_EXPIRED")      return errorResponse(c, 410, ErrorCode.CAPSULE_EXPIRED,      err.message);
    if (code === "DAILY_LIMIT_EXCEEDED") return errorResponse(c, 429, ErrorCode.DAILY_LIMIT_EXCEEDED, err.message);
  }
  throw err;
}

// 近傍検索 (geohash + Haversine + Cache)
r.get("/nearby", optionalAuthMiddleware, rateLimitMiddleware({ requests: 60, windowSeconds: 60, keyPrefix: "nearby" }),
  zValidator("query", nearbySearchSchema, (res, c) => { if (!res.success) return errorResponse(c, 422, ErrorCode.VALIDATION_ERROR, "Validation failed", res.error.flatten()); }),
  async (c) => {
    const q = c.req.valid("query");
    try {
      const cache = await TimeCapsuleService.openCache();
      const result = await mkSvc(c).findNearby(
        { latitude: q.lat, longitude: q.lng, radiusMeters: q.radius, limit: q.limit, cursor: q.cursor },
        { cache, waitUntil: (p) => c.executionCtx.waitUntil(p) }
      );
      c.header("Cache-Control", "public, max-age=30, stale-while-revalidate=10");
      return successResponse(c, {
        items: result.items.map((item) => ({
          id: item.id, title: item.title, latitude: item.latitude, longitude: item.longitude,
          arAnchorId: item.arAnchorId, mediaType: item.mediaType,
          discoverRadiusMeters: item.discoverRadiusMeters,
          distanceMeters: Math.round(item.distanceMeters), createdAt: item.createdAt,
        })),
        nextCursor: result.nextCursor, total: result.total,
      });
    } catch (e) { return handleErr(c, e); }
  });

r.get("/my", authMiddleware, async (c) => {
  const user = c.get("user");
  const { items, nextCursor } = await mkSvc(c).findByUser(user.userId, c.req.query("cursor"), parseInt(c.req.query("limit") ?? "20", 10));
  return successResponse(c, { items, nextCursor });
});

r.get("/all", authMiddleware, requireRole("admin", "moderator"), async (c) => {
  const { items, nextCursor } = await mkSvc(c).findAll(c.req.query("cursor"), parseInt(c.req.query("limit") ?? "100", 10));
  return successResponse(c, { items, nextCursor });
});

r.get("/:id", optionalAuthMiddleware, rateLimitMiddleware(), async (c) => {
  const user = c.get("user");
  try {
    const capsule = await mkSvc(c).findById(c.req.param("id"), user?.userId);
    c.executionCtx.waitUntil(mkSvc(c).incrementViewCount(c.req.param("id")));
    return successResponse(c, capsule);
  } catch (e) { return handleErr(c, e); }
});

r.post("/", authMiddleware, rateLimitMiddleware({ requests: 20, windowSeconds: 60, keyPrefix: "capsule-create" }),
  zValidator("json", createTimeCapsuleSchema, (res, c) => { if (!res.success) return errorResponse(c, 422, ErrorCode.VALIDATION_ERROR, "Validation failed", res.error.flatten()); }),
  async (c) => {
    try {
      const capsule = await mkSvc(c).create(c.get("user").userId, c.req.valid("json"));
      return successResponse(c, { id: capsule.id, geohash: capsule.geohash, createdAt: capsule.createdAt }, 201);
    } catch (e) { return handleErr(c, e); }
  });

r.delete("/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  try { await mkSvc(c).delete(c.req.param("id"), user.userId, user.role); return successResponse(c, { message: "Deleted" }); }
  catch (e) { return handleErr(c, e); }
});

export { r as timeCapsuleRouter };
