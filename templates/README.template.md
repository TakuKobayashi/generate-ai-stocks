# generate-ai-stocks

生成AIに作らせたそれぞれの各種開発プロジェクトをストック・管理する統合リポジトリです。

## 開発フェーズ

- incubating → 開発中
- validating → 動作確認中
- launched → ローンチ済（submodule化候補）
- archived → 保守停止

---

## プロジェクト一覧

| プロジェクト | 説明 | status |
| ------------ | ---- | ------ |

{{PROJECT_TABLE}}

---

## 開発フロー

### 新規プロジェクト追加

```bash
npm run projects:add -- --name my-new-project
```

### portfolio / README同期

```bash
npm run projects:sync
```

### project.yml検証

```bash
npm run projects:validate
```

---

## Submodule運用（ローンチ後）

### 初回clone

```bash
git clone --recurse-submodules <repo-url>
```

### 他PCで最新取得（親 + 全submodule）

```bash
npm run projects:pull
```

### 開発内容を全反映

```bash
npm run projects:push
```

### 状態確認

```bash
npm run projects:status
```

---

## Submodule重要ポイント

- 親repoはsubmoduleのcommit pointerを管理
- 子repo更新後は親repo側pointer更新も必要
- projects:pull → 全PC同期用
- projects:push → 全更新反映用

---

## 運用戦略

### Phase1:

Monorepo高速開発

### Phase2:

Launch済プロジェクトを独立repo化

### Phase3:

generate-ai-stocks に submodule統合

```

```
