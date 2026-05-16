export type ServiceType = 'gmail' | 'yahoo' | 'all';
export type AIProvider = 'groq' | 'gemini';
export type EmailStatus = 'pending' | 'replied' | 'error' | 'skipped';

export interface EmailMessage {
  id: string;
  service: 'gmail' | 'yahoo';
  subject: string;
  from: string;
  to: string;
  body: string;
  messageId: string;
  references: string;
  threadId?: string;
  date: Date;
}

export interface EmailContext {
  from: string;
  subject: string;
  body: string;
}

/** Gmail Pub/Sub Webhook ペイロード */
export interface GmailWebhookPayload {
  message: {
    data: string;
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
