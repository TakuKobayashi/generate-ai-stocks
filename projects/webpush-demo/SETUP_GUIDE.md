# Web Push データ配信デモ - 詳細セットアップガイド

## 概要

このプロジェクトでは、Web Push APIを使用して**通知を表示せずにデータのみをサーバーからブラウザに送信**します。

## 重要な注意事項

### ブラウザの制限について

多くのブラウザでは、プッシュ通知を受信する際に**必ず通知を表示する必要があります**。これはユーザー体験とセキュリティのためのブラウザの仕様です。

- **Chrome/Edge**: `userVisibleOnly: false` は開発環境でのみ動作する可能性があります
- **Firefox**: より柔軟ですが、完全なサイレント配信は制限される場合があります
- **Safari**: Web Push APIのサポートは限定的です

### 回避策

完全にサイレントなデータ配信が必要な場合、以下の代替手段を検討してください:

1. **WebSocket**: リアルタイムの双方向通信
2. **Server-Sent Events (SSE)**: サーバーからクライアントへの一方向ストリーミング
3. **定期的なポーリング**: setIntervalでAPIをポーリング

ただし、このデモでは**Web Push APIの機能を最大限活用する方法**を示しています。

## プロジェクト構造

\`\`\`
webpush-demo/
├── src/
│   ├── pages/
│   │   ├── index.tsx          # メインページ
│   │   ├── _app.tsx           # Next.jsアプリラッパー
│   │   └── _document.tsx      # HTMLドキュメント設定
│   ├── styles/
│   │   ├── Home.module.css    # ページスタイル
│   │   └── globals.css        # グローバルスタイル
│   └── worker/
│       ├── index.ts           # Cloudflare Workerメインファイル
│       ├── index-simple.ts    # シンプル版実装
│       └── webpush-crypto.ts  # 暗号化ヘルパー
├── public/
│   └── sw.js                  # Service Worker
├── scripts/
│   └── generate-vapid-keys.js # VAPID鍵生成スクリプト
├── package.json
├── tsconfig.json
├── wrangler.toml
├── next.config.js
└── README.md
\`\`\`

## ステップバイステップセットアップ

### ステップ1: 依存関係のインストール

\`\`\`bash
cd webpush-demo
npm install
\`\`\`

### ステップ2: VAPID鍵の生成

VAPID (Voluntary Application Server Identification) 鍵ペアを生成します:

\`\`\`bash
node scripts/generate-vapid-keys.js
\`\`\`

出力例:
\`\`\`
VAPID Keys Generated:
====================
Public Key: BDd3_hVL9fZi9Ybo2UUzA284WG5FZR30_95YeZJsiApwXKpNZ...
Private Key: bdSiNn8-_e1KR6RqJAEePiqQMzwK2anCFaHxH...
\`\`\`

**これらの鍵を安全に保管してください！**

### ステップ3: Cloudflare KVの設定

Cloudflare アカウントにログイン:

\`\`\`bash
wrangler login
\`\`\`

KVネームスペースを作成:

\`\`\`bash
# 本番用
wrangler kv:namespace create "SUBSCRIPTIONS"

# プレビュー用
wrangler kv:namespace create "SUBSCRIPTIONS" --preview
\`\`\`

出力されたIDをメモします:
\`\`\`
{ binding = "SUBSCRIPTIONS", id = "abcd1234..." }
{ binding = "SUBSCRIPTIONS", preview_id = "efgh5678..." }
\`\`\`

### ステップ4: wrangler.tomlの設定

\`wrangler.toml\`を編集:

\`\`\`toml
name = "webpush-demo"
main = "src/worker/index.ts"
compatibility_date = "2024-01-01"

[vars]
VAPID_PUBLIC_KEY = "ここに生成された公開鍵を貼り付け"

[[kv_namespaces]]
binding = "SUBSCRIPTIONS"
id = "本番用のKV IDを貼り付け"
preview_id = "プレビュー用のKV IDを貼り付け"
\`\`\`

### ステップ5: シークレットの設定

VAPID秘密鍵をCloudflare Workersのシークレットとして設定:

\`\`\`bash
wrangler secret put VAPID_PRIVATE_KEY
\`\`\`

プロンプトが表示されたら、生成された秘密鍵を貼り付けてEnterを押します。

### ステップ6: ローカル開発

#### フロントエンドの起動

\`\`\`bash
npm run dev
\`\`\`

http://localhost:3000 でアクセス可能

#### Workerの起動

別のターミナルで:

\`\`\`bash
npm run worker:dev
\`\`\`

http://localhost:8787 でWorkerが起動します

### ステップ7: 動作確認

1. ブラウザで http://localhost:3000 を開く
2. 「購読を開始」ボタンをクリック
3. ブラウザの通知許可を承認
4. メッセージとデータを入力して「プッシュを送信」をクリック
5. データが受信履歴に表示されることを確認

## デプロイ

### Cloudflare Workersへのデプロイ

\`\`\`bash
npm run worker:deploy
\`\`\`

デプロイされたURLが表示されます（例: https://webpush-demo.your-subdomain.workers.dev）

### Next.jsアプリのビルド

\`\`\`bash
npm run build
\`\`\`

\`out/\`フォルダにスタティックファイルが生成されます。これをCloudflare Pagesや他のホスティングサービスにデプロイできます。

## 本番環境での考慮事項

### 1. 完全な暗号化実装

\`src/worker/index-simple.ts\`はデモ用の簡略版です。本番環境では\`src/worker/webpush-crypto.ts\`の完全な暗号化実装を使用するか、ライブラリを使用してください。

### 2. エラーハンドリング

- 期限切れの購読を削除
- 失敗した送信を再試行
- ログとモニタリングの実装

### 3. セキュリティ

- VAPID鍵を環境変数で管理
- 適切な認証・認可の実装
- レート制限の設定

### 4. スケーラビリティ

- KVの代わりにDurable Objectsを検討
- バッチ処理で大量の購読者に対応
- キューシステムの導入

## トラブルシューティング

### Service Workerが登録されない

**問題**: Service Workerの登録に失敗する

**解決策**:
- HTTPSまたはlocalhostで実行していることを確認
- ブラウザのDevToolsでService Workerのステータスを確認
- キャッシュをクリアして再読み込み

### プッシュ通知が届かない

**問題**: プッシュが送信されるが受信されない

**解決策**:
- ブラウザの通知許可を確認
- VAPID鍵が正しく設定されているか確認
- ネットワークタブでAPIレスポンスを確認
- Service Workerのコンソールログを確認

### CORS エラー

**問題**: APIリクエストがCORSエラーで失敗

**解決策**:
- Workerのcors設定を確認
- オリジンが正しく設定されているか確認

### 通知が強制的に表示される

**問題**: データのみ受信したいのに通知が表示される

**解決策**:
- これはブラウザの仕様です
- WebSocketやSSEなど代替手段を検討
- バックグラウンドで最小限の通知を表示することを検討

## 技術詳細

### Web Push APIの仕組み

1. **購読**: クライアントがPush Serviceに購読を登録
2. **保存**: 購読情報をサーバーに保存
3. **送信**: サーバーがPush Serviceに暗号化されたデータを送信
4. **配信**: Push ServiceがService Workerにデータを配信
5. **処理**: Service Workerがデータを受信してページに転送

### データフロー

\`\`\`
[ユーザー] → [購読開始] → [Push Service] → [Subscription取得]
     ↓
[Cloudflare Worker] → [KVに保存]
     ↓
[管理者] → [プッシュ送信] → [Worker] → [KVから購読取得]
     ↓
[Worker] → [暗号化] → [Push Service] → [Service Worker]
     ↓
[Service Worker] → [postMessage] → [Reactアプリ]
     ↓
[UIに表示]
\`\`\`

## さらなる改善

- [ ] TypeScriptの型定義を強化
- [ ] ユニットテストの追加
- [ ] E2Eテストの実装
- [ ] 購読管理UIの追加
- [ ] 統計情報とアナリティクス
- [ ] マルチテナント対応
- [ ] Webhook統合

## 参考資料

- [MDN Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Web Push Protocol](https://datatracker.ietf.org/doc/html/rfc8030)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/rfc8292)

## サポート

問題が発生した場合は、GitHubのIssuesで報告してください。
