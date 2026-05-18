import { Hono } from 'hono';
import { eq, desc, and } from 'drizzle-orm';
import { createDb } from '../db';
import { notifications } from '../db/schema';
import type { AppEnv } from '../index';

const notificationsRouter = new Hono<AppEnv>();

// ユーザーの通知一覧取得
notificationsRouter.get('/:userId', async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.req.param('userId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50'), 100);
  const unreadOnly = c.req.query('unread') === 'true';

  const conditions = [eq(notifications.userId, userId)];
  if (unreadOnly) {
    conditions.push(eq(notifications.isRead, 0));
  }

  const result = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  // dataフィールドをパース
  const parsed = result.map((n) => ({
    ...n,
    data: n.data ? JSON.parse(n.data) : null,
  }));

  return c.json(parsed);
});

// 未読数取得
notificationsRouter.get('/:userId/unread-count', async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.req.param('userId');

  const result = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)));

  return c.json({ count: result.length });
});

// 通知を既読にする
notificationsRouter.put('/:notificationId/read', async (c) => {
  const db = createDb(c.env.DB);
  const notificationId = c.req.param('notificationId');
  const { userId } = await c.req.json<{ userId: string }>();

  await db
    .update(notifications)
    .set({ isRead: 1 })
    .where(
      and(eq(notifications.id, notificationId), eq(notifications.userId, userId))
    );

  return c.json({ success: true });
});

// 全通知を既読にする
notificationsRouter.put('/:userId/read-all', async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.req.param('userId');

  await db
    .update(notifications)
    .set({ isRead: 1 })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, 0)));

  return c.json({ success: true });
});

export default notificationsRouter;
