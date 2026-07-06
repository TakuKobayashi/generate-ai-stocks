import { Hono } from "hono";
import type { Env } from "../types/env";
import { authRouter }        from "./auth";
import { timeCapsuleRouter } from "./timeCapsules";
import { audioRouter }       from "./audio";
import { couponRouter }      from "./coupons";
import { reportRouter }      from "./reports";

export function registerRoutes(app: Hono<{ Bindings: Env }>) {
  app.route("/api/v1/auth",             authRouter);
  app.route("/api/v1/time-capsules",    timeCapsuleRouter);
  app.route("/api/v1/time-capsules/:capsuleId/report", reportRouter);
  app.route("/api/v1/audio",            audioRouter);
  app.route("/api/v1/coupons",          couponRouter);
}
