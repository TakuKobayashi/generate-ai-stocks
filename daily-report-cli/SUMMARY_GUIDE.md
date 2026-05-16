# 要約機能ガイド

Daily Report CLIには、収集した情報を自動的に3行で要約する機能があります。

## 📋 要約方法の選択

### 1. ローカル要約 (推奨・デフォルト)

**メリット:**
- ✅ APIキー不要
- ✅ 無料
- ✅ プライバシー保護
- ✅ 高速

**デメリット:**
- ⚠️ 精度はAI要約より劣る
- ⚠️ 抽出型要約(重要文を選択)

**使い方:**

```bash
# 基本的な使い方
daily-report generate --summarize

# または -s で短縮
daily-report generate -s
```

**動作原理:**
1. TF-IDF(単語の重要度)でコミットメッセージやタスクをスコアリング
2. 重要なキーワードを含む文章にボーナス
3. 統計情報と重要な活動を組み合わせて3行に整形

### 2. AI要約 (OpenAI / Anthropic)

**メリット:**
- ✅ 高精度
- ✅ 自然な文章
- ✅ 文脈を理解した要約

**デメリット:**
- ⚠️ APIキーが必要
- ⚠️ 課金される
- ⚠️ 外部サービスに依存

**使い方:**

#### OpenAI (GPT)

```bash
# APIキーを環境変数で設定
export OPENAI_API_KEY=sk-...

# 要約生成
daily-report generate --summarize \
  --summary-api openai \
  --summary-api-key $OPENAI_API_KEY

# モデルを指定
daily-report generate --summarize \
  --summary-api openai \
  --summary-api-key $OPENAI_API_KEY \
  --summary-model gpt-4o
```

#### Anthropic (Claude)

```bash
# APIキーを環境変数で設定
export ANTHROPIC_API_KEY=sk-ant-...

# 要約生成
daily-report generate --summarize \
  --summary-api anthropic \
  --summary-api-key $ANTHROPIC_API_KEY

# モデルを指定
daily-report generate --summarize \
  --summary-api anthropic \
  --summary-api-key $ANTHROPIC_API_KEY \
  --summary-model claude-3-5-sonnet-20241022
```

## 📊 出力例

### ローカル要約の例

```markdown
## 📊 3行要約

1. 本日は5件のコミット、3件のタスク完了、2件のPRレビューを行いました。
2. ユーザー認証機能のバグ修正とパフォーマンス最適化を実装
3. データベーススキーマの更新とAPIエンドポイントの追加

**キーワード**: authentication, optimization, database, api, schema
```

### AI要約の例

```markdown
## 📊 3行要約 (AI生成)

1. 本日は計5件のコミットと3件のタスク完了、2件のコードレビューを実施しました。
2. 主な作業として、ユーザー認証のバグ修正とクエリ最適化によるパフォーマンス改善を実装しました。
3. データベーススキーマの更新とREST APIエンドポイントの新規追加も完了しています。
```

## 💡 使用シーン

### 毎日の日報にローカル要約を含める

```bash
# シンプルに要約付き日報を生成
daily-report generate -s
```

### 週報にAI要約を使用

```bash
# 週報テンプレートでAI要約を使用
daily-report generate \
  --template weekly-template.md \
  --summarize \
  --summary-api openai \
  --summary-api-key $OPENAI_API_KEY \
  --output weekly-report.md
```

### GitHub Actionsで自動要約

```yaml
# .github/workflows/daily-report.yml

- name: Generate daily report with summary
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: |
    npm start generate \
      --summarize \
      --summary-api openai \
      --summary-api-key "$OPENAI_API_KEY" \
      --output "./reports/daily-report-$(date +%Y-%m-%d).md"
```

## ⚙️ 推奨モデル

### OpenAI

| モデル | 用途 | コスト | 特徴 |
|--------|------|--------|------|
| gpt-4o-mini | **推奨** 日報要約 | 最安 | 十分な精度、高速 |
| gpt-4o | 週報・月報 | 中 | 高精度 |
| gpt-3.5-turbo | 簡易要約 | 最安 | 基本的な要約 |

### Anthropic

| モデル | 用途 | コスト | 特徴 |
|--------|------|--------|------|
| claude-3-haiku-20240307 | **推奨** 日報要約 | 最安 | 高速、十分な精度 |
| claude-3-5-sonnet-20241022 | 週報・月報 | 中 | 最高精度 |

## 🔒 セキュリティとプライバシー

### ローカル要約
- ✅ データは一切外部に送信されない
- ✅ 完全にローカルで処理
- ✅ プライバシー保護

### AI要約
- ⚠️ コミットメッセージやタスク名がAPIに送信される
- ⚠️ 機密情報が含まれる場合は使用を避ける
- ⚠️ 各プロバイダーのプライバシーポリシーを確認

**推奨設定:**
- 個人プロジェクト → AI要約OK
- 企業プロジェクト → ローカル要約推奨
- OSS → どちらでもOK

## 💰 コスト試算

### OpenAI (gpt-4o-mini)

- 入力: $0.150 / 1M tokens
- 出力: $0.600 / 1M tokens
- 1日の日報: 約500 tokens (入力) + 100 tokens (出力)
- **月間コスト**: 約 $0.50 (営業日20日)

### Anthropic (claude-3-haiku)

- 入力: $0.25 / 1M tokens
- 出力: $1.25 / 1M tokens
- 1日の日報: 約500 tokens (入力) + 100 tokens (出力)
- **月間コスト**: 約 $0.40 (営業日20日)

## 🛠️ カスタマイズ

### ローカル要約のキーワードをカスタマイズ

`src/services/summarizer/local-summarizer.ts` を編集:

```typescript
// 重要なキーワードを追加
const importantKeywords = [
  'implement', '実装', 'fix', '修正', 'bug', 'バグ',
  'feature', '機能', 'release', 'リリース', 'deploy', 'デプロイ',
  'refactor', 'リファクタ', 'optimize', '最適化',
  // カスタムキーワードを追加
  'security', 'セキュリティ', 'performance', 'パフォーマンス',
];
```

### AI要約のプロンプトをカスタマイズ

`src/services/summarizer/api-summarizer.ts` の `buildPrompt` メソッドを編集

## ❓ トラブルシューティング

### ローカル要約が「本日の活動はありませんでした」と表示される

→ データが収集されていない可能性があります
```bash
# データ収集状況を確認
daily-report generate  # 要約なしで実行してデータを確認
```

### AI要約でエラーが発生する

→ APIキーとモデル名を確認
```bash
# APIキーが正しいか確認
echo $OPENAI_API_KEY

# モデル名が正しいか確認
daily-report generate --summarize \
  --summary-api openai \
  --summary-api-key $OPENAI_API_KEY \
  --summary-model gpt-4o-mini  # 正しいモデル名
```

### 要約の品質が低い

**ローカル要約の場合:**
- より多くのコミットメッセージを書く
- コミットメッセージを詳細にする
- タスク名を具体的にする

**AI要約の場合:**
- より高性能なモデルを使用 (gpt-4o, claude-3-5-sonnet)
- プロンプトをカスタマイズ

## 📚 参考リンク

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Anthropic API Documentation](https://docs.anthropic.com)
- [Natural NPM Package](https://www.npmjs.com/package/natural)
- [Compromise NPM Package](https://www.npmjs.com/package/compromise)
