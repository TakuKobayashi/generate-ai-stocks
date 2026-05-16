import UIKit
import FirebaseCore
import FirebaseMessaging
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // ① Firebase 初期化（GoogleService-Info.plist を自動読み込み）
        FirebaseApp.configure()

        // ② GRDB ActiveRecord 用 DB 初期化
        do {
            try DatabaseHolder.shared.initialize()
        } catch {
            fatalError("DB初期化失敗: \(error)")
        }

        // ③ FCM デリゲート設定
        Messaging.messaging().delegate = self

        // ④ UNUserNotificationCenter デリゲート設定
        UNUserNotificationCenter.current().delegate = self

        // ⑤ APNs リモート通知登録（許可ダイアログはSetupViewで表示）
        application.registerForRemoteNotifications()

        // ⑥ 起動時にFCMトークンを確認してサーバーと同期
        Task {
            if let token = try? await Messaging.messaging().token() {
                await UserService.shared.updateFcmToken(token)
            }
        }

        return true
    }

    // APNs デバイストークンを FCM SDK に渡す
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Messaging.messaging().apnsToken = deviceToken
    }

    // APNs 登録失敗（実機以外では起きうる）
    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("[APNs] 登録失敗（シミュレータでは正常）: \(error.localizedDescription)")
    }
}

// ─── FCM デリゲート ────────────────────────────────────────────────────────
extension AppDelegate: MessagingDelegate {
    /// FCMトークンが取得または更新された時に呼ばれる
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        print("[FCM] トークン更新: \(token.prefix(20))...")
        Task {
            await UserService.shared.updateFcmToken(token)
        }
    }
}

// ─── UNUserNotificationCenter デリゲート ──────────────────────────────────
extension AppDelegate: UNUserNotificationCenterDelegate {

    /// フォアグラウンドでの通知表示設定
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        let userInfo = notification.request.content.userInfo
        handleFCMPayload(userInfo)
        // フォアグラウンドでもバナー・サウンド・バッジを表示
        completionHandler([.banner, .sound, .badge])
    }

    /// 通知タップ時（バックグラウンド・終了状態から起動）
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        handleFCMPayload(userInfo)
        completionHandler()
    }

    /// バックグラウンド Silent Push（data-only メッセージ）
    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        handleFCMPayload(userInfo)
        completionHandler(.newData)
    }

    // ─── ヘルパー ──────────────────────────────────────────────────────

    private func handleFCMPayload(_ userInfo: [AnyHashable: Any]) {
        // FCM ペイロードの title / body を取得
        // notification メッセージ: aps.alert に入る
        // data-only メッセージ: カスタムキーに入る
        let title: String
        let body: String

        if let aps = userInfo["aps"] as? [String: Any],
           let alert = aps["alert"] as? [String: Any] {
            title = alert["title"] as? String ?? "飲みに誘われました！"
            body  = alert["body"]  as? String ?? ""
        } else {
            title = userInfo["title"] as? String ?? "飲みに誘われました！"
            body  = userInfo["body"]  as? String ?? ""
        }

        // String キーのみ data として抽出
        var data: [String: String] = [:]
        for (k, v) in userInfo {
            if let key = k as? String, let val = v as? String {
                data[key] = val
            }
        }

        // NotificationRecord (ActiveRecord) に保存
        NotificationService.shared.handleReceivedNotification(
            title: title,
            body: body,
            data: data
        )
        NotificationService.shared.refreshBadge()
    }
}
