import type { Context } from "hono";

export function successResponse<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json({ success: true, data }, status);
}

export function errorResponse(
  c: Context,
  status: 400 | 401 | 403 | 404 | 409 | 410 | 422 | 429 | 500,
  code: string, message: string, details?: unknown
) {
  return c.json({ success: false, error: { code, message, ...(details !== undefined ? { details } : {}) } }, status);
}

export const ErrorCode = {
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  TOKEN_REVOKED: "TOKEN_REVOKED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  ACCOUNT_BANNED: "ACCOUNT_BANNED",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  DAILY_LIMIT_EXCEEDED: "DAILY_LIMIT_EXCEEDED",
  CAPSULE_EXPIRED: "CAPSULE_EXPIRED",
  COUPON_EXPIRED: "COUPON_EXPIRED",
  COUPON_LIMIT_REACHED: "COUPON_LIMIT_REACHED",
  ALREADY_REDEEMED: "ALREADY_REDEEMED",
  TOO_FAR_FROM_CAPSULE: "TOO_FAR_FROM_CAPSULE",
  ALREADY_REPORTED: "ALREADY_REPORTED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
