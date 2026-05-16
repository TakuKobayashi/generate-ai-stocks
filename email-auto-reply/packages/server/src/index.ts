/**
 * packages/server — Cloudflare Workers エントリポイント
 *
 * ルーティング:
 *   POST /webhook/gmail         Gmail Pub/Sub Webhook
 *   GET  /webhook/gmail/verify  Pub/Sub 確認
 *   POST /webhook/gmail/manual-sync  手動同期
 *   GET  /admin/history         処理済みメール履歴
 *   POST /admin/sync/gmail      Gmail 手動同期
 *   POST /admin/sync/yahoo      Yahoo 手動同期
 *   GET  /health                ヘルスチェック
 *
 * Cron Trigger:
 *   scheduled()  Gmail + Yahoo を定期ポーリング
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './bindings.js';
import { webhookRoutes } from './routes/webhook.js';
import { adminRoutes } from './routes/admin.js';
import { processGmailEmails, processYahooEmails } from './services/reply.js';

const app = new Hono<{ Bindings: Env }>();

// ─────────────────────────────────────────────
// グローバルミドルウェア
// ─────────────────────────────────────────────
app.use('*', logger());
app.use('/admin/*', cors());

// ─────────────────────────────────────────────
// ルート登録
// ─────────────────────────────────────────────
app.route('/webhook', webhookRoutes);
app.route('/admin',   adminRoutes);

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    ts:     new Date().toISOString(),
    ai:     c.env.AI_PROVIDER,
  })
);

app.notFound((c) => c.json({ error: 'Not Found' }, 404));

app.onError((err, c) => {
  console.error('[app] Unhandled error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// ─────────────────────────────────────────────
// Cloudflare Workers エクスポート
// ─────────────────────────────────────────────
export default {
  /**
   * HTTP リクエストハンドラ
   */
  fetch: app.fetch,

  /**
   * Cron Trigger ハンドラ (wrangler.toml の [triggers].crons で設定)
   * デフォルト: 5分ごと
   */
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log(`[cron] 定期チェック開始: ${new Date().toISOString()}`);

    ctx.waitUntil(
      Promise.allSettled([
        processGmailEmails(env).then(r => console.log(`[cron] Gmail: ${r.processed}件処理`)),
        processYahooEmails(env).then(r => console.log(`[cron] Yahoo: ${r.processed}件処理`)),
      ]).then(results => {
        for (const r of results) {
          if (r.status === 'rejected') {
            console.error('[cron] エラー:', r.reason);
          }
        }
      })
    );
  },
};
