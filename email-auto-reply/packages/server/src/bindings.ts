import type { AIProvider } from '@email-reply/core';

/**
 * Cloudflare Workers の環境バインディング型
 * wrangler.toml の [vars] / Secrets / D1 / KV に対応する
 */
export interface Env {
  // D1 データベース
  DB: D1Database;

  // AI 設定
  AI_PROVIDER:   AIProvider;
  GROQ_API_KEY:  string;
  GEMINI_API_KEY: string;

  // Gmail OAuth2 トークン（wrangler secret put で設定）
  GMAIL_CLIENT_ID:      string;
  GMAIL_CLIENT_SECRET:  string;
  GMAIL_ACCESS_TOKEN:   string;
  GMAIL_REFRESH_TOKEN:  string;
  GMAIL_TARGET_LABEL:   string;

  // Yahoo Mail
  YAHOO_EMAIL:          string;
  YAHOO_APP_PASSWORD:   string;
  YAHOO_TARGET_FOLDER:  string;
  YAHOO_IMAP_HOST?:     string;
  YAHOO_IMAP_PORT?:     string;
  YAHOO_SMTP_HOST?:     string;
  YAHOO_SMTP_PORT?:     string;

  // Webhook 検証トークン (Gmail Pub/Sub)
  WEBHOOK_SECRET: string;

  // 署名テキスト (Markdown)
  SIGNATURE: string;

  // その他
  LOG_LEVEL?: string;
}
