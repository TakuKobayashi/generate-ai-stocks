# 📧 email-auto-reply (Monorepo)

Gmail / Yahoo Japan Mail 自動返信ツール  
**CLI (Node.js)** と **Cloudflare Workers (Webhook + Cron)** をモノリポで管理します。

---

## パッケージ構成

```
email-auto-reply/
├── packages/
│   ├── core/          # 共有ロジック (AI生成 / 型定義 / メールパーサー)
│   ├── cli/           # Node.js CLIツール (Commander + SQLite + IMAP)
│   └── server/        # Cloudflare Workers (Hono + D1 + Webhook)
├── tsconfig.base.json
└── package.json       # npm workspaces
```

| パッケージ | プラットフォーム | 役割 |
|-----------|--------------|------|
| `@email-reply/core` | agnostic | AI生成・型定義・メールパーサー |
| `@email-reply/cli`  | Node.js 20 | IMAP ポーリング・SMTP 送信・cron |
| `@email-reply/server` | Cloudflare Workers | Gmail Webhook・D1・Hono API |

---

## クイックスタート

### インストール

```bash
npm install
npm run build:core   # core を先にビルド
npm run build:cli
```

### CLI のセットアップ

```bash
cd packages/cli
cp .env.example .env
# .env を編集 → APIキー / メール設定を記入

# Gmail OAuth 認証
npm run dev -- auth gmail

# 動作確認（1回チェック）
npm run dev -- check all

# 定期監視（15分ごと）
npm run dev -- watch all
```

### Cloudflare Workers のセットアップ

```bash
cd packages/server

# 1. D1 データベースを作成
npx wrangler d1 create email-reply-db
# → 出力された database_id を wrangler.toml に記入

# 2. マイグレーション実行
npm run db:migrate:local   # ローカルテスト用
npm run db:migrate         # 本番

# 3. シークレットを設定
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put GMAIL_CLIENT_ID
npx wrangler secret put GMAIL_CLIENT_SECRET
npx wrangler secret put GMAIL_ACCESS_TOKEN
npx wrangler secret put GMAIL_REFRESH_TOKEN
npx wrangler secret put YAHOO_EMAIL
npx wrangler secret put YAHOO_APP_PASSWORD
npx wrangler secret put WEBHOOK_SECRET
npx wrangler secret put SIGNATURE

# 4. ローカル開発
cp .dev.vars.example .dev.vars
# .dev.vars を編集
npm run dev

# 5. デプロイ
npm run deploy
```

---

## Gmail Pub/Sub Webhook の設定

Workers デプロイ後、Gmail のリアルタイム通知を受信するために設定します。

```bash
# 1. Google Cloud Pub/Sub トピックを作成
gcloud pubsub topics create gmail-push

# 2. Gmail が Pub/Sub に publish できる権限を付与
gcloud pubsub topics add-iam-policy-binding gmail-push \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher"

# 3. Push サブスクリプションを作成
#    ?token= に WEBHOOK_SECRET を指定
gcloud pubsub subscriptions create gmail-push-sub \
  --topic=gmail-push \
  --push-endpoint="https://<your-worker>.workers.dev/webhook/gmail?token=<WEBHOOK_SECRET>" \
  --ack-deadline=60

# 4. Gmail API で watch() を実行（定期的に更新が必要）
curl -X POST "https://gmail.googleapis.com/gmail/v1/users/me/watch" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"topicName":"projects/<PROJECT_ID>/topics/gmail-push","labelIds":["Label_ID"]}'
```

---

## API エンドポイント (Workers)

| Method | Path | 説明 |
|--------|------|------|
| `GET`  | `/health` | ヘルスチェック |
| `POST` | `/webhook/gmail` | Gmail Pub/Sub Webhook |
| `GET`  | `/webhook/gmail/verify` | Pub/Sub 確認 |
| `POST` | `/webhook/gmail/manual-sync` | Gmail 手動同期 |
| `GET`  | `/admin/history` | 処理済みメール履歴 |
| `POST` | `/admin/sync/gmail` | Gmail 手動同期 |
| `POST` | `/admin/sync/yahoo` | Yahoo 手動同期 |

管理APIは `Authorization: Bearer <WEBHOOK_SECRET>` が必要です。

---

## プラットフォーム別の役割分担

```
[Gmail]
  受信 → Pub/Sub → Webhook → Workers → D1 に記録 → Gmail API で返信

[Yahoo Mail]
  受信 → CLI watch (cron) → SQLite に記録 → SMTP で返信
  ※ Workers は Cron Trigger でポーリング（将来の拡張）

[AI 生成]
  packages/core の generateReply() が両環境で共通動作
  Groq: llama-3.3-70b-versatile
  Gemini: gemini-2.0-flash
```

---

## CLIコマンド一覧

```
email-reply check [service]      1回チェックして返信
email-reply watch [service]      cronで定期チェック
  -s, --schedule <cron>          スケジュール式 (デフォルト: */15 * * * *)
email-reply auth gmail           Gmail OAuth認証
email-reply auth yahoo           Yahoo設定ガイド
email-reply history [-n N]       処理済みメール履歴
email-reply config               設定確認
```
