# クリップボードマネージャー モノレポ

## 構成

```
monorepo/
├── android/ClipboardManager/    # Android Studio プロジェクト
└── ios/ClipboardManager/        # Xcode プロジェクト
```

## Android

### 開発環境
- Android Studio Hedgehog (2023.1.1) 以上
- JDK 17
- Android SDK API 34

### 開始手順
1. Android Studioで `android/ClipboardManager/` を開く
2. `local.properties` の `sdk.dir` をAndroid SDKのパスに設定
3. ▶ Run でビルド・実行

### 収益化設定
- AdMob: `app/src/main/java/.../ads/AdManager.kt` の広告IDを本番用に変更
- Play Billing: Google Play ConsoleでサブスクriptionID (`premium_monthly`, `premium_yearly`) を作成

---

## iOS

### 開発環境
- Xcode 15.0 以上
- iOS 16.0+ ターゲット
- Apple Developer Account (実機テスト・拡張機能に必要)

### 開始手順
1. Xcodeで `ios/ClipboardManager/ClipboardManager.xcodeproj` を開く
2. 各ターゲットの Signing & Capabilities で Development Team を設定
3. App Group `group.com.example.clipboardmanager` を設定（必須）
4. ▶ Run でビルド・実行

### App Group 設定（キーボード・ウィジェット動作に必須）
1. Apple Developer Portal → Identifiers → App Groups
2. `group.com.example.clipboardmanager` を作成
3. Xcode の各ターゲット → Signing & Capabilities → App Groups で追加

### StoreKit テスト
- `ClipboardManager/Products.storekit` が設定済み
- Xcode: Edit Scheme → Run → Options → StoreKit Configuration で選択

### 収益化設定
- AdMob: `Sources/Monetization/AdBannerView.swift` でSDKを有効化
- App Store Connect でサブスクリプション商品を作成:
  - `com.example.clipboardmanager.premium.monthly` (¥300/月)
  - `com.example.clipboardmanager.premium.yearly` (¥2,400/年)
