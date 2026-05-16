/**
 * Yahoo Mail IMAP クライアント (Workers 版)
 *
 * Cloudflare Workers は TCP ソケット (connect()) をサポートするため
 * imapflow の代わりに fetch ベースの IMAP-over-HTTP プロキシは使わず、
 * Workers の `connect()` API (nodejs_compat) 経由で IMAP を直接接続する。
 *
 * ただし Workers の IMAP 直接接続は複雑なため、
 * 実用上は外部の IMAP-HTTP ブリッジ（例: Cloudflare Tunnel 経由の
 * 自前 Node サーバー）か、Yahoo OAuth2 REST API を利用する方が現実的。
 *
 * このファイルでは「Yahoo IMAP をポーリングする Cron Worker」の
 * 実装パターンとして、Workers TCP Socket API を使った骨格を提供する。
 * 実際の IMAP プロトコル実装は node-imap ライクな軽量ライブラリに委ねる想定。
 */

import type { Env } from '../bindings.js';
import type { EmailMessage } from '@email-reply/core';

/**
 * Yahoo IMAP ポーリング
 *
 * Workers 環境では IMAP TCP ソケット接続が可能だが、
 * プロトコルスタックの完全実装は複雑になるため、
 * 実プロジェクトでは下記いずれかを推奨:
 *
 * A) Cloudflare Workers から自前の Node.js IMAPプロキシ (別Worker or VPS) を HTTP で呼び出す
 * B) Yahoo OAuth2 REST API (Yahoo Mail API) を利用する
 * C) CLI (packages/cli) の cron watch で IMAP を担当し、
 *    Workers は Gmail Webhook 専用と役割を分担する
 *
 * ここでは C パターン（Gmail Webhook = Workers、Yahoo = CLI cron）の
 * インターフェイスのみ定義し、将来の実装に備えたスタブとする。
 */
export async function fetchYahooMessages(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _env: Env,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _processedIds: Set<string>
): Promise<EmailMessage[]> {
  // TODO: Workers TCP Socket を使った IMAP 実装 or 外部プロキシ呼び出し
  // 現時点では CLI の watch コマンドで代替
  return [];
}

/**
 * Yahoo SMTP 送信 (Workers 版)
 * Workers からは直接 SMTP 接続できないため、
 * Cloudflare Email Routing または外部 SMTP プロキシ経由で送信する
 *
 * 推奨: SendGrid / Resend / Mailchannels の REST API を使う
 */
export async function sendYahooReply(
  env: Env,
  original: EmailMessage,
  replyBody: string
): Promise<string> {
  // Mailchannels (Cloudflare Workers で無料送信可能)
  const subject = original.subject.startsWith('Re:')
    ? original.subject
    : `Re: ${original.subject}`;

  const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: original.from }] }],
      from: { email: env.YAHOO_EMAIL },
      subject,
      content: [{ type: 'text/plain', value: replyBody }],
      headers: {
        'In-Reply-To': original.messageId,
        References:    original.messageId,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mailchannels送信エラー: ${body}`);
  }

  return `mailchannels-${Date.now()}`;
}
