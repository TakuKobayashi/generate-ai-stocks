# AR Timecapsule — モノレポ

位置情報 + ARタイムカプセル + クーポン プラットフォームのモノレポです。

```
ar-timecapsule/
├── packages/
│   ├── server/   # Cloudflare Workers + Hono バックエンド API
│   ├── web/      # Next.js 15 SSG フロントエンド
│   └── unity/    # Unity AR クライアント
├── migrations/   # D1 SQLite マイグレーション
└── pnpm-workspace.yaml
```

## セットアップ

```bash
# 依存インストール
pnpm install

# D1 データベース作成
cd packages/server
wrangler d1 create ar-timecapsule-db
# → 出力された database_id を wrangler.jsonc に設定

# R2 バケット作成
wrangler r2 bucket create ar-timecapsule-audio

# Secrets 設定
wrangler secret put JWT_SECRET
wrangler secret put R2_ACCOUNT_ID
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY

# DBマイグレーション
pnpm db:migrate:local   # ローカル
pnpm db:migrate:remote  # 本番

# ローカル開発
pnpm dev        # API (localhost:8787)
pnpm dev:web    # Web (localhost:3000)

# テスト
cd packages/server && pnpm test

# デプロイ (WebビルドしてからWorkers配信)
pnpm deploy
```

## 主要API

```
POST /api/v1/auth/signup
POST /api/v1/auth/signup/store   # store権限 (招待コード: STORE-INVITE-2024)
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout

GET  /api/v1/time-capsules/nearby?lat=&lng=&radius=&limit=&cursor=
GET  /api/v1/time-capsules/my
GET  /api/v1/time-capsules/all   # admin/moderator のみ
GET  /api/v1/time-capsules/:id
POST /api/v1/time-capsules
DELETE /api/v1/time-capsules/:id

POST /api/v1/audio/upload-url
POST /api/v1/audio/confirm

GET  /api/v1/coupons/:id
POST /api/v1/coupons/:id/redeem

POST /api/v1/time-capsules/:id/report
```

## Web管理画面

| パス | 説明 | 権限 |
|------|------|------|
| `/` | ランディングページ | 誰でも |
| `/auth/login` | ログイン | 誰でも |
| `/auth/signup` | ユーザー登録 | 誰でも |
| `/store/signup` | 店舗登録 | 招待コード必要 |
| `/admin` | ダッシュボード | 要ログイン |
| `/admin/capsules` | カプセル一覧マップ | 要ログイン |
| `/admin/capsules/new` | カプセル作成 | 要ログイン |
| `/admin/capsules?view=all` | 全カプセルマップ | admin のみ |
| `/admin/coupons` | クーポン一覧 | store/admin |
| `/admin/coupons/new` | クーポン付きカプセル作成 | store/admin |

## Unity セットアップ

1. Unity 2022.3 LTS 以上で `packages/unity` を開く
2. Package Manager から NuGetForUnity が自動インストールされる
3. `Assets/Scripts/Api/ApiClient.cs` の `_baseUrl` を本番URLに変更
4. Project Settings → XR Plug-in Management で ARCore (Android) / ARKit (iOS) を有効化
