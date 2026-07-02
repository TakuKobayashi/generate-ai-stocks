# 名刺帳アプリ モノレポ

アカウント登録不要で使える名刺交換アプリ。QR / Nearby(Bluetooth+Wi-Fi) / NFC の3方式で連絡先を交換できる。

```
meishi-app/
├── android/          # Android (Kotlin + Jetpack Compose)
│   └── app/src/main/java/com/meishi/app/
│       ├── db/       # SQLite ActiveRecord 基底クラス
│       ├── model/    # Profile / Contact / SnsAccount
│       ├── nearby/   # Nearby Connections ラッパー
│       ├── nfc/      # HCE / NFCリーダー
│       ├── ui/       # Compose 画面 & コンポーネント
│       └── util/     # MessagePack / QR / 画像ユーティリティ
└── ios/              # iOS (Swift + SwiftUI)
    └── Meishi/
        ├── DB/       # SQLite3 ラッパー (外部ライブラリ不要)
        ├── Models/   # Profile / Contact / SnsAccount
        ├── Transfer/ # MultipeerConnectivity / NFC (CoreNFC)
        ├── Util/     # MessagePack手書き実装 / 画像 / QR
        └── Views/    # SwiftUI 画面
```

## MessagePack スキーマ (version 1)
| フィールド | 型 | 説明 |
|---|---|---|
| type | int | 1 = 連絡先交換 |
| version | int | スキーマバージョン |
| device_id | str | 送信元の一時ID (重複受信検知用) |
| sent_at | int | unix秒 |
| icon | map/nil | mime: str, data: bin |
| data.name | str | 名前 |
| data.mail | str | メールアドレス |
| data.tel | str | 国際番号付き電話番号 |
| data.address | str | 住所 |
| data.accounts[].service_name | str | SNS名 |
| data.accounts[].service_type | int | 0=other 1=X 2=FB 3=LINE 4=WA 5=IG 6=TT 7=YT 8=GH 9=LI 10=Web |
| data.accounts[].account_url | str/nil | SNSのURL |
| data.accounts[].account_id | str/nil | SNSのID(例:LINE ID) |
| data.accounts[].sort_order | int | 表示順 |

## 通信方式
| 方式 | Android | iOS | クロスプラットフォーム |
|---|---|---|---|
| QRコード | ZXing生成/MLKit読取 | CoreImage生成/AVFoundation読取 | ✅ |
| Nearby | Nearby Connections API | MultipeerConnectivity | ❌ 同OS間のみ |
| NFC | HCE送信 + ReaderMode受信 | CoreNFC受信のみ(HCE非対応) | Android送→iOS受のみ ✅ |
