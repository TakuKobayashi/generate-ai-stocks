import type { Context, Next } from "hono";
import { errorResponse } from "../utils/response";
export async function errorHandler(c: Context, next: Next): Promise<Response> {
  try { await next(); return c.res; }
  catch (err) { console.error("[ErrorHandler]", err); return errorResponse(c, 500, "INTERNAL_ERROR", "Unexpected error"); }
}
