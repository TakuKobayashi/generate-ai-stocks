# 開発者ガイド

## 開発環境のセットアップ

### 前提条件

- Node.js 16.x 以上
- npm または yarn
- Git

### セットアップ手順

```bash
# リポジトリをクローン
git clone https://github.com/your-username/github-leak-detector.git
cd github-leak-detector

# 依存関係をインストール
npm install

# TypeScriptをビルド
npm run build

# ローカルでテスト
npm run dev -- detect
```

## プロジェクト構造

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
├── examples/               # 使用例
├── docs/                   # ドキュメント
├── .github/
│   └── workflows/          # GitHub Actions ワークフロー
├── tests/                  # テストファイル（TODO）
├── package.json
├── tsconfig.json
├── action.yml              # GitHub Actions 定義
└── README.md
```

## アーキテクチャ

### コンポーネント

1. **GitUtils**: Git操作とパターン抽出
   - リモートリポジトリ情報の取得
   - ユニークなコードパターンの自動抽出
   - コミット履歴の取得

2. **GitHubClient**: GitHub API との通信
   - Code Search API の実行
   - リポジトリ情報の取得
   - オーナー情報の取得

3. **LeakDetector**: 検出エンジン
   - パターンベースの検索実行
   - 結果のフィルタリング
   - レポート生成

4. **Notifier**: 通知システム
   - Slack通知
   - Webhook通知
   - カスタム通知（拡張可能）

### データフロー

```
[GitUtils] → パターン抽出
     ↓
[LeakDetector] → 検出実行
     ↓
[GitHubClient] → GitHub検索
     ↓
[LeakDetector] → 結果フィルタリング
     ↓
[Notifier] → 通知送信（オプション）
```

## API リファレンス

### LeakDetector

```typescript
class LeakDetector {
  constructor(options?: DetectionOptions)
  
  // 検出を実行
  async detect(): Promise<LeakResult[]>
  
  // JSON形式で結果を出力
  async detectAndOutputJson(): Promise<string>
}
```

### DetectionOptions

```typescript
interface DetectionOptions {
  excludeForks?: boolean;          // フォークを除外
  notify?: boolean;                // 通知を有効化
  notificationUrl?: string;        // 通知先URL
  notificationMessage?: string;    // カスタム通知メッセージ
  notificationType?: 'slack' | 'webhook' | 'email';
  apiToken?: string;               // GitHub APIトークン
  searchPatterns?: string[];       // 検索パターン
  maxResults?: number;             // 最大結果数
}
```

### LeakResult

```typescript
interface LeakResult {
  repositoryUrl: string;
  repositoryName: string;
  ownerName: string;
  ownerEmail?: string;
  ownerGithubUrl: string;
  createdAt: string;
  isFork: boolean;
  matchedPattern: string;
  matchedFile?: string;
}
```

## 新機能の追加

### 新しい通知タイプの追加

1. `src/notifier.ts`に新しいメソッドを追加:

```typescript
private static async sendDiscordNotification(
  webhookUrl: string,
  payload: NotificationPayload
): Promise<void> {
  // Discord通知の実装
}
```

2. `send`メソッドに case を追加:

```typescript
case 'discord':
  await this.sendDiscordNotification(url, payload);
  break;
```

3. 型定義を更新:

```typescript
notificationType?: 'slack' | 'webhook' | 'email' | 'discord';
```

### 新しい検出方法の追加

1. `src/git-utils.ts`に新しい抽出メソッドを追加:

```typescript
static extractCommitHashes(count: number = 10): string[] {
  // コミットハッシュ抽出の実装
}
```

2. `src/github-client.ts`に検索メソッドを追加:

```typescript
async searchByCommitHash(hash: string): Promise<SearchResult> {
  // コミットハッシュ検索の実装
}
```

3. `src/detector.ts`で新しいメソッドを使用:

```typescript
const commitHashes = GitUtils.extractCommitHashes();
for (const hash of commitHashes) {
  const results = await this.githubClient.searchByCommitHash(hash);
  // 処理...
}
```

## テストの追加（TODO）

```bash
# テストフレームワークのインストール
npm install --save-dev jest @types/jest ts-jest

# テスト実行
npm test
```

テスト例:

```typescript
// tests/git-utils.test.ts
import { GitUtils } from '../src/git-utils';

describe('GitUtils', () => {
  test('parseGitUrl should parse HTTPS URL', () => {
    const result = GitUtils.parseGitUrl('https://github.com/owner/repo.git');
    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('repo');
  });

  test('parseGitUrl should parse SSH URL', () => {
    const result = GitUtils.parseGitUrl('git@github.com:owner/repo.git');
    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('repo');
  });
});
```

## リリースプロセス

1. バージョンを更新:

```bash
npm version patch  # または minor, major
```

2. ビルド:

```bash
npm run build
```

3. npmに公開:

```bash
npm publish
```

4. GitHubリリースを作成:

```bash
git tag v1.0.1
git push origin v1.0.1
```

## コントリビューション

Pull Requestを歓迎します！

### ガイドライン

1. コードスタイル: TypeScript標準スタイルに準拠
2. コミットメッセージ: Conventional Commits形式
3. テスト: 新機能には必ずテストを追加
4. ドキュメント: README.mdを更新

### コミットメッセージ例

```
feat: Add Discord notification support
fix: Fix rate limit handling
docs: Update API documentation
refactor: Improve pattern extraction logic
test: Add tests for GitUtils
```

## デバッグ

### ローカルデバッグ

```bash
# TypeScriptを直接実行
npx ts-node src/cli.ts detect

# デバッグログを有効化
DEBUG=* npx ts-node src/cli.ts detect
```

### VS Code デバッグ設定

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug CLI",
      "runtimeArgs": ["-r", "ts-node/register"],
      "args": ["${workspaceFolder}/src/cli.ts", "detect"],
      "cwd": "${workspaceFolder}",
      "protocol": "inspector"
    }
  ]
}
```

## パフォーマンス最適化

### レート制限の管理

```typescript
// GitHub API のレート制限を確認
async checkRateLimit(): Promise<void> {
  const response = await fetch('https://api.github.com/rate_limit', {
    headers: { 'Authorization': `token ${this.token}` }
  });
  const data = await response.json();
  console.log('Rate limit:', data.rate);
}
```

### 並列検索の実装

```typescript
// 複数パターンを並列検索
async detectLeaksParallel(patterns: string[]): Promise<LeakResult[]> {
  const promises = patterns.map(pattern => 
    this.searchCode(`"${pattern}"`)
  );
  const results = await Promise.all(promises);
  // 結果を統合...
}
```

## セキュリティ考慮事項

1. **APIトークンの保護**: 環境変数に保存し、コミットしない
2. **レート制限の遵守**: GitHub APIの制限を超えない
3. **プライベート情報の取り扱い**: ログに機密情報を出力しない
4. **依存関係の監査**: 定期的に`npm audit`を実行

## ライセンス

MIT License - 詳細はLICENSEファイルを参照
