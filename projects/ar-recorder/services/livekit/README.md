# LiveKit サービス

AR Recorder の WebRTC 機能で使用する LiveKit SFU サーバーです。

## 起動方法

```bash
cd services/livekit

# サーバーのみ起動（通常）
docker compose up -d

# ダッシュボードも含めて起動
docker compose --profile playground up -d

# ログ確認
docker compose logs -f livekit

# 停止
docker compose down
```

## 接続情報

| 項目 | 値 |
|------|-----|
| WebSocket URL | `ws://localhost:7880` |
| API Key | `devkey` |
| API Secret | `secret` |
| HTTP ポート | `7880` |
| TCP ポート | `7881` |
| UDP ポート | `7882` |

## ローカル LAN の別端末から接続する場合

1. このサーバーを起動している PC の LAN IP を確認：
   ```bash
   # macOS / Linux
   ip route get 1 | awk '{print $7}'
   # Windows
   ipconfig | findstr "IPv4"
   ```

2. `livekit.yaml` の `rtc.ips` に LAN IP を追記：
   ```yaml
   rtc:
     ips:
       - 192.168.1.xxx   ← PC の LAN IP
   ```

3. Unity の LiveKit Publisher / Receiver で Server URL を変更：
   ```
   ws://192.168.1.xxx:7880
   ```

4. Docker Compose を再起動：
   ```bash
   docker compose restart livekit
   ```

## 本番環境への移行

1. `livekit.yaml` の `keys` を強力なシークレットに変更
2. `rtc.use_external_ip: true` に変更
3. TLS 証明書（HTTPS/WSS）を設定
4. または [LiveKit Cloud](https://cloud.livekit.io) を使用（無料枠あり）

## ファイアウォール設定

Unity アプリからアクセスできない場合は以下ポートを開放：

```bash
# iptables（Linux）
sudo iptables -A INPUT -p tcp --dport 7880 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 7881 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 7882 -j ACCEPT

# ufw（Ubuntu）
sudo ufw allow 7880/tcp
sudo ufw allow 7881/tcp
sudo ufw allow 7882/udp
```
