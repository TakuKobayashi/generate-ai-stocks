# クイックスタートガイド

## 5分で始める GitHub Leak Detector

### 1. インストール

```bash
npm install -g github-leak-detector
```

### 2. 基本的な使い方（Blobハッシュ検索）

リポジトリのディレクトリに移動して実行:

```bash
cd your-repository
github-leak-detector detect
```

これだけでBlobハッシュベースの高精度な流出検出が開始されます！

**何が起きているか:**
1. リポジトリ内の全ファイルのGit blobハッシュを抽出
2. GitHub上でこれらのハッシュをバッチ検索
3. 30%以上のファイルが一致するリポジトリを検出
4. リスクレベル（Low/Medium/High/Critical）を判定

### 3. よく使うオプション

#### GitHub APIトークンを使う（推奨）

レート制限を緩和するため、トークンの使用を推奨します:

```bash
export GITHUB_TOKEN="ghp_your_token_here"
github-leak-detector detect
```

#### 閾値を調整

```bash
# より厳格に: 80%以上の一致のみ警告
github-leak-detector detect --match-threshold 80

# より敏感に: 20%以上で警告
github-leak-detector detect --match-threshold 20

# 高リスク閾値も変更
github-leak-detector detect \
  --match-threshold 30 \
  --high-match-threshold 90
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
    - cron: '0 9 * * *'  # 毎日午前9時
  workflow_dispatch:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Run detection
        run: |
          npm install -g github-leak-detector
          github-leak-detector detect \
            --api-token "${{ secrets.GITHUB_TOKEN }}"
```

## 検索方法の選択

### Blobハッシュ検索（デフォルト・推奨）

最も正確な方法。ファイル内容のハッシュ値で検出します。

```bash
github-leak-detector detect --search-method blob-hash
```

**メリット:**
- 誤検知が極めて少ない
- ファイル名変更に影響されない
- あらゆる言語に対応

### パターン検索

プロジェクト固有の識別子で検索します。

```bash
github-leak-detector detect --search-method pattern
```

### ハイブリッド検索

両方を組み合わせます。

```bash
github-leak-detector detect --search-method hybrid
```

## 検出結果の見方

```
🚨 [1] suspicious-user/copied-project
    Match: 42/45 files (93.33%) - Risk: CRITICAL
    URL: https://github.com/suspicious-user/copied-project
```

**リスクレベル:**
- 🚨 **Critical (95%以上)**: ほぼ完全なコピー → 即座に対応
- ❗ **High (80-95%)**: 大部分が一致 → 早急に確認
- ⚠️ **Medium (50-80%)**: 半分以上が一致 → 監視が必要
- ℹ️ **Low (30-50%)**: 部分的に一致 → 記録のみ

## プロジェクトタイプ別の推奨設定

### 小規模プロジェクト（<30ファイル）

```bash
github-leak-detector detect \
  --max-blob-hashes 30 \
  --blob-batch-size 15
```

### 中規模プロジェクト（30-100ファイル）

```bash
# デフォルト設定で十分
github-leak-detector detect
```

### 大規模プロジェクト（100+ファイル）

```bash
github-leak-detector detect \
  --max-blob-hashes 100 \
  --blob-batch-size 30 \
  --api-token "$GITHUB_TOKEN"
```

### 機密性の高いプロジェクト

```bash
# 少しでも疑わしいものを検出
github-leak-detector detect \
  --match-threshold 20 \
  --notify \
  --notification-url "$SLACK_WEBHOOK"
```

## トラブルシューティング

### エラー: "Failed to get git remote URL"
→ Gitリポジトリ内で実行してください

```bash
git status  # 確認
cd /path/to/your/repository
github-leak-detector detect
```

### エラー: "rate limit exceeded"
→ GitHub Personal Access Tokenを使用してください

```bash
# トークンを作成: https://github.com/settings/tokens
# 権限: public_repo

export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
github-leak-detector detect --api-token "$GITHUB_TOKEN"
```

### 検出されすぎる
→ 閾値を上げてください

```bash
github-leak-detector detect --match-threshold 60
```

### 何も検出されない
→ 閾値を下げる、またはファイル数を増やしてください

```bash
github-leak-detector detect \
  --match-threshold 20 \
  --max-blob-hashes 100
```

## JSON出力で詳細確認

```bash
# JSON形式で保存
github-leak-detector detect --json > results.json

# 高リスクのみ抽出（jq使用）
github-leak-detector detect --json | \
  jq '.[] | select(.riskLevel == "critical" or .riskLevel == "high")'
```

## 次のステップ

### さらに詳しく

- **技術詳細**: [docs/BLOB_HASH_DETECTION.md](docs/BLOB_HASH_DETECTION.md)
- **詳細な使用例**: [docs/EXAMPLES_UPDATED.md](docs/EXAMPLES_UPDATED.md)
- **定期実行の設定**: [docs/SCHEDULE.md](docs/SCHEDULE.md)
- **開発者ガイド**: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

### 推奨される運用

1. **毎日実行**: GitHub Actionsで自動化
2. **閾値調整**: プロジェクトに応じて最適化
3. **通知設定**: 高リスクは即座に通知
4. **定期確認**: 検出結果を必ず人間が確認

## ヘルプとサポート

```bash
# コマンドヘルプ
github-leak-detector --help
github-leak-detector detect --help
github-leak-detector schedule --help
```
