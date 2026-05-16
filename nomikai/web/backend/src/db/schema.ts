import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ユーザーテーブル
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  fcmToken: text('fcm_token'),        // Android FCM トークン
  webFcmToken: text('web_fcm_token'), // Web ブラウザ FCM トークン (Firebase JS SDK)
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// フレンド関係テーブル
export const friends = sqliteTable('friends', {
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  friendId: text('friend_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
});

// 飲み会誘いテーブル
export const drinkingInvites = sqliteTable('drinking_invites', {
  id: text('id').primaryKey(),
  creatorId: text('creator_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  dateTime: integer('date_time').notNull(),
  locationLat: real('location_lat'),
  locationLng: real('location_lng'),
  locationName: text('location_name'),
  participantCount: integer('participant_count').notNull().default(2),
  message: text('message'),
  status: text('status').notNull().default('open'),
  createdAt: integer('created_at').notNull(),
});

// 通知テーブル
export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  inviteId: text('invite_id').references(() => drinkingInvites.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  data: text('data'),
  isRead: integer('is_read').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});

// リレーション定義
export const usersRelations = relations(users, ({ many }) => ({
  sentInvites: many(drinkingInvites),
  notifications: many(notifications),
  friends: many(friends, { relationName: 'userFriends' }),
}));

export const drinkingInvitesRelations = relations(drinkingInvites, ({ one, many }) => ({
  creator: one(users, {
    fields: [drinkingInvites.creatorId],
    references: [users.id],
  }),
  notifications: many(notifications),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  invite: one(drinkingInvites, { fields: [notifications.inviteId], references: [drinkingInvites.id] }),
}));

// 型エクスポート
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type DrinkingInvite = typeof drinkingInvites.$inferSelect;
export type NewDrinkingInvite = typeof drinkingInvites.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
