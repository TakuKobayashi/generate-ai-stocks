# PLATEAU Sniper Simulation

Unity 6 + Next.js/PlayCanvas による  
**スナイパー vs ボディガード 警備シミュレーション**

---

## 🏗️ アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  シグナリング (ICE/SDP交換のみ)                          │
│  PartyKit WebSocket                                      │
│  packages/signaling/src/server.ts                        │
└───────────────┬─────────────────┘
                │ wss://...partykit.dev/party/<roomId>
     ┌──────────┴──────────┐
     │                     │
┌────▼────┐           ┌────▼────┐
│ Sniper  │           │Bodyguard│  (複数可)
│ Client  │◄─────────►│ Client  │
└─────────┘  WebRTC   └─────────┘
          DataChannel
          unreliable/unordered
          = UDP 投げっぱなし
          MessagePack バイナリ

┌──────────────────────────────────────────────────────────┐
│  REST API (ルーム管理・将来拡張用)                        │
│  Cloudflare Workers + Hono                               │
│  packages/server/                                        │
└──────────────────────────────────────────────────────────┘
```

### データフロー

```
[位置送信 @ 20fps]
SniperController.Update()
  → RoomClient.SendSniperState()
    → WebRtcPeer.Send(DcCodec.Encode(DcSniperState))  ← MessagePack
      → DataChannel (unreliable/unordered) ──────────►  相手側
                                                          ↓
                                             RoomClient.OnSniperState
                                                          ↓
                                             RemotePlayerRegistry
                                             (Lerp補間でゴースト更新)

[シグナリング @ 接続確立時のみ]
PartyKit ─ offer/answer/ice ─► WebRtcPeer
  → RTCPeerConnection.SetLocalDescription/SetRemoteDescription
```

### STUNサーバー (Public 無料)
```
stun:stun.l.google.com:19302
stun:stun1.l.google.com:19302
stun:stun.mozilla.org
```

---

## 📁 モノレポ構成

```
plateau-sniper/
├── package.json              (pnpm workspace root)
├── pnpm-workspace.yaml
├── packages/
│   ├── shared/               @plateau-sniper/shared
│   │   └── src/index.ts      全メッセージ型定義 (TS/C# 共通)
│   │
│   ├── signaling/            @plateau-sniper/signaling
│   │   ├── partykit.json
│   │   └── src/server.ts     PartyKit WebSocket シグナリングサーバー
│   │
│   ├── server/               @plateau-sniper/server
│   │   ├── wrangler.jsonc
│   │   └── src/index.ts      Hono REST API (Cloudflare Workers)
│   │
│   └── web/                  @plateau-sniper/web
│       ├── next.config.ts    SSG + PlayCanvas
│       └── src/
│           ├── app/          Next.js App Router
│           ├── components/   HUD / Lobby / Result UI
│           ├── hooks/        useGame (React状態管理)
│           └── lib/
│               ├── signaling/   SignalingClient.ts
│               ├── webrtc/      PeerConnection.ts / RoomClient.ts
│               ├── msgpack/     codec.ts (encode/decode)
│               └── playcanvas/  GameApp.ts
│
└── unity/PlateauSniperGame/
    ├── packages.config       NuGetForUnity
    │   ├── MessagePack 2.5.x
    │   ├── Websocket.Client 5.x
    │   └── Newtonsoft.Json 13.x
    └── Assets/Scripts/
        ├── Network/
        │   ├── DcMessages.cs         MessagePackペイロード型 + DcCodec
        │   ├── SignalingClient.cs     PartyKit WS (Websocket.Client)
        │   ├── WebRtcPeer.cs          Unity WebRTC DataChannel
        │   ├── RoomClient.cs          メッシュ管理 (MonoBehaviour)
        │   ├── NetworkGameSync.cs     RoomClient↔GameManager橋渡し
        │   ├── RemotePlayerRegistry.cs ゴースト管理
        │   └── BulletEffectManager.cs
        ├── Core/             GameManager / PlateauSceneSetup / WebGLBridge
        ├── Player/Sniper/    SniperController / SniperInputActions
        ├── Player/Bodyguard/ BodyguardController / BodyguardInputActions
        ├── AI/               NpcGuard / VIPController / AudienceNPC
        ├── Detection/        DetectionManager
        ├── Game/             CoverPoint
        └── UI/               GameHUD / LobbyManager / SniperScopeUI
```

---

## 🚀 セットアップ

### 1. 依存インストール

```bash
pnpm install
pnpm build:shared
```

### 2. シグナリングサーバー (PartyKit) 起動

```bash
pnpm dev:signaling
# → ws://localhost:1999/party/<roomId>
```

### 3. REST API サーバー (Cloudflare Workers) 起動

```bash
pnpm dev:server
# → http://localhost:8787
```

### 4. Web クライアント (Next.js + PlayCanvas) 起動

```bash
pnpm dev:web
# → http://localhost:3000
```

### 5. Unity プロジェクト

```
1. Unity 6 (6000.0.x) で unity/PlateauSniperGame を開く
2. Window > Package Manager > com.unity.webrtc をインストール
3. NuGetForUnity を導入後 packages.config で自動インストール
4. PLATEAU SDK で都市データをインポート
5. RoomClient の Inspector で useLocalServer=true を確認
```

---

## 🌐 デプロイ

### PartyKit

```bash
pnpm deploy:signaling
# partykit.json の name に合わせた URL が発行される
```

### Cloudflare Workers

```bash
# wrangler.jsonc の PARTYKIT_HOST を本番 URL に更新
pnpm deploy:server
```

### Next.js (Cloudflare Pages / Vercel)

```bash
pnpm --filter @plateau-sniper/web build
# out/ ディレクトリを静的ホスティングにデプロイ
```

---

## ⚙️ 環境変数

### Web (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_PARTYKIT_HOST=localhost:1999
```

### Unity (RoomClient Inspector)
```
useLocalServer:  true (開発) / false (本番)
localApiUrl:     http://localhost:8787
localPartykit:   localhost:1999
serverBaseUrl:   https://plateau-sniper.your-name.workers.dev
partykitHost:    plateau-sniper-signaling.your-name.partykit.dev
```

---

## 📡 WebRTC DataChannel 仕様

| 項目           | 値                          |
|---------------|----------------------------|
| チャンネル名   | `"position"`               |
| ordered       | `false` (順序保証なし)      |
| maxRetransmits| `0` (再送なし = UDP)        |
| フォーマット   | MessagePack 配列            |
| 送信レート     | 20fps                       |
| STUNサーバー   | Google / Mozilla (Public)  |

### MessagePack ペイロードサイズ目安

| メッセージ      | バイト数 |
|---------------|---------|
| DcSniperState  | ~35B    |
| DcBodyguardState| ~40B   |
| DcSniperFired  | ~45B    |
| DcGameEvent    | ~10B    |

---

## 🎮 ゲームルール

| ロール | 操作 | 勝利条件 |
|--------|------|---------|
| スナイパー | WASD移動 / 右クリックでAim切替(10秒) / 左クリック射撃 | VIP命中 |
| ボディガード | WASD移動 / E: VIP誘導 / Q: 警備員派遣 | スナイパーを3秒視認 or 時間切れ |
