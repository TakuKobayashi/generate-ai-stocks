# クイックスタートガイド

## 📦 インストール

```bash
# リポジトリをクローン
cd daily-report-cli

# 依存関係のインストール
npm install

# ビルド
npm run build

# グローバルにインストール（オプション）
npm link
```

## 🚀 初回セットアップ（5分で完了）

### 1. GitHub認証（必須）

```bash
# GitHub OAuth Appを作成
# https://github.com/settings/developers
# Callback URL: http://localhost:3000/callback

# 認証を実行
daily-report auth github \
  --client-id YOUR_GITHUB_CLIENT_ID \
  --client-secret YOUR_GITHUB_CLIENT_SECRET
```

### 2. その他のサービス認証（オプション）

#### Asana

```bash
daily-report auth asana \
  --client-id YOUR_ASANA_CLIENT_ID \
  --client-secret YOUR_ASANA_CLIENT_SECRET
```

#### Google Tasks

```bash
daily-report auth google-tasks \
  --client-id YOUR_GOOGLE_CLIENT_ID \
  --client-secret YOUR_GOOGLE_CLIENT_SECRET
```

#### Trello

```bash
daily-report auth trello --api-key YOUR_TRELLO_API_KEY
# ブラウザが開くので、トークンをコピーして貼り付け
```

## 📝 日報を生成

### 基本的な使い方

```bash
# 今日の日報を生成
daily-report generate

# 出力例: daily-report-2024-01-15.md
```

### よく使うオプション

```bash
# 昨日の日報を生成
daily-report generate --date 2024-01-14

# カスタムテンプレートを使用
daily-report generate --template ./my-template.md

# 出力先を指定
daily-report generate --output ./reports/daily.md

# 複数のGitリポジトリを指定
daily-report generate --git-repos ~/project1 ~/project2
```

## 🎨 テンプレートのカスタマイズ

### デフォルトテンプレートの場所

```
templates/default.md
```

### カスタムテンプレートの作成

```bash
# テンプレートをコピー
cp templates/default.md my-template.md

# 編集
vim my-template.md

# 使用
daily-report generate --template my-template.md
```

### よく使うHandlebars構文

```handlebars
# 日付フォーマット
{{formatDate date "yyyy年MM月dd日"}}

# ループ
{{#each git.commits}}
- {{message}}
{{/each}}

# 条件分岐
{{#if (isNotEmpty github.commits)}}
コミットがあります
{{/if}}

# カウント
コミット数: {{count git.commits}}

# リンク
{{link "タイトル" "https://example.com"}}
```

## 🔄 GitHub Actionsで自動化

### 1. リポジトリのSecretsを設定

GitHub リポジトリの Settings > Secrets and variables > Actions:

- `ASANA_TOKEN`
- `GOOGLE_TASKS_TOKEN`
- `TRELLO_TOKEN`

### 2. ワークフローを有効化

`.github/workflows/daily-report.yml` が既に設定されています。

### 3. 実行スケジュール変更（オプション）

```yaml
schedule:
  # 毎日18:00 JST (9:00 UTC)
  - cron: '0 9 * * *'
```

### 4. 手動実行

GitHub Actions タブ > "Generate Daily Report" > "Run workflow"

## 📊 生成される日報の内容

- **Gitコミット**: ローカルリポジトリのコミット履歴
- **GitHubコミット**: GitHubにプッシュされたコミット
- **PRコメント**: プルリクエストへのコメント
- **Asanaタスク**: 完了・作成したタスク、コメント
- **Google Tasksタスク**: 完了・作成したタスク
- **Trelloカード**: 完了・作成したカード、コメント

## 🔍 トラブルシューティング

### 認証エラー

```bash
# トークンを確認
cat ~/.daily-report-cli/tokens.json

# 再認証
daily-report auth github --client-id XXX --client-secret XXX
```

### データが取得できない

```bash
# デバッグモード（詳細ログ）
DEBUG=* daily-report generate

# 特定のサービスのみ使用
daily-report generate --github-token YOUR_TOKEN
```

### ポート3000が使用中

```bash
# 別のポートを使用
daily-report auth github --client-id XXX --client-secret XXX --port 3001
```

## 💡 便利なTips

### 1. エイリアスを設定

```bash
# ~/.bashrc または ~/.zshrc に追加
alias dr='daily-report generate'
alias dra='daily-report auth'

# 使用例
dr
dr --date 2024-01-14
```

### 2. cronで毎日自動生成

```bash
# crontabに追加
0 18 * * * cd ~/daily-report-cli && daily-report generate --output ~/reports/daily-$(date +\%Y-\%m-\%d).md
```

### 3. 週報を生成

```bash
# 過去7日分の日報を生成して結合
for i in {0..6}; do
  date=$(date -d "$i days ago" +%Y-%m-%d)
  daily-report generate --date $date --output "report-$date.md"
done
```

## 💡 便利な使い方

### 要約機能を使う

```bash
# ローカル要約(無料・APIキー不要)
daily-report generate --summarize

# AI要約(OpenAI)
daily-report generate --summarize \
  --summary-api openai \
  --summary-api-key $OPENAI_API_KEY

# AI要約(Anthropic Claude)
daily-report generate --summarize \
  --summary-api anthropic \
  --summary-api-key $ANTHROPIC_API_KEY
```

詳しくは[SUMMARY_GUIDE.md](./SUMMARY_GUIDE.md)をご覧ください。

## 📚 次のステップ

1. **README.md**: 詳細なドキュメント
2. **ARCHITECTURE.md**: プロジェクト構造の理解
3. **CONFIG_EXAMPLES.md**: 高度な設定例
4. カスタムテンプレートの作成
5. 追加サービスの実装

## 🆘 サポート

問題が発生した場合:
1. README.mdを確認
2. GitHub Issuesで報告
3. ログを確認: `~/.daily-report-cli/`

## ✨ まとめ

```bash
# 1. インストール
npm install && npm run build

# 2. 認証
daily-report auth github --client-id XXX --client-secret XXX

# 3. 日報生成
daily-report generate

# これで完了！
```

Happy reporting! 🎉
