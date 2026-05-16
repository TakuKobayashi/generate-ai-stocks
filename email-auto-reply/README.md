# 📧 email-auto-reply (Monorepo)

Gmail / Yahoo Japan Mail 自動返信ツール  
**CLI (Node.js)** と **Cloudflare Workers (Webhook + Cron)** を pnpm workspaces で管理します。

---

## パッケージ構成

```
email-auto-reply/
├── packages/
│   ├── core/          # 共有ロジック (AI生成 / 型定義 / メールパーサー)
│   ├── cli/           # Node.js CLIツール (Commander + SQLite + IMAP)
│   └── server/        # Cloudflare Workers (Hono + D1 + Webhook)
├── pnpm-workspace.yaml
├── .npmrc
├── tsconfig.base.json
└── package.json
```

| パッケージ | プラットフォーム | 役割 |
|---|---|---|
| `@email-reply/core` | 環境非依存 | AI生成・型定義・メールパーサー |
| `@email-reply/cli`  | Node.js 20+ | IMAP ポーリング・SMTP 送信・cron |
| `@email-reply/server` | Cloudflare Workers | Gmail Webhook・Hono API・D1 |

---

## インストール（共通）

```bash
# pnpm がない場合はインストール
npm install -g pnpm

# 依存関係を一括インストール
pnpm install

# core を先にビルド（cli / server が依存するため必須）
pnpm build:core
```

---

## CLI パッケージ (`packages/cli`)

### 概要

Node.js で動作するコマンドラインツールです。  
IMAP でメールを取得し、AI で返信を生成して SMTP で送信します。  
処理済みメールは SQLite (Drizzle ORM) で管理し、二重返信を防止します。

```
メール受信
  → Gmailラベル「要返信」または Yahooフォルダ「要返信」に移動
  → CLI が検出 → AI で返信生成 → 署名を付与 → 返信送信
  → SQLite に記録
```

### 1. 事前準備

**Gmail の場合 — Google Cloud Console での設定**

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 「APIとサービス」→「ライブラリ」→ `Gmail API` を有効化
3. 「認証情報」→「認証情報を作成」→「OAuth 2.0 クライアント ID」
4. アプリの種類: **デスクトップアプリ** を選択
5. 生成された **クライアントID** と **クライアントシークレット** を控える

**Yahoo Japan Mail の場合 — アプリパスワードの発行**

1. [Yahoo JAPAN ID管理](https://login.yahoo.co.jp/) にログイン
2. アカウント情報 → セキュリティ → **アプリパスワードの管理**
3. 「アプリパスワードを発行する」→ 生成されたパスワードを控える
4. Yahooメール設定 → メールの受け取り方 → **IMAP を有効化**

### 2. 環境変数の設定

```bash
cd packages/cli
cp .env.example .env
```

`.env` を編集して以下を設定します:

```env
# AIプロバイダー（groq または gemini）
AI_PROVIDER=groq
GROQ_API_KEY=gsk_xxxxxxxxxxxx        # https://console.groq.com/
GEMINI_API_KEY=AIzaSy_xxxxxxxxxxxx   # https://aistudio.google.com/

# Gmail
GMAIL_CLIENT_ID=xxxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxxx
GMAIL_TARGET_LABEL=要返信            # 返信トリガーとなるラベル名

# Yahoo Japan Mail
YAHOO_EMAIL=your_address@yahoo.co.jp
YAHOO_APP_PASSWORD=xxxx xxxx xxxx xxxx
YAHOO_TARGET_FOLDER=要返信           # 返信トリガーとなるフォルダ名

# 署名ファイル（Markdown形式）
SIGNATURE_FILE=./signature.md

# データベース保存先
DATABASE_URL=./data/emails.db

# 定期チェックのスケジュール（cron式）
CRON_SCHEDULE=*/15 * * * *
```

### 3. 署名ファイルの編集

`packages/cli/signature.md` を自分の情報に書き換えてください。  
返信メールの末尾に自動的に付与されます。

```markdown
---

山田 太郎 (Taro Yamada)
株式会社サンプル
📧 taro@example.com
📞 03-XXXX-XXXX
```

### 4. Gmail 認証（初回のみ）

```bash
# ルートから実行
pnpm dev:cli -- auth gmail

# または packages/cli に移動して実行
cd packages/cli
pnpm dev -- auth gmail
```

ブラウザでURLを開いて認証し、表示された認証コードを貼り付けます。  
トークンは `data/gmail-token.json` に保存され、以降は自動で使用されます。

Yahoo Mail は認証不要です（アプリパスワードで接続）。

### 5. 動作確認

```bash
# 設定を確認
pnpm dev:cli -- config

# Gmail・Yahoo 両方を1回チェックして返信
pnpm dev:cli -- check all

# Gmail のみチェック
pnpm dev:cli -- check gmail

# Yahoo のみチェック
pnpm dev:cli -- check yahoo

# 処理履歴を確認（直近20件）
pnpm dev:cli -- history
pnpm dev:cli -- history --limit 50
```

### 6. 定期監視の起動（watch モード）

```bash
# 15分ごとに全サービスをチェック（.env の CRON_SCHEDULE に従う）
pnpm dev:cli -- watch all

# 5分ごとにチェック（スケジュールを上書き）
pnpm dev:cli -- watch all --schedule "*/5 * * * *"

# Gmailのみを1時間ごとにチェック
pnpm dev:cli -- watch gmail --schedule "0 * * * *"

# 起動後1回だけ実行して終了（動作確認用）
pnpm dev:cli -- watch all --once
```

`Ctrl+C` で停止します。サーバーで常駐させる場合は `pm2` や `systemd` での管理を推奨します。

### CLI コマンドリファレンス

```
pnpm dev:cli -- <command> [options]

コマンド:
  check [service]              メールを1回チェックして返信
                               service: gmail | yahoo | all (デフォルト: all)

  watch [service]              cronで定期チェック・自動返信
                               service: gmail | yahoo | all (デフォルト: all)
    -s, --schedule <cron>      cronスケジュール式 (デフォルト: */15 * * * *)
    --once                     1回だけ実行して終了

  auth gmail                   Gmail OAuth2 認証を実行
    --check                    認証状態の確認のみ
  auth yahoo                   Yahoo Mail の設定ガイドを表示

  history                      処理済みメールの履歴を表示
    -n, --limit <number>       表示件数 (デフォルト: 20)

  config                       現在の設定を表示
```

---

## Server パッケージ (`packages/server`)

### 概要

Cloudflare Workers で動作するサーバーです。  
Gmail の **Pub/Sub Webhook** でリアルタイムに新着メールを受信し、AI で返信を生成して送信します。  
処理済みメールは **Cloudflare D1** (SQLite 互換) で管理します。  
また **Cron Trigger** で定期的にメールをポーリングすることもできます。

```
Gmail 新着メール
  → Google Cloud Pub/Sub → Webhook POST /webhook/gmail
  → Workers が受信 → AI で返信生成 → Gmail API で返信送信
  → D1 に記録
```

### 1. 事前準備

- Cloudflare アカウント（[無料プラン](https://dash.cloudflare.com/sign-up)で可）
- `wrangler` CLI（`pnpm install` 後に `packages/server/node_modules/.bin/wrangler` として利用可）
- Google Cloud Pub/Sub の設定（Gmail Webhook 利用時）

### 2. D1 データベースの作成

```bash
cd packages/server

# D1 データベースを作成（初回のみ）
pnpm wrangler d1 create email-reply-db
```

出力された `database_id` を `wrangler.toml` に記入します:

```toml
[[d1_databases]]
binding       = "DB"
database_name = "email-reply-db"
database_id   = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← ここに記入
```

### 3. マイグレーションの実行

```bash
# ローカル開発用（.wrangler/ 以下にローカルDBが作成される）
pnpm db:migrate:local

# 本番 D1 に適用
pnpm db:migrate
```

### 4. ローカル開発

```bash
cd packages/server
cp .dev.vars.example .dev.vars
```

`.dev.vars` を編集してシークレットを設定します:

```env
AI_PROVIDER=groq
GROQ_API_KEY=gsk_xxxxxxxxxxxx
GMAIL_CLIENT_ID=xxxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxxx
GMAIL_ACCESS_TOKEN=ya29.xxxx       # Google OAuth Playground で取得可
GMAIL_REFRESH_TOKEN=1//xxxx
GMAIL_TARGET_LABEL=要返信
YAHOO_EMAIL=your_address@yahoo.co.jp
YAHOO_APP_PASSWORD=xxxx xxxx xxxx xxxx
WEBHOOK_SECRET=your-random-secret  # Pub/Sub 認証 & 管理API 共通トークン
SIGNATURE=---\n山田 太郎\n📧 taro@example.com
```

```bash
# ローカルサーバー起動（http://localhost:8787）
pnpm dev:server
```

### 5. 本番デプロイ

```bash
# シークレットを本番環境に設定（対話的に入力）
cd packages/server
pnpm wrangler secret put GROQ_API_KEY
pnpm wrangler secret put GEMINI_API_KEY
pnpm wrangler secret put GMAIL_CLIENT_ID
pnpm wrangler secret put GMAIL_CLIENT_SECRET
pnpm wrangler secret put GMAIL_ACCESS_TOKEN
pnpm wrangler secret put GMAIL_REFRESH_TOKEN
pnpm wrangler secret put YAHOO_EMAIL
pnpm wrangler secret put YAHOO_APP_PASSWORD
pnpm wrangler secret put WEBHOOK_SECRET
pnpm wrangler secret put SIGNATURE

# デプロイ
pnpm deploy:server
# または
cd packages/server && pnpm deploy
```

デプロイ後のURLは `https://email-auto-reply.<your-subdomain>.workers.dev` です。

### 6. Gmail Pub/Sub Webhook の設定

Workers デプロイ後に Gmail のリアルタイム通知を設定します。

```bash
# ① Google Cloud Pub/Sub トピックを作成
gcloud pubsub topics create gmail-push

# ② Gmail が Pub/Sub に publish できる権限を付与
gcloud pubsub topics add-iam-policy-binding gmail-push \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher"

# ③ Push サブスクリプションを作成（?token= に WEBHOOK_SECRET を指定）
gcloud pubsub subscriptions create gmail-push-sub \
  --topic=gmail-push \
  --push-endpoint="https://email-auto-reply.<your-subdomain>.workers.dev/webhook/gmail?token=<WEBHOOK_SECRET>" \
  --ack-deadline=60

# ④ Gmail API で watch() を呼び出してプッシュ通知を開始
#    ※ watch() は7日で失効するため定期的に再実行が必要
curl -X POST "https://gmail.googleapis.com/gmail/v1/users/me/watch" \
  -H "Authorization: Bearer <GMAIL_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "topicName": "projects/<PROJECT_ID>/topics/gmail-push",
    "labelIds":  ["<TARGET_LABEL_ID>"]
  }'
```

> **ラベルID の調べ方**  
> `curl "https://gmail.googleapis.com/gmail/v1/users/me/labels" -H "Authorization: Bearer <TOKEN>"` で一覧取得できます。

### 7. API エンドポイントリファレンス

| Method | パス | 認証 | 説明 |
|--------|------|------|------|
| `GET`  | `/health` | 不要 | ヘルスチェック |
| `POST` | `/webhook/gmail` | `?token=<SECRET>` | Gmail Pub/Sub Webhook 受信 |
| `GET`  | `/webhook/gmail/verify` | 不要 | Pub/Sub サブスクリプション確認 |
| `POST` | `/webhook/gmail/manual-sync` | Bearer トークン | Gmail ラベルを手動フルスキャン |
| `GET`  | `/admin/history?limit=N` | Bearer トークン | 処理済みメール履歴取得 |
| `POST` | `/admin/sync/gmail` | Bearer トークン | Gmail 手動同期 |
| `POST` | `/admin/sync/yahoo` | Bearer トークン | Yahoo 手動同期 |

管理 API (`/admin/*`, `/webhook/*/manual-sync`) のリクエスト例:

```bash
# 処理済みメール履歴を取得
curl "https://email-auto-reply.<subdomain>.workers.dev/admin/history?limit=10" \
  -H "Authorization: Bearer <WEBHOOK_SECRET>"

# Gmail を手動でフルスキャンして未処理メールに返信
curl -X POST "https://email-auto-reply.<subdomain>.workers.dev/admin/sync/gmail" \
  -H "Authorization: Bearer <WEBHOOK_SECRET>"
```

### 8. Cron Trigger の設定

`wrangler.toml` の `[triggers]` セクションで設定済みです（デフォルト: 5分ごと）。

```toml
[triggers]
crons = ["*/5 * * * *"]
```

変更する場合は `wrangler.toml` を編集して再デプロイします。  
Cloudflare ダッシュボードの Workers → **トリガー** タブからも確認できます。

---

## ルートスクリプト一覧

```bash
pnpm install           # 全パッケージの依存関係をインストール
pnpm build             # core → cli → server の順にビルド
pnpm build:core        # core のみビルド
pnpm build:cli         # core + cli をビルド
pnpm build:server      # core + server をビルド
pnpm dev:cli           # CLI を開発モードで起動
pnpm dev:server        # Workers をローカル開発モードで起動
pnpm typecheck         # 全パッケージの型チェック
pnpm deploy:server     # Workers を本番デプロイ
```

---

## プラットフォーム別の設計概要

| 懸念点 | CLI (Node.js) | Server (Workers) |
|--------|--------------|-----------------|
| Gmail 接続 | `googleapis` SDK | fetch で Gmail REST API 直接呼び出し |
| Yahoo 接続 | `imapflow` + `nodemailer` | Mailchannels REST API |
| DB | `better-sqlite3` + Drizzle | Cloudflare D1 + Drizzle |
| 認証情報 | `.env` ファイル | `wrangler secret put` |
| 署名 | ファイル読み込み | Secrets の `SIGNATURE` 環境変数 |
| AI 生成 | `@email-reply/core` 共通 | `@email-reply/core` 共通 |
