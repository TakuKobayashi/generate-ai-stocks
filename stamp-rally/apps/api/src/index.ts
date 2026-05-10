import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import adminAuthRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import userRoutes from './routes/user';

export type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
  JWT_SECRET: string;
  FRONTEND_URL: string;
  ENVIRONMENT: string;
};

const app = new Hono<{ Bindings: Env }>();

// ミドルウェア
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:3000';
      const allowed = [frontendUrl, 'http://localhost:3000', 'http://localhost:3001'];
      return allowed.includes(origin) ? origin : frontendUrl;
    },
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

// ヘルスチェック
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ルート定義
app.route('/api/auth/admin', adminAuthRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api', userRoutes);

// R2 ファイルアップロード
app.post('/api/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return c.json({ error: 'ファイルが必要です' }, 400);

  const ext = file.name.split('.').pop() || 'bin';
  const key = `uploads/${crypto.randomUUID()}.${ext}`;
  await c.env.BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  return c.json({ url: `/api/files/${key}` }, 201);
});

// R2 ファイル取得
app.get('/api/files/*', async (c) => {
  const key = c.req.path.replace('/api/files/', '');
  const object = await c.env.BUCKET.get(key);
  if (!object) return c.json({ error: 'ファイルが見つかりません' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000');

  return new Response(object.body, { headers });
});

// エラーハンドリング
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

app.notFound((c) => c.json({ error: 'Not Found' }, 404));

export default app;
