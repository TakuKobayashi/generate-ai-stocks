import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["user","moderator","admin","store"] }).notNull().default("user"),
  isBanned: integer("is_banned", { mode: "boolean" }).notNull().default(false),
  banReason: text("ban_reason"),
  avatarUrl: text("avatar_url"),
  shopName: text("shop_name"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
  roleIdx: index("users_role_idx").on(t.role),
}));

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  revokedAt: text("revoked_at"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  userIdIdx: index("rt_user_id_idx").on(t.userId),
  tokenHashIdx: uniqueIndex("rt_token_hash_idx").on(t.tokenHash),
}));

export const timeCapsules = sqliteTable("time_capsules", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  geohash: text("geohash").notNull(),
  arAnchorId: text("ar_anchor_id"),
  visibility: text("visibility", { enum: ["public","friends","private"] }).notNull().default("public"),
  status: text("status", { enum: ["active","expired","removed","pending"] }).notNull().default("active"),
  expireAt: text("expire_at"),
  viewCount: integer("view_count").notNull().default(0),
  reportCount: integer("report_count").notNull().default(0),
  mediaType: text("media_type", { enum: ["audio","none"] }).notNull().default("none"),
  discoverRadiusMeters: integer("discover_radius_meters").notNull().default(100),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  nearbyIdx: index("tc_nearby_idx").on(t.visibility, t.status, t.geohash, t.createdAt),
  geohashIdx: index("tc_geohash_idx").on(t.geohash),
  cursorIdx: index("tc_cursor_idx").on(t.geohash, t.id),
  userCreatedIdx: index("tc_user_created_idx").on(t.userId, t.createdAt),
  expireStatusIdx: index("tc_expire_status_idx").on(t.expireAt, t.status),
  reportCountIdx: index("tc_report_count_idx").on(t.reportCount),
}));

export const audioFiles = sqliteTable("audio_files", {
  id: text("id").primaryKey(),
  timeCapsuleId: text("time_capsule_id").notNull().references(() => timeCapsules.id, { onDelete: "cascade" }),
  r2Key: text("r2_key").notNull().unique(),
  originalFileName: text("original_file_name"),
  mimeType: text("mime_type").notNull().default("audio/mpeg"),
  fileSize: integer("file_size").notNull(),
  durationSeconds: real("duration_seconds"),
  isConfirmed: integer("is_confirmed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  capsuleIdIdx: index("af_capsule_id_idx").on(t.timeCapsuleId),
  r2KeyIdx: uniqueIndex("af_r2_key_idx").on(t.r2Key),
}));

export const coupons = sqliteTable("coupons", {
  id: text("id").primaryKey(),
  timeCapsuleId: text("time_capsule_id").notNull().references(() => timeCapsules.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  shopName: text("shop_name").notNull(),
  redemptionType: text("redemption_type", { enum: ["qr","code","screen"] }).notNull().default("screen"),
  redemptionCode: text("redemption_code"),
  redemptionQrData: text("redemption_qr_data"),
  redeemLimit: integer("redeem_limit"),
  redeemCount: integer("redeem_count").notNull().default(0),
  expireAt: text("expire_at"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  capsuleIdIdx: index("cp_capsule_id_idx").on(t.timeCapsuleId),
  isActiveIdx: index("cp_is_active_idx").on(t.isActive),
}));

export const couponRedemptions = sqliteTable("coupon_redemptions", {
  id: text("id").primaryKey(),
  couponId: text("coupon_id").notNull().references(() => coupons.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  redeemedAt: text("redeemed_at").notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  couponIdIdx: index("cr_coupon_id_idx").on(t.couponId),
  userIdIdx: index("cr_user_id_idx").on(t.userId),
  uniqueRedemption: uniqueIndex("cr_unique_idx").on(t.couponId, t.userId),
}));

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  timeCapsuleId: text("time_capsule_id").notNull().references(() => timeCapsules.id, { onDelete: "cascade" }),
  reporterId: text("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason", { enum: ["spam","harassment","sexual","gore","copyright","other"] }).notNull(),
  detail: text("detail"),
  status: text("status", { enum: ["pending","reviewed","resolved","dismissed"] }).notNull().default("pending"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (t) => ({
  capsuleIdIdx: index("rp_capsule_id_idx").on(t.timeCapsuleId),
  reporterIdIdx: index("rp_reporter_id_idx").on(t.reporterId),
  statusIdx: index("rp_status_idx").on(t.status),
  uniqueReport: uniqueIndex("rp_unique_idx").on(t.timeCapsuleId, t.reporterId),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
export type TimeCapsule = typeof timeCapsules.$inferSelect;
export type NewTimeCapsule = typeof timeCapsules.$inferInsert;
export type AudioFile = typeof audioFiles.$inferSelect;
export type NewAudioFile = typeof audioFiles.$inferInsert;
export type Coupon = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;
export type CouponRedemption = typeof couponRedemptions.$inferSelect;
export type NewCouponRedemption = typeof couponRedemptions.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
