# シグナリングサーバー

LiveKit アクセストークンの発行と、カスタム WebSocket シグナリングを提供します。

## 役割

1. **トークン発行** — Unity クライアントが API Secret を持たなくて済むよう、  
   サーバーサイドで JWT トークンを生成して返す
2. **シグナリング中継** — WebSocket でルーム参加者への offer/answer/ICE を中継

## 起動方法

### ローカル（Node.js）

```bash
cd services/signaling
cp .env.example .env   # 必要に応じて編集
npm install
npm run dev            # 開発（nodemon で自動リロード）
npm start              # 本番
```

### Docker Compose（LiveKit と同時起動）

```bash
# まず LiveKit の共有ネットワークを作成
cd services/livekit
docker compose up -d

# シグナリングサーバーを追加起動
cd ../signaling
cp .env.example .env
docker compose up -d
```

## エンドポイント

### GET `/token`

LiveKit アクセストークンを発行する。

**クエリパラメーター:**

| パラメーター | 必須 | 説明 |
|------------|------|------|
| `room`     | ✓ | ルーム名（例: `ar-room`） |
| `identity` | ✓ | 参加者 ID（例: `AR-Publisher`） |
| `canPublish` | - | `true`（デフォルト）/ `false` |
| `canSubscribe` | - | `true`（デフォルト）/ `false` |

**レスポンス例:**
```json
{
  "token": "eyJhbGci...",
  "serverUrl": "ws://localhost:7880",
  "room": "ar-room",
  "identity": "AR-Publisher"
}
```

**Unity からの呼び出し例:**
```csharp
var url = "http://localhost:4000/token?room=ar-room&identity=AR-Publisher&canPublish=true";
var req = UnityWebRequest.Get(url);
await req.SendWebRequest();
var data = JsonUtility.FromJson<TokenResponse>(req.downloadHandler.text);
// data.token を LiveKit 接続に使用
```

### GET `/health`

死活確認。

```json
{ "status": "ok", "timestamp": "2024-02-09T12:00:00.000Z" }
```

### WebSocket `ws://localhost:4000/ws`

ルーム参加・シグナリングメッセージ中継。

**メッセージタイプ:**

| type | 方向 | 説明 |
|------|------|------|
| `join` | Client→Server | ルームに参加 |
| `room_joined` | Server→Client | 参加完了 + 既存参加者リスト |
| `peer_joined` | Server→Client（ブロードキャスト） | 他参加者が入室 |
| `peer_left` | Server→Client（ブロードキャスト） | 他参加者が退室 |
| `signal` | Client→Server→Client | offer/answer/candidate の中継 |
