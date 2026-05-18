-- Migration: 0003_use_fcm_for_web.sql
-- web_push_subscriptions テーブルを削除し、
-- users テーブルに web_fcm_token カラムを追加する

ALTER TABLE users ADD COLUMN web_fcm_token TEXT;

-- web_push_subscriptions テーブルは不要になったため削除
DROP TABLE IF EXISTS web_push_subscriptions;
