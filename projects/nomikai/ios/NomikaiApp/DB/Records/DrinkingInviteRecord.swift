import Foundation
import GRDB
import Combine

// ─────────────────────────────────────────────────────────────────────────
//  DrinkingInviteRecord - 飲み会誘いのローカルキャッシュ
//
//  使い方:
//    // APIレスポンスからキャッシュ
//    try DrinkingInviteRecord.fromAPI(invite, currentUserId: uid).save()
//
//    // 取得
//    let received = try DrinkingInviteRecord.receivedBy(userId: uid)
//    let sent     = try DrinkingInviteRecord.sentBy(userId: uid)
//    let invite   = try DrinkingInviteRecord.find(inviteId)
//
//    // ステータス変更
//    try invite?.close()
//    try invite?.cancel()
//
//    // Flow で監視
//    DrinkingInviteRecord.observeReceived(userId: uid)
//      .sink { invites in ... }
// ─────────────────────────────────────────────────────────────────────────

struct DrinkingInviteRecord: ActiveRecord, Codable, Equatable {
    typealias ID = String

    // ステータス定数
    static let statusOpen      = "open"
    static let statusClosed    = "closed"
    static let statusCancelled = "cancelled"
    // 方向定数
    static let directionSent     = "sent"
    static let directionReceived = "received"

    var id: String
    var creatorId: String
    var creatorName: String
    var direction: String       // "sent" | "received"
    var userId: String          // このデバイスのユーザーID
    var dateTime: Int64         // UNIXミリ秒
    var locationLat: Double?
    var locationLng: Double?
    var locationName: String?
    var participantCount: Int
    var message: String?
    var status: String
    var createdAt: Int64
    var syncedAt: Int64

    enum Columns {
        static let id               = Column(CodingKeys.id)
        static let creatorId        = Column(CodingKeys.creatorId)
        static let creatorName      = Column(CodingKeys.creatorName)
        static let direction        = Column(CodingKeys.direction)
        static let userId           = Column(CodingKeys.userId)
        static let dateTime         = Column(CodingKeys.dateTime)
        static let locationLat      = Column(CodingKeys.locationLat)
        static let locationLng      = Column(CodingKeys.locationLng)
        static let locationName     = Column(CodingKeys.locationName)
        static let participantCount = Column(CodingKeys.participantCount)
        static let message          = Column(CodingKeys.message)
        static let status           = Column(CodingKeys.status)
        static let createdAt        = Column(CodingKeys.createdAt)
        static let syncedAt         = Column(CodingKeys.syncedAt)
    }

    enum CodingKeys: String, CodingKey {
        case id, direction, message, status
        case creatorId        = "creator_id"
        case creatorName      = "creator_name"
        case userId           = "user_id"
        case dateTime         = "date_time"
        case locationLat      = "location_lat"
        case locationLng      = "location_lng"
        case locationName     = "location_name"
        case participantCount = "participant_count"
        case createdAt        = "created_at"
        case syncedAt         = "synced_at"
    }

    static var databaseTableName: String { "drinking_invites" }
    static var persistenceConflictPolicy = PersistenceConflictPolicy(
        insert: .replace,
        update: .replace
    )
}

// ─── 算出プロパティ ───────────────────────────────────────────────────────
extension DrinkingInviteRecord {
    var isOpen:      Bool { status == Self.statusOpen }
    var isClosed:    Bool { status == Self.statusClosed }
    var isCancelled: Bool { status == Self.statusCancelled }
    var isSent:      Bool { direction == Self.directionSent }
    var isReceived:  Bool { direction == Self.directionReceived }

    var dateTimeDate: Date { Date(timeIntervalSince1970: Double(dateTime) / 1000) }
}

// ─── インスタンスメソッド ─────────────────────────────────────────────────
extension DrinkingInviteRecord {
    /// 募集を締め切る。
    @discardableResult
    func close() throws -> DrinkingInviteRecord {
        var updated = self
        updated.status = Self.statusClosed
        return try updated.save()
    }

    /// 募集をキャンセルする。
    @discardableResult
    func cancel() throws -> DrinkingInviteRecord {
        var updated = self
        updated.status = Self.statusCancelled
        return try updated.save()
    }

    /// 同期日時を現在に更新する。
    @discardableResult
    func touch() throws -> DrinkingInviteRecord {
        var updated = self
        updated.syncedAt = .now
        return try updated.save()
    }
}

// ─── クラスメソッド（ファインダー） ─────────────────────────────────────
extension DrinkingInviteRecord {
    /// IDで誘いを取得する。
    static func find(_ id: String) throws -> DrinkingInviteRecord? {
        try DatabaseHolder.shared.db.read { db in
            try DrinkingInviteRecord.fetchOne(db, key: id)
        }
    }

    /// 受け取った誘い一覧（新しい順）。
    static func receivedBy(userId: String) throws -> [DrinkingInviteRecord] {
        try DatabaseHolder.shared.db.read { db in
            try DrinkingInviteRecord
                .filter(Columns.userId == userId && Columns.direction == directionReceived)
                .order(Columns.createdAt.desc)
                .fetchAll(db)
        }
    }

    /// 送った誘い一覧（新しい順）。
    static func sentBy(userId: String) throws -> [DrinkingInviteRecord] {
        try DatabaseHolder.shared.db.read { db in
            try DrinkingInviteRecord
                .filter(Columns.userId == userId && Columns.direction == directionSent)
                .order(Columns.createdAt.desc)
                .fetchAll(db)
        }
    }

    /// ステータスでフィルタして取得する。
    static func whereStatus(userId: String, status: String) throws -> [DrinkingInviteRecord] {
        try DatabaseHolder.shared.db.read { db in
            try DrinkingInviteRecord
                .filter(Columns.userId == userId && Columns.status == status)
                .order(Columns.dateTime.asc)
                .fetchAll(db)
        }
    }

    /// 受け取った誘いを Combine Publisher で監視する。
    static func observeReceived(userId: String) -> AnyPublisher<[DrinkingInviteRecord], Error> {
        ValueObservation
            .tracking { db in
                try DrinkingInviteRecord
                    .filter(Columns.userId == userId && Columns.direction == directionReceived)
                    .order(Columns.createdAt.desc)
                    .fetchAll(db)
            }
            .publisher(in: DatabaseHolder.shared.db, scheduling: .immediate)
            .eraseToAnyPublisher()
    }

    /// 送った誘いを Combine Publisher で監視する。
    static func observeSent(userId: String) -> AnyPublisher<[DrinkingInviteRecord], Error> {
        ValueObservation
            .tracking { db in
                try DrinkingInviteRecord
                    .filter(Columns.userId == userId && Columns.direction == directionSent)
                    .order(Columns.createdAt.desc)
                    .fetchAll(db)
            }
            .publisher(in: DatabaseHolder.shared.db, scheduling: .immediate)
            .eraseToAnyPublisher()
    }

    /// 古いキャッシュを削除する。
    static func deleteOlderThan(_ date: Date) throws {
        let ms = Int64(date.timeIntervalSince1970 * 1000)
        try DatabaseHolder.shared.db.write { db in
            try DrinkingInviteRecord
                .filter(Columns.createdAt < ms)
                .deleteAll(db)
        }
    }

    /// APIレスポンスから DrinkingInviteRecord を生成するファクトリ。
    static func fromAPI(_ dto: InviteDTO, currentUserId: String) -> DrinkingInviteRecord {
        let direction = dto.creatorId == currentUserId ? directionSent : directionReceived
        return DrinkingInviteRecord(
            id:               dto.id,
            creatorId:        dto.creatorId,
            creatorName:      dto.creatorName,
            direction:        direction,
            userId:           currentUserId,
            dateTime:         Int64(dto.dateTime),
            locationLat:      dto.locationLat,
            locationLng:      dto.locationLng,
            locationName:     dto.locationName,
            participantCount: dto.participantCount,
            message:          dto.message,
            status:           dto.status,
            createdAt:        Int64(dto.createdAt),
            syncedAt:         .now
        )
    }
}
