CREATE TABLE `device_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`latitude` integer NOT NULL,
	`longitude` integer NOT NULL,
	`geohash` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_tokens_user_id_unique` ON `device_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `device_geohash_idx` ON `device_tokens` (`geohash`);--> statement-breakpoint
CREATE INDEX `device_user_id_idx` ON `device_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `noroshis` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`latitude` integer NOT NULL,
	`longitude` integer NOT NULL,
	`geohash` text NOT NULL,
	`address` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `geohash_idx` ON `noroshis` (`geohash`);--> statement-breakpoint
CREATE INDEX `end_at_idx` ON `noroshis` (`end_at`);--> statement-breakpoint
CREATE INDEX `geohash_end_at_idx` ON `noroshis` (`geohash`,`end_at`);