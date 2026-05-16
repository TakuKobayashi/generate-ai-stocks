-- D1 マイグレーション: 初期スキーマ
-- 実行: wrangler d1 migrations apply email-reply-db

CREATE TABLE IF NOT EXISTS processed_emails (
  id               TEXT    PRIMARY KEY NOT NULL,
  service          TEXT    NOT NULL CHECK(service IN ('gmail','yahoo')),
  email_id         TEXT    NOT NULL,
  subject          TEXT,
  from_address     TEXT,
  to_address       TEXT,
  processed_at     INTEGER NOT NULL,
  status           TEXT    NOT NULL DEFAULT 'pending'
                           CHECK(status IN ('pending','replied','error','skipped')),
  error_message    TEXT,
  reply_message_id TEXT,
  ai_provider      TEXT
);

CREATE INDEX IF NOT EXISTS idx_service_email ON processed_emails(service, email_id);
CREATE INDEX IF NOT EXISTS idx_status        ON processed_emails(status);
CREATE INDEX IF NOT EXISTS idx_processed_at  ON processed_emails(processed_at);
