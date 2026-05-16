import Foundation
import GRDB
import Combine

// ─────────────────────────────────────────────────────────────────────────
//  NotificationRecord - プッシュ通知のローカルキャッシュ
//
//  使い方:
//    // FCM受信時に保存
//    try NotificationRecord(
//        id: uuid, userId: uid, inviteId: data["inviteId"],
//        title: title, body: body, dataJson: jsonStr
//    ).save()
//
//    // 一覧取得
//    let all    = try NotificationRecord.allForUser(userId: uid)
//    let unread = try NotificationRecord.unreadForUser(userId: uid)
//    let count  = try NotificationRecord.unreadCount(userId: uid)
//
//    // 既読
//    try notification.markRead()
//    try NotificationRecord.markAllRead(userId: uid)
//
//    // Flow で監視
//    NotificationRecord.observeForUser(userId: uid)
//      .sink { notifications in ... }
// ─────────────────────────────────────────────────────────────────────────

struct NotificationRecord: ActiveRecord, Codable, Equatable {
    typealias ID = String

    var id: String
    var userId: String
    var inviteId: String?
    var title: String
    var body: String
    var dataJson: String?   // JSON文字列
    var isRead: Int         // 0=未読, 1=既読
    var createdAt: Int64

    enum Columns {
        static let id        = Column(CodingKeys.id)
        static let userId    = Column(CodingKeys.userId)
        static let inviteId  = Column(CodingKeys.inviteId)
        static let title     = Column(CodingKeys.title)
        static let body      = Column(CodingKeys.body)
        static let dataJson  = Column(CodingKeys.dataJson)
        static let isRead    = Column(CodingKeys.isRead)
        static let createdAt = Column(CodingKeys.createdAt)
    }

    enum CodingKeys: String, CodingKey {
        case id, title, body
        case userId    = "user_id"
        case inviteId  = "invite_id"
        case dataJson  = "data_json"
        case isRead    = "is_read"
        case createdAt = "created_at"
    }

    static var databaseTableName: String { "notifications" }
    static var persistenceConflictPolicy = PersistenceConflictPolicy(
        insert: .replace,
        update: .replace
    )

    init(
        id: String = UUID().uuidString,
        userId: String,
        inviteId: String? = nil,
        title: String,
        body: String,
        dataJson: String? = nil,
        isRead: Int = 0,
        createdAt: Int64 = .now
    ) {
        self.id        = id
        self.userId    = userId
        self.inviteId  = inviteId
        self.title     = title
        self.body      = body
        self.dataJson  = dataJson
        self.isRead    = isRead
        self.createdAt = createdAt
    }
}

// ─── 算出プロパティ ───────────────────────────────────────────────────────
extension NotificationRecord {
    var isUnread: Bool { isRead == 0 }
    var createdDate: Date { Date(timeIntervalSince1970: Double(createdAt) / 1000) }

    /// dataJson をデコードして通知データを返す。
    var notificationData: [String: String]? {
        guard let json = dataJson,
              let data = json.data(using: .utf8),
              let dict = try? JSONDecoder().decode([String: String].self, from: data)
        else { return nil }
        return dict
    }
}

// ─── インスタンスメソッド ─────────────────────────────────────────────────
extension NotificationRecord {
    /// この通知を既読にする。
    @discardableResult
    func markRead() throws -> NotificationRecord {
        var updated = self
        updated.isRead = 1
        return try updated.save()
    }
}

// ─── クラスメソッド（ファインダー） ─────────────────────────────────────
extension NotificationRecord {
    /// ユーザーの全通知を新しい順で取得する。
    static func allForUser(userId: String) throws -> [NotificationRecord] {
        try DatabaseHolder.shared.db.read { db in
            try NotificationRecord
                .filter(Columns.userId == userId)
                .order(Columns.createdAt.desc)
                .fetchAll(db)
        }
    }

    /// ユーザーの未読通知を取得する。
    static func unreadForUser(userId: String) throws -> [NotificationRecord] {
        try DatabaseHolder.shared.db.read { db in
            try NotificationRecord
                .filter(Columns.userId == userId && Columns.isRead == 0)
                .order(Columns.createdAt.desc)
                .fetchAll(db)
        }
    }

    /// 未読件数を取得する。
    static func unreadCount(userId: String) throws -> Int {
        try DatabaseHolder.shared.db.read { db in
            try NotificationRecord
                .filter(Columns.userId == userId && Columns.isRead == 0)
                .fetchCount(db)
        }
    }

    /// 全通知を既読にする。
    static func markAllRead(userId: String) throws {
        try DatabaseHolder.shared.db.write { db in
            try db.execute(
                sql: "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
                arguments: [userId]
            )
        }
    }

    /// 通知一覧を Combine Publisher で監視する。
    static func observeForUser(userId: String) -> AnyPublisher<[NotificationRecord], Error> {
        ValueObservation
            .tracking { db in
                try NotificationRecord
                    .filter(Columns.userId == userId)
                    .order(Columns.createdAt.desc)
                    .fetchAll(db)
            }
            .publisher(in: DatabaseHolder.shared.db, scheduling: .immediate)
            .eraseToAnyPublisher()
    }

    /// 未読件数を Combine Publisher で監視する。
    static func observeUnreadCount(userId: String) -> AnyPublisher<Int, Error> {
        ValueObservation
            .tracking { db in
                try NotificationRecord
                    .filter(Columns.userId == userId && Columns.isRead == 0)
                    .fetchCount(db)
            }
            .publisher(in: DatabaseHolder.shared.db, scheduling: .immediate)
            .eraseToAnyPublisher()
    }

    /// 古い通知を削除して keepCount 件だけ残す。
    static func pruneOld(userId: String, keepCount: Int = 50) throws {
        try DatabaseHolder.shared.db.write { db in
            try db.execute(sql: """
                DELETE FROM notifications
                WHERE user_id = ? AND id NOT IN (
                    SELECT id FROM notifications
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                )
                """, arguments: [userId, userId, keepCount])
        }
    }
}
