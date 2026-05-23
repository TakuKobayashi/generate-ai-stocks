# GitHub Leak Detector - プロジェクトサマリー（Blobハッシュ検索版）

## 概要

GitHubにソースコードが流出していないかを検出するCLIツール & GitHub Actionsライブラリです。
**Gitのblobハッシュ（ファイル内容のSHA-1）を使用した高精度な検出**がデフォルトで、あらゆるプログラミング言語のプロジェクトに対応しています。

## 主な機能

### ✅ 実装済み機能

1. **Blobハッシュ検索（デフォルト・推奨）**
   - Gitの内部ハッシュ値を使用した高精度検出
   - 複数のハッシュをバッチ検索（API効率化）
   - マッチング率に応じた段階的警告（Low/Medium/High/Critical）
   - 言語・プロジェクト構造に完全非依存
   - ファイル名変更やリファクタリングに影響されない

2. **柔軟な閾値設定**
   - 何%一致で警告するかカスタマイズ可能（デフォルト: 30%）
   - 高リスク判定閾値も調整可能（デフォルト: 80%）
   - プロジェクトに応じた最適化が可能

3. **複数の検索方法**
   - Blobハッシュ検索（最も正確）
   - パターン検索（補完的）
   - ハイブリッド検索（両方を組み合わせ）

4. **言語非依存のパターン抽出**
   - JavaScript/TypeScript, Python, Java, C/C++, Go, Rust, Ruby, PHP等に対応
   - package.json, Cargo.toml, setup.py, pom.xml, go.mod等から自動抽出
   - READMEやソースコードから識別子を抽出

5. **CLI インターフェース**
   - `detect` コマンド: 流出検出を実行
   - `schedule` コマンド: 定期実行
   - 豊富なオプション（検索方法、閾値、通知など）

6. **通知機能**
   - Slack通知対応
   - カスタムWebhook対応
   - リスクレベルに応じた通知内容

7. **GitHub Actions サポート**
   - ワークフローファイルのサンプル
   - 定期実行の設定例

8. **ローカル定期実行**
   - scheduleコマンド
   - Cron、Systemd、PM2での運用サポート

## ファイル構成

```
github-leak-detector/
├── src/
│   ├── cli.ts              # CLIエントリーポイント（更新）
│   ├── detector.ts         # 検出エンジン（Blobハッシュ中心）
│   ├── github-client.ts    # GitHub API（バッチ検索実装）
│   ├── git-utils.ts        # Git操作（言語非依存、blob抽出）
│   ├── notifier.ts         # 通知機能
│   ├── action.ts           # GitHub Actions
│   ├── types.ts            # 型定義（マッチング情報追加）
│   └── index.ts            # ライブラリエクスポート
├── docs/
│   ├── BLOB_HASH_DETECTION.md  # Blobハッシュ技術詳細
│   ├── EXAMPLES_UPDATED.md     # 使用例（更新版）
│   ├── DEVELOPMENT.md          # 開発者ガイド
│   └── SCHEDULE.md             # 定期実行設定
├── .github/workflows/
│   └── leak-detection.yml      # GitHub Actions例
├── README.md                   # メインドキュメント（更新）
├── QUICKSTART.md              # クイックスタート
└── package.json               # npm設定
```

## 検出方法の詳細

### 実装された検出アプローチ

#### 1. Blobハッシュ検索（デフォルト・最も正確）

**仕組み:**
1. `git ls-files -s`でリポジトリ内全ファイルのblobハッシュを取得
2. 複数のハッシュを`hash:abc OR hash:def ...`形式でバッチ検索
3. 各リポジトリで一致したファイル数をカウント
4. マッチング率を計算: `(一致ファイル数 / 総ファイル数) × 100`
5. 閾値判定とリスクレベル分類

**利点:**
- ファイル内容が完全一致するものを検出
- ファイル名変更に影響されない
- コミット履歴の書き換えに影響されない
- 言語・フレームワークに完全非依存
- 誤検知が極めて少ない

**マッチング率による分類:**
- **95%以上**: Critical（ほぼ完全なコピー）
- **80-95%**: High（大部分が一致）
- **50-80%**: Medium（半分以上が一致）
- **30-50%**: Low（部分的に一致）

#### 2. パターン検索（補完的）

言語非依存のパターン抽出:
- 設定ファイル: package.json, Cargo.toml, setup.py, pom.xml, go.mod, composer.json, Gemfile等
- README: タイトル、プロジェクト名
- ソースコード: クラス名、関数名、定数（言語共通の正規表現）

#### 3. ハイブリッド検索

Blobハッシュ + パターン検索を組み合わせて包括的に検出

## 使用方法

### CLIとして使用

```bash
# インストール
npm install -g github-leak-detector

# 基本的な検出（Blobハッシュ、30%閾値）
github-leak-detector detect

# 閾値カスタマイズ
github-leak-detector detect \
  --match-threshold 50 \
  --high-match-threshold 90

# 大規模プロジェクト
github-leak-detector detect \
  --max-blob-hashes 100 \
  --blob-batch-size 30 \
  --api-token "$GITHUB_TOKEN"

# ハイブリッド検索
github-leak-detector detect --search-method hybrid

# Slack通知
github-leak-detector detect \
  --notify \
  --notification-url "$SLACK_WEBHOOK_URL"
```

### GitHub Actionsとして使用

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- uses: actions/setup-node@v4
- run: |
    npm install -g github-leak-detector
    github-leak-detector detect \
      --match-threshold 30 \
      --api-token "${{ secrets.GITHUB_TOKEN }}"
```

### プログラムから使用

```typescript
import { LeakDetector } from 'github-leak-detector';

const detector = new LeakDetector({
  searchMethod: 'blob-hash',
  matchThresholdPercent: 30,
  highMatchThresholdPercent: 80,
  maxBlobHashesToSearch: 50,
  blobHashBatchSize: 20,
  apiToken: process.env.GITHUB_TOKEN
});

const leaks = await detector.detect();

for (const leak of leaks) {
  console.log(`${leak.repositoryName}: ${leak.matchPercentage}% (${leak.riskLevel})`);
}
```

## 技術スタック

- **言語**: TypeScript 5.3
- **ランタイム**: Node.js 16+
- **CLIフレームワーク**: commander.js
- **API**: GitHub Code Search API
- **検出手法**: Git blob SHA-1 ハッシュ
- **依存関係**:
  - node-fetch: HTTP リクエスト
  - chalk: カラフルなCLI出力
  - @actions/core: GitHub Actions サポート

## パフォーマンス特性

### API使用量

- **1バッチ**: 1 API呼び出し（20ハッシュ検索）
- **50ファイル検索**: 約3バッチ = 3 API呼び出し
- **100ファイル検索**: 約5バッチ = 5 API呼び出し

### レート制限

- **認証なし**: 10リクエスト/分 → 最大200ファイル/分
- **認証あり**: 30リクエスト/分 → 最大600ファイル/分

### 推奨設定

| プロジェクト規模 | max-blob-hashes | blob-batch-size | 所要時間（目安） |
|----------------|-----------------|-----------------|-----------------|
| 小（<30ファイル） | 30 | 15 | 30秒 |
| 中（30-100） | 50 | 20 | 1分 |
| 大（100+） | 100 | 30 | 2-3分 |

## セキュリティ考慮事項

1. **APIトークンの保護**: 環境変数で管理
2. **プライバシー**: Blobハッシュはファイル内容を暴露しない
3. **レート制限の遵守**: 適切な待機時間を設定
4. **検証**: 流出検出は補助ツール、確実な防止策ではない

## 今後の拡張可能性

### 実装可能な追加機能

1. **検出精度の向上**
   - ファイルサイズによる重み付け
   - ディレクトリ構造の類似性チェック
   - 時系列分析（いつから流出しているか）

2. **通知機能の拡張**
   - Discord, Microsoft Teams
   - Email（SMTP）
   - PagerDuty統合

3. **レポート機能**
   - HTML/PDF レポート生成
   - ダッシュボード
   - トレンド分析

4. **運用支援**
   - ホワイトリスト機能
   - 自動応答（GitHub API経由でissue作成）
   - 複数リポジトリ一括チェック

## ドキュメント

- [README.md](README.md) - メインドキュメント
- [QUICKSTART.md](QUICKSTART.md) - クイックスタート
- [docs/BLOB_HASH_DETECTION.md](docs/BLOB_HASH_DETECTION.md) - 技術詳細
- [docs/EXAMPLES_UPDATED.md](docs/EXAMPLES_UPDATED.md) - 詳細な使用例
- [docs/SCHEDULE.md](docs/SCHEDULE.md) - 定期実行の設定
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - 開発者ガイド

## ライセンス

MIT License

## 主な改善点（v2.0）

1. ✅ **Blobハッシュ検索**: 最も正確な検出方法をデフォルト化
2. ✅ **言語非依存**: あらゆるプロジェクトで使用可能に
3. ✅ **段階的警告**: マッチング率に応じたリスクレベル判定
4. ✅ **柔軟な閾値**: プロジェクトに応じた調整が可能
5. ✅ **バッチ検索**: API効率を大幅に向上
6. ✅ **詳細な結果**: 一致ファイル数、マッチング率を表示
