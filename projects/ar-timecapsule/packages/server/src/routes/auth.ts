import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../types/env";
import { AuthService } from "../services/authService";
import { createDb } from "../db";
import { signUpSchema, storeSignUpSchema, loginSchema, refreshSchema } from "../validators/auth";
import { successResponse, errorResponse, ErrorCode } from "../utils/response";
import { rateLimitMiddleware } from "../middleware/rateLimit";
import { authMiddleware } from "../middleware/auth";

const r = new Hono<{ Bindings: Env }>();
const rl = rateLimitMiddleware({ requests: 10, windowSeconds: 60, keyPrefix: "auth" });
const mkSvc = (c: { env: Env }) => new AuthService(createDb(c.env.DB), { jwtSecret: c.env.JWT_SECRET, accessExpiresIn: parseInt(c.env.JWT_ACCESS_EXPIRES_IN, 10), refreshExpiresIn: parseInt(c.env.JWT_REFRESH_EXPIRES_IN, 10) });
const meta = (c: { req: { header: (k: string) => string | undefined } }) => ({ userAgent: c.req.header("User-Agent"), ipAddress: c.req.header("CF-Connecting-IP") });

function handleErr(c: Parameters<typeof errorResponse>[0], err: unknown): Response {
  if (err instanceof Error && "code" in err) {
    const code = (err as { code: string }).code;
    if (code === "EMAIL_ALREADY_EXISTS") return errorResponse(c, 409, ErrorCode.EMAIL_ALREADY_EXISTS, err.message);
    if (code === "INVALID_CREDENTIALS")  return errorResponse(c, 401, ErrorCode.INVALID_CREDENTIALS,  "Invalid email or password");
    if (code === "ACCOUNT_BANNED")       return errorResponse(c, 403, ErrorCode.ACCOUNT_BANNED,       err.message);
    if (code === "TOKEN_INVALID")        return errorResponse(c, 401, ErrorCode.TOKEN_INVALID,        err.message);
    if (code === "TOKEN_REVOKED")        return errorResponse(c, 401, ErrorCode.TOKEN_REVOKED,        err.message);
    if (code === "TOKEN_EXPIRED")        return errorResponse(c, 401, ErrorCode.TOKEN_EXPIRED,        err.message);
    if (code === "FORBIDDEN")            return errorResponse(c, 403, ErrorCode.FORBIDDEN,            err.message);
  }
  throw err;
}

r.post("/signup", rl, zValidator("json", signUpSchema, (res, c) => { if (!res.success) return errorResponse(c, 422, ErrorCode.VALIDATION_ERROR, "Validation failed", res.error.flatten()); }),
  async (c) => { const { email, password, displayName } = c.req.valid("json"); try { return successResponse(c, await mkSvc(c).signUp(email, password, displayName, meta(c)), 201); } catch (e) { return handleErr(c, e); } });

r.post("/signup/store", rl, zValidator("json", storeSignUpSchema, (res, c) => { if (!res.success) return errorResponse(c, 422, ErrorCode.VALIDATION_ERROR, "Validation failed", res.error.flatten()); }),
  async (c) => { const { email, password, displayName, shopName, inviteCode } = c.req.valid("json"); try { return successResponse(c, await mkSvc(c).storeSignUp(email, password, displayName, shopName, inviteCode, meta(c)), 201); } catch (e) { return handleErr(c, e); } });

r.post("/login", rl, zValidator("json", loginSchema, (res, c) => { if (!res.success) return errorResponse(c, 422, ErrorCode.VALIDATION_ERROR, "Validation failed", res.error.flatten()); }),
  async (c) => { const { email, password } = c.req.valid("json"); try { return successResponse(c, await mkSvc(c).login(email, password, meta(c))); } catch (e) { return handleErr(c, e); } });

r.post("/refresh", rl, zValidator("json", refreshSchema, (res, c) => { if (!res.success) return errorResponse(c, 422, ErrorCode.VALIDATION_ERROR, "Validation failed", res.error.flatten()); }),
  async (c) => { try { return successResponse(c, await mkSvc(c).refresh(c.req.valid("json").refreshToken, meta(c))); } catch (e) { return handleErr(c, e); } });

r.post("/logout", authMiddleware, zValidator("json", refreshSchema, (res, c) => { if (!res.success) return errorResponse(c, 422, ErrorCode.VALIDATION_ERROR, "Validation failed", res.error.flatten()); }),
  async (c) => { await mkSvc(c).logout(c.req.valid("json").refreshToken); return successResponse(c, { message: "Logged out" }); });

export { r as authRouter };
