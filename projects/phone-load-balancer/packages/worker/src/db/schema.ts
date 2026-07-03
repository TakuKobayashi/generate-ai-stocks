import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Admin users
export const adminUsers = sqliteTable("admin_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Tenants
export const tenants = sqliteTable("tenants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  // Vonage phone number assigned to this tenant (incoming call number)
  vonageNumber: text("vonage_number").unique(),
  // Vonage application ID for this tenant
  vonageAppId: text("vonage_app_id"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Forward destination phone numbers per tenant
export const forwardNumbers = sqliteTable(
  "forward_numbers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    phoneNumber: text("phone_number").notNull(),
    // Priority: lower number = higher priority (1 = highest)
    priority: integer("priority").notNull().default(1),
    // Current call status: idle | busy | unavailable
    status: text("status", { enum: ["idle", "busy", "unavailable"] })
      .notNull()
      .default("idle"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("tenant_phone_idx").on(t.tenantId, t.phoneNumber)]
);

// Active call legs tracking
export const callLegs = sqliteTable("call_legs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id")
    .notNull()
    .references(() => tenants.id),
  // Vonage conversation/call UUID for the inbound call
  inboundConversationId: text("inbound_conversation_id").notNull(),
  // Caller phone number
  callerNumber: text("caller_number").notNull(),
  // Current forward number being tried
  forwardNumberId: integer("forward_number_id").references(
    () => forwardNumbers.id
  ),
  // Vonage call UUID for the outbound (forwarded) leg
  outboundCallUuid: text("outbound_call_uuid"),
  // Status: ringing | connected | queued | completed | failed
  status: text("status", {
    enum: ["ringing", "connected", "queued", "completed", "failed"],
  })
    .notNull()
    .default("ringing"),
  // Queue position (null if not queued)
  queuePosition: integer("queue_position"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// Call history log
export const callLogs = sqliteTable("call_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenantId: integer("tenant_id").references(() => tenants.id),
  callerNumber: text("caller_number").notNull(),
  vonageNumber: text("vonage_number").notNull(),
  forwardedTo: text("forwarded_to"),
  // outcome: connected | no_answer | queued | unknown_number | no_forward_numbers | all_busy
  outcome: text("outcome").notNull(),
  durationSeconds: integer("duration_seconds"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
