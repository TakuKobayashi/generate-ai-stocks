import { createMiddleware } from "hono/factory";
import type { Env } from "../types/env";
import type { AuthUser, UserRole } from "../types/common";
import { verifyJwt } from "../utils/jwt";
import { errorResponse, ErrorCode } from "../utils/response";

type V = { user: AuthUser };

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: V }>(async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return errorResponse(c, 401, ErrorCode.UNAUTHORIZED, "Authorization header required");
  try {
    const p = await verifyJwt(auth.slice(7), c.env.JWT_SECRET);
    c.set("user", { userId: p.sub, email: p.email, role: p.role });
    await next();
  } catch (e) {
    if (e instanceof Error && e.message === "JWT expired") return errorResponse(c, 401, ErrorCode.TOKEN_EXPIRED, "Access token expired");
    return errorResponse(c, 401, ErrorCode.TOKEN_INVALID, "Invalid access token");
  }
});

export const optionalAuthMiddleware = createMiddleware<{ Bindings: Env; Variables: V }>(async (c, next) => {
  const auth = c.req.header("Authorization");
  if (auth?.startsWith("Bearer ")) {
    try {
      const p = await verifyJwt(auth.slice(7), c.env.JWT_SECRET);
      c.set("user", { userId: p.sub, email: p.email, role: p.role });
    } catch { /* optional */ }
  }
  await next();
});

export function requireRole(...roles: UserRole[]) {
  return createMiddleware<{ Bindings: Env; Variables: V }>(async (c, next) => {
    const user = c.get("user");
    if (!user) return errorResponse(c, 401, ErrorCode.UNAUTHORIZED, "Authentication required");
    if (!roles.includes(user.role)) return errorResponse(c, 403, ErrorCode.FORBIDDEN, "Insufficient permissions");
    await next();
  });
}
