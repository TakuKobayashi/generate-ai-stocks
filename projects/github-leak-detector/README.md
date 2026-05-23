# GitHub Leak Detector

GitHubにソースコードが流出していないか検出するCLIツール & GitHub Actionsライブラリ

## 特徴

- 🔐 **Blobハッシュ検索**: ファイル内容のハッシュ値で高精度に流出を検知（デフォルト）
- 📊 **段階的な警告**: マッチング率に応じてリスクレベル（低/中/高/重大）を判定
- 🎯 **柔軟な閾値設定**: 何%一致で警告するかをカスタマイズ可能
- 🔍 **複数の検索方法**: Blobハッシュ、パターン検索、ハイブリッドから選択可能
- 🌍 **言語非依存**: あらゆるプログラミング言語のプロジェクトに対応
- 🔔 Slack/Webhook通知対応
- ⏰ ローカルでの定期実行サポート
- 🎯 GitHub Actions統合

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

### CLI: 基本的な使用（Blobハッシュ検索 - 推奨）

```bash
# リポジトリ内で実行（デフォルトでblobハッシュ検索）
cd your-repository
github-leak-detector detect
```

**動作の仕組み:**
1. リポジトリ内のファイルのGit blob SHA（内容ハッシュ）を抽出
2. GitHub上でこれらのハッシュを一括検索
3. 複数のファイルが一致するリポジトリを検出
4. マッチング率に応じてリスクレベルを判定

### CLI: 閾値のカスタマイズ

```bash
# 50%以上一致で警告、90%以上で高リスク判定
github-leak-detector detect \
  --match-threshold 50 \
  --high-match-threshold 90

# より厳格に: 20%以上で警告
github-leak-detector detect --match-threshold 20

# 確実な流出のみ: 80%以上で警告
github-leak-detector detect --match-threshold 80
```

### CLI: 検索方法の選択

```bash
# Blobハッシュ検索（デフォルト、最も正確）
github-leak-detector detect --search-method blob-hash

# パターン検索（言語非依存の識別子検索）
github-leak-detector detect --search-method pattern

# ハイブリッド（両方を組み合わせ）
github-leak-detector detect --search-method hybrid
```

### CLI: 詳細設定

```bash
# 検索するファイル数とバッチサイズを調整
github-leak-detector detect \
  --max-blob-hashes 100 \
  --blob-batch-size 30

# GitHub APIトークンを使用（レート制限を緩和）
github-leak-detector detect --api-token YOUR_GITHUB_TOKEN

# Slack通知を有効化
github-leak-detector detect \
  --notify \
  --notification-url https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  --notification-type slack

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
  --notification-url https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  --match-threshold 40
```

### GitHub Actions

#### 基本的なワークフロー

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
            --match-threshold 30 \
            --notify \
            --notification-url "${{ secrets.SLACK_WEBHOOK_URL }}" \
            --notification-type slack
```

### プログラムから使用

```typescript
import { LeakDetector } from 'github-leak-detector';

const detector = new LeakDetector({
  searchMethod: 'blob-hash', // デフォルト
  matchThresholdPercent: 30,
  highMatchThresholdPercent: 80,
  maxBlobHashesToSearch: 50,
  blobHashBatchSize: 20,
  excludeForks: true,
  apiToken: process.env.GITHUB_TOKEN
});

const leaks = await detector.detect();

// 結果を処理
for (const leak of leaks) {
  console.log(`Found: ${leak.repositoryName}`);
  console.log(`  Match: ${leak.matchPercentage}%`);
  console.log(`  Risk: ${leak.riskLevel}`);
  console.log(`  Files: ${leak.matchedFilesCount}/${leak.totalFilesChecked}`);
}
```

## コマンドオプション

### `detect` コマンド

| オプション | 説明 | デフォルト |
|----------|------|----------|
| `--search-method <method>` | 検索方法: blob-hash, pattern, hybrid | blob-hash |
| `--match-threshold <percent>` | 警告する最小マッチング率（0-100） | 30 |
| `--high-match-threshold <percent>` | 高リスクとする閾値（0-100） | 80 |
| `--max-blob-hashes <number>` | 検索するblobハッシュの最大数 | 50 |
| `--blob-batch-size <number>` | 1回の検索で使用するハッシュ数 | 20 |
| `--no-exclude-forks` | フォークも検索対象に含める | false |
| `--notify` | 流出検出時に通知を送信 | false |
| `--notification-url <url>` | 通知先URL | - |
| `--notification-type <type>` | 通知タイプ（slack, webhook, email） | slack |
| `--notification-message <msg>` | カスタム通知メッセージ | - |
| `--api-token <token>` | GitHub APIトークン | $GITHUB_TOKEN |
| `--patterns <patterns>` | パターン検索用の文字列（カンマ区切り） | 自動検出 |
| `--max-results <number>` | 最大検出数 | 50 |
| `--json` | JSON形式で出力 | false |

## 検出方法の詳細

### 1. Blobハッシュ検索（推奨・デフォルト）

**最も正確な検出方法**です。Gitの内部で使われるファイル内容のSHA-1ハッシュを使用します。

**仕組み:**
1. `git ls-files -s` でリポジトリ内の全ファイルのblobハッシュを取得
2. 複数のハッシュを `hash:abc123 OR hash:def456 ...` 形式で一括検索
3. 各リポジトリで何個のファイルが一致したかをカウント
4. マッチング率を計算してリスクレベルを判定

**利点:**
- ファイル名変更に影響されない
- 空白やインデントの変更も検出
- 言語やプロジェクト構造に依存しない
- 誤検知が極めて少ない

**マッチング率とリスクレベル:**
- **95%以上**: 🚨 Critical（ほぼ完全なコピー）
- **80%以上**: ❗ High（大部分が一致）
- **50%以上**: ⚠️ Medium（半分以上が一致）
- **30%以上**: ℹ️ Low（部分的に一致）

```bash
# 30%以上で警告（デフォルト）
github-leak-detector detect --match-threshold 30

# より厳格に: 80%以上のみ警告
github-leak-detector detect --match-threshold 80

# より敏感に: 10%以上で警告
github-leak-detector detect --match-threshold 10
```

### 2. パターン検索

プロジェクト固有の識別子（クラス名、関数名、プロジェクト名など）を自動抽出して検索します。

**対応言語:**
- JavaScript/TypeScript
- Python
- Java
- C/C++
- Go
- Rust
- Ruby
- PHP
- その他多数

**抽出元:**
- README.mdのタイトル
- 設定ファイル（package.json, Cargo.toml, setup.py, pom.xml, go.mod等）
- ソースコード内のクラス名、関数名、定数名

```bash
github-leak-detector detect --search-method pattern

# カスタムパターンを指定
github-leak-detector detect \
  --search-method pattern \
  --patterns "MyUniqueClass,mySecretFunction,PROJECT_CONSTANT"
```

### 3. ハイブリッド検索

BlobハッシュとパターンSearch両方を使用して、より包括的に検出します。

```bash
github-leak-detector detect --search-method hybrid
```

## 検出結果の例

```
🔍 Starting GitHub leak detection...

Current repository: yourname/your-project
Repository URL: https://github.com/yourname/your-project

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

🚨 [1] suspicious-user/copied-project
    Match: 42/45 files (93.33%) - Risk: CRITICAL
    URL: https://github.com/suspicious-user/copied-project
    Owner: suspicious-user (https://github.com/suspicious-user)
    Created: 2024-01-15 10:30:00
    Is Fork: No

ℹ️  [2] another-user/partial-copy
    Match: 15/45 files (33.33%) - Risk: LOW
    URL: https://github.com/another-user/partial-copy
    Owner: another-user (https://github.com/another-user)
    Created: 2024-02-01 14:20:00
    Is Fork: No

📈 Risk Summary:
   🚨 Critical: 1
   ℹ️  Low: 1

⚠️  Total: 2 potential leak(s) detected
```

## パフォーマンスとレート制限

### GitHub API制限

- **認証なし**: 10リクエスト/分
- **認証あり**: 30リクエスト/分

### 推奨設定

```bash
# 小規模プロジェクト（<30ファイル）
github-leak-detector detect \
  --max-blob-hashes 30 \
  --blob-batch-size 15

# 中規模プロジェクト（30-100ファイル）- デフォルト
github-leak-detector detect \
  --max-blob-hashes 50 \
  --blob-batch-size 20

# 大規模プロジェクト（100+ファイル）
github-leak-detector detect \
  --max-blob-hashes 100 \
  --blob-batch-size 30 \
  --api-token YOUR_TOKEN
```

## トラブルシューティング

### レート制限エラー

```
Error: GitHub API rate limit exceeded
```

**解決策**: GitHub Personal Access Tokenを使用

```bash
# トークンを作成: https://github.com/settings/tokens
# 権限: public_repo（パブリックリポジトリのみの場合）

export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
github-leak-detector detect --api-token "$GITHUB_TOKEN"
```

### ファイルが見つからない

```
Error: No files found in repository
```

**解決策**: Gitリポジトリ内で実行していることを確認

```bash
git status  # リポジトリ内か確認
cd /path/to/your/repository
github-leak-detector detect
```

### 検出感度の調整

```bash
# 誤検知が多い場合: 閾値を上げる
github-leak-detector detect --match-threshold 50

# 見逃しが心配な場合: 閾値を下げる
github-leak-detector detect --match-threshold 20

# 検索するファイル数を増やす
github-leak-detector detect --max-blob-hashes 100
```

## 環境変数

| 変数 | 説明 |
|-----|------|
| `GITHUB_TOKEN` | GitHub APIトークン（推奨） |

## ライセンス

MIT

## セキュリティに関する注意

このツールはソースコードの流出を**検出**するものであり、流出を**防止**するものではありません。
機密情報をコミットしないよう、以下の対策も併用してください:

- `.gitignore`の適切な設定
- git-secretsなどの事前チェックツール
- GitHub Secret Scanningの有効化
- コミット前のレビュープロセス
