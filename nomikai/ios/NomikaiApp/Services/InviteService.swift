import Foundation
import CoreLocation

// ─────────────────────────────────────────────────────────────────────────
//  InviteService
//  DrinkingInviteRecord (ActiveRecord) を中心に誘い操作を管理する
// ─────────────────────────────────────────────────────────────────────────

final class InviteService {
    static let shared = InviteService()
    private init() {}

    // ─── 誘い作成 ─────────────────────────────────────────────────────

    /// サーバーへ POST → DrinkingInviteRecord.save() でキャッシュ
    func createInvite(
        dateTime: Date,
        location: CLLocationCoordinate2D?,
        locationName: String?,
        participantCount: Int,
        message: String?
    ) async throws -> CreateInviteResponse {
        guard let user = try UserRecord.findCurrent() else {
            throw AppError.notLoggedIn
        }

        let dateTimeMs = dateTime.timeIntervalSince1970 * 1000
        let body = APIClient.CreateInviteBody(
            creatorId:        user.id,
            dateTime:         dateTimeMs,
            locationLat:      location?.latitude,
            locationLng:      location?.longitude,
            locationName:     locationName,
            participantCount: participantCount,
            message:          message
        )

        let res = try await APIClient.shared.createInvite(body)

        // ① ActiveRecord でローカルキャッシュに保存（memberwiseイニシャライザを使用）
        var record = DrinkingInviteRecord(
            id:               res.inviteId,
            creatorId:        user.id,
            creatorName:      user.name,
            direction:        DrinkingInviteRecord.directionSent,
            userId:           user.id,
            dateTime:         Int64(dateTimeMs),
            locationLat:      location?.latitude,
            locationLng:      location?.longitude,
            locationName:     locationName,
            participantCount: participantCount,
            message:          message,
            status:           DrinkingInviteRecord.statusOpen,
            createdAt:        .now,
            syncedAt:         .now
        )
        try record.save()

        return res
    }

    // ─── 受け取った誘いをサーバーと同期 ──────────────────────────────

    func syncReceived() async throws {
        guard let user = try UserRecord.findCurrent() else { return }
        let dtos = try await APIClient.shared.getReceivedInvites(userId: user.id)
        for dto in dtos {
            // ActiveRecord ファクトリメソッド → save()
            try DrinkingInviteRecord.fromAPI(dto, currentUserId: user.id).save()
        }
    }

    // ─── キャッシュ優先の詳細取得 ─────────────────────────────────────

    func getInvite(_ id: String) async throws -> DrinkingInviteRecord? {
        // ① ローカルキャッシュを確認（ActiveRecord.find）
        if let cached = try DrinkingInviteRecord.find(id) { return cached }

        // ② なければサーバーから取得してキャッシュ
        guard let user = try UserRecord.findCurrent() else { return nil }
        let dtos = try await APIClient.shared.getReceivedInvites(userId: user.id)
        if let dto = dtos.first(where: { $0.id == id }) {
            let record = DrinkingInviteRecord.fromAPI(dto, currentUserId: user.id)
            try record.save()
            return record
        }
        return nil
    }
}
