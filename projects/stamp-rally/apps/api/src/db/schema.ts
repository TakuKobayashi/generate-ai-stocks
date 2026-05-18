import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';

// ==============================
// 管理者ユーザー (スタンプラリー作成者)
// ==============================
export const adminUsers = sqliteTable('admin_users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ==============================
// ユーザー (スタンプラリー参加者)
// ==============================
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique(),
  passwordHash: text('password_hash'),
  name: text('name'),
  isGuest: integer('is_guest', { mode: 'boolean' }).notNull().default(false),
  guestToken: text('guest_token').unique(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ==============================
// スタンプラリー
// ==============================
export const stampRallies = sqliteTable('stamp_rallies', {
  id: text('id').primaryKey(),
  adminUserId: text('admin_user_id').notNull().references(() => adminUsers.id),
  name: text('name').notNull(),
  description: text('description'),
  startAt: text('start_at').notNull(),
  endAt: text('end_at'),            // null = 無期限
  maxParticipants: integer('max_participants'), // null = 無制限
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  shareToken: text('share_token').notNull().unique(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ==============================
// スタンプラリーの場所
// ==============================
export const stampRallyLocations = sqliteTable('stamp_rally_locations', {
  id: text('id').primaryKey(),
  stampRallyId: text('stamp_rally_id').notNull().references(() => stampRallies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address'),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  sortOrder: integer('sort_order').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ==============================
// 参加情報
// ==============================
export const participations = sqliteTable('participations', {
  id: text('id').primaryKey(),
  stampRallyId: text('stamp_rally_id').notNull().references(() => stampRallies.id),
  userId: text('user_id').notNull().references(() => users.id),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ==============================
// 押されたスタンプ
// ==============================
export const stamps = sqliteTable('stamps', {
  id: text('id').primaryKey(),
  participationId: text('participation_id').notNull().references(() => participations.id, { onDelete: 'cascade' }),
  locationId: text('location_id').notNull().references(() => stampRallyLocations.id),
  pressedAt: text('pressed_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ==============================
// Relations
// ==============================
export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  stampRallies: many(stampRallies),
}));

export const stampRalliesRelations = relations(stampRallies, ({ one, many }) => ({
  adminUser: one(adminUsers, { fields: [stampRallies.adminUserId], references: [adminUsers.id] }),
  locations: many(stampRallyLocations),
  participations: many(participations),
}));

export const stampRallyLocationsRelations = relations(stampRallyLocations, ({ one, many }) => ({
  stampRally: one(stampRallies, { fields: [stampRallyLocations.stampRallyId], references: [stampRallies.id] }),
  stamps: many(stamps),
}));

export const participationsRelations = relations(participations, ({ one, many }) => ({
  stampRally: one(stampRallies, { fields: [participations.stampRallyId], references: [stampRallies.id] }),
  user: one(users, { fields: [participations.userId], references: [users.id] }),
  stamps: many(stamps),
}));

export const stampsRelations = relations(stamps, ({ one }) => ({
  participation: one(participations, { fields: [stamps.participationId], references: [participations.id] }),
  location: one(stampRallyLocations, { fields: [stamps.locationId], references: [stampRallyLocations.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  participations: many(participations),
}));

// ==============================
// Types
// ==============================
export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type StampRally = typeof stampRallies.$inferSelect;
export type NewStampRally = typeof stampRallies.$inferInsert;
export type StampRallyLocation = typeof stampRallyLocations.$inferSelect;
export type NewStampRallyLocation = typeof stampRallyLocations.$inferInsert;
export type Participation = typeof participations.$inferSelect;
export type Stamp = typeof stamps.$inferSelect;
