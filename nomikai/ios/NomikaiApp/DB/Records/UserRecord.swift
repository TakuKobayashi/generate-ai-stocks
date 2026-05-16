import Foundation
import GRDB
import Combine

// ─────────────────────────────────────────────────────────────────────────
//  UserRecord - ローカルユーザープロフィール
//
//  使い方:
//    // 作成・保存
//    try UserRecord(id: uuid, name: "太郎", fcmToken: token).save()
//
//    // カレントユーザー取得
//    let me = try UserRecord.findCurrent()
//
//    // FCMトークン更新
//    try me?.updateFcmToken(token)
//
//    // Combine で監視
//    UserRecord.observeCurrent()
//      .sink { user in ... }
// ─────────────────────────────────────────────────────────────────────────

struct UserRecord: ActiveRecord, Codable, Equatable {
    typealias ID = String

    var id: String
    var name: String
    var fcmToken: String?
    var isCurrent: Int          // 1 = このデバイスのユーザー
    var createdAt: Int64
    var updatedAt: Int64

    // ─── DB カラムマッピング ────────────────────────────────────────────
    enum Columns {
        static let id         = Column(CodingKeys.id)
        static let name       = Column(CodingKeys.name)
        static let fcmToken   = Column(CodingKeys.fcmToken)
        static let isCurrent  = Column(CodingKeys.isCurrent)
        static let createdAt  = Column(CodingKeys.createdAt)
        static let updatedAt  = Column(CodingKeys.updatedAt)
    }

    enum CodingKeys: String, CodingKey {
        case id, name
        case fcmToken  = "fcm_token"
        case isCurrent = "is_current"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    static var databaseTableName: String { "users" }

    // GRDB が主キーを自動で認識できるよう定義
    static var persistenceConflictPolicy = PersistenceConflictPolicy(
        insert: .replace,
        update: .replace
    )

    // ─── イニシャライザ ─────────────────────────────────────────────────
    init(
        id: String = UUID().uuidString,
        name: String,
        fcmToken: String? = nil,
        isCurrent: Int = 0,
        createdAt: Int64 = .now,
        updatedAt: Int64 = .now
    ) {
        self.id        = id
        self.name      = name
        self.fcmToken  = fcmToken
        self.isCurrent = isCurrent
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

// ─── 算出プロパティ ───────────────────────────────────────────────────────
extension UserRecord {
    var isCurrentUser: Bool { isCurrent == 1 }
}

// ─── インスタンスメソッド（ドメイン操作） ─────────────────────────────────
extension UserRecord {
    /// FCMトークンを更新して保存する。
    @discardableResult
    func updateFcmToken(_ token: String?) throws -> UserRecord {
        var updated = self
        updated.fcmToken = token
        updated.updatedAt = .now
        return try updated.save()
    }

    /// 名前を更新して保存する。
    @discardableResult
    func updateName(_ newName: String) throws -> UserRecord {
        var updated = self
        updated.name     = newName
        updated.updatedAt = .now
        return try updated.save()
    }
}

// ─── クラスメソッド（ファインダー） ─────────────────────────────────────
extension UserRecord {
    /// IDでユーザーを検索する。
    static func find(_ id: String) throws -> UserRecord? {
        try DatabaseHolder.shared.db.read { db in
            try UserRecord.fetchOne(db, key: id)
        }
    }

    /// カレントユーザーを取得する。
    static func findCurrent() throws -> UserRecord? {
        try DatabaseHolder.shared.db.read { db in
            try UserRecord
                .filter(Columns.isCurrent == 1)
                .fetchOne(db)
        }
    }

    /// 全ユーザーを取得する。
    static func all() throws -> [UserRecord] {
        try DatabaseHolder.shared.db.read { db in
            try UserRecord.fetchAll(db)
        }
    }

    /// カレントユーザーとして設定する（既存の current フラグをリセット）。
    static func setCurrent(_ record: UserRecord) throws {
        try DatabaseHolder.shared.db.write { db in
            try db.execute(sql: "UPDATE users SET is_current = 0")
            var updated = record
            updated.isCurrent = 1
            updated.updatedAt = .now
            try updated.save(db)
        }
    }

    /// カレントユーザーを Combine Publisher で監視する。
    static func observeCurrent() -> AnyPublisher<UserRecord?, Error> {
        ValueObservation
            .tracking { db in
                try UserRecord
                    .filter(Columns.isCurrent == 1)
                    .fetchOne(db)
            }
            .publisher(in: DatabaseHolder.shared.db, scheduling: .immediate)
            .eraseToAnyPublisher()
    }
}

// ─── Int64 now ヘルパー ──────────────────────────────────────────────────
extension Int64 {
    static var now: Int64 { Int64(Date().timeIntervalSince1970 * 1000) }
}
