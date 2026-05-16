-- Migration: 0002_webpush_subscriptions.sql

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webpush_user_id ON web_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_webpush_endpoint ON web_push_subscriptions(endpoint);
