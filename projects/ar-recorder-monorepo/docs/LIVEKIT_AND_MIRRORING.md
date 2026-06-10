# LiveKit WebRTC & ローカルミラーリング 技術ドキュメント

## 1. LiveKit 概要とアーキテクチャ

```
┌────────────────────────────────────────────────────────────────┐
│                 LiveKit Server (SFU)                           │
│         services/livekit/  で Docker 起動                      │
└──────────────────┬───────────────────────┬─────────────────────┘
                   │                       │
     ┌─────────────▼───────────┐  ┌────────▼──────────────────┐
     │  AR 端末（送信側）       │  │  視聴端末（受信側）        │
     │  ARLiveKitPublisher     │  │  ARLiveKitReceiver        │
     │  ・AR画面キャプチャ      │  │  ・VideoTrack 受信        │
     │  ・VideoTrack 公開      │  │  ・RawImage 表示          │
     └─────────────────────────┘  └───────────────────────────┘
```

### SFU（Selective Forwarding Unit）の役割

LiveKit の SFU は各参加者のストリームを受け取り、他の参加者へ選択的に転送します。
P2P と異なり参加者が増えても送信側の帯域は 1 本で済みます。

---

## 2. LiveKit サーバーのセットアップ

### ローカル開発（Docker）

```bash
cd services/livekit
docker compose up -d
```

起動確認：
```bash
curl http://localhost:7880/
# → {"status":"ok"}
```

### 設定ファイル（livekit.yaml）の主要項目

| 項目 | 値 | 説明 |
|------|-----|------|
| `port` | 7880 | HTTP/WebSocket ポート |
| `rtc.tcp_port` | 7881 | TCP フォールバック |
| `rtc.udp_port` | 7882 | UDP メイン通信 |
| `rtc.use_external_ip` | false | LAN 内のみなら false |
| `keys.devkey` | secret | API Key: devkey |

---

## 3. ローカルネットワーク内での LiveKit ミラーリング

LiveKit（WebRTC）はローカルネットワーク内でも追加実装なしで動作します。

### ICE 候補の優先順位

```
Host candidate（同一サブネット直接接続）  ←── 最優先
  ↓ 失敗時
Server-reflexive（STUN 経由）
  ↓ 失敗時
Relay（TURN 中継）
```

同一 Wi-Fi LAN 内では **Host candidate** が選ばれるため、
インターネット・STUN・TURN サーバーは不要です。

### LAN ミラーリング手順

```
[ AR 端末 ] ── Wi-Fi ── [ LiveKit Server (PC) ] ── Wi-Fi ── [ 視聴端末 ]
                           ws://192.168.1.xxx:7880
```

1. **PC で LiveKit を起動**
   ```bash
   cd services/livekit
   # livekit.yaml の rtc.ips に PC の LAN IP を追加
   # ips:
   #   - 192.168.1.xxx
   docker compose up -d
   ```

2. **AR 端末（Unity）** — ARLiveKitPublisher の設定:
   ```
   Server URL: ws://192.168.1.xxx:7880
   Room Name: demo-room
   API Key: devkey / Secret: secret
   ```

3. **視聴端末** — 以下のいずれか:
   - Unity アプリで ARLiveKitReceiver を同じ設定で接続
   - ブラウザで https://meet.livekit.io にアクセス → Custom Server URL に `ws://192.168.1.xxx:7880` を入力 → 同じルームに参加

---

## 4. TCP ベースのローカルミラーリング

LiveKit を使わずサーバー不要で動作するシンプルな実装です。
完全オフライン・デモ環境に最適です。

### プロトコル仕様

```
┌──────────────┬──────────────────────────────────┐
│  4 bytes     │  N bytes                         │
│  Frame Size  │  JPEG データ                      │
│  (Int32 LE)  │                                  │
└──────────────┴──────────────────────────────────┘
```

### JPEG 品質とスループット目安

| 品質 | フレームサイズ目安 | 30fps 帯域 | 推奨環境 |
|------|----------------|------------|--------|
| 95   | ~150 KB        | ~36 Mbps   | 有線 LAN |
| 75   | ~60 KB         | ~14 Mbps   | Wi-Fi（デフォルト） |
| 50   | ~30 KB         | ~7 Mbps    | モバイルホットスポット |

### 接続手順

**送信側（AR 端末）:**
1. `ARLocalMirrorSender` が自動でサーバー起動（`autoStart=true`）
2. コンソールに表示される IP アドレスを確認
3. `LAN IP:9000` を視聴側に伝える

**受信側（別端末）:**
1. `ARLocalMirrorReceiver` に送信側 IP とポートを入力
2. Connect ボタンを押す

---

## 5. LiveKit vs TCP ミラーリング 比較

| 観点 | LiveKit | TCP ミラーリング |
|------|---------|----------------|
| 遅延 | 100–300 ms | 50–150 ms |
| 映像品質 | H.264 適応ビットレート | JPEG（固定品質） |
| 外部サーバー | ◯（LiveKit SFU） | ✕ |
| 複数視聴者 | ◯（SFU が中継） | ◯（全員に送信） |
| インターネット経由 | ◯ | △（推奨しない） |
| セットアップ難易度 | 中（Docker 1 コマンド） | 低（アプリのみ） |
| 本番運用 | ◎ | △ |
| 完全オフライン | △ | ◎ |

### 選択指針

```
インターネット経由 or 複数視聴者 or 高品質
  → LiveKit（ARLiveKitPublisher / Receiver）

完全オフライン or サーバー不要 or デモ最優先
  → TCP ミラーリング（ARLocalMirrorSender / Receiver）

LAN 内デモでコスト最小
  → LiveKit（ローカルサーバー）または TCP ミラーリング
```

---

## 6. セキュリティ注意事項

### LiveKit トークン管理

本番環境では以下を遵守してください：

- ❌ Unity クライアントに API Secret を埋め込まない
- ✅ `services/signaling` のトークン発行エンドポイントを使用
- ✅ トークン TTL を短く設定（デフォルト: 1 時間）

```
Unity クライアント → GET /token → シグナリングサーバー → JWT 返却
Unity クライアント → ws://livekit:7880（JWT 付き）→ LiveKit Server
```

### TCP ミラーリングのセキュリティ

TCP ミラーリングは**暗号化なし**の平文通信です。
- LAN 内のデモ・開発環境専用
- 公開ネットワークでは使用しないこと

---

## 7. トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| LiveKit 接続できない | サーバー未起動 | `docker compose up -d` を確認 |
| 映像が届かない | CanPublish=false | トークンの権限を確認 |
| LAN 端末から繋がらない | IP 未設定 | `livekit.yaml` の `rtc.ips` を設定 |
| TCP 接続できない | IP/ポート誤り | `mirrorSender.LocalIPAddress` をログで確認 |
| 映像がカクつく | 帯域不足 | `jpegQuality` を下げる / 解像度を落とす |
| Android カメラが黒い | 権限未取得 | `PermissionUtils.RequestAllPermissions()` |

---

## 8. 参考リンク

- [LiveKit 公式ドキュメント](https://docs.livekit.io)
- [livekit/client-sdk-unity](https://github.com/livekit/client-sdk-unity)
- [LiveKit Cloud（無料枠あり）](https://cloud.livekit.io)
- [Unity WebRTC パッケージ](https://docs.unity3d.com/Packages/com.unity.webrtc@3.0)
- [LiveKit Docker イメージ](https://hub.docker.com/r/livekit/livekit-server)
