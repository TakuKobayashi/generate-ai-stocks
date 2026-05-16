import * as dotenv from 'dotenv';
dotenv.config();

import type { AIProvider } from '@email-reply/core';

function opt(key: string, def: string): string {
  return process.env[key] ?? def;
}

export const config = {
  aiProvider:  opt('AI_PROVIDER', 'groq') as AIProvider,
  groqApiKey:  process.env.GROQ_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,

  gmail: {
    clientId:    process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    redirectUri: opt('GMAIL_REDIRECT_URI', 'urn:ietf:wg:oauth:2.0:oob'),
    targetLabel: opt('GMAIL_TARGET_LABEL', '要返信'),
    tokenPath:   opt('GMAIL_TOKEN_PATH', './data/gmail-token.json'),
  },

  yahoo: {
    email:        process.env.YAHOO_EMAIL,
    appPassword:  process.env.YAHOO_APP_PASSWORD,
    imapHost:     opt('YAHOO_IMAP_HOST', 'imap.mail.yahoo.co.jp'),
    imapPort:     parseInt(opt('YAHOO_IMAP_PORT', '993')),
    smtpHost:     opt('YAHOO_SMTP_HOST', 'smtp.mail.yahoo.co.jp'),
    smtpPort:     parseInt(opt('YAHOO_SMTP_PORT', '465')),
    targetFolder: opt('YAHOO_TARGET_FOLDER', '要返信'),
  },

  signatureFile: opt('SIGNATURE_FILE', './signature.md'),
  databaseUrl:   opt('DATABASE_URL', './data/emails.db'),
  cronSchedule:  opt('CRON_SCHEDULE', '*/15 * * * *'),
} as const;
