-- Migration: 0000_initial_schema.sql

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  vonage_number TEXT UNIQUE,
  vonage_app_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS forward_numbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle','busy','unavailable')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, phone_number)
);

CREATE TABLE IF NOT EXISTS call_legs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  inbound_conversation_id TEXT NOT NULL,
  caller_number TEXT NOT NULL,
  forward_number_id INTEGER REFERENCES forward_numbers(id),
  outbound_call_uuid TEXT,
  status TEXT NOT NULL DEFAULT 'ringing' CHECK(status IN ('ringing','connected','queued','completed','failed')),
  queue_position INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER REFERENCES tenants(id),
  caller_number TEXT NOT NULL,
  vonage_number TEXT NOT NULL,
  forwarded_to TEXT,
  outcome TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_forward_numbers_tenant ON forward_numbers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_call_legs_conversation ON call_legs(inbound_conversation_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_tenant ON call_logs(tenant_id);
