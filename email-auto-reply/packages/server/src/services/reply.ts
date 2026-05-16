import { eq } from 'drizzle-orm';
import type { Env } from '../bindings.js';
import type { EmailMessage } from '@email-reply/core';
import { generateReply, appendSignature } from '@email-reply/core';
import { getDb, schema } from '../db/index.js';
import { fetchGmailMessages, sendGmailReply } from './gmail-api.js';
import { fetchYahooMessages, sendYahooReply } from './yahoo-imap.js';

// ─────────────────────────────────────────────
// DB ヘルパー (D1 + Drizzle)
// ─────────────────────────────────────────────

async function getProcessedIds(env: Env): Promise<Set<string>> {
  const db   = getDb(env.DB);
  const rows = await db
    .select({ id: schema.processedEmails.id })
    .from(schema.processedEmails)
    .all();
  return new Set(rows.map(r => r.id));
}

async function markPending(env: Env, msg: EmailMessage) {
  const db = getDb(env.DB);
  await db.insert(schema.processedEmails).values({
    id:          `${msg.service}:${msg.id}`,
    service:     msg.service,
    emailId:     msg.id,
    subject:     msg.subject,
    fromAddress: msg.from,
    toAddress:   msg.to,
    processedAt: new Date(),
    status:      'pending',
    aiProvider:  env.AI_PROVIDER,
  }).onConflictDoNothing();
}

async function updateStatus(
  env: Env,
  id: string,
  status: 'replied' | 'error' | 'skipped',
  replyMessageId?: string,
  errorMessage?: string,
) {
  const db = getDb(env.DB);
  await db.update(schema.processedEmails)
    .set({ status, replyMessageId, errorMessage })
    .where(eq(schema.processedEmails.id, id));
}

// ─────────────────────────────────────────────
// 1件処理
// ─────────────────────────────────────────────

async function processOne(env: Env, msg: EmailMessage): Promise<void> {
  const id = `${msg.service}:${msg.id}`;
  await markPending(env, msg);

  try {
    const replyText = await generateReply(
      { from: msg.from, subject: msg.subject, body: msg.body },
      {
        provider:     env.AI_PROVIDER,
        groqApiKey:   env.GROQ_API_KEY,
        geminiApiKey: env.GEMINI_API_KEY,
      }
    );
    const fullReply = appendSignature(replyText, env.SIGNATURE ?? '');

    let replyId: string;
    if (msg.service === 'gmail') {
      replyId = await sendGmailReply(env, msg, fullReply);
    } else {
      replyId = await sendYahooReply(env, msg, fullReply);
    }

    await updateStatus(env, id, 'replied', replyId);
    console.log(`[reply] 返信完了 [${msg.service}]: ${msg.subject}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[reply] 返信失敗 [${msg.service}]: ${msg.subject} - ${errMsg}`);
    await updateStatus(env, id, 'error', undefined, errMsg);
  }
}

// ─────────────────────────────────────────────
// Gmail ラベルの全メールを処理する（Cron / Webhook共用）
// ─────────────────────────────────────────────

export async function processGmailEmails(env: Env): Promise<{ processed: number }> {
  const processedIds = await getProcessedIds(env);
  const messages     = await fetchGmailMessages(env, processedIds);
  for (const msg of messages) await processOne(env, msg);
  return { processed: messages.length };
}

export async function processYahooEmails(env: Env): Promise<{ processed: number }> {
  const processedIds = await getProcessedIds(env);
  const messages     = await fetchYahooMessages(env, processedIds);
  for (const msg of messages) await processOne(env, msg);
  return { processed: messages.length };
}

// ─────────────────────────────────────────────
// 特定の Gmail メッセージIDだけを処理する（Webhook用）
// ─────────────────────────────────────────────

export async function processSingleGmailMessage(
  env: Env,
  messageId: string
): Promise<void> {
  const id = `gmail:${messageId}`;
  const db = getDb(env.DB);

  // 処理済みチェック
  const existing = await db
    .select()
    .from(schema.processedEmails)
    .where(eq(schema.processedEmails.id, id))
    .get();

  if (existing) {
    console.log(`[reply] スキップ (処理済み): ${id}`);
    return;
  }

  // Gmail API でメッセージ詳細を取得（単一メッセージ版）
  const { getAccessToken } = await import('./gmail-api.js');
  const { extractGmailBody, getGmailHeader, truncateBody } = await import('@email-reply/core');

  const token = await getAccessToken(env);
  const res   = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Gmail message fetch failed: ${await res.text()}`);

  const full = await res.json<{
    id: string; threadId: string;
    payload?: { headers?: Array<{ name: string; value: string }>; mimeType?: string; body?: { data?: string }; parts?: unknown[] };
  }>();

  const headers = full.payload?.headers ?? [];
  const msg: EmailMessage = {
    id:         full.id,
    service:    'gmail',
    threadId:   full.threadId,
    subject:    getGmailHeader(headers, 'Subject') || '(件名なし)',
    from:       getGmailHeader(headers, 'From'),
    to:         getGmailHeader(headers, 'To'),
    body:       truncateBody(extractGmailBody(full.payload as Record<string, unknown>)),
    messageId:  getGmailHeader(headers, 'Message-ID'),
    references: getGmailHeader(headers, 'References'),
    date:       new Date(),
  };

  await processOne(env, msg);
}

// ─────────────────────────────────────────────
// 履歴取得 (管理API用)
// ─────────────────────────────────────────────

export async function listHistory(env: Env, limit = 20) {
  const db = getDb(env.DB);
  return db.select()
    .from(schema.processedEmails)
    .orderBy(schema.processedEmails.processedAt)
    .limit(limit)
    .all();
}
