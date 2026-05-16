# 🍺 飲みに行きたい！

> 友達に「今夜飲みに行かない？」をワンタップで届けるアプリ

---

## モノレポ構成

```
nomikai/
├── android/                    # Android アプリ (Kotlin + Jetpack Compose)
├── ios/                        # iOS アプリ (SwiftUI)
├── web/
│   ├── backend/                # API サーバー (Cloudflare Workers + Hono + D1)
│   └── frontend/               # Web アプリ (Next.js SSG + Firebase FCM)
├── .github/workflows/          # CI/CD (GitHub Actions)
├── .vscode/                    # VS Code 推奨設定
├── package.json                # pnpm workspaces ルート
├── pnpm-workspace.yaml
└── turbo.json                  # Turborepo パイプライン
```

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| **Android** | Kotlin · Jetpack Compose · Hilt · Room (ActiveRecord) · FCM |
| **iOS** | SwiftUI · GRDB (ActiveRecord) · CoreLocation · Firebase Messaging |
| **Web Frontend** | Next.js 14 (SSG) · TypeScript · Firebase JS SDK · Leaflet |
| **Web Backend** | Cloudflare Workers · Hono · TypeScript · Drizzle ORM · D1 |
| **Push 通知** | Firebase Cloud Messaging (Android / iOS / Web 共通) |
| **飲食店 API** | ホットペッパーグルメ API + ValueCommerce アフィリエイト |
| **パッケージ管理** | pnpm workspaces + Turborepo |

---

## クイックスタート

### 前提条件

- Node.js >= 20 / pnpm >= 9
- Android Studio Iguana 以降（Android 開発時）
- Xcode 15 以降 + CocoaPods（iOS 開発時）

### インストール・起動

```bash
# 依存関係インストール（web/frontend・web/backend）
pnpm install

# フロントエンド開発サーバー
pnpm dev

# バックエンド開発サーバー（別ターミナル）
pnpm dev:backend

# 型チェック（全パッケージ）
pnpm typecheck
```

---

## セットアップ手順

### 1. Firebase プロジェクト作成

1. [Firebase Console](https://console.firebase.google.com) でプロジェクトを作成
2. 各プラットフォームのアプリを追加：
   - **Android** → `google-services.json` を `android/app/` に配置
   - **iOS** → `GoogleService-Info.plist` を `ios/NomikaiApp/Resources/` に配置
   - **Web** → Firebase 設定値をメモ
3. クラウドメッセージング → ウェブプッシュ証明書を生成
4. iOS 向け APNs 認証キーをアップロード

### 2. ホットペッパー API + ValueCommerce

1. [リクルート Web サービス](https://webservice.recruit.co.jp/) でホットペッパーグルメ API キーを取得
2. [ValueCommerce](https://www.valuecommerce.ne.jp/) でアフィリエイトプログラムに参加し SID・PID を取得

### 3. Cloudflare Workers バックエンド

```bash
cd web/backend

npx wrangler login
npx wrangler d1 create nomikai-db
# → database_id を wrangler.toml に記入

pnpm db:migrate

npx wrangler secret put HOTPEPPER_API_KEY
npx wrangler secret put FCM_PROJECT_ID
npx wrangler secret put FCM_CLIENT_EMAIL
npx wrangler secret put FCM_PRIVATE_KEY   # base64エンコードした秘密鍵
```

`wrangler.toml` の `HOTPEPPER_AFFILIATE_ID`・`HOTPEPPER_AFFILIATE_PID` も更新してください。

### 4. Web フロントエンド

```bash
cd web/frontend
cp .env.local.example .env.local
# .env.local を編集して Firebase 設定を入力
```

### 5. Android

1. `android/app/google-services.json` を配置
2. `android/app/build.gradle.kts` の `BASE_URL` を Workers の URL に変更
3. Android Studio で `android/` を開いてビルド

### 6. iOS

```bash
cd ios
chmod +x setup.sh && ./setup.sh
# XcodeGen + CocoaPods が自動セットアップされます

# Info.plist の GMSApiKey と API_BASE_URL を更新後
open NomikaiApp.xcworkspace
```

---

## デプロイ

```bash
# フロントエンドをビルドしてバックエンドと一括デプロイ
pnpm build:deploy

# 個別実行の場合
pnpm --filter frontend build:export   # SSG → backend/web-dist/ にコピー
pnpm --filter backend deploy          # Cloudflare Workers にデプロイ
```

### GitHub Actions 自動デプロイ

`main` ブランチへの push で `.github/workflows/deploy-backend.yml` が実行されます。
リポジトリ Settings → Secrets に以下を追加してください：

| Secret | 説明 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API トークン |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare アカウント ID |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase 設定 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase 設定 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase 設定 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase 設定 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase 設定 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase 設定 |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Firebase VAPID 公開鍵 |

---

## アーキテクチャ

```
[Android / iOS / Web]
        │ HTTPS
        ▼
[Cloudflare Workers (Hono)]
        │
        ├── /api/users          ユーザー登録・FCMトークン管理
        ├── /api/invites   ──── FCM HTTP v1 → 全デバイスへ Push
        ├── /api/restaurants ── ホットペッパー API プロキシ
        ├── /api/notifications  通知管理
        └── /* (static) ─────── Next.js SSG ビルド配信
                │
               D1 (SQLite)
```

### ActiveRecord パターン（Android / iOS）

各プラットフォームでモデルが DB 操作メソッドを直接持ちます。

```kotlin
// Android (Room)
UserRecord(id = uuid, name = "太郎").save()
val me = UserRecord.findCurrent()
notification.markRead()
NotificationRecord.observeForUser(userId).collect { list -> ... }
```

```swift
// iOS (GRDB)
try UserRecord(id: uuid, name: "太郎").save()
let me = try UserRecord.findCurrent()
try notification.markRead()
NotificationRecord.observeForUser(userId: id).sink { list in ... }
```

---

## ライセンス

MIT
