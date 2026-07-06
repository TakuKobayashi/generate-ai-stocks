import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../types/env";
import type { AuthUser } from "../types/common";
import { CouponService } from "../services/couponService";
import { createDb } from "../db";
import { redeemCouponSchema } from "../validators/coupon";
import { successResponse, errorResponse, ErrorCode } from "../utils/response";
import { authMiddleware } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rateLimit";

type V = { user: AuthUser };
const r = new Hono<{ Bindings: Env; Variables: V }>();
const mkSvc = (c: { env: Env }) => new CouponService(createDb(c.env.DB), { redeemRadiusM: parseInt(c.env.COUPON_REDEEM_RADIUS_M, 10) });

r.get("/:id", authMiddleware, async (c) => {
  try { return successResponse(c, await mkSvc(c).findById(c.req.param("id"), c.get("user").userId)); }
  catch (e) {
    if (e instanceof Error && "code" in e) {
      const code = (e as { code: string }).code;
      if (code === "NOT_FOUND") return errorResponse(c, 404, ErrorCode.NOT_FOUND, e.message);
      if (code === "COUPON_EXPIRED") return errorResponse(c, 410, ErrorCode.COUPON_EXPIRED, e.message);
    }
    throw e;
  }
});

r.post("/:id/redeem", authMiddleware, rateLimitMiddleware({ requests: 5, windowSeconds: 60, keyPrefix: "coupon-redeem" }),
  zValidator("json", redeemCouponSchema, (res, c) => { if (!res.success) return errorResponse(c, 422, ErrorCode.VALIDATION_ERROR, "Validation failed", res.error.flatten()); }),
  async (c) => {
    try { return successResponse(c, await mkSvc(c).redeem(c.get("user").userId, c.req.param("id"), c.req.valid("json")), 201); }
    catch (e) {
      if (e instanceof Error && "code" in e) {
        const err = e as Error & { code: string; details?: unknown };
        if (err.code === "NOT_FOUND")            return errorResponse(c, 404, ErrorCode.NOT_FOUND,            e.message);
        if (err.code === "COUPON_EXPIRED")        return errorResponse(c, 410, ErrorCode.COUPON_EXPIRED,        e.message);
        if (err.code === "COUPON_LIMIT_REACHED")  return errorResponse(c, 409, ErrorCode.COUPON_LIMIT_REACHED,  e.message);
        if (err.code === "ALREADY_REDEEMED")      return errorResponse(c, 409, ErrorCode.ALREADY_REDEEMED,      e.message);
        if (err.code === "TOO_FAR_FROM_CAPSULE")  return errorResponse(c, 403, ErrorCode.TOO_FAR_FROM_CAPSULE,  e.message, err.details);
      }
      throw e;
    }
  });

export { r as couponRouter };
