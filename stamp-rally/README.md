# スタンプラリー — モノリポジトリ

現地を巡るデジタルスタンプラリーサービス。Cloudflare Workers / D1 / R2 / Pages を使って完全無料で運用可能。

## プロジェクト構成

```
stamp-rally/
├── apps/
│   ├── api/           # Hono + TypeScript + Drizzle ORM (Cloudflare Workers)
│   └── web/           # Next.js + TypeScript (Cloudflare Pages)
│       └── src/app/
│           ├── /               ← ユーザートップ (参加一覧)
│           ├── /login          ← ユーザーログイン
│           ├── /register       ← ユーザー登録
│           ├── /join/[token]   ← スタンプラリー参加ページ
│           ├── /stamp/[id]     ← スタンプ押下ページ
│           └── /admin/         ← 管理者ダッシュボード
│               ├── /admin/login
│               ├── /admin/register
│               ├── /admin/create
│               └── /admin/[id]
└── packages/
    └── shared/        # 共有型定義 (将来拡張用)
```

## 技術スタック

| 項目 | 技術 |
|------|------|
| フロントエンド | Next.js 15 + TypeScript |
| スタイリング | CSS Modules (Tailwind なし) |
| バックエンド | Hono + TypeScript |
| ORM | Drizzle ORM |
| DB | Cloudflare D1 (SQLite) |
| ストレージ | Cloudflare R2 |
| ホスティング | Cloudflare Workers / Pages |
| 地図 | Leaflet + OpenStreetMap (完全無料) |
| 状態管理 | Jotai (フォーム永続化) |
| ドラッグ&ドロップ | @dnd-kit |
| QRコード | qrcode.react |
| モノリポ管理 | Turborepo |

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Cloudflare リソースの作成

```bash
# D1 データベースの作成
wrangler d1 create stamp-rally-db

# R2 バケットの作成
wrangler r2 bucket create stamp-rally-assets
```

`apps/api/wrangler.toml` の `database_id` を取得した ID に更新してください。

### 3. D1 マイグレーション実行

```bash
# ローカル
wrangler d1 execute stamp-rally-db --local --file=apps/api/src/db/migrations/0000_initial.sql

# 本番
wrangler d1 execute stamp-rally-db --file=apps/api/src/db/migrations/0000_initial.sql
```

### 4. シークレットの設定

```bash
cd apps/api

# JWT 署名用シークレット (ランダムな長い文字列)
wrangler secret put JWT_SECRET
```

### 5. 環境変数の設定

`apps/web/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8787
```

本番用は `apps/web/wrangler.toml` の `NEXT_PUBLIC_API_URL` を更新してください。

## 開発サーバー起動

```bash
# API (http://localhost:8787)
cd apps/api && npm run dev

# Web (http://localhost:3000)
cd apps/web && npm run dev
```

または Turborepo で一括起動:
```bash
npm run dev
```

## デプロイ

### API (Workers)

```bash
cd apps/api
npm run deploy
```

### Web (Cloudflare Pages)

```bash
cd apps/web
npm run build
npm run deploy
```

## 機能一覧

### 管理者 (`/admin`)
- [x] アカウント登録・ログイン
- [x] スタンプラリー一覧 (地図サムネイル付き、参加者数/コンプリート数表示)
- [x] スタンプラリー有効/無効切替 (確認ダイアログ付き)
- [x] スタンプラリー作成 (Leaflet 地図でピン留め)
  - 逆ジオコーディング (Nominatim API)
  - スポットのドラッグ&ドロップ並び替え
  - フォームデータの LocalStorage 永続化 (Jotai atomWithStorage)
- [x] 参加用URL・QRコード表示

### ユーザーアプリ (トップ / `/join` / `/stamp`)
- [x] 参加したスタンプラリー一覧 (進捗バー付き)
- [x] アカウント登録・ログイン
- [x] ゲスト参加 (「調整さん」方式)
- [x] 参加URLからスタンプラリー参加
- [x] スタンプ押下画面
  - Leaflet 地図 (スポット・ユーザー位置表示)
  - GPS 位置情報による 200m 範囲チェック
  - 範囲外はボタンをグレーアウト
  - コンプリート時に演出表示

## セキュリティ

- パスワードハッシュ: PBKDF2 + SHA-256 (Web Crypto API)
- 認証: HMAC-SHA256 JWT (7日間有効)
- CORS: 指定フロントエンドドメインのみ許可
- スタンプ押下時にサーバー側でも距離を再検証

## メール配信 (Cloudflare Email Workers)

Cloudflare Email Workers を使用する場合は `wrangler.toml` に以下を追加:

```toml
send_email = [
  { name = "SEND_EMAIL", destination_address = "no-reply@yourdomain.com" }
]
```

メール送信コードのサンプル:
```typescript
// apps/api/src/utils/email.ts
export async function sendWelcomeEmail(env: Env, to: string, name: string) {
  const message = new EmailMessage(
    'no-reply@yourdomain.com',
    to,
    createMimeMessage()
  );
  await env.SEND_EMAIL.send(message);
}
```

## 将来の拡張

- Android / iOS ネイティブアプリ (React Native)
- LINE Bot 連携
- スタンプのカスタムデザイン
- 参加者ランキング
- スタンプラリーのカテゴリ・タグ機能
