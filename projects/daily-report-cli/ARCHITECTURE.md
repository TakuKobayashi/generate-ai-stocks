# Daily Report CLI - プロジェクト構成

## ディレクトリ構造

```
daily-report-cli/
├── .github/
│   └── workflows/
│       └── daily-report.yml          # GitHub Actions定期実行設定
├── src/
│   ├── commands/
│   │   ├── auth/
│   │   │   ├── github.ts             # GitHub認証コマンド
│   │   │   ├── asana.ts              # Asana認証コマンド
│   │   │   ├── google-tasks.ts       # Google Tasks認証コマンド
│   │   │   └── trello.ts             # Trello認証コマンド
│   │   └── generate.ts               # 日報生成コマンド
│   ├── services/
│   │   ├── git/
│   │   │   └── local-git.ts          # ローカルGitリポジトリ操作
│   │   ├── github/
│   │   │   └── github-api.ts         # GitHub API操作
│   │   ├── task-managers/
│   │   │   ├── asana.ts              # Asana API操作
│   │   │   ├── google-tasks.ts       # Google Tasks API操作
│   │   │   └── trello.ts             # Trello API操作
│   │   └── oauth/
│   │       └── local-oauth-server.ts # ローカルOAuthサーバー
│   ├── storage/
│   │   └── token-storage.ts          # トークン永続化
│   ├── template/
│   │   └── renderer.ts               # テンプレートレンダリング
│   ├── types/
│   │   └── index.ts                  # TypeScript型定義
│   └── index.ts                      # CLIエントリーポイント
├── templates/
│   └── default.md                    # デフォルトテンプレート
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md                         # メインドキュメント
└── CONFIG_EXAMPLES.md                # 設定例
```

## 主要コンポーネント

### 1. CLIコマンド (`src/commands/`)

#### 認証コマンド (`auth/`)
各サービスへのOAuth認証を処理します。

- **github.ts**: GitHub OAuth認証
- **asana.ts**: Asana OAuth認証
- **google-tasks.ts**: Google Tasks OAuth認証
- **trello.ts**: Trello認証（手動トークン入力）

#### 生成コマンド (`generate.ts`)
日報を生成するメインコマンド。各サービスからデータを収集し、テンプレートを使って日報を出力します。

### 2. サービス層 (`src/services/`)

#### Git (`git/local-git.ts`)
- ローカルGitリポジトリからコミット情報を取得
- 複数リポジトリのサポート
- 日付範囲でのフィルタリング

#### GitHub (`github/github-api.ts`)
- GitHub APIを使用したコミット取得
- PRコメント取得
- ブランチ情報の取得

#### タスクマネージャー (`task-managers/`)
各タスク管理ツールのAPI操作:
- 完了タスクの取得
- 新規作成タスクの取得
- コメントの取得
- 親子タスクの階層構造の処理

#### OAuth (`oauth/local-oauth-server.ts`)
- ローカルでExpressサーバーを起動
- OAuth認証フローの処理
- 認可コードとアクセストークンの交換

### 3. ストレージ (`src/storage/token-storage.ts`)
- `~/.daily-report-cli/tokens.json`にトークンを保存
- トークンの読み書き・削除操作

### 4. テンプレートエンジン (`src/template/renderer.ts`)
- Handlebarsテンプレートのコンパイル
- カスタムヘルパー関数の登録
- デフォルトテンプレートの生成

### 5. 型定義 (`src/types/index.ts`)
全てのデータ構造のTypeScript型定義

## 主要な機能

### OAuth認証フロー

1. ローカルでExpressサーバーを起動（デフォルトポート3000）
2. ブラウザで認証URLを開く
3. ユーザーが認可
4. コールバックURLでコードを受け取る
5. コードをアクセストークンに交換
6. トークンをローカルに保存

### データ収集フロー

1. 各サービスから並列でデータ取得
2. 日付範囲（その日の0:00-23:59）でフィルタリング
3. DailyReportData構造に統合
4. テンプレートエンジンに渡す

### テンプレートレンダリング

1. Handlebarsテンプレートをコンパイル
2. カスタムヘルパーを登録
3. データを挿入
4. Markdown形式で出力

## 拡張方法

### 新しいサービスの追加

1. `src/services/` に新しいサービスファイルを作成
2. `src/commands/auth/` に認証コマンドを追加
3. `src/types/index.ts` にデータ型を追加
4. `src/commands/generate.ts` にデータ収集ロジックを追加
5. デフォルトテンプレートを更新

### カスタムヘルパーの追加

`src/template/renderer.ts` の `registerHelpers()` 関数内:

```typescript
Handlebars.registerHelper('myHelper', (value: any) => {
  // ヘルパーロジック
  return result;
});
```

## 環境設定

### 開発環境

```bash
npm install
npm run dev -- generate --help
```

### 本番環境

```bash
npm install
npm run build
npm link
daily-report generate
```

### GitHub Actions

リポジトリのSecretsに以下を設定:
- ASANA_TOKEN
- GOOGLE_TASKS_TOKEN
- TRELLO_TOKEN

## トークンの管理

トークンは `~/.daily-report-cli/tokens.json` に保存されます:

```json
{
  "github": "ghp_xxxxx",
  "asana": "xxxxx",
  "googleTasks": "xxxxx",
  "trello": "xxxxx"
}
```

コマンドラインオプションで上書き可能:
```bash
daily-report generate --github-token YOUR_TOKEN
```

## APIレート制限への対応

各サービスのレート制限:
- **GitHub**: 5,000 requests/hour (認証済み)
- **Asana**: 1,500 requests/minute
- **Google Tasks**: 10,000 requests/day
- **Trello**: 300 requests/10秒

大量のデータを扱う場合は、APIコール数を最適化することを推奨します。

## セキュリティ考慮事項

1. トークンはローカルに平文で保存されます
2. OAuth認証はローカルサーバーで完結します
3. GitHub ActionsではリポジトリのSecretsを使用します
4. トークンを含むファイルは`.gitignore`に含まれています

## トラブルシューティング

### よくある問題

1. **ポート3000が使用中**: `--port` オプションで別のポートを指定
2. **トークンが無効**: 再認証を実行
3. **データが取得できない**: APIレート制限を確認
4. **テンプレートエラー**: Handlebars構文を確認

## パフォーマンス最適化

- 並列データ取得により高速化
- エラーハンドリングで一部失敗しても継続
- キャッシュ機能は未実装（将来の拡張候補）
