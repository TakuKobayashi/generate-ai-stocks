import { Hono } from 'hono';
import type { Env } from '../bindings.js';
import { listHistory, processGmailEmails, processYahooEmails } from '../services/reply.js';

const admin = new Hono<{ Bindings: Env }>();

/** Bearer トークン認証ミドルウェア */
admin.use('/*', async (c, next) => {
  const auth = c.req.header('Authorization');
  if (auth !== `Bearer ${c.env.WEBHOOK_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

/**
 * GET /admin/history?limit=20
 * 処理済みメール履歴を返す
 */
admin.get('/history', async (c) => {
  const limit   = parseInt(c.req.query('limit') ?? '20');
  const records = await listHistory(c.env, limit);
  return c.json({ records });
});

/**
 * POST /admin/sync/gmail
 * Gmail ラベル内のメールを手動同期
 */
admin.post('/sync/gmail', async (c) => {
  const result = await processGmailEmails(c.env);
  return c.json({ ok: true, ...result });
});

/**
 * POST /admin/sync/yahoo
 * Yahoo フォルダ内のメールを手動同期
 */
admin.post('/sync/yahoo', async (c) => {
  const result = await processYahooEmails(c.env);
  return c.json({ ok: true, ...result });
});

export { admin as adminRoutes };
