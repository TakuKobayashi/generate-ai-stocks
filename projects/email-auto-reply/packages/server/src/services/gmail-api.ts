/**
 * Gmail API クライアント (Workers 版)
 * googleapis SDK は Node.js 専用のため、
 * fetch ベースで直接 Gmail REST API を呼び出す
 */

import type { Env } from '../bindings.js';
import type { EmailMessage } from '../lib/index.js';
import { extractGmailBody, getGmailHeader, truncateBody } from '../lib/index.js';

// ─────────────────────────────────────────────
// OAuth2 アクセストークンのリフレッシュ
// ─────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export async function getAccessToken(env: Env): Promise<string> {
  // Secrets に直接アクセストークンを保存している場合はそちらを使用
  // 本番では KV にキャッシュする実装も推奨
  if (env.GMAIL_ACCESS_TOKEN) {
    return env.GMAIL_ACCESS_TOKEN;
  }

  // リフレッシュトークンを使って新しいアクセストークンを取得
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: env.GMAIL_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail token refresh failed: ${body}`);
  }

  const data = await res.json<TokenResponse>();
  return data.access_token;
}

// ─────────────────────────────────────────────
// Gmail API ヘルパー
// ─────────────────────────────────────────────

async function gmailFetch<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail API error [${res.status}]: ${body}`);
  }
  return res.json<T>();
}

// ─────────────────────────────────────────────
// ラベルIDの解決
// ─────────────────────────────────────────────

interface LabelListResponse {
  labels: Array<{ id: string; name: string }>;
}

async function getLabelId(token: string, labelName: string): Promise<string | null> {
  const data = await gmailFetch<LabelListResponse>('/users/me/labels', token);
  return data.labels.find(l => l.name === labelName)?.id ?? null;
}

// ─────────────────────────────────────────────
// メッセージ取得
// ─────────────────────────────────────────────

interface MessageListResponse {
  messages?: Array<{ id: string; threadId: string }>;
}

interface GmailMessagePayload {
  mimeType?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string };
  parts?: GmailMessagePayload[];
}

interface GmailMessageResponse {
  id:        string;
  threadId:  string;
  payload?:  GmailMessagePayload;
}

export async function fetchGmailMessages(
  env: Env,
  processedIds: Set<string>
): Promise<EmailMessage[]> {
  const token = await getAccessToken(env);
  const labelName = env.GMAIL_TARGET_LABEL || '要返信';

  const labelId = await getLabelId(token, labelName);
  if (!labelId) throw new Error(`Gmailラベル "${labelName}" が見つかりません`);

  const list = await gmailFetch<MessageListResponse>(
    `/users/me/messages?labelIds=${labelId}&maxResults=50`,
    token
  );

  const messages = list.messages ?? [];
  const result: EmailMessage[] = [];

  for (const msg of messages) {
    if (processedIds.has(`gmail:${msg.id}`)) continue;

    const full = await gmailFetch<GmailMessageResponse>(
      `/users/me/messages/${msg.id}?format=full`,
      token
    );

    const headers  = full.payload?.headers ?? [];
    const subject  = getGmailHeader(headers, 'Subject') || '(件名なし)';
    const from     = getGmailHeader(headers, 'From');
    const to       = getGmailHeader(headers, 'To');
    const messageId = getGmailHeader(headers, 'Message-ID');
    const references = getGmailHeader(headers, 'References');
    const body     = truncateBody(extractGmailBody(full.payload as Record<string, unknown>));

    result.push({
      id: msg.id, service: 'gmail', threadId: msg.threadId,
      subject, from, to, body, messageId, references, date: new Date(),
    });
  }

  return result;
}

// ─────────────────────────────────────────────
// 返信送信
// ─────────────────────────────────────────────

export async function sendGmailReply(
  env: Env,
  original: EmailMessage,
  replyBody: string
): Promise<string> {
  const token    = await getAccessToken(env);
  const myEmail  = env.GMAIL_ACCESS_TOKEN
    ? await getMyEmail(token)
    : env.YAHOO_EMAIL; // fallback (通常は取得する)

  const subject    = original.subject.startsWith('Re:') ? original.subject : `Re: ${original.subject}`;
  const references = original.references
    ? `${original.references} ${original.messageId}`
    : original.messageId;

  // base64 エンコード (Workers は atob/btoa のみ利用可)
  const bodyB64 = btoa(unescape(encodeURIComponent(replyBody)));
  const subjectB64 = btoa(unescape(encodeURIComponent(subject)));

  const raw = [
    `From: ${myEmail}`,
    `To: ${original.from}`,
    `Subject: =?UTF-8?B?${subjectB64}?=`,
    `In-Reply-To: ${original.messageId}`,
    `References: ${references}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    '',
    bodyB64,
  ].join('\r\n');

  // URL-safe base64
  const encoded = btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const res = await gmailFetch<{ id: string }>(
    '/users/me/messages/send',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ raw: encoded, threadId: original.threadId }),
    }
  );
  return res.id;
}

async function getMyEmail(token: string): Promise<string> {
  const data = await gmailFetch<{ emailAddress: string }>('/users/me/profile', token);
  return data.emailAddress;
}

// ─────────────────────────────────────────────
// Gmail History API: Webhook でメール変更を検知
// ─────────────────────────────────────────────

interface HistoryResponse {
  history?: Array<{
    messagesAdded?: Array<{ message: { id: string; threadId: string } }>;
  }>;
  historyId: string;
}

/**
 * Gmail Pub/Sub Webhook から historyId を受け取り
 * 新着メッセージIDのリストを返す
 */
export async function getNewMessageIds(
  env: Env,
  startHistoryId: string
): Promise<string[]> {
  const token = await getAccessToken(env);
  const data = await gmailFetch<HistoryResponse>(
    `/users/me/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded`,
    token
  );

  const ids: string[] = [];
  for (const h of data.history ?? []) {
    for (const added of h.messagesAdded ?? []) {
      ids.push(added.message.id);
    }
  }
  return ids;
}
