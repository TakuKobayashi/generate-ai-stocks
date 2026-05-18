# generate-ai-stocks

生成AIに作らせたそれぞれの各種開発プロジェクトを、  
**単なるアイデア集ではなく「技術検証・自動化・将来のローンチ候補」まで含めて体系的にストック・管理する統合リポジトリ** です。

---

# generate-ai-stocks の目的

generate-ai-stocks は、生成AIを活用して高速にプロジェクトを企画・構築し、  
それぞれを以下の3段階で運用する **AI駆動プロダクト研究所 / 開発資産管理基盤** です。

## 1. Sample（技術検証）
- PartyKit / LiveKit / WebRTC / OCR / GitHub API などの新技術検証
- 無料枠や低コスト環境でどこまで構築可能か確認
- 将来の本番プロジェクト用テンプレート化

## 2. CLI / Automation（自動化基盤）
- GitHub Actions
- Cron
- 定期監視
- 自動記事生成
- OCR処理
- セキュリティ監視

CLIツール群は単体利用だけでなく、  
**GitHub Actions による完全自動運用** を前提とした基盤として活用されます。

## 3. Launch Candidate（ローンチ候補）
- 実運用可能なWebサービス
- SaaS候補
- SEO / 収益化候補
- 独立リポジトリ化 + submodule管理

---

# generate-ai-stocks の強み

## 単なるポートフォリオではなく…
### 「AI × 技術検証 × 自動化 × 事業化」の一連フローを持つこと

- AIで高速試作
- 動作確認
- 改良
- ストック
- 自動化
- ローンチ判断
- 独立repo化

---

## 開発資産としての価値
- 再利用可能テンプレート
- GitHub Actions化しやすいCLI群
- 無料インフラ検証
- Submoduleによる段階的独立運用
- ポートフォリオとしても強い

---

# 開発フェーズ
- incubating → 開発中
- validating → 動作確認中
- launched → ローンチ済（submodule化候補）
- archived → 保守停止

---

# プロジェクト一覧

| プロジェクト | 説明 | status |
|------|------|------|
{{PROJECT_TABLE}}

---

# 開発フロー

## 新規プロジェクト追加
```bash
npm run projects:add -- --name my-new-project --description "Project description"
```

## portfolio / README同期
```bash
npm run projects:sync
```

## project.yml検証
```bash
npm run projects:validate
```

---

# Submodule運用（ローンチ後）

## 初回clone
```bash
git clone --recurse-submodules <repo-url>
```

## 他PCで最新取得（親 + 全submodule）
```bash
npm run projects:pull
```

## 開発内容を全反映
```bash
npm run projects:push
```

## 状態確認
```bash
npm run projects:status
```

---

# Submodule重要ポイント
- 親repoはsubmoduleのcommit pointerを管理
- 子repo更新後は親repo側pointer更新も必要
- generate-ai-stocks 直下で従来通り開発可能
- 他PCでも同一構成を再現可能
- projects:pull → 全PC同期用
- projects:push → 全更新反映用

---

# 推奨プロジェクト分類

## sample
技術検証 / 学習 / 無料インフラ研究  
例:
- chat-app
- gather-app

## cli
GitHub Actions / 自動化 / 定期実行基盤  
例:
- daily-report-cli
- github-leak-detector

## service
ローンチ候補 / SaaS / 独立運用  
例:
- recstudio
- stamp-rally

---

# 運用戦略

## Phase1:
Monorepo高速開発  
AIで大量試作 + 技術検証 + 資産化

## Phase2:
有望プロジェクトをLaunch  
project.yml整備 + 自動化 + 公開準備

## Phase3:
独立repo化 + Submodule統合  
generate-ai-stocks は「統合管理母艦」として機能

---

# 最終的なビジョン

generate-ai-stocks は  
**「生成AI時代における、プロダクト量産・検証・管理・独立運用のための母艦リポジトリ」**  
として進化していきます。