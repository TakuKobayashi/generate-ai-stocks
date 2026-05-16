// ─────────────────────────────────────────────
// 共有ドメイン型定義
// CLI / Server 両パッケージから参照する
// ─────────────────────────────────────────────

export type ServiceType = 'gmail' | 'yahoo' | 'all';
export type AIProvider = 'groq' | 'gemini';
export type EmailStatus = 'pending' | 'replied' | 'error' | 'skipped';

/** メール1件を表す共通型 */
export interface EmailMessage {
  /** サービス固有の一意ID */
  id: string;
  service: 'gmail' | 'yahoo';
  subject: string;
  from: string;
  to: string;
  body: string;
  /** RFC 2822 Message-ID ヘッダー */
  messageId: string;
  references: string;
  threadId?: string; // Gmail専用
  date: Date;
}

/** AI に渡す最小コンテキスト */
export interface EmailContext {
  from: string;
  subject: string;
  body: string;
}

/** DB processed_emails テーブル行 */
export interface ProcessedEmailRecord {
  id: string;
  service: 'gmail' | 'yahoo';
  emailId: string;
  subject: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  processedAt: Date;
  status: EmailStatus;
  errorMessage: string | null;
  replyMessageId: string | null;
  aiProvider: string | null;
}

/** Webhook ペイロード (Gmail Pub/Sub → Server) */
export interface GmailWebhookPayload {
  message: {
    data: string; // base64 encoded JSON
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

/** Gmail Pub/Sub data デコード後 */
export interface GmailPubSubData {
  emailAddress: string;
  historyId: number;
}
