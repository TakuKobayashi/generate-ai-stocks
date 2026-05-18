import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const processedEmails = sqliteTable('processed_emails', {
  id:             text('id').primaryKey(),
  service:        text('service', { enum: ['gmail', 'yahoo'] }).notNull(),
  emailId:        text('email_id').notNull(),
  subject:        text('subject'),
  fromAddress:    text('from_address'),
  toAddress:      text('to_address'),
  processedAt:    integer('processed_at', { mode: 'timestamp' }).notNull(),
  status:         text('status', {
                    enum: ['pending', 'replied', 'error', 'skipped'],
                  }).notNull().default('pending'),
  errorMessage:   text('error_message'),
  replyMessageId: text('reply_message_id'),
  aiProvider:     text('ai_provider'),
});

export type ProcessedEmail    = typeof processedEmails.$inferSelect;
export type NewProcessedEmail = typeof processedEmails.$inferInsert;
