# OfflineChat - モノレポジトリ

WiFi不要でNearby Connections / MultipeerConnectivity を使ったオフラインチャットアプリ。

```
offline-chat/
├── android/          # Android (Kotlin + Jetpack Compose)
├── ios/              # iOS (Swift + SwiftUI)
└── README.md
```

## Android セットアップ

### 必要環境
- Android Studio Meerkat (2024.3.1) 以降
- JDK 17
- Android SDK 35

### 手順

1. **Android Studio で開く**
   ```
   File → Open → android/ フォルダを選択
   ```

2. **local.properties を作成**
   ```
   cp android/local.properties.template android/local.properties
   ```
   `sdk.dir` を自分のSDKパスに変更し、`MAPS_API_KEY` を設定（省略可）。

3. **Gradle Sync → Run**
   - 実機接続必須（Nearby Connections はエミュレータ不可）

### パーミッション
初回起動時にまとめてダイアログが出ます。すべて「許可」してください。

---

## iOS セットアップ

### 必要環境
- Xcode 16 以降
- iOS 17 以上の実機（MultipeerConnectivity はシミュレータ不可）
- Apple Developer Account（無料でも実機デプロイ可）

### 手順

1. **Xcode で開く**
   ```
   ios/OfflineChat.xcodeproj をダブルクリック
   ```

2. **Signing 設定**
   ```
   Target: OfflineChat → Signing & Capabilities
   → Team を自分のアカウントに変更
   → Bundle Identifier を任意に変更（例: com.yourname.offlinechat）
   ```

3. **ビルド & 実行**
   - 実機を選択して ▶ Run

---

## 動作確認

1. **2台の実機**（Android同士 / iOS同士 / Android+iOS）でアプリを起動
2. Bluetooth・Wi-Fi・位置情報をONにする
3. トップ画面に相手が自動表示される
4. タップ → チャット開始

---

## 通信方式

| OS | 方式 | 最大距離 |
|----|------|---------|
| Android | Nearby Connections P2P_CLUSTER (WiFi-Aware + BT) | ~100m |
| iOS | MultipeerConnectivity (WiFi + BT) | ~30–100m |

Android ↔ iOS のクロスプラットフォーム通信は直接不可（同OS同士で動作）。
