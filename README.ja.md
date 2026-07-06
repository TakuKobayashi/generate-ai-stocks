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

| プロジェクト                                                                 | 説明                                                                                                                                                                                | status     |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [ai-agent-demo-genarator](./projects/ai-agent-demo-genarator/)               | GitHubのIssueをトリガーにAIがコードを修正し、自動的にプルリクエストを作成するDevOpsパイプライン。Google CloudまたはCloudflareとローカルLLMを用いたコスト効率の良い構成を選択可能。  | incubating |
| [ai-chat-auto-set-key](./projects/ai-chat-auto-set-key/)                     | GitHubのリポジトリのREADMEテーブルを毎日自動的に取得し、Cloudflare KVに保存して、そのデータをコンテキストとして利用できるChatGPTのようなチャットUIを提供します。                    | incubating |
| [aozora-map](./projects/aozora-map/)                                         | Blueskyに投稿された写真の位置情報を地図上に表示するウェブアプリケーションです。ReactとCloudflare Workersを使用しています。                                                          | incubating |
| [ar-editor-preview](./projects/ar-editor-preview/)                           | ARCore/ARKitの実機ARデータをLiveKitとProtocol BuffersでUnity Editorへ送信し、Unity上でARプレビューを行うためのマルチプラットフォーム開発環境。                                      | incubating |
| [ar-recorder](./projects/ar-recorder/)                                       | ARCore/ARKitに対応したAR画面の録画・共有ライブラリをUnityで利用するためのモノレポです。LiveKitによるライブストリーミング機能も備えています。                                        | incubating |
| [ar-timecapsule](./projects/ar-timecapsule/)                                 |                                                                                                                                                                                     | incubating |
| [attention-intervention-system](./projects/attention-intervention-system/)   | Compose、Hilt、Room を使用した Android アプリケーションで、ユーザーインタラクションや特定のタスクに焦点を当てている可能性があります。                                               | incubating |
| [auto-product-video-generator](./projects/auto-product-video-generator/)     | ウェブアプリケーションやコマンドラインインターフェース向けのプロモーション動画を自動生成するツールです。シナリオ作成、録画、ナレーション、レンダリングを自動化します。              | incubating |
| [background-speech-recognizer](./projects/background-speech-recognizer/)     | マイク音声をローカルで常時録音し、VAD と whisper.cpp を使ってリアルタイムに文字起こしする Android アプリおよび CLI ツール。                                                         | incubating |
| [clipboard-manager](./projects/clipboard-manager/)                           | AndroidとiOSの両方に対応したクリップボードマネージャーで、キーボードやウィジェット機能、AdMobやサブスクリプションによる収益化オプションを備えています。                             | incubating |
| [daily-report-cli](./projects/daily-report-cli/)                             | エンジニア向け日報を自動生成するCLIツール。GitHub Actionsや業務自動化パイプラインでの活用を想定。                                                                                   | incubating |
| [doc-scanner-unified](./projects/doc-scanner-unified/)                       | 画像から文字起こしを行うOCR対応のCLI / Web統合ドキュメントスキャンプロジェクト。文書電子化や自動化用途を想定。                                                                      | incubating |
| [email-auto-reply](./projects/email-auto-reply/)                             | メール返信文を自動生成するツールプロジェクト。返信下書きや業務効率化、自動応答基盤として活用可能。                                                                                  | incubating |
| [fullstack-image-converter](./projects/fullstack-image-converter/)           | ConvertMateは、アップロードなしで画像、動画、ドキュメントをバッチ変換できるブラウザベースのプラットフォームです。                                                                   | incubating |
| [github-leak-detector](./projects/github-leak-detector/)                     | GitHub上でのソースコード流出や機密情報漏洩を検出するセキュリティ監視ツール。                                                                                                        | incubating |
| [heart-linker-app](./projects/heart-linker-app/)                             | アカウント登録なしで利用できる、QRコード、Nearby（Androidのみ）、NFCによる連絡先交換をサポートするクロスプラットフォームの名刺帳アプリです。                                        | incubating |
| [kayaba-broadway](./projects/kayaba-broadway/)                               | 仮想空間の 3D マップを歩き回りながらデジタルコンテンツを購入できるオンラインマーケット。Cloudflare Workers、Hono、Angular、PixiJS、LiveKit、PartyKit を組み合わせた構成。           | incubating |
| [medicine-manager-app](./projects/medicine-manager-app/)                     | AndroidとiOSの両方の実装を持つ薬管理アプリのモノレポで、現在データベーススキーマと基本的なチェックリスト画面が実装されています。                                                    | incubating |
| [nomikai](./projects/nomikai/)                                               | 急な飲み会やカジュアルな集まりに人を誘う・募集する・通知するためのソーシャルアプリ / Webサービス。                                                                                  | incubating |
| [noroshi-app](./projects/noroshi-app/)                                       | 指定した場所に狼煙を出現させ、ARカメラを通して見ると実際に狼煙が見える位置情報ベースのARアプリです。                                                                                | incubating |
| [offline-chat-app](./projects/offline-chat-app/)                             | WiFiなどのインターネット接続がなくても、Nearby ConnectionsやMultipeerConnectivityを使ってAndroidとiOSでオフラインチャットができるアプリを開発します。                               | incubating |
| [PackingListApp](./projects/PackingListApp/)                                 | 旅行やその他の機会のために、荷造りリストを作成・管理できるシンプルなAndroidアプリです。                                                                                             | incubating |
| [passport-nft](./projects/passport-nft/)                                     | Solana ベースの入出国 NFT スタンプ管理システム。React/Vite のフロントエンドと Cloudflare Workers、Hono、D1、Drizzle ORM による API で、パスポートと入出国スタンプを管理する。       | incubating |
| [phantomcat-landing](./projects/phantomcat-landing/)                         | ナイト・オブ・ザ・ファントムキャットプロジェクトの公式ウェブサイト。Next.jsとCloudflare Workersを使用して、ニュース記事やコンテンツ生成を管理しています。                           | incubating |
| [phone-load-balancer](./projects/phone-load-balancer/)                       | Vonage Voice API、Cloudflare Workers、D1、Hono、Next.js を使用して構築された、テナント構成と優先度に基づいて通話ルーティングを行うマルチテナント対応の電話ロードバランサーです。    | incubating |
| [plateau-sniper-vs-guardman](./projects/plateau-sniper-vs-guardman/)         | UnityとNext.jsで構築された、リアルタイムのインタラクションを可能にするスナイパー対ボディガードのシミュレーションゲームです。                                                        | incubating |
| [recstudio](./projects/recstudio/)                                           | バックエンド不要でブラウザ上のみで画面録画と動画保存を実現するWebアプリケーション。                                                                                                 | incubating |
| [remove-light-shadow-camera-app](./projects/remove-light-shadow-camera-app/) | Pixelスマートフォンのカメラ機能を模倣したAndroidアプリで、画像処理や位置情報データの統合などが含まれる可能性があります。                                                            | incubating |
| [research-examples](./projects/research-examples/)                           | SaaS、ツール、ライブラリ、クラウド機能などの使い方を調査するためのサンプルプロジェクト集。各技術の検証用コードや管理スクリプトをまとめている。                                      | incubating |
| [signalforge](./projects/signalforge/)                                       | SignalForgeは、エンジニアの作業ログを収集し、LinkedInやXなどのプラットフォーム向けにプロフェッショナルなコンテンツを作成するツールです。開発者自身のブランド構築を自動化します。    | incubating |
| [stamp-rally](./projects/stamp-rally/)                                       | スタンプラリーを作成・共有・参加できるサービス。イベント、観光、地域活性化用途を想定。                                                                                              | incubating |
| [tappun-app-studio](./projects/tappun-app-studio/)                           | Next.js、TypeScript、Framer Motion を使用して構築された、モバイルアプリを紹介するゲーム風のポートフォリオウェブサイトです。                                                         | incubating |
| [tappunpages](./projects/tappunpages/)                                       | Next.jsとTypeScriptで構築された、個人のプロジェクトやスキルを紹介するポートフォリオサイト。Cloudflare Workersを利用してパフォーマンスを最適化し、グローバルな展開に対応しています。 | incubating |

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
