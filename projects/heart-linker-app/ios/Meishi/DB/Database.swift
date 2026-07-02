import Foundation
import SQLite3

// MARK: - Database (シングルトン)

final class Database {
    static let shared = Database()

    private var db: OpaquePointer?
    private let queue = DispatchQueue(label: "com.meishi.app.db", qos: .userInitiated)

    private init() {
        let url = FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("meishi.sqlite")

        guard sqlite3_open(url.path, &db) == SQLITE_OK else {
            fatalError("DB open failed: \(String(cString: sqlite3_errmsg(db)))")
        }
        sqlite3_exec(db, "PRAGMA foreign_keys = ON;", nil, nil, nil)
        createTables()
    }

    // MARK: - テーブル定義

    private func createTables() {
        let ddl = """
        CREATE TABLE IF NOT EXISTS profile (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL DEFAULT '',
            email TEXT NOT NULL DEFAULT '',
            phone TEXT NOT NULL DEFAULT '',
            address TEXT NOT NULL DEFAULT '',
            icon_path TEXT
        );
        CREATE TABLE IF NOT EXISTS profile_sns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_id INTEGER NOT NULL,
            service_name TEXT NOT NULL DEFAULT '',
            type TEXT NOT NULL,
            value TEXT NOT NULL DEFAULT '',
            account_url TEXT,
            account_id TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS profile_draft (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL DEFAULT '',
            email TEXT NOT NULL DEFAULT '',
            phone TEXT NOT NULL DEFAULT '',
            address TEXT NOT NULL DEFAULT '',
            icon_path TEXT
        );
        CREATE TABLE IF NOT EXISTS profile_draft_sns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            draft_id INTEGER NOT NULL,
            service_name TEXT NOT NULL DEFAULT '',
            type TEXT NOT NULL,
            value TEXT NOT NULL DEFAULT '',
            account_url TEXT,
            account_id TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL DEFAULT '',
            email TEXT NOT NULL DEFAULT '',
            phone TEXT NOT NULL DEFAULT '',
            address TEXT NOT NULL DEFAULT '',
            icon_path TEXT,
            received_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS contact_sns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contact_id INTEGER NOT NULL,
            service_name TEXT NOT NULL DEFAULT '',
            type TEXT NOT NULL,
            value TEXT NOT NULL DEFAULT '',
            account_url TEXT,
            account_id TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0
        );
        """
        ddl.components(separatedBy: ";").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }.forEach { exec($0) }
    }

    // MARK: - 実行API

    @discardableResult
    func exec(_ sql: String) -> Bool {
        queue.sync {
            var err: UnsafeMutablePointer<Int8>?
            let rc = sqlite3_exec(db, sql, nil, nil, &err)
            if rc != SQLITE_OK {
                print("SQL exec error: \(err.map { String(cString: $0) } ?? "?") — \(sql)")
                sqlite3_free(err)
                return false
            }
            return true
        }
    }

    @discardableResult
    func run(_ sql: String, _ params: [SqlValue] = []) -> Bool {
        queue.sync { _run(sql, params) }
    }

    @discardableResult
    private func _run(_ sql: String, _ params: [SqlValue]) -> Bool {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            print("Prepare failed: \(String(cString: sqlite3_errmsg(db))) — \(sql)")
            return false
        }
        defer { sqlite3_finalize(stmt) }
        bind(stmt, params)
        let rc = sqlite3_step(stmt)
        return rc == SQLITE_DONE || rc == SQLITE_ROW
    }

    func lastInsertRowId() -> Int64 {
        queue.sync { sqlite3_last_insert_rowid(db) }
    }

    func query(_ sql: String, _ params: [SqlValue] = [], handler: (Row) -> Void) {
        queue.sync {
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            defer { sqlite3_finalize(stmt) }
            bind(stmt, params)
            while sqlite3_step(stmt) == SQLITE_ROW {
                handler(Row(stmt: stmt))
            }
        }
    }

    private func bind(_ stmt: OpaquePointer?, _ params: [SqlValue]) {
        for (i, p) in params.enumerated() {
            let idx = Int32(i + 1)
            switch p {
            case .text(let v): sqlite3_bind_text(stmt, idx, v, -1, SQLITE_TRANSIENT)
            case .int(let v):  sqlite3_bind_int64(stmt, idx, v)
            case .null:        sqlite3_bind_null(stmt, idx)
            }
        }
    }
}

// MARK: - SqlValue

enum SqlValue {
    case text(String), int(Int64), null
    static func opt(_ v: String?) -> SqlValue { v.map { .text($0) } ?? .null }
}

// MARK: - Row

struct Row {
    let stmt: OpaquePointer?
    func int64(_ i: Int32) -> Int64 { sqlite3_column_int64(stmt, i) }
    func int(_ i: Int32) -> Int { Int(sqlite3_column_int64(stmt, i)) }
    func text(_ i: Int32) -> String { sqlite3_column_text(stmt, i).map { String(cString: $0) } ?? "" }
    func textOrNil(_ i: Int32) -> String? {
        sqlite3_column_type(stmt, i) == SQLITE_NULL ? nil : text(i)
    }
}

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
