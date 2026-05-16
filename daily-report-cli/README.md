# Daily Report CLI

エンジニア向けの日報を自動的に生成するNode.js + TypeScriptのCLIツールです。

## 特徴

- 🔄 複数の情報源から自動的にデータを収集
- 📝 Handlebarsテンプレートによるカスタマイズ可能な日報
- 🤖 3行要約機能(ローカル/AI対応)
- 🔐 OAuth認証によるセキュアな認証情報管理
- ⏰ GitHub Actionsによる定期実行サポート
- 🛠️ 拡張可能なアーキテクチャ

## サポートしている情報源

### 必須
- **Git (ローカル)**: コミット履歴
- **GitHub**: コミット、プルリクエストコメント

### オプション
- **Asana**: 完了/作成タスク、コメント
- **Google Tasks**: 完了/作成タスク
- **Trello**: 完了/作成タスク、コメント

## インストール

```bash
npm install
npm run build
npm link  # グローバルにインストール
```

## 使い方

### 1. 認証設定

各サービスのOAuth認証を行います。

#### GitHub認証

まず、GitHubでOAuthアプリケーションを作成します:
1. https://github.com/settings/developers にアクセス
2. "New OAuth App"をクリック
3. 以下を設定:
   - Application name: Daily Report CLI
   - Homepage URL: http://localhost:3000
   - Authorization callback URL: http://localhost:3000/callback
4. Client IDとClient Secretを取得

環境変数を設定:
```bash
export GITHUB_CLIENT_ID=your_client_id
export GITHUB_CLIENT_SECRET=your_client_secret
```

認証を実行:
```bash
daily-report auth github
```

#### Asana認証

```bash
export ASANA_CLIENT_ID=your_client_id
export ASANA_CLIENT_SECRET=your_client_secret
daily-report auth asana
```

#### Google Tasks認証

```bash
export GOOGLE_CLIENT_ID=your_client_id
export GOOGLE_CLIENT_SECRET=your_client_secret
daily-report auth google-tasks
```

#### Trello認証

```bash
export TRELLO_API_KEY=your_api_key
daily-report auth trello
```

#### 認証状態の確認

```bash
daily-report auth status
```

### 2. テンプレート初期化

デフォルトのテンプレートを作成:

```bash
daily-report init
```

これにより`template.md`が作成されます。このファイルを編集して日報の形式をカスタマイズできます。

### 3. 日報生成

```bash
# 今日の日報を生成
daily-report generate

# 3行要約付きで生成(ローカル・無料)
daily-report generate --summarize

# AI要約を使用(OpenAI)
daily-report generate --summarize \
  --summary-api openai \
  --summary-api-key $OPENAI_API_KEY

# AI要約を使用(Anthropic)
daily-report generate --summarize \
  --summary-api anthropic \
  --summary-api-key $ANTHROPIC_API_KEY

# 特定の日付の日報を生成
daily-report generate --date 2024-02-05

# カスタムテンプレートと出力先を指定
daily-report generate --template ./my-template.md --output ./reports/report.md

# コマンドラインでトークンを指定
daily-report generate --github-token YOUR_TOKEN
```

## テンプレートのカスタマイズ

テンプレートはHandlebars形式で記述します。利用可能な変数:

```handlebars
{{date}}  # 日報の日付

# Git
{{#each git.commits}}
  {{message}}      # コミットメッセージ
  {{date}}         # コミット日時
  {{branch}}       # ブランチ名
  {{repository}}   # リポジトリ名
  {{hash}}         # コミットハッシュ
{{/each}}

# GitHub
{{#each github.commits}}
  {{message}}       # コミットメッセージ
  {{commitUrl}}     # コミットURL
  {{repository}}    # リポジトリ名
  {{repositoryUrl}} # リポジトリURL
  {{branch}}        # ブランチ名
  {{branchUrl}}     # ブランチURL
{{/each}}

{{#each github.prComments}}
  {{prTitle}}      # PRタイトル
  {{prUrl}}        # PR URL
  {{comment}}      # コメント内容
  {{commentUrl}}   # コメントURL
{{/each}}

# タスク管理ツール (Asana, Google Tasks, Trello)
{{#each asana.completedTasks}}
  {{title}}        # タスクタイトル
  {{url}}          # タスクURL
  {{completedAt}}  # 完了日時
  {{parent.title}} # 親タスクタイトル (存在する場合)
  {{parent.url}}   # 親タスクURL (存在する場合)
{{/each}}
```

### ヘルパー関数

```handlebars
{{formatDate date "yyyy-MM-dd HH:mm"}}  # 日付フォーマット
{{firstLine message}}                   # テキストの最初の行のみ取得
{{{link url text}}}                     # Markdownリンク作成
{{#if (hasItems array)}}...{{/if}}      # 配列が空でないかチェック
{{taskHierarchy task}}                  # 階層タスクの表示
```

## GitHub Actionsでの定期実行

`.github/workflows/daily-report.yml`が含まれています。

### セットアップ手順

1. リポジトリのSecretsに以下を登録:
   - `GH_PERSONAL_TOKEN`: GitHub Personal Access Token
   - `ASANA_TOKEN`: Asanaアクセストークン
   - `GOOGLE_TASKS_TOKEN`: Google Tasksアクセストークン
   - `TRELLO_TOKEN`: Trelloアクセストークン
   - `TRELLO_API_KEY`: Trello APIキー
   - (オプション) `OPENAI_API_KEY` または `ANTHROPIC_API_KEY`: AI要約用

2. ワークフローが平日18:00 JST (09:00 UTC)に自動実行されます

3. 手動実行も可能:
   - GitHubリポジトリの「Actions」タブ
   - 「Daily Report Generation」を選択
   - 「Run workflow」をクリック

## 要約機能

詳しくは[SUMMARY_GUIDE.md](./SUMMARY_GUIDE.md)をご覧ください。

### ローカル要約(無料・APIキー不要)

```bash
daily-report generate --summarize
```

収集したデータからTF-IDFとキーワードマッチングで重要な情報を抽出し、3行で要約します。

### AI要約(OpenAI/Anthropic)

```bash
# OpenAI
daily-report generate --summarize \
  --summary-api openai \
  --summary-api-key $OPENAI_API_KEY

# Anthropic
daily-report generate --summarize \
  --summary-api anthropic \
  --summary-api-key $ANTHROPIC_API_KEY
```

より自然で高精度な要約が生成されます。

## プロジェクト構造

```
daily-report-cli/
├── src/
│   ├── commands/
│   │   ├── auth/          # 認証コマンド
│   │   └── generate.ts    # 日報生成コマンド
│   ├── services/
│   │   ├── git/           # ローカルGitサービス
│   │   ├── github/        # GitHub APIサービス
│   │   ├── task-managers/ # タスク管理ツールサービス
│   │   └── oauth/         # OAuth認証サーバー
│   ├── storage/           # トークンストレージ
│   ├── template/          # テンプレートレンダラー
│   ├── types/             # 型定義
│   └── index.ts           # エントリーポイント
├── .github/
│   └── workflows/
│       └── daily-report.yml  # GitHub Actions設定
└── package.json
```

## 開発

```bash
# 開発モードで実行
npm run dev

# ビルド
npm run build

# ローカルでテスト
npm start generate
```

## 拡張方法

### 新しいGitホスティングサービスの追加

1. `src/services/`に新しいサービスクラスを作成
2. 必要なAPIクライアントライブラリをインストール
3. `src/commands/generate.ts`に統合

### 新しいタスク管理ツールの追加

1. `src/services/task-managers/`に新しいサービスを作成
2. `src/types/index.ts`に型定義を追加
3. `src/commands/auth/`に認証コマンドを追加
4. `src/commands/generate.ts`に統合

## トラブルシューティング

### OAuth認証が失敗する

- 環境変数が正しく設定されているか確認
- リダイレクトURIがOAuthアプリケーション設定と一致しているか確認
- ファイアウォールがローカルサーバー(ポート3000-3003)をブロックしていないか確認

### トークンが保存されない

- `~/.daily-report-cli/`ディレクトリへの書き込み権限があるか確認

### データが取得できない

- `daily-report auth status`で認証状態を確認
- トークンが期限切れの場合は再認証が必要

## ライセンス

MIT
