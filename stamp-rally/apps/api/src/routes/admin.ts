import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, count, and } from 'drizzle-orm';
import { stampRallies, stampRallyLocations, participations, stamps } from '../db/schema';
import { adminAuth } from '../middleware/auth';
import { generateId, generateToken } from '../utils/crypto';
import type { Env } from '../index';

const app = new Hono<{ Bindings: Env }>();

// 全ルートに管理者認証を適用
app.use('*', adminAuth);

// ========================
// スタンプラリー一覧取得
// ========================
app.get('/stamp-rallies', async (c) => {
  const adminUserId = c.get('adminUserId');
  const db = drizzle(c.env.DB);

  const rallies = await db
    .select()
    .from(stampRallies)
    .where(eq(stampRallies.adminUserId, adminUserId))
    .orderBy(desc(stampRallies.createdAt))
    .all();

  // 参加者数とコンプリート数を集計
  const ralliesWithStats = await Promise.all(
    rallies.map(async (rally) => {
      const [{ participantCount }] = await db
        .select({ participantCount: count() })
        .from(participations)
        .where(eq(participations.stampRallyId, rally.id));

      const [{ completedCount }] = await db
        .select({ completedCount: count() })
        .from(participations)
        .where(
          and(
            eq(participations.stampRallyId, rally.id),
            // completedAt IS NOT NULL
          )
        );

      const locations = await db
        .select()
        .from(stampRallyLocations)
        .where(eq(stampRallyLocations.stampRallyId, rally.id))
        .orderBy(stampRallyLocations.sortOrder)
        .all();

      return {
        ...rally,
        participantCount,
        completedCount,
        locations,
      };
    })
  );

  return c.json({ rallies: ralliesWithStats });
});

// ========================
// スタンプラリー詳細取得
// ========================
app.get('/stamp-rallies/:id', async (c) => {
  const adminUserId = c.get('adminUserId');
  const { id } = c.req.param();
  const db = drizzle(c.env.DB);

  const rally = await db
    .select()
    .from(stampRallies)
    .where(and(eq(stampRallies.id, id), eq(stampRallies.adminUserId, adminUserId)))
    .get();

  if (!rally) return c.json({ error: 'スタンプラリーが見つかりません' }, 404);

  const locations = await db
    .select()
    .from(stampRallyLocations)
    .where(eq(stampRallyLocations.stampRallyId, id))
    .orderBy(stampRallyLocations.sortOrder)
    .all();

  const [{ participantCount }] = await db
    .select({ participantCount: count() })
    .from(participations)
    .where(eq(participations.stampRallyId, id));

  const [{ completedCount }] = await db
    .select({ completedCount: count() })
    .from(participations)
    .where(eq(participations.stampRallyId, id))
    .where(eq(participations.stampRallyId, id)); // TODO: AND completedAt IS NOT NULL

  const shareUrl = `${c.env.FRONTEND_URL}/join/${rally.shareToken}`;

  return c.json({ rally: { ...rally, locations, participantCount, completedCount, shareUrl } });
});

// ========================
// スタンプラリー作成
// ========================
app.post(
  '/stamp-rallies',
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      startAt: z.string(),
      endAt: z.string().optional(),
      maxParticipants: z.number().int().positive().optional(),
      locations: z
        .array(
          z.object({
            name: z.string().min(1),
            address: z.string().optional(),
            latitude: z.number(),
            longitude: z.number(),
          })
        )
        .min(1),
    })
  ),
  async (c) => {
    const adminUserId = c.get('adminUserId');
    const body = c.req.valid('json');
    const db = drizzle(c.env.DB);

    const rallyId = generateId();
    const shareToken = generateToken(10);

    await db.insert(stampRallies).values({
      id: rallyId,
      adminUserId,
      name: body.name,
      description: body.description,
      startAt: body.startAt,
      endAt: body.endAt,
      maxParticipants: body.maxParticipants,
      shareToken,
    });

    const locationValues = body.locations.map((loc, index) => ({
      id: generateId(),
      stampRallyId: rallyId,
      name: loc.name,
      address: loc.address,
      latitude: loc.latitude,
      longitude: loc.longitude,
      sortOrder: index,
    }));

    await db.insert(stampRallyLocations).values(locationValues);

    const shareUrl = `${c.env.FRONTEND_URL}/join/${shareToken}`;

    return c.json(
      {
        rally: {
          id: rallyId,
          shareToken,
          shareUrl,
          name: body.name,
          locations: locationValues,
        },
      },
      201
    );
  }
);

// ========================
// スタンプラリー有効/無効切替
// ========================
app.patch('/stamp-rallies/:id/toggle', async (c) => {
  const adminUserId = c.get('adminUserId');
  const { id } = c.req.param();
  const db = drizzle(c.env.DB);

  const rally = await db
    .select()
    .from(stampRallies)
    .where(and(eq(stampRallies.id, id), eq(stampRallies.adminUserId, adminUserId)))
    .get();

  if (!rally) return c.json({ error: 'スタンプラリーが見つかりません' }, 404);

  const newIsActive = !rally.isActive;
  await db
    .update(stampRallies)
    .set({ isActive: newIsActive, updatedAt: new Date().toISOString() })
    .where(eq(stampRallies.id, id));

  return c.json({ isActive: newIsActive });
});

// ========================
// スタンプラリー更新
// ========================
app.put(
  '/stamp-rallies/:id',
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      endAt: z.string().nullable().optional(),
      maxParticipants: z.number().int().positive().nullable().optional(),
    })
  ),
  async (c) => {
    const adminUserId = c.get('adminUserId');
    const { id } = c.req.param();
    const body = c.req.valid('json');
    const db = drizzle(c.env.DB);

    const rally = await db
      .select()
      .from(stampRallies)
      .where(and(eq(stampRallies.id, id), eq(stampRallies.adminUserId, adminUserId)))
      .get();

    if (!rally) return c.json({ error: 'スタンプラリーが見つかりません' }, 404);

    await db
      .update(stampRallies)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(stampRallies.id, id));

    return c.json({ success: true });
  }
);

export default app;
