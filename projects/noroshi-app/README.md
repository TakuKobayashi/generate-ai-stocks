# 狼煙アプリ (Noroshi App)

位置情報ベースのAR狼煙アプリ。指定した地点で狼煙を上げ、ARカメラでその方向をのぞくと実際に狼煙が見えるアプリです。

## 技術スタック

| レイヤー       | 技術                                                   |
|---------------|--------------------------------------------------------|
| AR            | Unity + AR Foundation + ARCore Extensions (Geospatial) |
| Android AR    | ARCore Geospatial API                                  |
| iOS AR        | ARKit (AR Foundation 経由)                            |
| Push通知      | Firebase Cloud Messaging (FCM) HTTP v1                 |
| APIサーバー   | Cloudflare Workers + Hono + Drizzle ORM                |
| サーバーDB    | Cloudflare D1 (SQLite)                                 |
| 位置検索      | GeoHash (precision 6, ~610m/cell)                      |
| ローカルDB    | SQLite (ActiveRecord パターン)                          |
| 地図表示      | Leaflet.js (UniWebView 内)                             |

## プロジェクト構成

```
noroshi-app/
├── packages/
│   ├── server/          # Cloudflare Workers API
│   │   ├── src/
│   │   │   ├── index.ts           # Hono エントリーポイント
│   │   │   ├── routes/
│   │   │   │   ├── noroshi.ts     # 狼煙 CRUD API
│   │   │   │   └── device.ts      # デバイストークン API
│   │   │   ├── db/
│   │   │   │   └── schema.ts      # Drizzle スキーマ
│   │   │   └── utils/
│   │   │       ├── geohash.ts     # GeoHash 検索ユーティリティ
│   │   │       └── fcm.ts         # FCM HTTP v1 送信
│   │   └── drizzle/
│   │       └── 0000_initial.sql   # D1 マイグレーション
│   │
│   ├── shared/          # 共通型定義
│   │
│   └── unity/           # Unity AR アプリ
│       └── Assets/
│           ├── Scripts/
│           │   ├── AR/
│           │   │   ├── NoroshiARManager.cs    # AR 狼煙配置管理
│           │   │   ├── NoroshiEffect.cs       # パーティクルエフェクト
│           │   │   └── ARSceneController.cs   # AR シーン初期化
│           │   ├── API/
│           │   │   └── NoroshiApiClient.cs    # HTTP API クライアント
│           │   ├── Database/
│           │   │   └── NoroshiRecord.cs       # SQLite ActiveRecord
│           │   ├── UI/
│           │   │   ├── MainSceneController.cs
│           │   │   ├── CreateNoroshiSceneController.cs
│           │   │   └── NoroshiMapController.cs
│           │   ├── Notifications/
│           │   │   └── NoroshiNotificationHandler.cs
│           │   └── Utils/
│           │       ├── AppManager.cs
│           │       ├── GeoUtils.cs
│           │       └── UnityMainThreadDispatcher.cs
│           └── StreamingAssets/
│               └── map/index.html  # Leaflet.js 地図
└── packages/shared/

```

## セットアップ手順

### 1. サーバー

```bash
cd packages/server
pnpm install

# D1 データベース作成
wrangler d1 create noroshi-db

# wrangler.toml の database_id を更新後:
wrangler d1 execute noroshi-db --local --file=./drizzle/0000_initial.sql

# Firebase の Service Account JSON を Wrangler シークレットに設定
wrangler secret put FCM_SERVICE_ACCOUNT   # JSONをペースト
wrangler secret put FCM_PROJECT_ID        # Firebaseプロジェクト ID

# ローカル開発
pnpm dev

# デプロイ
pnpm deploy
```

### 2. Unity

1. Unity 6 (6000.x) で `packages/unity` を開く
2. Package Manager で以下をインストール:
   - AR Foundation 6.x
   - ARCore XR Plugin 6.x
   - ARKit XR Plugin 6.x
   - Google ARCore Extensions for AR Foundation 1.44+
   - Firebase Messaging SDK
3. UniWebView をアセットストアから購入・インポート
4. `Assets/Scripts/Utils/AppManager.cs` の `apiBaseUrl` を Workers の URL に変更
5. `google-services.json` (Android) と `GoogleService-Info.plist` (iOS) を `Assets/` に配置
6. `Assets/Prefabs/NoroshiPrefab_README.md` に従って Prefab を作成

## API エンドポイント

| Method | Path                  | 説明                          |
|--------|-----------------------|-------------------------------|
| GET    | /api/noroshis         | 周辺狼煙取得 (?lat=&lng=)     |
| POST   | /api/noroshis         | 狼煙を上げる                  |
| DELETE | /api/noroshis/:id     | 狼煙を消す                    |
| POST   | /api/devices          | デバイストークン登録          |
| DELETE | /api/devices/:userId  | デバイストークン削除          |

## GeoHash による検索最適化

- precision 6 のセル (~610m) でインデックス化
- 検索時は中心点周辺 9 セル (自身 + 隣接 8 セル) を LIKE 検索
- さらに Haversine 公式で正確な距離フィルタを適用
- インデックス: `geohash_idx`, `geohash_end_at_idx`

## AR 動作仕様

| 距離      | 表示                         |
|----------|------------------------------|
| 1km 以上 | 非表示                        |
| ~1km     | 小さく表示                    |
| ~100m    | 通常サイズ                    |
| ~10m 以内| 画面いっぱいに拡大表示        |

位置特定には ARCore Geospatial API を優先使用。
利用不可の場合は GPS + 相対座標によるフォールバック。
