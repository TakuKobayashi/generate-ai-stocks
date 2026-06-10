-- 狼煙テーブル
CREATE TABLE IF NOT EXISTS noroshis (
  id          TEXT    NOT NULL PRIMARY KEY,
  user_id     TEXT    NOT NULL,
  latitude    INTEGER NOT NULL,   -- 緯度 * 1e7
  longitude   INTEGER NOT NULL,   -- 経度 * 1e7
  geohash     TEXT    NOT NULL,   -- precision 6
  address     TEXT    NOT NULL,
  message     TEXT    NOT NULL DEFAULT '',
  start_at    INTEGER NOT NULL,   -- Unix timestamp (seconds)
  end_at      INTEGER NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- GeoHash インデックス（LIKE 'xxxxx%' クエリで使用）
CREATE INDEX IF NOT EXISTS geohash_idx        ON noroshis (geohash);
CREATE INDEX IF NOT EXISTS end_at_idx         ON noroshis (end_at);
-- 複合インデックス: WHERE geohash LIKE ? AND start_at <= ? AND end_at >= ?
CREATE INDEX IF NOT EXISTS geohash_end_at_idx ON noroshis (geohash, end_at);

-- デバイストークンテーブル
CREATE TABLE IF NOT EXISTS device_tokens (
  id          TEXT    NOT NULL PRIMARY KEY,
  user_id     TEXT    NOT NULL UNIQUE,
  token       TEXT    NOT NULL,
  latitude    INTEGER NOT NULL,
  longitude   INTEGER NOT NULL,
  geohash     TEXT    NOT NULL,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS device_geohash_idx  ON device_tokens (geohash);
CREATE INDEX IF NOT EXISTS device_user_id_idx  ON device_tokens (user_id);
