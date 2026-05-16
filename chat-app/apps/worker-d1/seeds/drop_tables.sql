-- DropTable
-- マイグレーション管理テーブルリセット
DELETE FROM d1_migrations;
-- NOTE: テーブルを追加したらこちらにも忘れず追記
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS passkeys;
DROP TABLE IF EXISTS challenges;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS messages;
