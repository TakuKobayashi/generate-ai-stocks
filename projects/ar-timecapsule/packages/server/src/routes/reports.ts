import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../types/env";
import type { AuthUser } from "../types/common";
import { ReportService } from "../services/reportService";
import { createDb } from "../db";
import { createReportSchema } from "../validators/report";
import { successResponse, errorResponse, ErrorCode } from "../utils/response";
import { authMiddleware } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rateLimit";

type V = { user: AuthUser };
const r = new Hono<{ Bindings: Env; Variables: V }>();

r.post("/", authMiddleware, rateLimitMiddleware({ requests: 5, windowSeconds: 300, keyPrefix: "report" }),
  zValidator("json", createReportSchema, (res, c) => { if (!res.success) return errorResponse(c, 422, ErrorCode.VALIDATION_ERROR, "Validation failed", res.error.flatten()); }),
  async (c) => {
    const tcId = c.req.param("capsuleId");
    if (!tcId) return errorResponse(c, 422, ErrorCode.VALIDATION_ERROR, "capsuleId required");
    try { return successResponse(c, await new ReportService(createDb(c.env.DB)).create(c.get("user").userId, tcId, c.req.valid("json")), 201); }
    catch (e) {
      if (e instanceof Error && "code" in e) {
        const code = (e as { code: string }).code;
        if (code === "NOT_FOUND")       return errorResponse(c, 404, ErrorCode.NOT_FOUND,       e.message);
        if (code === "FORBIDDEN")       return errorResponse(c, 403, ErrorCode.FORBIDDEN,       e.message);
        if (code === "ALREADY_REPORTED")return errorResponse(c, 409, ErrorCode.ALREADY_REPORTED,e.message);
      }
      throw e;
    }
  });

export { r as reportRouter };
