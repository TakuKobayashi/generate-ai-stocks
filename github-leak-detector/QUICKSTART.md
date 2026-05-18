# クイックスタートガイド

## 5分で始める GitHub Leak Detector

### 1. インストール

```bash
npm install -g github-leak-detector
```

### 2. 基本的な使い方

リポジトリのディレクトリに移動して実行:

```bash
cd your-repository
github-leak-detector detect
```

これだけで流出検出が開始されます！

### 3. よく使うオプション

#### GitHub APIトークンを使う（推奨）

レート制限を緩和するため、トークンの使用を推奨します:

```bash
export GITHUB_TOKEN="ghp_your_token_here"
github-leak-detector detect
```

#### Slack通知を設定

流出を検出したらSlackへ通知:

```bash
github-leak-detector detect \
  --notify \
  --notification-url "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

#### 定期実行

1時間ごとに自動チェック:

```bash
github-leak-detector schedule --interval 60
```

### 4. GitHub Actionsで自動化

`.github/workflows/leak-check.yml` を作成:

```yaml
name: Daily Leak Check
on:
  schedule:
    - cron: '0 9 * * *'
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npx github-leak-detector detect
```

### トラブルシューティング

#### エラー: "Failed to get git remote URL"
→ Gitリポジトリ内で実行してください

#### エラー: "rate limit exceeded"
→ GitHub Personal Access Tokenを使用してください

#### パターンが見つからない
→ 手動でパターンを指定:
```bash
github-leak-detector detect --patterns "YourClass,yourFunction"
```

### さらに詳しく

- 詳細な使用例: [docs/EXAMPLES.md](docs/EXAMPLES.md)
- 定期実行の設定: [docs/SCHEDULE.md](docs/SCHEDULE.md)
- 開発者ガイド: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
