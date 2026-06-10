import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { deviceTokens } from '../db/schema';
import { encodeGeohash, encodeCoordinate } from '../utils/geohash';
import { generateId } from '../utils/id';
import type { Env } from '../types/env';

export const deviceRouter = new Hono<{ Bindings: Env }>();

/**
 * デバイストークン登録・更新
 * POST /api/devices
 */
deviceRouter.post('/', async (c) => {
  const body = await c.req.json();
  const { userId, token, latitude, longitude } = body;

  if (!userId || !token || !latitude || !longitude) {
    return c.json({ success: false, error: '必須フィールドが不足しています' }, 400);
  }

  const db = drizzle(c.env.DB);
  const geohash = encodeGeohash(latitude, longitude);
  const now = new Date();

  // upsert: userId が既存なら更新
  const existing = await db
    .select()
    .from(deviceTokens)
    .where(eq(deviceTokens.userId, userId))
    .get();

  if (existing) {
    await db
      .update(deviceTokens)
      .set({
        token,
        latitude: encodeCoordinate(latitude),
        longitude: encodeCoordinate(longitude),
        geohash,
        updatedAt: now,
      })
      .where(eq(deviceTokens.userId, userId));
  } else {
    await db.insert(deviceTokens).values({
      id: generateId(),
      userId,
      token,
      latitude: encodeCoordinate(latitude),
      longitude: encodeCoordinate(longitude),
      geohash,
      updatedAt: now,
    });
  }

  return c.json({ success: true });
});

/**
 * デバイストークン削除（ログアウト時）
 * DELETE /api/devices/:userId
 */
deviceRouter.delete('/:userId', async (c) => {
  const userId = c.req.param('userId');
  const db = drizzle(c.env.DB);

  await db.delete(deviceTokens).where(eq(deviceTokens.userId, userId));

  return c.json({ success: true });
});
