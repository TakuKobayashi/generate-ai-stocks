import Foundation
import SQLite3

final class DatabaseManager {
    static let shared = DatabaseManager()
    private var db: OpaquePointer?

    private init() {
        openDatabase()
        createTables()
    }

    private func openDatabase() {
        let url = try! FileManager.default
            .url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            .appendingPathComponent("offline_chat.db")
        guard sqlite3_open(url.path, &db) == SQLITE_OK else {
            print("[DB] Failed to open: \(url.path)")
            return
        }
        exec("PRAGMA foreign_keys = ON")
        exec("PRAGMA journal_mode = WAL")
    }

    private func createTables() {
        exec("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            bio TEXT,
            icon_path TEXT,
            is_discoverable INTEGER DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        """)
        exec("""
        CREATE TABLE IF NOT EXISTS chat_rooms (
            id TEXT PRIMARY KEY,
            peer_user_id TEXT NOT NULL,
            last_message TEXT,
            last_message_time INTEGER,
            unread_count INTEGER DEFAULT 0,
            is_request_pending INTEGER DEFAULT 0,
            is_request_accepted INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        """)
        exec("""
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            chat_room_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            message_type TEXT NOT NULL,
            content TEXT,
            file_path TEXT,
            file_name TEXT,
            file_size INTEGER,
            is_sent INTEGER DEFAULT 0,
            is_delivered INTEGER DEFAULT 0,
            is_read INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL
        )
        """)
        exec("CREATE INDEX IF NOT EXISTS idx_msg_room ON messages(chat_room_id, created_at)")
        exec("CREATE INDEX IF NOT EXISTS idx_room_peer ON chat_rooms(peer_user_id)")
    }

    // MARK: - Execute

    @discardableResult
    func exec(_ sql: String) -> Bool {
        var err: UnsafeMutablePointer<CChar>?
        let rc = sqlite3_exec(db, sql, nil, nil, &err)
        if rc != SQLITE_OK {
            print("[DB] exec error: \(err.map { String(cString: $0) } ?? "unknown") SQL: \(sql)")
            sqlite3_free(err)
            return false
        }
        return true
    }

    func query(_ sql: String, args: [Any?] = []) -> [[String: Any]] {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
        defer { sqlite3_finalize(stmt) }

        // Bind args
        for (i, arg) in args.enumerated() {
            let idx = Int32(i + 1)
            switch arg {
            case let s as String: sqlite3_bind_text(stmt, idx, s, -1, SQLITE_TRANSIENT)
            case let n as Int:    sqlite3_bind_int64(stmt, idx, Int64(n))
            case let n as Int64:  sqlite3_bind_int64(stmt, idx, n)
            case let b as Bool:   sqlite3_bind_int(stmt, idx, b ? 1 : 0)
            default:              sqlite3_bind_null(stmt, idx)
            }
        }

        var rows: [[String: Any]] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            var row: [String: Any] = [:]
            let count = sqlite3_column_count(stmt)
            for i in 0..<count {
                let col = String(cString: sqlite3_column_name(stmt, i))
                switch sqlite3_column_type(stmt, i) {
                case SQLITE_INTEGER: row[col] = Int(sqlite3_column_int64(stmt, i))
                case SQLITE_FLOAT:   row[col] = sqlite3_column_double(stmt, i)
                case SQLITE_TEXT:    row[col] = String(cString: sqlite3_column_text(stmt, i))
                default:             break
                }
            }
            rows.append(row)
        }
        return rows
    }

    @discardableResult
    func run(_ sql: String, args: [Any?] = []) -> Bool {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return false }
        defer { sqlite3_finalize(stmt) }
        for (i, arg) in args.enumerated() {
            let idx = Int32(i + 1)
            switch arg {
            case let s as String: sqlite3_bind_text(stmt, idx, s, -1, SQLITE_TRANSIENT)
            case let n as Int:    sqlite3_bind_int64(stmt, idx, Int64(n))
            case let n as Int64:  sqlite3_bind_int64(stmt, idx, n)
            case let b as Bool:   sqlite3_bind_int(stmt, idx, b ? 1 : 0)
            case .none:           sqlite3_bind_null(stmt, idx)
            default:              sqlite3_bind_null(stmt, idx)
            }
        }
        return sqlite3_step(stmt) == SQLITE_DONE
    }
}

// MARK: - SQLITE_TRANSIENT helper
private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
