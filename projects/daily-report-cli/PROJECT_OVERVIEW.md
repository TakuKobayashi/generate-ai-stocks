# Daily Report CLI - プロジェクト概要

## プロジェクトについて

このプロジェクトは、エンジニア向けの日報を自動生成するNode.js + TypeScriptのCLIツールです。複数の情報源(Git、GitHub、Asana、Google Tasks、Trello)から自動的にデータを収集し、カスタマイズ可能なテンプレートを使って日報を生成します。

## 主な機能

1. **複数の情報源に対応**
   - ローカルGit: コミット履歴
   - GitHub: コミット、PRコメント
   - Asana: タスク完了/作成、コメント
   - Google Tasks: タスク完了/作成
   - Trello: カード完了/作成、コメント

2. **3行要約機能**
   - ローカル要約: TF-IDF + キーワードマッチングによる抽出型要約(無料)
   - AI要約: OpenAI/Anthropic APIによる生成型要約(オプション)
   - 統計情報とキーワード抽出

3. **OAuth認証**
   - ローカルサーバーを使用したOAuth 2.0フロー
   - トークンの永続的な保存(~/.daily-report-cli/tokens.json)
   - コマンドライン引数によるトークン上書きも可能

4. **テンプレートエンジン**
   - Handlebars形式
   - カスタムヘルパー関数
   - for/ifなどの制御構文対応

5. **GitHub Actions対応**
   - 定期実行用ワークフローファイル付属
   - Secrets管理によるセキュアな運用

## ファイル構成

```
daily-report-cli/
├── src/
│   ├── commands/
│   │   ├── auth/
│   │   │   ├── github.ts          # GitHub OAuth認証
│   │   │   └── other-services.ts  # その他サービスのOAuth認証
│   │   └── generate.ts             # 日報生成メインロジック
│   ├── services/
│   │   ├── git/
│   │   │   └── local-git.ts        # ローカルGit操作
│   │   ├── github/
│   │   │   └── github-api.ts       # GitHub API クライアント
│   │   ├── task-managers/
│   │   │   ├── asana.ts            # Asana API クライアント
│   │   │   ├── google-tasks.ts     # Google Tasks API クライアント
│   │   │   └── trello.ts           # Trello API クライアント
│   │   ├── summarizer/
│   │   │   ├── local-summarizer.ts # ローカル要約エンジン
│   │   │   └── api-summarizer.ts   # AI要約エンジン
│   │   └── oauth/
│   │       └── local-oauth-server.ts # ローカルOAuthサーバー
│   ├── storage/
│   │   └── token-storage.ts        # トークン永続化
│   ├── template/
│   │   └── renderer.ts             # Handlebarsテンプレートレンダラー
│   ├── types/
│   │   └── index.ts                # TypeScript型定義
│   └── index.ts                    # CLIエントリーポイント
├── .github/
│   └── workflows/
│       └── daily-report.yml        # GitHub Actions定義
├── package.json
├── tsconfig.json
├── .gitignore
├── .env.example
├── README.md                       # メインドキュメント
├── QUICKSTART.md                   # クイックスタート
├── CONFIG_EXAMPLES.md              # 設定例
├── SUMMARY_GUIDE.md                # 要約機能ガイド
└── ARCHITECTURE.md                 # アーキテクチャ解説
```

## 技術スタック

### 言語・フレームワーク
- **TypeScript**: 型安全な開発
- **Node.js**: ランタイム環境
- **Commander**: CLI フレームワーク

### 主要ライブラリ
- **simple-git**: ローカルGit操作
- **octokit**: GitHub API クライアント
- **asana**: Asana API クライアント
- **axios**: HTTP クライアント(Google Tasks, Trello)
- **handlebars**: テンプレートエンジン
- **express**: OAuthローカルサーバー
- **date-fns**: 日付操作
- **natural**: 自然言語処理(TF-IDF, トークナイザー)
- **compromise**: 軽量NLP(キーワード抽出)

## コマンド一覧

```bash
# 認証
daily-report auth github        # GitHub認証
daily-report auth asana         # Asana認証
daily-report auth google-tasks  # Google Tasks認証
daily-report auth trello        # Trello認証
daily-report auth status        # 認証状態確認

# 日報生成
daily-report generate                    # 今日の日報生成
daily-report generate --date 2024-02-06  # 特定日の日報生成
daily-report generate --summarize        # 3行要約付き(ローカル)
daily-report generate --summarize \
  --summary-api openai \
  --summary-api-key $OPENAI_API_KEY     # AI要約付き
daily-report generate \
  --template ./custom.md \
  --output ./reports/report.md          # カスタムテンプレート使用

# テンプレート初期化
daily-report init                        # デフォルトテンプレート作成
daily-report init --path ./my-template.md # 指定パスに作成
```

## データフロー

1. **コマンド実行** (`daily-report generate`)
   ↓
2. **日付範囲計算** (デフォルト: 当日0:00-23:59)
   ↓
3. **並列データ収集**
   - ローカルGit: simple-gitでコミット取得
   - GitHub: Octokit APIでコミット・コメント取得
   - Asana: Asana SDKでタスク・コメント取得
   - Google Tasks: REST APIでタスク取得
   - Trello: REST APIでカード・コメント取得
   ↓
4. **データ統合** (DailyReportData構造体)
   ↓
5. **テンプレートレンダリング** (Handlebars)
   ↓
6. **ファイル出力** (Markdown形式)

## 拡張ポイント

### 新しいGitホスティングサービスの追加

```typescript
// src/services/gitlab/gitlab-api.ts
export class GitLabService {
  public async getCommits(dateRange: DateRange): Promise<GitCommit[]> {
    // GitLab API実装
  }
}

// src/commands/generate.tsに統合
const gitlabToken = options.gitlabToken || tokenStorage.getToken('gitlab');
if (gitlabToken) {
  const gitlabService = new GitLabService(gitlabToken);
  reportData.gitlab.commits = await gitlabService.getCommits(dateRange);
}
```

### 新しいタスク管理ツールの追加

```typescript
// src/services/task-managers/notion.ts
export class NotionService {
  public async getCompletedTasks(dateRange: DateRange): Promise<Task[]> {
    // Notion API実装
  }
}
```

### カスタムHelperの追加

```typescript
// src/template/renderer.ts内
Handlebars.registerHelper('customHelper', (value: string) => {
  // カスタムロジック
  return processedValue;
});
```

## セキュリティ考慮事項

1. **トークン管理**
   - トークンはローカル(`~/.daily-report-cli/tokens.json`)に保存
   - ファイルパーミッションを適切に設定(600推奨)
   - .gitignoreに必ず含める

2. **OAuth認証**
   - ローカルサーバーのみ使用(外部サーバー不使用)
   - Client Secretは環境変数で管理
   - リダイレクトURIはlocalhost固定

3. **GitHub Actions**
   - SecretsでトークンをSecure管理
   - Personal Access Tokenは最小権限で作成
   - ログにトークンが出力されないよう注意

## パフォーマンス

- **並列データ収集**: 各サービスからの取得は独立して実行可能
- **キャッシング**: 現在は未実装(将来的な改善点)
- **APIレート制限**: 各サービスのレート制限に注意
  - GitHub: 認証済み 5,000リクエスト/時
  - Asana: 1,500リクエスト/分
  - Google Tasks: クォータ制限あり
  - Trello: 300リクエスト/10秒

## 今後の改善案

1. **機能追加**
   - [ ] Slack/Discord/Teamsへの自動投稿
   - [ ] 複数リポジトリの一括スキャン
   - [ ] 週報/月報モード
   - [ ] PDFエクスポート
   - [ ] インタラクティブモード(選択的にデータ取得)

2. **パフォーマンス**
   - [ ] データキャッシング機能
   - [ ] 並列度の最適化
   - [ ] 増分更新サポート

3. **UX改善**
   - [ ] プログレスバー表示
   - [ ] より詳細なエラーメッセージ
   - [ ] 設定ファイル(.dailyreportrc)サポート
   - [ ] テンプレートのプレビュー機能

## ライセンス

MIT License

## 作成者

[Your Name]

## 貢献

プルリクエスト歓迎です!詳しくはREADME.mdをご覧ください。
