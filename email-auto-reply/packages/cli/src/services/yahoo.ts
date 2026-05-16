import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import type { EmailMessage } from '../lib/index.js';
import { htmlToPlainText, truncateBody } from '../lib/index.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

function createImapClient(): ImapFlow {
  if (!config.yahoo.email || !config.yahoo.appPassword) {
    throw new Error('YAHOO_EMAIL / YAHOO_APP_PASSWORD が未設定です');
  }
  return new ImapFlow({
    host:   config.yahoo.imapHost,
    port:   config.yahoo.imapPort,
    secure: true,
    auth:   { user: config.yahoo.email, pass: config.yahoo.appPassword },
    logger: false,
  });
}

export async function fetchYahooMessages(processedIds: Set<string>): Promise<EmailMessage[]> {
  const client = createImapClient();
  const result: EmailMessage[] = [];

  try {
    await client.connect();
    const folderName = config.yahoo.targetFolder;
    logger.step(`Yahooフォルダ "${folderName}" をチェック中...`);

    const lock = await client.getMailboxLock(folderName);
    try {
      if (!client.mailbox || client.mailbox.exists === 0) {
        logger.info('Yahoo: 新しいメールはありません');
        return [];
      }

      for await (const msg of client.fetch('1:*', { uid: true, envelope: true, source: true })) {
        const uid = msg.uid.toString();
        if (processedIds.has(`yahoo:${uid}`)) continue;

        const envelope = msg.envelope;
        if (!envelope) continue;

        const fromAddr = envelope.from?.[0];
        const from = fromAddr ? `${fromAddr.name ? fromAddr.name + ' ' : ''}<${fromAddr.address}>` : '';
        const to = envelope.to?.[0] ? `<${envelope.to[0].address}>` : '';

        let body = '';
        if (msg.source) {
          const raw = msg.source.toString('utf-8');
          if (raw.includes('<html') || raw.includes('<body')) {
            body = htmlToPlainText(raw);
          } else {
            const idx = raw.indexOf('\r\n\r\n');
            body = idx >= 0 ? raw.substring(idx + 4) : raw;
          }
        }

        result.push({
          id:         uid,
          service:    'yahoo',
          subject:    envelope.subject || '(件名なし)',
          from,
          to,
          body:       truncateBody(body),
          messageId:  envelope.messageId || '',
          references: '',
          date:       envelope.date || new Date(),
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  logger.info(`Yahoo: ${result.length}件の未処理メールを検出`);
  return result;
}

export async function sendYahooReply(original: EmailMessage, replyBody: string): Promise<string> {
  if (!config.yahoo.email || !config.yahoo.appPassword) {
    throw new Error('YAHOO_EMAIL / YAHOO_APP_PASSWORD が未設定です');
  }
  const transporter = nodemailer.createTransport({
    host:   config.yahoo.smtpHost,
    port:   config.yahoo.smtpPort,
    secure: true,
    auth:   { user: config.yahoo.email, pass: config.yahoo.appPassword },
  });

  const subject = original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`;
  const info = await transporter.sendMail({
    from:       config.yahoo.email,
    to:         original.from,
    subject,
    text:       replyBody,
    inReplyTo:  original.messageId,
    references: original.messageId,
    encoding:   'utf-8',
  });
  return info.messageId;
}
