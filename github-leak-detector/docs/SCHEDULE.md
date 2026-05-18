# ローカル定期実行の設定例

## 1. Cron（Linux/Mac）

### 毎日午前9時に実行

```bash
# crontabを編集
crontab -e

# 以下を追加
0 9 * * * cd /path/to/your/repository && /usr/local/bin/github-leak-detector detect --notify --notification-url https://hooks.slack.com/services/XXX/YYY/ZZZ >> /var/log/leak-detector.log 2>&1
```

### 6時間ごとに実行

```bash
0 */6 * * * cd /path/to/your/repository && /usr/local/bin/github-leak-detector detect --api-token YOUR_TOKEN >> /var/log/leak-detector.log 2>&1
```

## 2. スケジュールコマンドを使用

### バックグラウンドで実行

```bash
cd /path/to/your/repository
nohup github-leak-detector schedule --interval 60 --notify --notification-url YOUR_WEBHOOK > leak-detector.log 2>&1 &
```

### Systemd（Linux）

`/etc/systemd/system/github-leak-detector.service` を作成:

```ini
[Unit]
Description=GitHub Leak Detector
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/your/repository
ExecStart=/usr/local/bin/github-leak-detector schedule --interval 60 --notify --notification-url YOUR_WEBHOOK
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

有効化して起動:

```bash
sudo systemctl enable github-leak-detector
sudo systemctl start github-leak-detector
sudo systemctl status github-leak-detector
```

## 3. Windows タスクスケジューラ

### PowerShellスクリプト作成

`run-leak-detector.ps1`:

```powershell
Set-Location "C:\path\to\your\repository"
github-leak-detector detect --notify --notification-url "YOUR_WEBHOOK" | Out-File -Append "leak-detector.log"
```

### タスクスケジューラで設定

1. タスクスケジューラを開く
2. 「基本タスクの作成」を選択
3. トリガー: 毎日または間隔を指定
4. 操作: プログラムの開始
   - プログラム: `powershell.exe`
   - 引数: `-File "C:\path\to\run-leak-detector.ps1"`

## 4. Docker

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# グローバルにインストール
RUN npm install -g github-leak-detector

# リポジトリをマウントして実行
CMD ["github-leak-detector", "schedule", "--interval", "60"]
```

### docker-compose.yml

```yaml
version: '3.8'
services:
  leak-detector:
    build: .
    volumes:
      - /path/to/your/repository:/repo
    working_dir: /repo
    environment:
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    command: >
      github-leak-detector schedule
      --interval 60
      --notify
      --notification-url ${SLACK_WEBHOOK_URL}
    restart: unless-stopped
```

実行:

```bash
docker-compose up -d
```

## 5. PM2（Node.jsプロセスマネージャ）

### インストール

```bash
npm install -g pm2
```

### 設定ファイル作成

`ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'github-leak-detector',
    script: 'github-leak-detector',
    args: 'schedule --interval 60 --notify --notification-url YOUR_WEBHOOK',
    cwd: '/path/to/your/repository',
    env: {
      GITHUB_TOKEN: 'your-github-token'
    },
    autorestart: true,
    max_memory_restart: '500M'
  }]
};
```

### 起動

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # システム起動時に自動起動
```

## 環境変数の設定

### Linux/Mac (.bashrc / .zshrc)

```bash
export GITHUB_TOKEN="your-github-token"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/XXX/YYY/ZZZ"
```

### Windows (環境変数)

```powershell
[System.Environment]::SetEnvironmentVariable('GITHUB_TOKEN', 'your-github-token', 'User')
[System.Environment]::SetEnvironmentVariable('SLACK_WEBHOOK_URL', 'your-webhook-url', 'User')
```

### .envファイル（プロジェクトルート）

```
GITHUB_TOKEN=your-github-token
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
```

## ログローテーション

### logrotate設定（Linux）

`/etc/logrotate.d/github-leak-detector`:

```
/var/log/leak-detector.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    create 0644 your-username your-username
}
```
