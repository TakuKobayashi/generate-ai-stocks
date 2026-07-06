CREATE TABLE IF NOT EXISTS `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL UNIQUE,
  `password_hash` text NOT NULL,
  `display_name` text NOT NULL,
  `role` text NOT NULL DEFAULT 'user',
  `is_banned` integer NOT NULL DEFAULT 0,
  `ban_reason` text,
  `avatar_url` text,
  `shop_name` text,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_idx` ON `users` (`email`);
CREATE INDEX IF NOT EXISTS `users_role_idx` ON `users` (`role`);

CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `token_hash` text NOT NULL UNIQUE,
  `expires_at` text NOT NULL,
  `revoked_at` text,
  `user_agent` text,
  `ip_address` text,
  `created_at` text NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS `rt_user_id_idx` ON `refresh_tokens` (`user_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `rt_token_hash_idx` ON `refresh_tokens` (`token_hash`);

CREATE TABLE IF NOT EXISTS `time_capsules` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `title` text NOT NULL,
  `message` text,
  `latitude` real NOT NULL,
  `longitude` real NOT NULL,
  `geohash` text NOT NULL,
  `ar_anchor_id` text,
  `visibility` text NOT NULL DEFAULT 'public',
  `status` text NOT NULL DEFAULT 'active',
  `expire_at` text,
  `view_count` integer NOT NULL DEFAULT 0,
  `report_count` integer NOT NULL DEFAULT 0,
  `media_type` text NOT NULL DEFAULT 'none',
  `discover_radius_meters` integer NOT NULL DEFAULT 100,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS `tc_nearby_idx` ON `time_capsules` (`visibility`, `status`, `geohash`, `created_at`);
CREATE INDEX IF NOT EXISTS `tc_geohash_idx` ON `time_capsules` (`geohash`);
CREATE INDEX IF NOT EXISTS `tc_cursor_idx` ON `time_capsules` (`geohash`, `id`);
CREATE INDEX IF NOT EXISTS `tc_user_created_idx` ON `time_capsules` (`user_id`, `created_at`);
CREATE INDEX IF NOT EXISTS `tc_expire_status_idx` ON `time_capsules` (`expire_at`, `status`);
CREATE INDEX IF NOT EXISTS `tc_report_count_idx` ON `time_capsules` (`report_count`);

CREATE TABLE IF NOT EXISTS `audio_files` (
  `id` text PRIMARY KEY NOT NULL,
  `time_capsule_id` text NOT NULL REFERENCES `time_capsules`(`id`) ON DELETE CASCADE,
  `r2_key` text NOT NULL UNIQUE,
  `original_file_name` text,
  `mime_type` text NOT NULL DEFAULT 'audio/mpeg',
  `file_size` integer NOT NULL,
  `duration_seconds` real,
  `is_confirmed` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS `af_capsule_id_idx` ON `audio_files` (`time_capsule_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `af_r2_key_idx` ON `audio_files` (`r2_key`);

CREATE TABLE IF NOT EXISTS `coupons` (
  `id` text PRIMARY KEY NOT NULL,
  `time_capsule_id` text NOT NULL REFERENCES `time_capsules`(`id`) ON DELETE CASCADE,
  `title` text NOT NULL,
  `description` text,
  `shop_name` text NOT NULL,
  `redemption_type` text NOT NULL DEFAULT 'screen',
  `redemption_code` text,
  `redemption_qr_data` text,
  `redeem_limit` integer,
  `redeem_count` integer NOT NULL DEFAULT 0,
  `expire_at` text,
  `is_active` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL DEFAULT (datetime('now')),
  `updated_at` text NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS `cp_capsule_id_idx` ON `coupons` (`time_capsule_id`);
CREATE INDEX IF NOT EXISTS `cp_is_active_idx` ON `coupons` (`is_active`);

CREATE TABLE IF NOT EXISTS `coupon_redemptions` (
  `id` text PRIMARY KEY NOT NULL,
  `coupon_id` text NOT NULL REFERENCES `coupons`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `latitude` real NOT NULL,
  `longitude` real NOT NULL,
  `redeemed_at` text NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS `cr_coupon_id_idx` ON `coupon_redemptions` (`coupon_id`);
CREATE INDEX IF NOT EXISTS `cr_user_id_idx` ON `coupon_redemptions` (`user_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `cr_unique_idx` ON `coupon_redemptions` (`coupon_id`, `user_id`);

CREATE TABLE IF NOT EXISTS `reports` (
  `id` text PRIMARY KEY NOT NULL,
  `time_capsule_id` text NOT NULL REFERENCES `time_capsules`(`id`) ON DELETE CASCADE,
  `reporter_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `reason` text NOT NULL,
  `detail` text,
  `status` text NOT NULL DEFAULT 'pending',
  `reviewed_by` text REFERENCES `users`(`id`),
  `reviewed_at` text,
  `created_at` text NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS `rp_capsule_id_idx` ON `reports` (`time_capsule_id`);
CREATE INDEX IF NOT EXISTS `rp_reporter_id_idx` ON `reports` (`reporter_id`);
CREATE INDEX IF NOT EXISTS `rp_status_idx` ON `reports` (`status`);
CREATE UNIQUE INDEX IF NOT EXISTS `rp_unique_idx` ON `reports` (`time_capsule_id`, `reporter_id`);
