# GitHub Leak Detector - プロジェクトサマリー

## 概要

GitHubにソースコードが流出していないかを検出するCLIツール & GitHub Actionsライブラリです。
Node.js、TypeScript、commanderで開発されており、CLIでの実行、GitHub Actions、ローカル定期実行に対応しています。

## 主な機能

### ✅ 実装済み機能

1. **流出検出機能**
   - GitHub Code Search APIを使用したコード検索
   - リポジトリ内のユニークなパターンの自動抽出
   - カスタムパターンでの検索サポート
   - フォークリポジトリの除外オプション
   - 詳細なレポート出力（CLI/JSON形式）

2. **CLI インターフェース**
   - `detect` コマンド: 流出検出を実行
   - `schedule` コマンド: 定期実行
   - 豊富なコマンドラインオプション
   - カラフルな出力（chalkを使用）

3. **通知機能**
   - Slack通知対応
   - カスタムWebhook対応
   - 拡張可能な通知システム

4. **GitHub Actions サポート**
   - ワークフローファイルのサンプル提供
   - GitHub Actionとしての利用（action.yml）
   - 定期実行の設定例

5. **ローカル定期実行**
   - scheduleコマンドによる定期実行
   - Cron、Systemd、PM2などでの運用サポート
   - セットアップドキュメント完備

## ファイル構成

```
github-leak-detector/
├── src/
│   ├── cli.ts              # CLIエントリーポイント
│   ├── detector.ts         # メイン検出ロジック
│   ├── github-client.ts    # GitHub API クライアント
│   ├── git-utils.ts        # Git操作ユーティリティ
│   ├── notifier.ts         # 通知機能
│   ├── action.ts           # GitHub Actions エントリーポイント
│   ├── types.ts            # TypeScript型定義
│   └── index.ts            # ライブラリエクスポート
├── examples/
│   └── usage.ts            # 使用例
├── docs/
│   ├── DEVELOPMENT.md      # 開発者ガイド
│   ├── EXAMPLES.md         # 詳細な使用例
│   └── SCHEDULE.md         # 定期実行設定ガイド
├── .github/workflows/
│   └── leak-detection.yml  # GitHub Actions ワークフロー例
├── README.md               # メインドキュメント
├── QUICKSTART.md           # クイックスタートガイド
├── LICENSE                 # MITライセンス
├── package.json            # npm設定
├── tsconfig.json           # TypeScript設定
├── action.yml              # GitHub Action定義
└── setup.sh                # セットアップスクリプト
```

## 検出方法の詳細

### 実装された検出アプローチ

#### 1. ユニークなコードパターン検索（主要手法）
- **自動パターン抽出**:
  - `package.json`のプロジェクト名
  - TypeScript/JavaScriptのクラス名
  - エクスポートされた関数名
  - README.mdのタイトル
  
- **GitHub Code Search API**:
  - 抽出したパターンでGitHub全体を検索
  - language:typescript/javascript でフィルタリング
  - 自分のリポジトリとフォークを除外

#### 2. フィルタリング
- 現在のリポジトリを除外（git remoteから判別）
- オプションでフォークを除外
- レート制限を考慮した段階的検索

### 検出結果の情報

各流出に対して以下の情報を収集:
- リポジトリURL、名前
- オーナー名、GitHubアカウントURL
- オーナーのメールアドレス（APIトークン使用時）
- リポジトリ作成日時
- フォークかどうか
- マッチしたパターン
- マッチしたファイル名

## 使用方法

### CLIとして使用

```bash
# インストール
npm install -g github-leak-detector

# 基本的な検出
github-leak-detector detect

# オプション付き
github-leak-detector detect \
  --api-token "$GITHUB_TOKEN" \
  --notify \
  --notification-url "$SLACK_WEBHOOK_URL" \
  --patterns "MyClass,myFunction"

# 定期実行
github-leak-detector schedule --interval 60
```

### GitHub Actionsとして使用

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
- run: npx github-leak-detector detect
```

### プログラムから使用

```typescript
import { LeakDetector } from 'github-leak-detector';

const detector = new LeakDetector({
  excludeForks: true,
  apiToken: process.env.GITHUB_TOKEN
});

const leaks = await detector.detect();
```

## 技術スタック

- **言語**: TypeScript 5.3
- **ランタイム**: Node.js 16+
- **CLIフレームワーク**: commander.js
- **API**: GitHub Code Search API
- **ビルドツール**: TypeScript Compiler
- **依存関係**:
  - node-fetch: HTTP リクエスト
  - chalk: カラフルなCLI出力
  - @actions/core: GitHub Actions サポート

## セキュリティ考慮事項

1. **APIトークンの保護**: 環境変数で管理
2. **レート制限の遵守**: GitHub APIの制限を超えない設計
3. **プライベート情報**: ログに機密情報を出力しない
4. **検証**: 流出検出は補助ツールであり、確実な防止策ではない

## 今後の拡張可能性

### 実装可能な追加機能

1. **検出方法の追加**
   - ファイルハッシュ検索
   - リポジトリ構造の類似性チェック
   - コミットメッセージの検索

2. **通知機能の拡張**
   - Email通知の実装
   - Discord通知
   - Microsoft Teams通知
   - カスタムテンプレート

3. **レポート機能**
   - HTML形式のレポート生成
   - PDF出力
   - ダッシュボード

4. **高度なフィルタリング**
   - ホワイトリスト機能
   - 誤検出の学習機能
   - スター数やフォーク数でのフィルタリング

5. **パフォーマンス改善**
   - 並列検索
   - キャッシング機能
   - 増分検索

## テスト

現在、テストは未実装です。
今後、以下のテストを追加予定:

- ユニットテスト（Jest）
- 統合テスト
- E2Eテスト

## ライセンス

MIT License

## ドキュメント

- [README.md](README.md) - メインドキュメント
- [QUICKSTART.md](QUICKSTART.md) - クイックスタート
- [docs/EXAMPLES.md](docs/EXAMPLES.md) - 詳細な使用例
- [docs/SCHEDULE.md](docs/SCHEDULE.md) - 定期実行の設定
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - 開発者ガイド

## サポートとコントリビューション

Pull Requestsを歓迎します！
Issue報告もお気軽にどうぞ。
