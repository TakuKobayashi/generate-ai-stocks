# GitHub Leak Detector

GitHubにソースコードが流出していないか検出するCLIツール & GitHub Actionsライブラリ

## 特徴

- 🔍 GitHub Code Search APIを使用してソースコードの流出を検出
- 🤖 自動でリポジトリ内のユニークなパターンを抽出
- 🔔 Slack/Webhook通知対応
- ⏰ ローカルでの定期実行サポート
- 🎯 GitHub Actions統合
- 📊 詳細なレポート出力

## インストール

### グローバルインストール

```bash
npm install -g github-leak-detector
```

### プロジェクトにインストール

```bash
npm install --save-dev github-leak-detector
```

## 使用方法

### CLI: 基本的な使用

```bash
# リポジトリ内で実行
cd your-repository
github-leak-detector detect
```

### CLI: オプション付き

```bash
# フォークも含めて検索
github-leak-detector detect --no-exclude-forks

# カスタムパターンで検索
github-leak-detector detect --patterns "MyUniqueClass,mySecretFunction,MY_CONSTANT"

# GitHub APIトークンを使用（レート制限を緩和）
github-leak-detector detect --api-token YOUR_GITHUB_TOKEN

# Slack通知を有効化
github-leak-detector detect \
  --notify \
  --notification-url https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  --notification-type slack \
  --notification-message "⚠️ ソースコード流出を検出しました"

# JSON形式で出力
github-leak-detector detect --json > results.json
```

### CLI: 定期実行

```bash
# 60分ごとに実行（デフォルト）
github-leak-detector schedule

# 30分ごとに実行し、Slack通知
github-leak-detector schedule \
  --interval 30 \
  --notify \
  --notification-url https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### GitHub Actions

#### 方法1: ワークフローファイルを使用

`.github/workflows/leak-detection.yml` を作成:

```yaml
name: GitHub Leak Detection

on:
  schedule:
    - cron: '0 9 * * *'  # 毎日午前9時（UTC）
  workflow_dispatch:

jobs:
  detect-leaks:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install detector
        run: npm install -g github-leak-detector

      - name: Run detection
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          github-leak-detector detect \
            --api-token "$GITHUB_TOKEN" \
            --notify \
            --notification-url "${{ secrets.SLACK_WEBHOOK_URL }}" \
            --notification-type slack
```

#### 方法2: Actionとして使用

```yaml
- name: Detect GitHub Leaks
  uses: your-username/github-leak-detector@v1
  with:
    exclude-forks: 'true'
    notify: 'true'
    notification-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    notification-type: 'slack'
    api-token: ${{ secrets.GITHUB_TOKEN }}
```

### プログラムから使用

```typescript
import { LeakDetector } from 'github-leak-detector';

const detector = new LeakDetector({
  excludeForks: true,
  notify: true,
  notificationUrl: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
  notificationType: 'slack',
  apiToken: process.env.GITHUB_TOKEN,
  searchPatterns: ['MyUniqueClass', 'mySecretFunction'],
  maxResults: 50
});

const leaks = await detector.detect();
console.log(`Found ${leaks.length} potential leaks`);
```

## コマンドオプション

### `detect` コマンド

| オプション | 説明 | デフォルト |
|----------|------|----------|
| `--no-exclude-forks` | フォークされたリポジトリも検索対象に含める | false |
| `--notify` | 流出検出時に通知を送信 | false |
| `--notification-url <url>` | 通知先URL（Slack WebhookまたはカスタムWebhook） | - |
| `--notification-type <type>` | 通知タイプ（slack, webhook, email） | slack |
| `--notification-message <msg>` | カスタム通知メッセージ | - |
| `--api-token <token>` | GitHub APIトークン | $GITHUB_TOKEN |
| `--patterns <patterns>` | カンマ区切りの検索パターン（指定なしで自動検出） | 自動検出 |
| `--max-results <number>` | 最大検出数 | 50 |
| `--json` | JSON形式で出力 | false |

### `schedule` コマンド

`detect`コマンドのオプションに加えて:

| オプション | 説明 | デフォルト |
|----------|------|----------|
| `--interval <minutes>` | チェック間隔（分） | 60 |

## 検出方法

このツールは以下の方法でソースコードの流出を検出します:

1. **自動パターン抽出**: リポジトリ内のユニークなコード断片を自動抽出
   - `package.json`のプロジェクト名
   - TypeScript/JavaScriptのクラス名・関数名
   - README.mdのタイトル

2. **GitHub Code Search**: 抽出したパターンでGitHub全体を検索

3. **フィルタリング**:
   - 自分のリポジトリを除外
   - オプションでフォークを除外

## 環境変数

| 変数 | 説明 |
|-----|------|
| `GITHUB_TOKEN` | GitHub APIトークン（推奨） |

## 通知設定

### Slack通知

Slack Incoming Webhookを使用:

1. Slackワークスペースで[Incoming Webhook](https://api.slack.com/messaging/webhooks)を作成
2. Webhook URLを取得
3. コマンド実行時に指定:

```bash
github-leak-detector detect \
  --notify \
  --notification-url https://hooks.slack.com/services/XXX/YYY/ZZZ \
  --notification-type slack
```

### カスタムWebhook

任意のWebhookエンドポイントにJSONペイロードを送信:

```bash
github-leak-detector detect \
  --notify \
  --notification-url https://your-webhook.example.com/endpoint \
  --notification-type webhook
```

ペイロード形式:

```json
{
  "leaks": [...],
  "totalLeaks": 5,
  "repository": "owner/repo",
  "detectedAt": "2024-01-01T00:00:00.000Z"
}
```

## ローカルでの定期実行

### Cronを使用（Linux/Mac）

```bash
# crontabを編集
crontab -e

# 毎日午前9時に実行
0 9 * * * cd /path/to/your/repo && github-leak-detector detect --notify --notification-url YOUR_WEBHOOK
```

### スケジュールコマンドを使用

```bash
# バックグラウンドで実行
nohup github-leak-detector schedule --interval 60 > leak-detector.log 2>&1 &
```

## トラブルシューティング

### レート制限エラー

GitHub APIのレート制限に達した場合:

1. GitHub Personal Access Tokenを作成
2. `--api-token`オプションまたは`GITHUB_TOKEN`環境変数で指定

### パターンが見つからない

自動パターン抽出に失敗した場合:

```bash
github-leak-detector detect --patterns "YourUniquePattern1,YourUniquePattern2"
```

### Gitリポジトリでない

```
Error: Failed to get git remote URL
```

→ Gitリポジトリ内で実行してください

## ライセンス

MIT

## 貢献

Pull Requestsを歓迎します！

## セキュリティ

このツールはソースコードの流出を**検出**するものであり、流出を**防止**するものではありません。
機密情報をコミットしないよう、以下の対策も併用してください:

- `.gitignore`の適切な設定
- git-secretsなどの事前チェックツール
- GitHub Secret Scanningの有効化
