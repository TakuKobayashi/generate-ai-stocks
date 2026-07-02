# iOS セットアップ

## 必要な環境
- Xcode 15 以降
- iOS 16.0+
- Apple Developer アカウント (実機でのNFC使用に必要)

## 開始手順
1. `ios/Meishi.xcodeproj` を Xcode で開く
2. Signing & Capabilities で Team を設定する
3. シミュレータまたは実機 (iOS 16+) で Run

## 実機で NFC を使う場合
1. Xcode → Signing & Capabilities → `+ Capability` → **Near Field Communication Tag Reading** を追加
2. `Meishi.entitlements` の AID は Android 側と一致している (F0010203040506)

## Nearby (MultipeerConnectivity) の注意事項
- iOS同士のみ通信可能 (Android の Nearby Connections とは非互換)
- シミュレータではBluetooth/Wi-Fi が使えないため実機が推奨

## NFC 送信(Android→iOS)の仕組み
1. Android 側: HCE でセッショントークンをNFC応答
2. iOS 側: CoreNFC ISO-DEP でトークンを読み取り
3. トークンが一致する Nearby ピアに自動接続して MessagePack データを受信
