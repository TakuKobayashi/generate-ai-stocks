import Foundation
import FirebaseMessaging
import UserNotifications

// ─────────────────────────────────────────────────────────────────────────
//  NotificationService
//  FCM 受信 → NotificationRecord (ActiveRecord) にキャッシュ → 同期
// ─────────────────────────────────────────────────────────────────────────

final class NotificationService: NSObject {
    static let shared = NotificationService()
    private override init() { super.init() }

    // ─── 通知許可リクエスト ───────────────────────────────────────────

    func requestPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let options: UNAuthorizationOptions = [.alert, .sound, .badge]
        return (try? await center.requestAuthorization(options: options)) ?? false
    }

    // ─── FCM受信時にローカルDBへ保存 ─────────────────────────────────

    func handleReceivedNotification(title: String, body: String, data: [String: String]) {
        Task {
            guard let user = try? UserRecord.findCurrent() else { return }
            let record = NotificationRecord(
                id:       data["notificationId"] ?? UUID().uuidString,
                userId:   user.id,
                inviteId: data["inviteId"],
                title:    title,
                body:     body,
                dataJson: encodeJSON(data)
            )
            // ActiveRecord#save()
            try? record.save()
            try? NotificationRecord.pruneOld(userId: user.id, keepCount: 50)
        }
    }

    // ─── サーバーと同期 ───────────────────────────────────────────────

    func syncFromServer() async throws {
        guard let user = try UserRecord.findCurrent() else { return }
        let dtos = try await APIClient.shared.getNotifications(userId: user.id)
        for dto in dtos {
            // サーバーの createdAt はすでにUNIXミリ秒なのでそのまま使う
            let record = NotificationRecord(
                id:        dto.id,
                userId:    dto.userId,
                inviteId:  dto.inviteId,
                title:     dto.title,
                body:      dto.body,
                dataJson:  encodeJSON(dto.data ?? [:]),
                isRead:    dto.isRead,
                createdAt: Int64(dto.createdAt)   // *1000しない（サーバーはms単位）
            )
            // ActiveRecord#save() - upsert
            try? record.save()
        }
        try NotificationRecord.pruneOld(userId: user.id)
    }

    // ─── 既読操作 ─────────────────────────────────────────────────────

    /// ローカルDB即時更新 + サーバー非同期送信
    func markAsRead(_ record: NotificationRecord) async throws {
        // ① ActiveRecord#markRead()
        try record.markRead()
        // ② サーバー
        guard let user = try UserRecord.findCurrent() else { return }
        try? await APIClient.shared.markAsRead(notificationId: record.id, userId: user.id)
    }

    func markAllAsRead() async throws {
        guard let user = try UserRecord.findCurrent() else { return }
        // ① ActiveRecord.markAllRead()
        try NotificationRecord.markAllRead(userId: user.id)
        // ② サーバー
        try? await APIClient.shared.markAllAsRead(userId: user.id)
    }

    // ─── バッジ更新 ───────────────────────────────────────────────────

    func refreshBadge() {
        Task {
            guard let user = try? UserRecord.findCurrent() else {
                await UNUserNotificationCenter.current().setBadgeCount(0)
                return
            }
            let count = (try? NotificationRecord.unreadCount(userId: user.id)) ?? 0
            await UNUserNotificationCenter.current().setBadgeCount(count)
        }
    }

    // ─── ユーティリティ ───────────────────────────────────────────────

    private func encodeJSON(_ dict: [String: String]) -> String? {
        (try? JSONEncoder().encode(dict)).flatMap { String(data: $0, encoding: .utf8) }
    }
}
