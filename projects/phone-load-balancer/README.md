# PhoneRoute — 電話ロードバランサー

Vonage Voice API + Cloudflare Workers + D1 + Hono + Next.js で構築したマルチテナント対応電話ロードバランサーです。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare Workers                          │
│                                                              │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │  Static Assets      │  │  Hono API Server             │  │
│  │  (Next.js SSG)      │  │                              │  │
│  │                     │  │  /api/auth/*                 │  │
│  │  /          LP      │  │  /api/tenants/*              │  │
│  │  /admin/*   管理画面 │  │  /api/tenants/:id/           │  │
│  │                     │  │    forward-numbers/*         │  │
│  └─────────────────────┘  │  /api/webhooks/*             │  │
│                            │  /api/call-logs/*            │  │
│  ┌──────────────────────┐  └──────────────────────────────┘  │
│  │  Durable Object      │                                    │
│  │  CallQueueDO         │  ┌──────────────────────────────┐  │
│  │  (per-tenant queue)  │  │  Cloudflare D1               │  │
│  └──────────────────────┘  │  (SQLite)                    │  │
│                            └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ↕ Webhook                    ↕ Webhook
┌─────────────────────────────────────────────────────────────┐
│                     Vonage Voice API                         │
└─────────────────────────────────────────────────────────────┘
```

## 転送フロー

```
着信
  │
  ▼
テナント番号照合
  ├─ 番号不明 → 「この番号はお取り扱いできません」音声
  │
  ▼
転送先番号取得（優先度順）
  ├─ 登録なし → 「転送先が登録されていません」音声
  │
  ▼
空き番号に優先度順で転送
  │
  ├─ 10秒応答なし → 次の番号へ
  │
  ├─ 全員通話中 → キューに追加 + 「○番目にお待ちです」音声
  │
  └─ 応答あり → 通話確立 → ステータス更新
                    │
                    └─ 通話終了 → ステータス idle に戻す
                                       │
                                       └─ キューに待機者がいれば転送
```

## プロジェクト構成

```
phone-load-balancer/
├── packages/
│   ├── frontend/          # Next.js SSG フロントエンド
│   │   ├── src/app/
│   │   │   ├── page.tsx              # ランディングページ
│   │   │   └── admin/
│   │   │       ├── page.tsx          # ダッシュボード
│   │   │       ├── login/page.tsx    # ログイン
│   │   │       ├── tenants/page.tsx  # テナント管理
│   │   │       └── logs/page.tsx     # 通話ログ
│   │   └── next.config.ts   # SSG → worker/assets/ に出力
│   │
│   └── worker/            # Cloudflare Worker
│       ├── src/
│       │   ├── index.ts              # Hono エントリーポイント
│       │   ├── types.ts              # Env 型定義
│       │   ├── db/
│       │   │   ├── index.ts          # Drizzle クライアント
│       │   │   └── schema.ts         # DB スキーマ
│       │   ├── middleware/
│       │   │   └── auth.ts           # JWT 認証ミドルウェア
│       │   ├── routes/
│       │   │   ├── auth.ts           # 認証 API
│       │   │   ├── tenants.ts        # テナント CRUD
│       │   │   ├── forwardNumbers.ts # 転送番号 CRUD
│       │   │   ├── webhooks.ts       # Vonage Webhook
│       │   │   └── callLogs.ts       # 通話ログ
│       │   ├── services/
│       │   │   ├── loadBalancer.ts   # 転送ロジック本体
│       │   │   ├── ncco.ts           # Vonage NCCO ビルダー
│       │   │   ├── vonage.ts         # Vonage API クライアント
│       │   │   └── queue.ts          # キュー操作ヘルパー
│       │   └── durable-objects/
│       │       └── CallQueueDO.ts    # キュー Durable Object
│       ├── migrations/
│       │   └── 0000_initial_schema.sql
│       └── wrangler.jsonc
└── package.json
```

## セットアップ

### 1. 依存パッケージのインストール

```bash
pnpm install
```

### 2. Cloudflare D1 データベースの作成

```bash
# D1 データベースを作成
npx wrangler d1 create phone-lb-db

# 出力された database_id を wrangler.jsonc に設定
```

`packages/worker/wrangler.jsonc` の `YOUR_D1_DATABASE_ID` を実際のIDに置き換えてください。

### 3. マイグレーションの実行

```bash
# ローカル開発用
pnpm db:migrate:local

# 本番環境
pnpm db:migrate
```

### 4. Vonage のセットアップ

1. [Vonage Dashboard](https://dashboard.nexmo.com) にアクセス
2. Applications → Create a new application
3. Voice 機能を有効化
4. Answer URL: `https://your-worker.workers.dev/api/webhooks/answer`
5. Event URL: `https://your-worker.workers.dev/api/webhooks/call-event`
6. Fallback URL: `https://your-worker.workers.dev/api/webhooks/fallback`
7. 電話番号を購入し、Application にリンク

### 5. シークレットの設定

```bash
cd packages/worker

# JWT署名シークレット（任意のランダム文字列）
npx wrangler secret put JWT_SECRET

# Vonage API Key（Vonage Dashboardから）
npx wrangler secret put VONAGE_API_KEY

# Vonage API Secret
npx wrangler secret put VONAGE_API_SECRET

# Vonage Application ID
npx wrangler secret put VONAGE_APPLICATION_ID

# Vonage Private Key（Application作成時にダウンロードしたpemファイルの内容）
# 改行を \n に置換してから設定
npx wrangler secret put VONAGE_PRIVATE_KEY
```

### 6. ビルド & デプロイ

```bash
# フロントエンドをビルドして worker/assets/ に出力
pnpm build

# Cloudflare にデプロイ
pnpm deploy
```

### 7. 管理者アカウントの初期設定

デプロイ後、初回のみ以下のAPIを叩いて管理者を作成します：

```bash
curl -X POST https://your-worker.workers.dev/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-secure-password"}'
```

### 8. テナントの設定

1. `https://your-worker.workers.dev/admin` にアクセス
2. ログイン
3. テナントを作成
4. Vonage番号と Application ID を設定
5. 転送先電話番号を優先度順に登録

## ローカル開発

```bash
# Worker のローカル起動
cd packages/worker
npx wrangler dev

# フロントエンドの開発サーバー（別ターミナル）
cd packages/frontend
pnpm dev
```

フロントエンドは `http://localhost:3000`、API は `http://localhost:8787` で起動します。

開発時は `packages/frontend/src/lib/api.ts` の `API_BASE` を `http://localhost:8787` に向けるか、
`next.config.ts` に rewrites を追加してください。

## 環境変数（wrangler.jsonc の vars）

| 変数名 | 説明 |
|--------|------|
| `ENVIRONMENT` | `production` または `development` |

## Secrets（wrangler secret で設定）

| シークレット名 | 説明 |
|----------------|------|
| `JWT_SECRET` | JWT署名用シークレットキー |
| `VONAGE_API_KEY` | Vonage API Key |
| `VONAGE_API_SECRET` | Vonage API Secret |
| `VONAGE_APPLICATION_ID` | Vonage Application ID |
| `VONAGE_PRIVATE_KEY` | Vonage RSA秘密鍵（改行を\nに変換） |
