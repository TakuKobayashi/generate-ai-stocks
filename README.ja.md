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

| プロジェクト                                                               | 説明                                                                                                                                                                               | status     |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [ai-chat-auto-set-key](./projects/ai-chat-auto-set-key/)                   | GitHubリポジトリのREADMEに記載されたMarkdownテーブルを毎日自動取得してCloudflare KVに保存し、そのデータをコンテキストとして使えるChatGPTライクなチャットUIを提供するシステムです。 | incubating |
| [ar-editor-preview](./projects/ar-editor-preview/)                         | ARCore/ARKitの実機ARデータをLiveKitとProtocol BuffersでUnity Editorへ送信し、Unity上でARプレビューを行うためのマルチプラットフォーム開発環境。                                     | incubating |
| [ar-recorder](./projects/ar-recorder/)                                     | ARCore/ARKit 対応の AR 画面記録・共有ライブラリのモノリポジトリです。                                                                                                              | incubating |
| [attention-intervention-system](./projects/attention-intervention-system/) | ロック画面や通知に目標を表示し、スマートフォンを見るたびに目標を思い出せるアプリ                                                                                                   | incubating |
| [auto-product-video-generator](./projects/auto-product-video-generator/)   | WebアプリやCLIツール向けの、AIを活用したプロモーション動画生成ツールです。                                                                                                         | incubating |
| [clipboard-manager](./projects/clipboard-manager/)                         | クリップボードマネージャーアプリ                                                                                                                                                   | incubating |
| [daily-report-cli](./projects/daily-report-cli/)                           | エンジニア向け日報を自動生成するCLIツール。GitHub Actionsや業務自動化パイプラインでの活用を想定。                                                                                  | incubating |
| [devops-ai-agent](./projects/devops-ai-agent/)                             | GitHubのIssueをトリガーにAIがコードを修正してPRを自動作成するイベント駆動パイプライン。                                                                                            | incubating |
| [doc-scanner-unified](./projects/doc-scanner-unified/)                     | 画像から文字起こしを行うOCR対応のCLI / Web統合ドキュメントスキャンプロジェクト。文書電子化や自動化用途を想定。                                                                     | incubating |
| [email-auto-reply](./projects/email-auto-reply/)                           | メール返信文を自動生成するツールプロジェクト。返信下書きや業務効率化、自動応答基盤として活用可能。                                                                                 | incubating |
| [fullstack-image-converter](./projects/fullstack-image-converter/)         | 一括ファイル変換プラットフォーム。画像、動画、ドキュメントなど、すべてブラウザ上で処理されます。ファイルのアップロードは不要です。                                                 | incubating |
| [github-leak-detector](./projects/github-leak-detector/)                   | GitHub上でのソースコード流出や機密情報漏洩を検出するセキュリティ監視ツール。                                                                                                       | incubating |
| [heart-linker-app](./projects/heart-linker-app/)                           | アカウント登録不要で使える名刺交換アプリ。QR / Nearby(Bluetooth+Wi-Fi) / NFC の3方式で連絡先を交換できる。                                                                         | incubating |
| [nomikai](./projects/nomikai/)                                             | 急な飲み会やカジュアルな集まりに人を誘う・募集する・通知するためのソーシャルアプリ / Webサービス。                                                                                 | incubating |
| [noroshi-app](./projects/noroshi-app/)                                     | 位置情報ベースのAR狼煙アプリ。指定した地点で狼煙を上げ、ARカメラでその方向をのぞくと実際に狼煙が見えるアプリです。                                                                 | incubating |
| [offline-chat-app](./projects/offline-chat-app/)                           | WiFi不要でNearby Connections / MultipeerConnectivity を使ったオフラインチャットアプリ。                                                                                            | incubating |
| [PackingListApp](./projects/PackingListApp/)                               | 旅行や出張の持ち物リストを作成し、予定ごとのチェックリストとして管理できるAndroidネイティブアプリ。                                                                                | incubating |
| [phone-load-balancer](./projects/phone-load-balancer/)                     | Vonage Voice API + Cloudflare Workers + D1 + Hono + Next.js で構築したマルチテナント対応電話ロードバランサーです。                                                                 | incubating |
| [plateau-sniper-vs-guardman](./projects/plateau-sniper-vs-guardman/)       | スナイパー vs ボディガード 警備シミュレーション                                                                                                                                    | incubating |
| [recstudio](./projects/recstudio/)                                         | バックエンド不要でブラウザ上のみで画面録画と動画保存を実現するWebアプリケーション。                                                                                                | incubating |
| [signalforge](./projects/signalforge/)                                     | 日々のエンジニアリング業務から情報を収集し、実際に行った作業内容を把握した上で、プラットフォームに最適なコンテンツへと変換するツール。                                             | incubating |
| [stamp-rally](./projects/stamp-rally/)                                     | スタンプラリーを作成・共有・参加できるサービス。イベント、観光、地域活性化用途を想定。                                                                                             | incubating |

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

## リポジトリ運用方針

このリポジトリでは、まず `projects/` 配下でプロジェクトを管理します。

ある程度形になり、独立したリポジトリとして運用したくなった場合は GitHub 上で別リポジトリとして切り出します。

その後、Git Submodule として再度取り込むことで、

- プロジェクトごとの独立運用
- リポジトリの一覧管理
- portfolio自動生成

を両立しています。

運用イメージ:

    projects/
    ├── project-a
    ├── project-b
    └── project-c

↓

    projects/
    ├── project-a (Submodule)
    ├── project-b (Submodule)
    └── project-c

### プロジェクトを独立リポジトリ化する

まず対象ディレクトリへ移動します。

    cd projects/my-project

GitHubで新規リポジトリを作成後、pushします。

    git init
    git add .
    git commit -m "Initial commit"

    git branch -M main

    git remote add origin https://github.com/<user>/my-project.git

    git push -u origin main

親リポジトリ側からディレクトリを削除します。

    git rm -r projects/my-project

    git commit -m "Remove local project"

その後 Git Submodule として再登録します。

    git submodule add https://github.com/<user>/my-project.git projects/my-project

    git commit -m "Add submodule"

### Submodule込みでcloneする

    git clone --recursive <repository-url>

### 後からSubmoduleを取得する

    git submodule update --init --recursive

### 全Submoduleを最新化する

    git submodule update --remote

### 誤って追加したSubmoduleを削除する

    git submodule deinit -f projects/my-project

    git rm -f projects/my-project

    rm -rf .git/modules/projects/my-project

---

## 最終ビジョン

generate-ai-stocks は、  
思いついたアイディアを時間不足で終わらせず、生成AIによって先に形にし、必要ならそのまま世に出せる状態まで加速するための開発資産基盤です。
