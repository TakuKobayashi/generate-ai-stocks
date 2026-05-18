# generate-ai-stocks

generate-ai-stocks は、  
時間的制約で埋もれがちなアイディアを、生成AIでまず“動く形”として具現化し、  
改善・統合・公開可能な開発資産として蓄積していくための統合リポジトリです。

---

## generate-ai-stocks の目的

- アイディアを構想段階で止めない
- 初期実装の速度を最大化する
- まず動く状態にして判断しやすくする
- 改善・再利用・統合しやすい形で蓄積する
- 有望なものは独立運用・公開へ進める

---

## 基本方針

### 1. まず“動く形”にする
生成AIを活用して、ゼロからすべてを手作業で作る時間を圧縮し、  
まず一定水準で可動する状態まで高速に到達することを優先します。

### 2. 調整・改善はその後
可動状態になっていれば、
- 必要な改善点の判断
- 他プロジェクトへの統合
- 他者への説明
- 公開判断
が大幅に容易になります。

### 3. サンプルや技術検証も資産化
サンプル用途や学習目的のプロジェクトであっても、  
“ちゃんと動く” 状態で蓄積することで、
将来的な転用・統合・再利用コストを下げます。

---

## プロジェクトカテゴリ

### Product Candidate
公開・サービス化・収益化候補

### Utility / Automation
CLI / GitHub Actions / 自動化基盤

### Technical Asset
技術検証 / サンプル / 将来統合用

---

## 開発フェーズ
- incubating → アイディア具現化中
- validating → 改善・運用調整中
- launched → 公開 / 独立運用可能
- archived → 保守停止 / 技術資産化

---

## プロジェクト一覧

| プロジェクト | 説明 | status |
|------|------|------|
| [chat-app](./projects/chat-app/) | partykitでチャットアプリをサンプルとして作成したプロジェクト、様々なプラットフォームで動くサンプルを作成 | incubating |
| [daily-report-cli](./projects/daily-report-cli/) | エンジニア向け、日報自動作成ツール | incubating |
| [doc-scanner-unified](./projects/doc-scanner-unified/) | 画像から文字におこしてくれるCLIツール、Webサービス | incubating |
| [email-auto-reply](./projects/email-auto-reply/) | メールの返答を自動的に作成してくれるツールプロジェクト | incubating |
| [gather-app](./projects/gather-app/) | Gatherのようなバーチャルワークスペースサービス、PartyKitとLiveKitを使ったWebSocketとWebRTCを使ったサービスのサンプル | incubating |
| [github-leak-detector](./projects/github-leak-detector/) | Github上にソースコードが流出していないか検出するツール | incubating |
| [nomikai](./projects/nomikai/) |  | incubating |
| [recstudio](./projects/recstudio/) | ブラウザ上で画面録画を行い動画ファイルとして保存することができるWebサイト。バックエンド不使用。 | incubating |
| [stamp-rally](./projects/stamp-rally/) | スタンプラリーの作成と共有をして遊ぶことができるサービス | incubating |

---

## 開発フロー

### 新規プロジェクト追加
```bash
npm run projects:add -- --name my-new-project --description "Project description"
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
- generate-ai-stocks 配下で従来通り開発可能
- ローンチ後は独立repo化可能
- 他PCでも同一構成再現可能
- 親repoは統合管理母艦として機能

---

## 運用戦略

### Phase1:
Idea → Generate → Working Prototype  
生成AIでアイディアを高速に具現化し、まず動く形にする

### Phase2:
Refine / Integrate  
改善・調整・統合によって価値を高める

### Phase3:
Launch / Spin-out  
有望プロジェクトを独立repo化し、公開・運用する

---

## 最終ビジョン

generate-ai-stocks は、  
**「思いついたアイディアを時間不足で終わらせず、生成AIによって先に形にし、必要ならそのまま世に出せる状態まで加速するための開発資産基盤」**  
として進化していきます。