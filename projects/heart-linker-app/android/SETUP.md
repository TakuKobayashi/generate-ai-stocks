# Android セットアップ

## 必要な環境
- Android Studio Hedgehog (2023.1) 以降
- JDK 17
- Android SDK 34

## 開始手順
1. Android Studio で `android/` フォルダを **Open** する
2. 初回 Gradle Sync 時に gradle-wrapper.jar が自動ダウンロードされる
3. AVD または実機 (API 26+) で Run

## 必要なパーミッション (初回起動時に自動要求)
- カメラ (QRスキャン)
- Bluetooth / 位置情報 (Nearby Connections)
- NFC (NFCタップ送受信)

## 注意事項
- Nearby Connections は Google Play Services が必要 (実機推奨)
- NFC は実機のみ動作
