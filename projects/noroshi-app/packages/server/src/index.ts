import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { noroshiRouter } from './routes/noroshi';
import { deviceRouter } from './routes/device';
import type { Env } from './types/env';

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-User-Id'],
}));

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/api/noroshis', noroshiRouter);
app.route('/api/devices', deviceRouter);

app.onError((err, c) => {
  console.error(err);
  return c.json({ success: false, error: 'Internal Server Error' }, 500);
});

export default app;
