import { google, gmail_v1 } from 'googleapis';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import type { EmailMessage } from '@email-reply/core';
import { extractGmailBody, getGmailHeader, truncateBody } from '@email-reply/core';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

// googleapis の OAuth2Client 型を alias で使う
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

function createOAuth2Client(): OAuth2Client {
  if (!config.gmail.clientId || !config.gmail.clientSecret) {
    throw new Error('GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET が未設定です');
  }
  return new google.auth.OAuth2(
    config.gmail.clientId,
    config.gmail.clientSecret,
    config.gmail.redirectUri
  );
}

export function loadGmailToken(): OAuth2Client | null {
  const tokenPath = path.resolve(config.gmail.tokenPath);
  if (!fs.existsSync(tokenPath)) return null;
  const client = createOAuth2Client();
  client.setCredentials(JSON.parse(fs.readFileSync(tokenPath, 'utf-8')));
  return client;
}

export async function authenticateGmail(): Promise<OAuth2Client> {
  const client = createOAuth2Client();
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.labels',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
  });

  console.log('\n以下のURLをブラウザで開いて認証してください:\n');
  console.log(authUrl);
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = await new Promise<string>(resolve => {
    rl.question('認証コードを入力してください: ', ans => { rl.close(); resolve(ans.trim()); });
  });

  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const tokenDir = path.dirname(path.resolve(config.gmail.tokenPath));
  if (!fs.existsSync(tokenDir)) fs.mkdirSync(tokenDir, { recursive: true });
  fs.writeFileSync(config.gmail.tokenPath, JSON.stringify(tokens, null, 2));
  logger.success(`トークンを保存しました: ${config.gmail.tokenPath}`);
  return client;
}

async function getLabelId(gmail: gmail_v1.Gmail, name: string): Promise<string | null> {
  const res = await gmail.users.labels.list({ userId: 'me' });
  return res.data.labels?.find(l => l.name === name)?.id ?? null;
}

export async function fetchGmailMessages(processedIds: Set<string>): Promise<EmailMessage[]> {
  const auth = loadGmailToken();
  if (!auth) throw new Error('Gmail未認証。`email-reply auth gmail` を実行してください。');

  const gmail = google.gmail({ version: 'v1', auth });
  const labelId = await getLabelId(gmail, config.gmail.targetLabel);
  if (!labelId) {
    throw new Error(`Gmailラベル "${config.gmail.targetLabel}" が見つかりません`);
  }

  logger.step(`Gmailラベル "${config.gmail.targetLabel}" をチェック中...`);

  const listRes = await gmail.users.messages.list({ userId: 'me', labelIds: [labelId], maxResults: 50 });
  const messages = listRes.data.messages ?? [];
  const result: EmailMessage[] = [];

  for (const msg of messages) {
    const emailId = msg.id!;
    if (processedIds.has(`gmail:${emailId}`)) continue;

    const full = await gmail.users.messages.get({ userId: 'me', id: emailId, format: 'full' });
    type H = { name?: string; value?: string };
    const headers = (full.data.payload?.headers ?? []) as H[];

    result.push({
      id:         emailId,
      service:    'gmail',
      threadId:   full.data.threadId ?? undefined,
      subject:    getGmailHeader(headers, 'Subject') || '(件名なし)',
      from:       getGmailHeader(headers, 'From'),
      to:         getGmailHeader(headers, 'To'),
      body:       truncateBody(extractGmailBody(full.data.payload as Record<string, unknown>)),
      messageId:  getGmailHeader(headers, 'Message-ID'),
      references: getGmailHeader(headers, 'References'),
      date:       new Date(),
    });
  }

  logger.info(`Gmail: ${result.length}件の未処理メールを検出`);
  return result;
}

export async function sendGmailReply(original: EmailMessage, replyBody: string): Promise<string> {
  const auth = loadGmailToken();
  if (!auth) throw new Error('Gmail未認証');

  const gmail = google.gmail({ version: 'v1', auth });
  const profile = await gmail.users.getProfile({ userId: 'me' });
  const myEmail = profile.data.emailAddress!;

  const subject = original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`;
  const references = original.references
    ? `${original.references} ${original.messageId}`
    : original.messageId;

  const raw = [
    `From: ${myEmail}`,
    `To: ${original.from}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    `In-Reply-To: ${original.messageId}`,
    `References: ${references}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    '',
    Buffer.from(replyBody).toString('base64'),
  ].join('\r\n');

  const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded, threadId: original.threadId },
  });
  return res.data.id!;
}
