-- Migration: 0000_initial
-- スタンプラリーサービス 初期スキーマ

CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL UNIQUE,
  `password_hash` text NOT NULL,
  `name` text NOT NULL,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text UNIQUE,
  `password_hash` text,
  `name` text,
  `is_guest` integer NOT NULL DEFAULT 0,
  `guest_token` text UNIQUE,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `stamp_rallies` (
  `id` text PRIMARY KEY NOT NULL,
  `admin_user_id` text NOT NULL REFERENCES `admin_users`(`id`),
  `name` text NOT NULL,
  `description` text,
  `start_at` text NOT NULL,
  `end_at` text,
  `max_participants` integer,
  `is_active` integer NOT NULL DEFAULT 1,
  `share_token` text NOT NULL UNIQUE,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `stamp_rally_locations` (
  `id` text PRIMARY KEY NOT NULL,
  `stamp_rally_id` text NOT NULL REFERENCES `stamp_rallies`(`id`) ON DELETE CASCADE,
  `name` text NOT NULL,
  `address` text,
  `latitude` real NOT NULL,
  `longitude` real NOT NULL,
  `sort_order` integer NOT NULL,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `participations` (
  `id` text PRIMARY KEY NOT NULL,
  `stamp_rally_id` text NOT NULL REFERENCES `stamp_rallies`(`id`),
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `completed_at` text,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(`stamp_rally_id`, `user_id`)
);

CREATE TABLE IF NOT EXISTS `stamps` (
  `id` text PRIMARY KEY NOT NULL,
  `participation_id` text NOT NULL REFERENCES `participations`(`id`) ON DELETE CASCADE,
  `location_id` text NOT NULL REFERENCES `stamp_rally_locations`(`id`),
  `pressed_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(`participation_id`, `location_id`)
);

CREATE INDEX IF NOT EXISTS `idx_stamp_rallies_admin` ON `stamp_rallies`(`admin_user_id`);
CREATE INDEX IF NOT EXISTS `idx_locations_rally` ON `stamp_rally_locations`(`stamp_rally_id`);
CREATE INDEX IF NOT EXISTS `idx_participations_rally` ON `participations`(`stamp_rally_id`);
CREATE INDEX IF NOT EXISTS `idx_participations_user` ON `participations`(`user_id`);
CREATE INDEX IF NOT EXISTS `idx_stamps_participation` ON `stamps`(`participation_id`);
