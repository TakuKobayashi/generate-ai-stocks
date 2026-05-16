import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { createDb } from '../db';
import { drinkingInvites, friends, users, notifications } from '../db/schema';
import { sendFcmToMultiple } from '../services/fcm';
import type { AppEnv } from '../index';

const invitesRouter = new Hono<AppEnv>();

// 飲み会誘い作成 → フレンドへ FCM 通知送信（Android / Web 共通）
invitesRouter.post('/', async (c) => {
  const db = createDb(c.env.DB);
  const body = await c.req.json<{
    creatorId: string;
    dateTime: number;
    locationLat?: number;
    locationLng?: number;
    locationName?: string;
    participantCount: number;
    message?: string;
  }>();

  if (!body.creatorId || !body.dateTime || !body.participantCount) {
    return c.json({ error: '必須項目が不足しています' }, 400);
  }

  const creator = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, body.creatorId))
    .get();

  if (!creator) return c.json({ error: 'ユーザーが見つかりません' }, 404);

  const inviteId = crypto.randomUUID();
  const now = Date.now();

  await db.insert(drinkingInvites).values({
    id: inviteId,
    creatorId: body.creatorId,
    dateTime: body.dateTime,
    locationLat: body.locationLat ?? null,
    locationLng: body.locationLng ?? null,
    locationName: body.locationName ?? null,
    participantCount: body.participantCount,
    message: body.message ?? null,
    status: 'open',
    createdAt: now,
  });

  // フレンドの Android / Web FCM トークンを両方取得
  const friendUsers = await db
    .select({
      id: users.id,
      fcmToken: users.fcmToken,
      webFcmToken: users.webFcmToken,
    })
    .from(friends)
    .innerJoin(users, eq(users.id, friends.friendId))
    .where(eq(friends.userId, body.creatorId));

  const dateStr = new Date(body.dateTime).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const notifTitle = `🍺 ${creator.name}さんが飲みに誘っています！`;
  const notifBody = [
    `日時: ${dateStr}`,
    `人数: ${body.participantCount}人`,
    body.locationName ? `場所: ${body.locationName}` : '',
    body.message ?? '',
  ].filter(Boolean).join(' | ');

  const notifData = {
    type: 'drinking_invite',
    inviteId,
    creatorId: body.creatorId,
    creatorName: creator.name,
  };

  let androidCount = 0;
  let webCount = 0;

  if (friendUsers.length > 0) {
    const androidTokens = friendUsers.map(f => f.fcmToken).filter(Boolean) as string[];
    const webTokens    = friendUsers.map(f => f.webFcmToken).filter(Boolean) as string[];

    // Android と Web は同じ FCM HTTP v1 API で送信できる
    const allTokens = [...androidTokens, ...webTokens];
    if (allTokens.length > 0) {
      const result = await sendFcmToMultiple(c.env, allTokens, notifTitle, notifBody, notifData);
      androidCount = Math.min(result.success, androidTokens.length);
      webCount = result.success - androidCount;
    }

    // 通知レコード保存（アプリ内通知一覧用）
    const notifRecords = friendUsers.map(f => ({
      id: crypto.randomUUID(),
      userId: f.id,
      inviteId,
      title: notifTitle,
      body: notifBody,
      data: JSON.stringify(notifData),
      isRead: 0,
      createdAt: now,
    }));
    await db.insert(notifications).values(notifRecords);
  }

  return c.json({
    success: true,
    inviteId,
    notifiedCount: { android: androidCount, web: webCount, total: androidCount + webCount },
  });
});

// 誘い一覧取得（自分が受けた）
invitesRouter.get('/received/:userId', async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.req.param('userId');

  const friendInvites = await db
    .select({ invite: drinkingInvites, creatorName: users.name })
    .from(friends)
    .innerJoin(drinkingInvites, eq(drinkingInvites.creatorId, friends.friendId))
    .innerJoin(users, eq(users.id, drinkingInvites.creatorId))
    .where(eq(friends.userId, userId))
    .orderBy(desc(drinkingInvites.createdAt))
    .limit(50);

  return c.json(friendInvites.map(r => ({ ...r.invite, creatorName: r.creatorName })));
});

// 自分が作った誘い一覧
invitesRouter.get('/sent/:userId', async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.req.param('userId');

  const result = await db
    .select()
    .from(drinkingInvites)
    .where(eq(drinkingInvites.creatorId, userId))
    .orderBy(desc(drinkingInvites.createdAt))
    .limit(50);

  return c.json(result);
});

// 誘い詳細取得
invitesRouter.get('/:inviteId', async (c) => {
  const db = createDb(c.env.DB);
  const inviteId = c.req.param('inviteId');

  const invite = await db
    .select({
      id: drinkingInvites.id,
      creatorId: drinkingInvites.creatorId,
      creatorName: users.name,
      dateTime: drinkingInvites.dateTime,
      locationLat: drinkingInvites.locationLat,
      locationLng: drinkingInvites.locationLng,
      locationName: drinkingInvites.locationName,
      participantCount: drinkingInvites.participantCount,
      message: drinkingInvites.message,
      status: drinkingInvites.status,
      createdAt: drinkingInvites.createdAt,
    })
    .from(drinkingInvites)
    .innerJoin(users, eq(users.id, drinkingInvites.creatorId))
    .where(eq(drinkingInvites.id, inviteId))
    .get();

  if (!invite) return c.json({ error: '誘いが見つかりません' }, 404);
  return c.json(invite);
});

// ステータス更新
invitesRouter.patch('/:inviteId/status', async (c) => {
  const db = createDb(c.env.DB);
  const inviteId = c.req.param('inviteId');
  const { status, userId } = await c.req.json<{
    status: 'open' | 'closed' | 'cancelled';
    userId: string;
  }>();

  const invite = await db.select().from(drinkingInvites).where(eq(drinkingInvites.id, inviteId)).get();
  if (!invite) return c.json({ error: '誘いが見つかりません' }, 404);
  if (invite.creatorId !== userId) return c.json({ error: '権限がありません' }, 403);

  await db.update(drinkingInvites).set({ status }).where(eq(drinkingInvites.id, inviteId));
  return c.json({ success: true });
});

export default invitesRouter;
