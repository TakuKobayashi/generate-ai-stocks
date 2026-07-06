import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../types/env";
import type { AuthUser } from "../types/common";
import { AudioService } from "../services/audioService";
import { createDb } from "../db";
import { requestUploadUrlSchema, confirmUploadSchema } from "../validators/audio";
import { successResponse, errorResponse, ErrorCode } from "../utils/response";
import { authMiddleware } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rateLimit";

type V = { user: AuthUser };
const r = new Hono<{ Bindings: Env; Variables: V }>();
const mkSvc = (c: { env: Env }) => new AudioService(createDb(c.env.DB), { r2AccountId: c.env.R2_ACCOUNT_ID, r2AccessKeyId: c.env.R2_ACCESS_KEY_ID, r2SecretAccessKey: c.env.R2_SECRET_ACCESS_KEY, r2BucketName: "ar-timecapsule-audio", maxFileSize: parseInt(c.env.MAX_AUDIO_FILE_SIZE, 10), signedUrlExpiresIn: parseInt(c.env.SIGNED_URL_EXPIRES_IN, 10) });

r.post("/upload-url", authMiddleware, rateLimitMiddleware({ requests: 30, windowSeconds: 60, keyPrefix: "audio-upload" }),
  zValidator("json", requestUploadUrlSchema, (res, c) => { if (!res.success) return errorResponse(c, 422, ErrorCode.VALIDATION_ERROR, "Validation failed", res.error.flatten()); }),
  async (c) => {
    try { return successResponse(c, await mkSvc(c).requestUploadUrl(c.get("user").userId, c.req.valid("json")), 201); }
    catch (e) {
      if (e instanceof Error && "code" in e) {
        const code = (e as { code: string }).code;
        if (code === "NOT_FOUND") return errorResponse(c, 404, ErrorCode.NOT_FOUND, e.message);
        if (code === "FORBIDDEN") return errorResponse(c, 403, ErrorCode.FORBIDDEN, e.message);
        if (code === "VALIDATION_ERROR") return errorResponse(c, 422, ErrorCode.VALIDATION_ERROR, e.message);
      }
      throw e;
    }
  });

r.post("/confirm", authMiddleware,
  zValidator("json", confirmUploadSchema, (res, c) => { if (!res.success) return errorResponse(c, 422, ErrorCode.VALIDATION_ERROR, "Validation failed", res.error.flatten()); }),
  async (c) => {
    try { await mkSvc(c).confirmUpload(c.get("user").userId, c.req.valid("json")); return successResponse(c, { message: "Confirmed" }); }
    catch (e) {
      if (e instanceof Error && "code" in e) {
        const code = (e as { code: string }).code;
        if (code === "NOT_FOUND") return errorResponse(c, 404, ErrorCode.NOT_FOUND, e.message);
        if (code === "FORBIDDEN") return errorResponse(c, 403, ErrorCode.FORBIDDEN, e.message);
      }
      throw e;
    }
  });

export { r as audioRouter };
