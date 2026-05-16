import Foundation
import GRDB

// ─────────────────────────────────────────────────────────────────────────
//  DatabaseHolder
//  ActiveRecord の全クラスが共有する GRDB データベースシングルトン。
//  AppDelegate や NomikaiApp.swift で一度だけ initialize() を呼ぶ。
// ─────────────────────────────────────────────────────────────────────────

final class DatabaseHolder {
    static let shared = DatabaseHolder()
    private(set) var db: DatabaseQueue!

    private init() {}

    /// アプリ起動時に一度だけ呼ぶ。
    func initialize() throws {
        let url = try FileManager.default
            .url(for: .applicationSupportDirectory,
                 in: .userDomainMask,
                 appropriateFor: nil,
                 create: true)
            .appendingPathComponent("nomikai.sqlite")

        var config = Configuration()
        config.foreignKeysEnabled = true
        #if DEBUG
        config.prepareDatabase { db in
            db.trace { print("[GRDB]", $0) }
        }
        #endif

        db = try DatabaseQueue(path: url.path, configuration: config)
        try runMigrations()
    }

    private func runMigrations() throws {
        var migrator = DatabaseMigrator()

        migrator.registerMigration("v1_initial") { db in
            // users
            try db.create(table: "users", ifNotExists: true) { t in
                t.primaryKey("id", .text)
                t.column("name", .text).notNull()
                t.column("fcm_token", .text)
                t.column("is_current", .integer).notNull().defaults(to: 0)
                t.column("created_at", .integer).notNull()
                t.column("updated_at", .integer).notNull()
            }

            // drinking_invites
            try db.create(table: "drinking_invites", ifNotExists: true) { t in
                t.primaryKey("id", .text)
                t.column("creator_id", .text).notNull()
                t.column("creator_name", .text).notNull()
                // "sent" or "received"
                t.column("direction", .text).notNull()
                // このデバイスの userId（フィルタ用）
                t.column("user_id", .text).notNull()
                t.column("date_time", .integer).notNull()
                t.column("location_lat", .double)
                t.column("location_lng", .double)
                t.column("location_name", .text)
                t.column("participant_count", .integer).notNull().defaults(to: 2)
                t.column("message", .text)
                // "open" | "closed" | "cancelled"
                t.column("status", .text).notNull().defaults(to: "open")
                t.column("created_at", .integer).notNull()
                t.column("synced_at", .integer).notNull()
            }
            try db.create(
                index: "idx_invites_user_dir",
                on: "drinking_invites",
                columns: ["user_id", "direction", "date_time"],
                ifNotExists: true
            )

            // notifications
            try db.create(table: "notifications", ifNotExists: true) { t in
                t.primaryKey("id", .text)
                t.column("user_id", .text).notNull()
                t.column("invite_id", .text)
                t.column("title", .text).notNull()
                t.column("body", .text).notNull()
                t.column("data_json", .text)
                t.column("is_read", .integer).notNull().defaults(to: 0)
                t.column("created_at", .integer).notNull()
            }
            try db.create(
                index: "idx_notif_user",
                on: "notifications",
                columns: ["user_id", "created_at"],
                ifNotExists: true
            )
        }

        try migrator.migrate(db)
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  ActiveRecord プロトコル
//
//  各モデルはこのプロトコルに準拠し、
//  インスタンスメソッド (save / delete) と
//  static ファインダーを実装する。
// ─────────────────────────────────────────────────────────────────────────

protocol ActiveRecord: FetchableRecord, PersistableRecord, Identifiable {
    associatedtype ID: DatabaseValueConvertible

    /// INSERT OR REPLACE でこのレコードを保存する。
    @discardableResult
    func save() throws -> Self

    /// このレコードを DELETE する。
    @discardableResult
    func delete() throws -> Bool
}

// デフォルト実装 - GRDB の upsert / delete に委譲
extension ActiveRecord {
    @discardableResult
    func save() throws -> Self {
        try DatabaseHolder.shared.db.write { db in
            try self.save(db)
            return self
        }
    }

    @discardableResult
    func delete() throws -> Bool {
        try DatabaseHolder.shared.db.write { db in
            try self.delete(db)
        }
    }
}
