# Daily Report CLI - 使用開始チェックリスト

このチェックリストに従って、Daily Report CLIをセットアップしてください。

## ✅ 初期セットアップ

- [ ] Node.js (v16以上)がインストールされている
- [ ] プロジェクトをクローンまたはダウンロード
- [ ] `npm install`で依存関係をインストール
- [ ] `npm run build`でビルド成功
- [ ] (オプション) `npm link`でグローバルインストール

## ✅ 基本動作確認

- [ ] `daily-report init`でテンプレート作成成功
- [ ] Gitリポジトリ内で`daily-report generate`実行
- [ ] `daily-report-YYYY-MM-DD.md`ファイルが生成される
- [ ] ローカルGitのコミットが日報に含まれている

## ✅ GitHub連携(推奨)

### 方法1: Personal Access Token (簡単)

- [ ] https://github.com/settings/tokens でトークン作成
- [ ] `repo`と`user`スコープを選択
- [ ] `daily-report generate --github-token <TOKEN>`で実行成功

### 方法2: OAuth認証 (推奨・継続利用向け)

- [ ] GitHub OAuth Appを作成
- [ ] 環境変数`GITHUB_CLIENT_ID`と`GITHUB_CLIENT_SECRET`を設定
- [ ] `daily-report auth github`で認証成功
- [ ] `daily-report auth status`でGitHubが"認証済み"と表示
- [ ] `daily-report generate`でGitHubデータが取得される

## ✅ タスク管理ツール連携(オプション)

### Asana

- [ ] Asana OAuth Appを作成
- [ ] 環境変数を設定
- [ ] `daily-report auth asana`で認証成功
- [ ] 日報にAsanaタスクが含まれる

### Google Tasks

- [ ] Google Cloud Projectを作成
- [ ] Google Tasks APIを有効化
- [ ] OAuth認証情報を作成
- [ ] 環境変数を設定
- [ ] `daily-report auth google-tasks`で認証成功
- [ ] 日報にGoogle Tasksが含まれる

### Trello

- [ ] https://trello.com/app-key でAPIキー取得
- [ ] 環境変数`TRELLO_API_KEY`を設定
- [ ] `daily-report auth trello`で認証成功
- [ ] 日報にTrelloカードが含まれる

## ✅ テンプレートカスタマイズ

- [ ] `template.md`を編集
- [ ] カスタムテンプレートで日報生成成功
- [ ] Handlebarsヘルパー関数が動作
- [ ] 条件分岐(if/each)が正しく動作

## ✅ GitHub Actions設定(オプション)

- [ ] GitHubリポジトリにプッシュ
- [ ] リポジトリのSecretsを設定:
  - [ ] `GH_PERSONAL_TOKEN`
  - [ ] `ASANA_TOKEN` (使用する場合)
  - [ ] `GOOGLE_TASKS_TOKEN` (使用する場合)
  - [ ] `TRELLO_TOKEN` (使用する場合)
  - [ ] `TRELLO_API_KEY` (使用する場合)
- [ ] ワークフローが手動実行可能
- [ ] スケジュール実行が動作(翌営業日確認)

## 🎯 使用シーン別チェック

### 個人開発者

- [x] Git
- [ ] GitHub
- [ ] お好みのタスク管理ツール1つ

### チーム開発

- [x] Git
- [x] GitHub
- [x] Asana または Google Tasks または Trello
- [ ] GitHub Actions定期実行

### フリーランス/複数プロジェクト

- [x] Git
- [x] GitHub
- [x] 複数のタスク管理ツール
- [ ] プロジェクト別テンプレート作成

## 📝 トラブルシューティングチェック

問題が発生した場合:

- [ ] `npm run build`が成功している
- [ ] 環境変数が正しく設定されている
- [ ] `daily-report auth status`で認証状態を確認
- [ ] カレントディレクトリがGitリポジトリである
- [ ] ポート3000-3003がファイアウォールで許可されている
- [ ] `~/.daily-report-cli/tokens.json`が存在する(OAuth認証後)

## 🚀 次のステップ

- [ ] 定期実行を設定(cron / Task Scheduler / GitHub Actions)
- [ ] チーム向けテンプレートを作成
- [ ] Slack/Discord連携を検討
- [ ] 他のGitホスティングサービス追加を検討

---

## 完了後

全てのチェックが完了したら、あなたの日報作成は自動化されています! 🎉

毎日の作業終了時に`daily-report generate`を実行するだけで、
その日の全ての活動がまとまった日報が生成されます。
