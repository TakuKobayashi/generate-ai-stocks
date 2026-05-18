import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDb } from '../db';
import { users, friends } from '../db/schema';
import type { AppEnv } from '../index';

const usersRouter = new Hono<AppEnv>();

// ユーザー登録 / FCMトークン更新
usersRouter.post('/register', async (c) => {
  const db = createDb(c.env.DB);
  const body = await c.req.json<{
    userId: string;
    name: string;
    fcmToken?: string;      // Android FCM トークン
    webFcmToken?: string;   // Web ブラウザ FCM トークン
  }>();

  if (!body.userId || !body.name) {
    return c.json({ error: 'userId と name は必須です' }, 400);
  }

  const now = Date.now();

  await db
    .insert(users)
    .values({
      id: body.userId,
      name: body.name,
      fcmToken: body.fcmToken ?? null,
      webFcmToken: body.webFcmToken ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        name: body.name,
        fcmToken: body.fcmToken ?? null,
        webFcmToken: body.webFcmToken ?? null,
        updatedAt: now,
      },
    });

  return c.json({ success: true, userId: body.userId });
});

// Android FCM トークン更新
usersRouter.put('/:userId/fcm-token', async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.req.param('userId');
  const { fcmToken } = await c.req.json<{ fcmToken: string }>();

  if (!fcmToken) return c.json({ error: 'fcmToken は必須です' }, 400);

  await db
    .update(users)
    .set({ fcmToken, updatedAt: Date.now() })
    .where(eq(users.id, userId));

  return c.json({ success: true });
});

// Web FCM トークン更新（Firebase JS SDK から取得したトークン）
usersRouter.put('/:userId/web-fcm-token', async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.req.param('userId');
  const { webFcmToken } = await c.req.json<{ webFcmToken: string | null }>();

  await db
    .update(users)
    .set({ webFcmToken: webFcmToken ?? null, updatedAt: Date.now() })
    .where(eq(users.id, userId));

  return c.json({ success: true });
});

// フレンド追加
usersRouter.post('/:userId/friends', async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.req.param('userId');
  const { friendId } = await c.req.json<{ friendId: string }>();

  const now = Date.now();

  await db
    .insert(friends)
    .values([
      { userId, friendId, createdAt: now },
      { userId: friendId, friendId: userId, createdAt: now },
    ])
    .onConflictDoNothing();

  return c.json({ success: true });
});

// フレンド一覧取得
usersRouter.get('/:userId/friends', async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.req.param('userId');

  const result = await db
    .select({ id: users.id, name: users.name })
    .from(friends)
    .innerJoin(users, eq(users.id, friends.friendId))
    .where(eq(friends.userId, userId));

  return c.json(result);
});

// ユーザー情報取得
usersRouter.get('/:userId', async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.req.param('userId');

  const user = await db
    .select({ id: users.id, name: users.name, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) return c.json({ error: 'ユーザーが見つかりません' }, 404);

  return c.json(user);
});

export default usersRouter;
