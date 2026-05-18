import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import usersRouter from './routes/users';
import invitesRouter from './routes/invites';
import restaurantsRouter from './routes/restaurants';
import notificationsRouter from './routes/notifications';

// Cloudflare Workers 環境変数の型定義
export type AppEnv = {
  Bindings: {
    DB: D1Database;
    ASSETS: Fetcher;               // 静的アセット (Next.js SSG ビルド)
    HOTPEPPER_API_KEY: string;
    HOTPEPPER_AFFILIATE_ID: string;
    HOTPEPPER_AFFILIATE_PID: string;
    FCM_PROJECT_ID: string;        // Android / Web 共通
    FCM_CLIENT_EMAIL: string;
    FCM_PRIVATE_KEY: string;
    CORS_ORIGIN: string;
  };
};

const app = new Hono<AppEnv>();

// ミドルウェア
app.use('*', logger());
app.use('*', prettyJSON());
app.use('/api/*', async (c, next) => {
  const corsOrigin = c.env.CORS_ORIGIN ?? '*';
  return cors({
    origin: corsOrigin,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-User-Id'],
  })(c, next);
});

// ヘルスチェック
app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

// API ルート登録
app.route('/api/users', usersRouter);
app.route('/api/invites', invitesRouter);
app.route('/api/restaurants', restaurantsRouter);
app.route('/api/notifications', notificationsRouter);

// API 以外は Next.js SSG の静的ファイルを返す
app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Not Found' }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

// エラーハンドリング
app.onError((err, c) => {
  console.error('サーバーエラー:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default app;
