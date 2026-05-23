# 詳細な使用例（Blobハッシュ検索版）

## CLIコマンド例

### 1. 基本的なBlobハッシュ検索

```bash
# デフォルト設定で実行（最も推奨）
cd your-repository
github-leak-detector detect
```

出力例:
```
🔍 Starting GitHub leak detection...

Current repository: username/my-project
Repository URL: https://github.com/username/my-project

🔐 Using blob hash detection method (most accurate)

Extracting file blob hashes from repository...
Found 45 files to check
Match threshold: 30%
High risk threshold: 80%

Starting blob hash search for 45 files...
Batch size: 20, Match threshold: 30%
Searching in 3 batches...
Processing batch 1/3 (20 hashes)...
Processing batch 2/3 (20 hashes)...
Processing batch 3/3 (5 hashes)...

Found 2 repositories matching the threshold

================================================================================
📊 Detection Results
================================================================================

⚠️  Found 2 potential leak(s):

🚨 [1] suspicious-user/exact-copy
    Match: 43/45 files (95.56%) - Risk: CRITICAL
    URL: https://github.com/suspicious-user/exact-copy
    Owner: suspicious-user (https://github.com/suspicious-user)
    Created: 2024-01-15 10:30:00
    Is Fork: No

ℹ️  [2] another-user/partial-match
    Match: 16/45 files (35.56%) - Risk: LOW
    URL: https://github.com/another-user/partial-match
    Owner: another-user (https://github.com/another-user)
    Created: 2024-02-01 14:20:00
    Is Fork: No

📈 Risk Summary:
   🚨 Critical: 1
   ℹ️  Low: 1

⚠️  Total: 2 potential leak(s) detected
```

### 2. 閾値をカスタマイズ

```bash
# より厳格に: 80%以上の一致のみ報告
github-leak-detector detect --match-threshold 80

# より敏感に: 10%以上の一致も報告
github-leak-detector detect --match-threshold 10

# 高リスク閾値も調整
github-leak-detector detect \
  --match-threshold 20 \
  --high-match-threshold 70
```

### 3. 大規模プロジェクトの検索

```bash
# 100ファイルまで検索、バッチサイズ30
github-leak-detector detect \
  --max-blob-hashes 100 \
  --blob-batch-size 30 \
  --api-token "$GITHUB_TOKEN"
```

### 4. ハイブリッド検索

```bash
# Blobハッシュ + パターン検索を組み合わせ
github-leak-detector detect \
  --search-method hybrid \
  --patterns "MyUniqueClass,ProjectName"
```

### 5. Slack通知付き

```bash
# 30%以上一致で通知、80%以上で高リスク
github-leak-detector detect \
  --match-threshold 30 \
  --high-match-threshold 80 \
  --notify \
  --notification-url "$SLACK_WEBHOOK_URL" \
  --notification-type slack \
  --notification-message "🚨 ソースコード流出を検出しました"
```

### 6. JSON出力

```bash
# JSON形式で出力して保存
github-leak-detector detect --json > leak-results.json

# jqでフィルタリング
github-leak-detector detect --json | \
  jq '.[] | select(.riskLevel == "critical" or .riskLevel == "high")'

# 高リスクのみ抽出
github-leak-detector detect --json | \
  jq '.[] | select(.matchPercentage >= 80)'
```

JSON出力例:
```json
[
  {
    "repositoryUrl": "https://github.com/suspicious/repo",
    "repositoryName": "suspicious/repo",
    "ownerName": "suspicious",
    "ownerGithubUrl": "https://github.com/suspicious",
    "createdAt": "2024-01-15T10:30:00Z",
    "isFork": false,
    "matchedPattern": "42 files matched",
    "matchType": "blob-hash",
    "matchedFilesCount": 42,
    "totalFilesChecked": 45,
    "matchPercentage": 93.33,
    "riskLevel": "critical",
    "matchedHashes": ["abc123...", "def456..."]
  }
]
```

### 7. 比較: 各検索方法

```bash
# Blobハッシュ検索（推奨）
github-leak-detector detect --search-method blob-hash

# パターン検索
github-leak-detector detect --search-method pattern

# ハイブリッド
github-leak-detector detect --search-method hybrid
```

## プロジェクトタイプ別の推奨設定

### Node.jsプロジェクト

```bash
github-leak-detector detect \
  --match-threshold 30 \
  --max-blob-hashes 50
```

### Pythonプロジェクト

```bash
github-leak-detector detect \
  --match-threshold 35 \
  --max-blob-hashes 60
```

### Go/Rustプロジェクト

```bash
github-leak-detector detect \
  --match-threshold 40 \
  --max-blob-hashes 40
```

### モノレポ

```bash
# より多くのファイルをチェック
github-leak-detector detect \
  --max-blob-hashes 150 \
  --blob-batch-size 30 \
  --match-threshold 25
```

## 定期実行の例

### 1. GitHub Actions（推奨）

```yaml
name: Daily Leak Detection

on:
  schedule:
    - cron: '0 9 * * *'  # 毎日午前9時（UTC）
  workflow_dispatch:

jobs:
  detect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Run blob hash detection
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: |
          npm install -g github-leak-detector
          github-leak-detector detect \
            --search-method blob-hash \
            --match-threshold 30 \
            --high-match-threshold 80 \
            --api-token "$GITHUB_TOKEN" \
            --notify \
            --notification-url "$SLACK_WEBHOOK" \
            --json > leak-results-$(date +%Y%m%d).json
      
      - name: Upload results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: leak-detection-results
          path: leak-results-*.json
```

### 2. Cron（ローカル）

```bash
# crontab -e
0 */6 * * * cd /path/to/repo && github-leak-detector detect --match-threshold 40 --notify --notification-url $SLACK_WEBHOOK
```

### 3. Scheduleコマンド

```bash
github-leak-detector schedule \
  --interval 60 \
  --match-threshold 30 \
  --notify \
  --notification-url "$SLACK_WEBHOOK"
```

## トラブルシューティング例

### ケース1: 検出されすぎる

```bash
# 問題: 低リスクの一致が多すぎる
# 解決策: 閾値を上げる
github-leak-detector detect --match-threshold 60
```

### ケース2: 何も検出されない

```bash
# 問題: 閾値が高すぎる可能性
# 解決策: 閾値を下げる、ファイル数を増やす
github-leak-detector detect \
  --match-threshold 20 \
  --max-blob-hashes 100
```

### ケース3: レート制限

```bash
# 問題: GitHub API rate limit exceeded
# 解決策: トークンを使用、バッチサイズを小さく
export GITHUB_TOKEN="ghp_xxxx"
github-leak-detector detect \
  --api-token "$GITHUB_TOKEN" \
  --blob-batch-size 15
```

## プログラムから使用する例

### TypeScript

```typescript
import { LeakDetector, LeakResult } from 'github-leak-detector';

async function checkLeaks() {
  const detector = new LeakDetector({
    searchMethod: 'blob-hash',
    matchThresholdPercent: 30,
    highMatchThresholdPercent: 80,
    maxBlobHashesToSearch: 50,
    blobHashBatchSize: 20,
    apiToken: process.env.GITHUB_TOKEN
  });

  const leaks = await detector.detect();

  // 高リスクのみフィルタリング
  const highRiskLeaks = leaks.filter(
    leak => leak.riskLevel === 'critical' || leak.riskLevel === 'high'
  );

  if (highRiskLeaks.length > 0) {
    console.log(`🚨 ${highRiskLeaks.length} high-risk leaks found!`);
    for (const leak of highRiskLeaks) {
      console.log(`- ${leak.repositoryName}: ${leak.matchPercentage}%`);
    }
  }
}
```

### カスタム通知

```typescript
import { LeakDetector } from 'github-leak-detector';

async function detectAndNotify() {
  const detector = new LeakDetector({
    searchMethod: 'blob-hash',
    matchThresholdPercent: 30,
    apiToken: process.env.GITHUB_TOKEN
  });

  const leaks = await detector.detect();

  // リスクレベル別に通知
  const critical = leaks.filter(l => l.riskLevel === 'critical');
  const high = leaks.filter(l => l.riskLevel === 'high');

  if (critical.length > 0) {
    // 緊急通知
    await sendUrgentAlert(critical);
  }

  if (high.length > 0) {
    // 通常通知
    await sendNormalAlert(high);
  }
}
```

## リスクレベル別の対応フロー

### Critical（95%以上）

```bash
# 即座に詳細調査
github-leak-detector detect --match-threshold 95 --json | \
  jq '.[] | {repo: .repositoryName, match: .matchPercentage, owner: .ownerName}'

# 該当リポジトリを手動確認
# → GitHubに報告、法的措置を検討
```

### High（80-95%）

```bash
# 毎日チェック
github-leak-detector detect --match-threshold 80 --notify

# 該当リポジトリのオーナーに連絡
```

### Medium（50-80%）

```bash
# 週次チェック
# 状況を監視、必要に応じて対応
```

### Low（30-50%）

```bash
# 月次チェック
# 記録のみ、積極的な対応は不要
```
