import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// 狼煙テーブル
export const noroshis = sqliteTable('noroshis', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  latitude: integer('latitude').notNull(), // 緯度 * 1e7 (整数化)
  longitude: integer('longitude').notNull(), // 経度 * 1e7 (整数化)
  geohash: text('geohash').notNull(), // GeoHash (精度6)
  address: text('address').notNull(),
  message: text('message').notNull().default(''),
  startAt: integer('start_at', { mode: 'timestamp' }).notNull(),
  endAt: integer('end_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  // GeoHashによる検索を高速化
  geohashIdx: index('geohash_idx').on(table.geohash),
  // 有効期限でフィルタするためのインデックス
  endAtIdx: index('end_at_idx').on(table.endAt),
  // 複合インデックス: GeoHashと有効期限での絞り込みを最適化
  geohashEndAtIdx: index('geohash_end_at_idx').on(table.geohash, table.endAt),
}));

// デバイストークンテーブル（Push通知用）
export const deviceTokens = sqliteTable('device_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  token: text('token').notNull(),
  latitude: integer('latitude').notNull(),
  longitude: integer('longitude').notNull(),
  geohash: text('geohash').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  geohashIdx: index('device_geohash_idx').on(table.geohash),
  userIdIdx: index('device_user_id_idx').on(table.userId),
}));

export type Noroshi = typeof noroshis.$inferSelect;
export type NewNoroshi = typeof noroshis.$inferInsert;
export type DeviceToken = typeof deviceTokens.$inferSelect;
export type NewDeviceToken = typeof deviceTokens.$inferInsert;
