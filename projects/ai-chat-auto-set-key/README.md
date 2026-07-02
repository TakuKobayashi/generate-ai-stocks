# GitHub KV Chat

GitHubリポジトリのREADMEに記載されたMarkdownテーブルを毎日自動取得してCloudflare KVに保存し、そのデータをコンテキストとして使えるChatGPTライクなチャットUIを提供するシステムです。

## アーキテクチャ

```
pnpm monorepo
├── packages/worker/   # Cloudflare Workers (Hono)
│   ├── src/cron/      # 定期実行: GitHub README → KV
│   ├── src/api/       # /api/chat (OpenAI SSE), /api/kv
│   ├── src/auth/      # パスワード認証 + Passkey (WebAuthn)
│   └── src/lib/       # Markdown table parser
└── packages/web/      # Next.js SSG (assistant-ui)
    └── out/           # ビルド成果物 → Workers Assets
```

- **フロントエンド**: Next.js (SSG `output: 'export'`) + [assistant-ui](https://www.assistant-ui.com/)
- **バックエンド**: Hono on Cloudflare Workers
- **データストア**: Cloudflare KV
- **スケジューラ**: Cloudflare Cron Triggers (毎日0時UTC)
- **認証**: パスワード(PBKDF2) + Passkey(WebAuthn)

## セットアップ

### 1. 依存パッケージインストール

```bash
pnpm install
```

### 2. Cloudflare KV NamespaceをWranglerで作成

```bash
cd packages/worker
pnpm wrangler kv namespace create KV
pnpm wrangler kv namespace create KV --preview
```

出力された `id` と `preview_id` を `wrangler.jsonc` の `kv_namespaces` に設定してください。

### 3. wrangler.jsonc を設定

```jsonc
// packages/worker/wrangler.jsonc
{
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "実際のKV Namespace ID",
      "preview_id": "プレビュー用KV Namespace ID"
    }
  ],
  "vars": {
    "GITHUB_REPO_OWNER": "対象リポジトリのオーナー名",
    "GITHUB_REPO_NAME": "対象リポジトリ名",
    "OPENAI_API_KEY": "sk-..."
  }
}
```

> **注意**: `OPENAI_API_KEY` は `wrangler secret put OPENAI_API_KEY` でSecretとして設定することを推奨します。

### 4. 初回ユーザー作成

```bash
pnpm setup-auth
```

ユーザー名とパスワードを入力すると、KVにユーザー情報が書き込まれます。

**本番環境への適用:**
```bash
cd packages/worker
pnpm wrangler kv key put auth:user '<出力されたJSON>' --remote
```

### 5. スクレイピングロジックの実装

`packages/worker/src/lib/github.ts` の `selectTargetTable` 関数を編集して、取得したいテーブルを選択するロジックを実装してください。

```typescript
export function selectTargetTable(tables: ParsedTable[]): ParsedTable | undefined {
  // 例: "Name" ヘッダーを含むテーブルを選択
  return tables.find(t => t.headers.includes("Name"));
  // 例: 最初のテーブル
  // return tables[0];
}
```

### 6. ビルド & デプロイ

```bash
pnpm deploy
```

## ローカル開発

```bash
# Webフロントエンド
pnpm dev:web

# Cloudflare Worker (別ターミナル)
pnpm dev:worker
```

## APIエンドポイント

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/auth/status` | 認証状態確認 |
| POST | `/api/auth/login` | パスワードログイン |
| POST | `/api/auth/logout` | ログアウト |
| POST | `/api/auth/passkey/register/start` | Passkey登録開始 |
| POST | `/api/auth/passkey/register/finish` | Passkey登録完了 |
| POST | `/api/auth/passkey/auth/start` | Passkey認証開始 |
| POST | `/api/auth/passkey/auth/finish` | Passkey認証完了 |
| POST | `/api/chat` | チャット (OpenAI SSE streaming) |
| GET | `/api/kv/readme-table` | KV内のテーブルデータ取得 |
| POST | `/api/kv/readme-table/refresh` | 手動でREADMEを再取得 |

## Passkey認証フロー

1. 初回ログイン: パスワード認証
2. ログイン成功後: Passkey登録モーダルが自動表示される
3. 以降: Passkeyでワンタップログイン（パスワード入力も可）

> **本番環境での注意**: WebAuthnの署名検証は現在簡略化されています。本番運用には `@simplewebauthn/server` パッケージの導入を強く推奨します。

## KVデータ構造

| Key | 内容 |
|-----|------|
| `readme:table` | パース済みMarkdownテーブルJSON |
| `readme:last_fetched` | 最終取得日時 |
| `auth:user` | ユーザー認証情報 |
| `auth:challenge` | WebAuthnチャレンジ(TTL 5分) |
| `auth:credentials` | 登録済みPasskey一覧 |
| `session_secret` | JWT署名用シークレット(自動生成) |
