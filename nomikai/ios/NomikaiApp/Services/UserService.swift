import Foundation
import FirebaseMessaging

// ─────────────────────────────────────────────────────────────────────────
//  UserService - ユーザー登録・FCMトークン管理
// ─────────────────────────────────────────────────────────────────────────

final class UserService {
    static let shared = UserService()
    private init() {}

    // ─── ユーザー登録 ─────────────────────────────────────────────────

    func register(name: String) async throws -> UserRecord {
        let existingUser = try UserRecord.findCurrent()
        let userId       = existingUser?.id ?? UUID().uuidString

        // FCM トークンを取得（失敗しても登録は続ける）
        let fcmToken = try? await Messaging.messaging().token()

        // ① UserRecord.setCurrent() (ActiveRecord) でローカルDB保存
        let record = UserRecord(
            id:        userId,
            name:      name,
            fcmToken:  fcmToken,
            isCurrent: 1
        )
        try UserRecord.setCurrent(record)

        // ② サーバーへ登録
        try await APIClient.shared.registerUser(
            userId:   userId,
            name:     name,
            fcmToken: fcmToken
        )
        return record
    }

    // ─── FCMトークン更新 ──────────────────────────────────────────────

    func updateFcmToken(_ token: String) async {
        // ① ActiveRecord#updateFcmToken でローカルDB更新
        guard let user = try? UserRecord.findCurrent() else { return }
        _ = try? user.updateFcmToken(token)

        // ② サーバーへ送信
        try? await APIClient.shared.updateFcmToken(userId: user.id, fcmToken: token)
    }

    // ─── フレンド追加 ─────────────────────────────────────────────────

    func addFriend(friendId: String) async throws {
        guard let user = try UserRecord.findCurrent() else {
            throw AppError.notLoggedIn
        }
        try await APIClient.shared.addFriend(userId: user.id, friendId: friendId)
    }
}

enum AppError: LocalizedError {
    case notLoggedIn
    var errorDescription: String? {
        switch self {
        case .notLoggedIn: return "ログインが必要です"
        }
    }
}
