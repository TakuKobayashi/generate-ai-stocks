# generate-ai-stocks

[English README](./README.md)

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
  が容易になります。

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
| ------------ | ---- | ------ |
| [aozora-map](./projects/aozora-map/) |  | incubating |
| [app-studio](./projects/app-studio/) | モバイルアプリの紹介やプロモーションページを構築するためのNext.js製アプリスタジオサイト。 | incubating |
| [chat-app](./projects/chat-app/) | PartyKitを活用し、リアルタイム通信・WebSocket構成・無料運用可能性を学ぶためのマルチプラットフォーム対応チャットアプリサンプル。 | incubating |
| [daily-report-cli](./projects/daily-report-cli/) | エンジニア向け日報を自動生成するCLIツール。GitHub Actionsや業務自動化パイプラインでの活用を想定。 | incubating |
| [doc-scanner-unified](./projects/doc-scanner-unified/) | 画像から文字起こしを行うOCR対応のCLI / Web統合ドキュメントスキャンプロジェクト。文書電子化や自動化用途を想定。 | incubating |
| [email-auto-reply](./projects/email-auto-reply/) | メール返信文を自動生成するツールプロジェクト。返信下書きや業務効率化、自動応答基盤として活用可能。 | incubating |
| [gather-app](./projects/gather-app/) | Gather風バーチャルワークスペースサービス。PartyKitとLiveKitを用いたWebSocket / WebRTC構成やオンライン空間設計を検証。 | incubating |
| [github-leak-detector](./projects/github-leak-detector/) | GitHub上でのソースコード流出や機密情報漏洩を検出するセキュリティ監視ツール。 | incubating |
| [kayaba-broadway](./projects/kayaba-broadway/) |  | incubating |
| [nomikai](./projects/nomikai/) | 急な飲み会やカジュアルな集まりに人を誘う・募集する・通知するためのソーシャルアプリ / Webサービス。 | incubating |
| [PackingListApp](./projects/PackingListApp/) | 旅行や出張の持ち物リストを作成し、予定ごとのチェックリストとして管理できるAndroidネイティブアプリ。 | incubating |
| [passport-nft](./projects/passport-nft/) |  | incubating |
| [recstudio](./projects/recstudio/) | バックエンド不要でブラウザ上のみで画面録画と動画保存を実現するWebアプリケーション。 | incubating |
| [stamp-rally](./projects/stamp-rally/) | スタンプラリーを作成・共有・参加できるサービス。イベント、観光、地域活性化用途を想定。 | incubating |

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

## 最終ビジョン

generate-ai-stocks は、  
思いついたアイディアを時間不足で終わらせず、生成AIによって先に形にし、必要ならそのまま世に出せる状態まで加速するための開発資産基盤です。
