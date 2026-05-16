import { eq } from 'drizzle-orm';
import type { ServiceType } from '../lib/index.js';
import { generateReply, appendSignature } from '../lib/index.js';
import { getDb, schema } from '../db/index.js';
import { fetchGmailMessages, sendGmailReply } from './gmail.js';
import { fetchYahooMessages, sendYahooReply } from './yahoo.js';
import { loadSignature } from '../utils/signature.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import type { EmailMessage } from '../lib/index.js';
import chalk from 'chalk';

// ─────────────────────────────────────────────
// DB ヘルパー
// ─────────────────────────────────────────────

async function getProcessedIds(): Promise<Set<string>> {
  const db = getDb(config.databaseUrl);
  const rows = await db.select({ id: schema.processedEmails.id }).from(schema.processedEmails).all();
  return new Set(rows.map(r => r.id));
}

async function markPending(msg: EmailMessage) {
  const db = getDb(config.databaseUrl);
  await db.insert(schema.processedEmails).values({
    id:          `${msg.service}:${msg.id}`,
    service:     msg.service,
    emailId:     msg.id,
    subject:     msg.subject,
    fromAddress: msg.from,
    toAddress:   msg.to,
    processedAt: new Date(),
    status:      'pending',
    aiProvider:  config.aiProvider,
  }).onConflictDoNothing();
}

async function updateStatus(
  id: string,
  status: 'replied' | 'error' | 'skipped',
  replyMessageId?: string,
  errorMessage?: string,
) {
  const db = getDb(config.databaseUrl);
  await db.update(schema.processedEmails)
    .set({ status, replyMessageId, errorMessage })
    .where(eq(schema.processedEmails.id, id));
}

// ─────────────────────────────────────────────
// メール処理
// ─────────────────────────────────────────────

async function processOne(msg: EmailMessage, signature: string): Promise<void> {
  const id = `${msg.service}:${msg.id}`;
  const svc = msg.service === 'gmail' ? chalk.blue('Gmail') : chalk.magenta('Yahoo');
  logger.info(`処理中 [${svc}]: ${chalk.bold(msg.subject)} / from: ${msg.from}`);

  await markPending(msg);

  try {
    const replyText = await generateReply(
      { from: msg.from, subject: msg.subject, body: msg.body },
      { provider: config.aiProvider, groqApiKey: config.groqApiKey, geminiApiKey: config.geminiApiKey }
    );
    const fullReply = appendSignature(replyText, signature);

    let replyId: string;
    if (msg.service === 'gmail') {
      replyId = await sendGmailReply(msg, fullReply);
    } else {
      replyId = await sendYahooReply(msg, fullReply);
    }

    await updateStatus(id, 'replied', replyId);
    logger.success(`返信送信完了 [${svc}]: ${msg.subject}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error(`返信失敗 [${msg.service}]: ${msg.subject} - ${errMsg}`);
    await updateStatus(id, 'error', undefined, errMsg);
  }
}

export async function processEmails(service: ServiceType): Promise<void> {
  const processedIds = await getProcessedIds();
  const signature    = loadSignature(config.signatureFile);

  let gmailCount = 0;
  let yahooCount = 0;

  if (service === 'gmail' || service === 'all') {
    try {
      const msgs = await fetchGmailMessages(processedIds);
      gmailCount = msgs.length;
      for (const msg of msgs) await processOne(msg, signature);
    } catch (err) {
      logger.error(`Gmail処理エラー: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (service === 'yahoo' || service === 'all') {
    try {
      const msgs = await fetchYahooMessages(processedIds);
      yahooCount = msgs.length;
      for (const msg of msgs) await processOne(msg, signature);
    } catch (err) {
      logger.error(`Yahoo処理エラー: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const total = gmailCount + yahooCount;
  if (total === 0) {
    logger.info('処理するメールはありませんでした');
  } else {
    logger.success(`完了: Gmail ${gmailCount}件 / Yahoo ${yahooCount}件 処理`);
  }
}

export async function listHistory(limit = 20) {
  const db = getDb(config.databaseUrl);
  return db.select().from(schema.processedEmails)
    .orderBy(schema.processedEmails.processedAt)
    .limit(limit)
    .all();
}
