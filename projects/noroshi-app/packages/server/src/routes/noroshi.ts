import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, gte, lte, or, eq, like } from 'drizzle-orm';
import { noroshis, deviceTokens } from '../db/schema';
import {
  encodeGeohash,
  getNeighborGeohashes,
  calculateDistance,
  encodeCoordinate,
  decodeCoordinate,
} from '../utils/geohash';
import { sendNoroshiNotification } from '../utils/fcm';
import { generateId } from '../utils/id';
import type { Env } from '../types/env';

export const noroshiRouter = new Hono<{ Bindings: Env }>();

/**
 * 狼煙一覧取得（現在地から半径2km以内の有効な狼煙）
 * GET /api/noroshis?lat=35.681&lng=139.767
 */
noroshiRouter.get('/', async (c) => {
  const lat = parseFloat(c.req.query('lat') ?? '');
  const lng = parseFloat(c.req.query('lng') ?? '');

  if (isNaN(lat) || isNaN(lng)) {
    return c.json({ success: false, error: 'lat, lng が必須です' }, 400);
  }

  const db = drizzle(c.env.DB);
  const now = new Date();
  const radiusMeters = 2000;

  // 現在地周辺のGeoHashを取得してLIKE検索
  const neighborHashes = getNeighborGeohashes(lat, lng);

  // GeoHash prefix (4文字) でのIN検索
  // precision6 のセル(~610m)を9つ取り、4文字prefix(~40km)で括ることで確実にカバー
  const hashPrefixes = [...new Set(neighborHashes.map(h => h.substring(0, 5)))];

  // GeoHash LIKE検索 + 有効期限フィルタ（インデックスが効く形）
  const conditions = hashPrefixes.map(prefix =>
    like(noroshis.geohash, `${prefix}%`)
  );

  const candidates = await db
    .select()
    .from(noroshis)
    .where(
      and(
        or(...conditions),
        lte(noroshis.startAt, now),
        gte(noroshis.endAt, now)
      )
    )
    .all();

  // Haversineで正確な距離フィルタ
  const filtered = candidates.filter(n => {
    const nLat = decodeCoordinate(n.latitude);
    const nLng = decodeCoordinate(n.longitude);
    const dist = calculateDistance(lat, lng, nLat, nLng);
    return dist <= radiusMeters;
  });

  const result = filtered.map(n => ({
    id: n.id,
    userId: n.userId,
    latitude: decodeCoordinate(n.latitude),
    longitude: decodeCoordinate(n.longitude),
    geohash: n.geohash,
    address: n.address,
    message: n.message,
    startAt: (n.startAt instanceof Date ? n.startAt : new Date(n.startAt * 1000)).toISOString(),
    endAt: (n.endAt instanceof Date ? n.endAt : new Date(n.endAt * 1000)).toISOString(),
    createdAt: (n.createdAt instanceof Date ? n.createdAt : new Date(n.createdAt * 1000)).toISOString(),
  }));

  return c.json({ success: true, data: { noroshis: result } });
});

/**
 * 狼煙を上げる
 * POST /api/noroshis
 */
noroshiRouter.post('/', async (c) => {
  const body = await c.req.json();
  const { userId, latitude, longitude, address, message, startAt, endAt } = body;

  if (!userId || !latitude || !longitude || !address || !startAt || !endAt) {
    return c.json({ success: false, error: '必須フィールドが不足しています' }, 400);
  }

  const db = drizzle(c.env.DB);
  const id = generateId();
  const geohash = encodeGeohash(latitude, longitude);
  const now = new Date();

  const newNoroshi = {
    id,
    userId,
    latitude: encodeCoordinate(latitude),
    longitude: encodeCoordinate(longitude),
    geohash,
    address,
    message: message ?? '',
    startAt: new Date(startAt),
    endAt: new Date(endAt),
    createdAt: now,
  };

  await db.insert(noroshis).values(newNoroshi);

  // 半径2km以内のデバイストークンを取得してPush通知
  const neighborHashes = getNeighborGeohashes(latitude, longitude);
  const hashPrefixes = [...new Set(neighborHashes.map(h => h.substring(0, 5)))];
  const conditions = hashPrefixes.map(prefix =>
    like(deviceTokens.geohash, `${prefix}%`)
  );

  const nearbyDevices = await db
    .select()
    .from(deviceTokens)
    .where(or(...conditions))
    .all();

  // 自分以外のデバイスを距離でフィルタ
  const targetTokens = nearbyDevices
    .filter(d => {
      if (d.userId === userId) return false;
      const dLat = decodeCoordinate(d.latitude);
      const dLng = decodeCoordinate(d.longitude);
      return calculateDistance(latitude, longitude, dLat, dLng) <= 2000;
    })
    .map(d => d.token);

  // FCM送信（非同期、失敗してもレスポンスには影響しない）
  if (targetTokens.length > 0 && c.env.FCM_SERVICE_ACCOUNT) {
    const insertedNoroshi = {
      ...newNoroshi,
      startAt: newNoroshi.startAt,
      endAt: newNoroshi.endAt,
      createdAt: newNoroshi.createdAt,
    };
    c.executionCtx.waitUntil(
      sendNoroshiNotification(
        targetTokens,
        insertedNoroshi,
        c.env.FCM_SERVICE_ACCOUNT,
        c.env.FCM_PROJECT_ID
      )
    );
  }

  return c.json({
    success: true,
    data: {
      id,
      userId,
      latitude,
      longitude,
      geohash,
      address,
      message: message ?? '',
      startAt,
      endAt,
      createdAt: now.toISOString(),
    }
  }, 201);
});

/**
 * 狼煙を消す
 * DELETE /api/noroshis/:id
 */
noroshiRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const userId = c.req.header('X-User-Id');

  if (!userId) {
    return c.json({ success: false, error: 'X-User-Id ヘッダーが必要です' }, 401);
  }

  const db = drizzle(c.env.DB);

  const target = await db
    .select()
    .from(noroshis)
    .where(eq(noroshis.id, id))
    .get();

  if (!target) {
    return c.json({ success: false, error: '狼煙が見つかりません' }, 404);
  }

  if (target.userId !== userId) {
    return c.json({ success: false, error: '権限がありません' }, 403);
  }

  await db.delete(noroshis).where(eq(noroshis.id, id));

  return c.json({ success: true });
});
