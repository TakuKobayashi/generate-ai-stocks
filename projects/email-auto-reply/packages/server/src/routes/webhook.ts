import { Hono } from 'hono';
import type { Env } from '../bindings.js';
import type { GmailWebhookPayload, GmailPubSubData } from '../lib/index.js';
import { processSingleGmailMessage, processGmailEmails } from '../services/reply.js';
import { getNewMessageIds } from '../services/gmail-api.js';

const webhook = new Hono<{ Bindings: Env }>();

/**
 * POST /webhook/gmail
 *
 * Gmail → Google Cloud Pub/Sub → Cloudflare Workers Webhook
 *
 * 設定手順:
 *   1. Google Cloud Console で Pub/Sub トピックを作成
 *   2. Gmail API で watch() を呼んでトピックをサブスクライブ
 *   3. Pub/Sub サブスクリプションのプッシュエンドポイントに
 *      このURLを設定: https://<worker>.workers.dev/webhook/gmail
 *   4. WEBHOOK_SECRET を Pub/Sub の認証トークンとして設定
 */
webhook.post('/gmail', async (c) => {
  // ─── トークン検証 ───
  const token = c.req.query('token');
  if (token !== c.env.WEBHOOK_SECRET) {
    console.warn('[webhook] 不正なトークン');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let payload: GmailWebhookPayload;
  try {
    payload = await c.req.json<GmailWebhookPayload>();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  // ─── Pub/Sub データのデコード ───
  let pubsubData: GmailPubSubData;
  try {
    const decoded = atob(payload.message.data);
    pubsubData    = JSON.parse(decoded) as GmailPubSubData;
  } catch {
    return c.json({ error: 'Invalid Pub/Sub data' }, 400);
  }

  console.log(`[webhook/gmail] historyId: ${pubsubData.historyId}, email: ${pubsubData.emailAddress}`);

  // ─── 非同期で新着メッセージを処理 ───
  // waitUntil で レスポンス返却後も処理を継続する
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const messageIds = await getNewMessageIds(c.env, String(pubsubData.historyId));
        console.log(`[webhook/gmail] 新着 ${messageIds.length}件`);

        for (const id of messageIds) {
          await processSingleGmailMessage(c.env, id);
        }
      } catch (err) {
        console.error(`[webhook/gmail] 処理エラー: ${err instanceof Error ? err.message : String(err)}`);
      }
    })()
  );

  // Pub/Sub は素早く 200 を返さないと再送してくる
  return c.json({ ok: true });
});

/**
 * GET /webhook/gmail/verify
 * Gmail Pub/Sub のサブスクリプション確認用
 */
webhook.get('/gmail/verify', (c) => {
  const challenge = c.req.query('hub.challenge');
  if (challenge) return c.text(challenge);
  return c.json({ ok: true });
});

/**
 * POST /webhook/gmail/manual-sync
 * ラベル内の全メールを手動同期する（テスト・復旧用）
 */
webhook.post('/gmail/manual-sync', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${c.env.WEBHOOK_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const result = await processGmailEmails(c.env);
  return c.json({ ok: true, ...result });
});

export { webhook as webhookRoutes };
