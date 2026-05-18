# 飲みに行きたい！ - iOS アプリ セットアップガイド

## 動作要件
- iOS 16.0+
- Xcode 15+
- CocoaPods

## アーキテクチャ概要

```
iOS App (SwiftUI)
  ├── DB/              SQLite ORM (GRDB) - ActiveRecordパターン
  │   ├── ActiveRecord.swift      基底プロトコル + DatabaseHolder
  │   └── Records/
  │       ├── UserRecord.swift
  │       ├── DrinkingInviteRecord.swift
  │       └── NotificationRecord.swift
  ├── Network/         URLSession API クライアント
  ├── Services/        ビジネスロジック層
  │   ├── UserService.swift
  │   ├── InviteService.swift
  │   ├── NotificationService.swift
  │   └── LocationManager.swift  CLLocationManager ラッパー
  └── Features/        SwiftUI 画面
      ├── Setup/        初回登録
      ├── Home/         誘い作成・マップ・飲食店
      ├── Notifications/ 通知一覧
      └── Friends/      フレンド管理
```

## ActiveRecord パターン

```swift
// 保存
try UserRecord(id: uuid, name: "太郎", fcmToken: token).save()

// 検索
let me = try UserRecord.findCurrent()           // クラスメソッド
let n  = try NotificationRecord.find(id)        // クラスメソッド

// インスタンスメソッド
try me?.updateFcmToken(newToken)
try notification.markRead()
try invite.close()
try invite.delete()

// Combine Publisher でリアルタイム監視 (DB変更→画面自動更新)
NotificationRecord.observeForUser(userId:)       // → AnyPublisher<[NotificationRecord], Error>
NotificationRecord.observeUnreadCount(userId:)   // → AnyPublisher<Int, Error>
DrinkingInviteRecord.observeReceived(userId:)    // → AnyPublisher<[DrinkingInviteRecord], Error>
```

## セットアップ手順

### 1. Firebase プロジェクト設定

1. [Firebase Console](https://console.firebase.google.com) でプロジェクトを開く
2. iOS アプリを追加 → バンドルID: `com.example.nomikai`
3. `GoogleService-Info.plist` をダウンロードして `NomikaiApp/Resources/` に配置
4. プロジェクト設定 → クラウドメッセージング → APNs 認証キーをアップロード

### 2. Google Maps API キー設定

1. [Google Cloud Console](https://console.cloud.google.com) で Maps SDK for iOS を有効化
2. APIキーを取得
3. `NomikaiApp/Resources/Info.plist` の `GMSApiKey` を更新:
   ```xml
   <key>GMSApiKey</key>
   <string>YOUR_GOOGLE_MAPS_API_KEY</string>
   ```

### 3. API サーバー URL 設定

`NomikaiApp/Resources/Info.plist` の `API_BASE_URL` を更新:
```xml
<key>API_BASE_URL</key>
<string>https://nomikai-server.YOUR-ACCOUNT.workers.dev</string>
```

### 4. CocoaPods インストール

```bash
cd ios
pod install
open NomikaiApp.xcworkspace
```

### 5. Xcode の設定

1. **Signing & Capabilities** タブで:
   - チームを選択
   - `Push Notifications` を追加
   - `Background Modes` → `Remote notifications` にチェック

2. **Build Settings**:
   - `SWIFT_STRICT_CONCURRENCY` = `complete`

### 6. ビルド・実行

```bash
# 実機が必要（シミュレータはプッシュ通知不可）
xcodebuild -workspace NomikaiApp.xcworkspace \
           -scheme NomikaiApp \
           -destination 'platform=iOS,name=iPhone'
```

## Push 通知フロー

```
友達が「飲みに行きたい！」ボタンを押す
  → POST /api/invites
  → サーバーが FCM HTTP v1 API でトークン宛に送信
  → iOS: AppDelegate.userNotificationCenter(_:willPresent:)
       → NotificationService.handleReceivedNotification()
         → NotificationRecord(...).save()  ← ActiveRecord#save()
         → Combine Publisher が emit
           → NotificationsViewModel が自動で画面更新
           → バッジ更新
```

## フレンド追加の流れ

1. **自分**: ホーム画面 → 👤 ボタン → 「IDをコピー」または「IDをシェア」
2. **友達**: フレンド追加シート → コピーされたIDを貼り付け → 「追加」
3. 双方向で自動登録される（サーバー側で両方向を挿入）

## ディレクトリ構成

```
ios/
├── Podfile
├── Package.swift
└── NomikaiApp/
    ├── App/
    │   ├── NomikaiApp.swift         エントリポイント
    │   ├── AppDelegate.swift        FCM・APNs デリゲート
    │   └── ContentView.swift        ログインゲート
    ├── DB/
    │   ├── ActiveRecord.swift       プロトコル + DatabaseHolder + マイグレーション
    │   └── Records/
    │       ├── UserRecord.swift
    │       ├── DrinkingInviteRecord.swift
    │       └── NotificationRecord.swift
    ├── Network/
    │   └── APIClient.swift          URLSession + DTOs
    ├── Services/
    │   ├── UserService.swift
    │   ├── InviteService.swift
    │   ├── NotificationService.swift
    │   └── LocationManager.swift
    ├── Features/
    │   ├── Setup/SetupView.swift
    │   ├── Home/HomeView.swift
    │   ├── Notifications/NotificationsView.swift
    │   └── Friends/FriendView.swift
    └── Resources/
        ├── Info.plist
        └── GoogleService-Info.plist  ← Firebase からダウンロード
```
