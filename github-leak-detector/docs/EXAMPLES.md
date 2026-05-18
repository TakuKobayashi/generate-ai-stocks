# 詳細な使用例

## CLIコマンド例

### 1. 基本的な検出

```bash
# 現在のリポジトリで流出を検出
cd your-repository
github-leak-detector detect
```

出力例:
```
🔍 Starting GitHub leak detection...

Current repository: username/my-project
Repository URL: https://github.com/username/my-project

Extracting unique patterns from repository...
Auto-detected patterns:
  - "my-project"
  - "MyProjectClass"
  - "initializeApp"

Searching GitHub for potential leaks...

Searching for pattern: "my-project"
Searching for pattern: "MyProjectClass"
Searching for pattern: "initializeApp"

================================================================================
📊 Detection Results
================================================================================

⚠️  Found 2 potential leak(s):

[1] suspicious-user/copied-project
    URL: https://github.com/suspicious-user/copied-project
    Owner: suspicious-user (https://github.com/suspicious-user)
    Created: 2024-01-15 10:30:00
    Is Fork: No
    Matched Pattern: "MyProjectClass"
    Matched File: src/main.ts

[2] another-user/similar-code
    URL: https://github.com/another-user/similar-code
    Owner: another-user (https://github.com/another-user)
    Created: 2024-02-01 14:20:00
    Is Fork: No
    Matched Pattern: "initializeApp"
    Matched File: lib/init.js

⚠️  Total: 2 potential leak(s) detected
```

### 2. カスタムパターンで検索

```bash
# 特定のクラス名や関数名で検索
github-leak-detector detect \
  --patterns "MyUniqueClassName,secretFunction,INTERNAL_CONSTANT"
```

### 3. GitHub APIトークンを使用

```bash
# レート制限を緩和するためトークンを使用
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
github-leak-detector detect --api-token "$GITHUB_TOKEN"

# または直接指定
github-leak-detector detect --api-token "ghp_xxxxxxxxxxxxxxxxxxxx"
```

### 4. Slack通知を有効化

```bash
# 流出検出時にSlackへ通知
github-leak-detector detect \
  --notify \
  --notification-url "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX" \
  --notification-type slack \
  --notification-message "🚨 ソースコードの流出が検出されました！"
```

### 5. JSON形式で出力

```bash
# JSON形式で結果を保存
github-leak-detector detect --json > leak-results.json

# jqで整形して表示
github-leak-detector detect --json | jq '.'

# 結果をフィルタリング
github-leak-detector detect --json | jq '.[] | select(.isFork == false)'
```

JSON出力例:
```json
[
  {
    "repositoryUrl": "https://github.com/suspicious-user/copied-project",
    "repositoryName": "suspicious-user/copied-project",
    "ownerName": "suspicious-user",
    "ownerEmail": "user@example.com",
    "ownerGithubUrl": "https://github.com/suspicious-user",
    "createdAt": "2024-01-15T10:30:00Z",
    "isFork": false,
    "matchedPattern": "MyProjectClass",
    "matchedFile": "src/main.ts"
  }
]
```

### 6. フォークを含めて検索

```bash
# デフォルトではフォークは除外されるが、含める場合
github-leak-detector detect --no-exclude-forks
```

### 7. 最大結果数を指定

```bash
# 最大10件まで検出
github-leak-detector detect --max-results 10
```

## 定期実行の例

### 1. デフォルト（60分ごと）

```bash
github-leak-detector schedule
```

### 2. カスタム間隔で実行

```bash
# 30分ごとに実行
github-leak-detector schedule --interval 30

# 12時間ごとに実行
github-leak-detector schedule --interval 720
```

### 3. 通知付き定期実行

```bash
github-leak-detector schedule \
  --interval 60 \
  --notify \
  --notification-url "$SLACK_WEBHOOK_URL" \
  --notification-type slack \
  --api-token "$GITHUB_TOKEN"
```

## GitHub Actions の例

### 例1: シンプルな定期実行

`.github/workflows/leak-check.yml`:

```yaml
name: Daily Leak Check

on:
  schedule:
    - cron: '0 0 * * *'  # 毎日午前0時（UTC）

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npx github-leak-detector detect
```

### 例2: Slack通知付き

```yaml
name: Leak Detection with Notification

on:
  schedule:
    - cron: '0 */6 * * *'  # 6時間ごと
  workflow_dispatch:

jobs:
  detect-and-notify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Run leak detection
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: |
          npm install -g github-leak-detector
          github-leak-detector detect \
            --api-token "$GITHUB_TOKEN" \
            --notify \
            --notification-url "$SLACK_WEBHOOK" \
            --notification-type slack
```

### 例3: 結果をArtifactとして保存

```yaml
name: Leak Detection with Artifacts

on:
  schedule:
    - cron: '0 9 * * 1'  # 毎週月曜日午前9時（UTC）

jobs:
  detect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install detector
        run: npm install -g github-leak-detector
      
      - name: Run detection
        id: detect
        continue-on-error: true
        run: |
          github-leak-detector detect \
            --json > leak-results-$(date +%Y%m%d).json
      
      - name: Upload results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: leak-detection-results
          path: leak-results-*.json
          retention-days: 90
```

### 例4: Pull Request時にチェック

```yaml
name: Check for Leaks on PR

on:
  pull_request:
    branches: [main]

jobs:
  leak-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install detector
        run: npm install -g github-leak-detector
      
      - name: Run detection
        id: detect
        run: |
          RESULT=$(github-leak-detector detect --json)
          echo "result=$RESULT" >> $GITHUB_OUTPUT
          LEAK_COUNT=$(echo "$RESULT" | jq '. | length')
          if [ "$LEAK_COUNT" -gt 0 ]; then
            echo "⚠️ Warning: $LEAK_COUNT potential leak(s) detected"
            exit 1
          fi
      
      - name: Comment on PR
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '⚠️ Potential source code leaks detected! Please review the workflow logs.'
            })
```

## プログラムから使用する例

### TypeScript

```typescript
import { LeakDetector, LeakResult } from 'github-leak-detector';

async function checkForLeaks() {
  const detector = new LeakDetector({
    excludeForks: true,
    apiToken: process.env.GITHUB_TOKEN,
    maxResults: 50
  });

  try {
    const leaks: LeakResult[] = await detector.detect();
    
    if (leaks.length > 0) {
      console.log(`❌ Found ${leaks.length} potential leaks!`);
      
      // 流出情報を処理
      for (const leak of leaks) {
        console.log(`- ${leak.repositoryName}`);
        console.log(`  Owner: ${leak.ownerName}`);
        console.log(`  Created: ${leak.createdAt}`);
      }
      
      // 独自の処理を実装
      await sendEmailAlert(leaks);
      await logToDatabase(leaks);
    } else {
      console.log('✓ No leaks detected');
    }
  } catch (error) {
    console.error('Detection failed:', error);
  }
}

checkForLeaks();
```

### カスタム通知の実装

```typescript
import { LeakDetector, Notifier } from 'github-leak-detector';

async function detectWithCustomNotification() {
  const detector = new LeakDetector({
    apiToken: process.env.GITHUB_TOKEN
  });

  const leaks = await detector.detect();

  if (leaks.length > 0) {
    // Discord通知の例
    await sendDiscordNotification(leaks);
    
    // メール送信の例
    await sendEmail({
      to: 'security@example.com',
      subject: `⚠️ ${leaks.length}件のソースコード流出を検出`,
      body: formatLeaksForEmail(leaks)
    });
  }
}

async function sendDiscordNotification(leaks: LeakResult[]) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL!;
  const payload = {
    content: `⚠️ ${leaks.length}件のソースコード流出を検出しました`,
    embeds: leaks.slice(0, 10).map(leak => ({
      title: leak.repositoryName,
      url: leak.repositoryUrl,
      fields: [
        { name: 'Owner', value: leak.ownerName, inline: true },
        { name: 'Created', value: leak.createdAt, inline: true },
        { name: 'Pattern', value: leak.matchedPattern, inline: false }
      ]
    }))
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
```

## トラブルシューティング例

### パターンが見つからない場合

```bash
# 手動でパターンを指定
github-leak-detector detect \
  --patterns "YourProjectName,YourUniqueClass,yourUniqueFunction"
```

### レート制限エラー

```bash
# エラー: GitHub API rate limit exceeded
# → APIトークンを使用

export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
github-leak-detector detect --api-token "$GITHUB_TOKEN"
```

### デバッグモード（詳細ログ）

```bash
# Node.jsのデバッグ出力を有効化
DEBUG=* github-leak-detector detect
```
