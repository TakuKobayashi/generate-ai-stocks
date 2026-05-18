import { Hono } from 'hono';
import { searchRestaurants } from '../services/hotpepper';
import type { AppEnv } from '../index';

const restaurantsRouter = new Hono<AppEnv>();

// 周辺飲食店検索（ホットペッパーAPI）
restaurantsRouter.get('/nearby', async (c) => {
  const lat = parseFloat(c.req.query('lat') ?? '');
  const lng = parseFloat(c.req.query('lng') ?? '');
  const range = parseInt(c.req.query('range') ?? '3') as 1 | 2 | 3 | 4 | 5;
  const count = parseInt(c.req.query('count') ?? '10');
  const keyword = c.req.query('keyword');

  if (isNaN(lat) || isNaN(lng)) {
    return c.json({ error: 'lat と lng は必須です' }, 400);
  }

  if (range < 1 || range > 5) {
    return c.json({ error: 'range は 1〜5 で指定してください' }, 400);
  }

  try {
    const restaurants = await searchRestaurants(
      c.env.HOTPEPPER_API_KEY,
      c.env.HOTPEPPER_AFFILIATE_ID,
      c.env.HOTPEPPER_AFFILIATE_PID,
      { lat, lng, range, count: Math.min(count, 20), keyword }
    );

    return c.json({
      results: restaurants,
      total: restaurants.length,
      searchInfo: {
        lat,
        lng,
        range,
        // rangeの対応距離を返す
        radiusMeters: [300, 500, 1000, 2000, 3000][range - 1],
      },
    });
  } catch (e) {
    console.error('ホットペッパーAPI エラー:', e);
    return c.json({ error: '飲食店検索に失敗しました' }, 500);
  }
});

export default restaurantsRouter;
