import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as schema from './schema.js';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(dbUrl: string) {
  if (_db) return _db;

  const dbPath = path.resolve(dbUrl);
  const dbDir  = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS processed_emails (
      id              TEXT    PRIMARY KEY NOT NULL,
      service         TEXT    NOT NULL CHECK(service IN ('gmail','yahoo')),
      email_id        TEXT    NOT NULL,
      subject         TEXT,
      from_address    TEXT,
      to_address      TEXT,
      processed_at    INTEGER NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'pending'
                              CHECK(status IN ('pending','replied','error','skipped')),
      error_message   TEXT,
      reply_message_id TEXT,
      ai_provider     TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_service_email ON processed_emails(service, email_id);
    CREATE INDEX IF NOT EXISTS idx_status ON processed_emails(status);
  `);

  _db = drizzle(sqlite, { schema });
  return _db;
}

export { schema };
