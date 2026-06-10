// services/signaling/src/index.js
// LiveKit アクセストークン発行 + カスタムシグナリングサーバー
// Unity クライアントはここからトークンを取得して LiveKit に接続する

require("dotenv").config();

const express   = require("express");
const cors      = require("cors");
const http      = require("http");
const WebSocket = require("ws");
const { AccessToken } = require("livekit-server-sdk");

const app  = express();
const port = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

// ============================================================
// REST: LiveKit トークン発行
// GET /token?room=ar-room&identity=AR-Publisher&canPublish=true
// ============================================================

app.get("/token", async (req, res) => {
  const { room, identity, canPublish, canSubscribe } = req.query;

  if (!room || !identity) {
    return res.status(400).json({ error: "room and identity are required" });
  }

  try {
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity,
        ttl: parseInt(process.env.TOKEN_TTL || "3600"),
      }
    );

    at.addGrant({
      roomJoin:     true,
      room,
      canPublish:   canPublish   !== "false",
      canSubscribe: canSubscribe !== "false",
    });

    const token = await at.toJwt();

    res.json({
      token,
      serverUrl: process.env.LIVEKIT_URL,
      room,
      identity,
    });

    console.log(`[Token] Issued for identity=${identity} room=${room}`);
  } catch (err) {
    console.error("[Token] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// REST: 死活確認
// ============================================================

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============================================================
// WebSocket: シンプルなシグナリングチャネル
// Unity クライアントがルームの参加者一覧などを取得するために使用
// ============================================================

const server = http.createServer(app);
const wss    = new WebSocket.Server({ server, path: "/ws" });

/** roomName → Set<WebSocket> */
const rooms = new Map();

wss.on("connection", (ws, req) => {
  console.log("[WS] Client connected:", req.socket.remoteAddress);

  ws.roomName = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {

      // ルームに参加
      case "join": {
        const { room, identity } = msg;
        ws.roomName = room;
        ws.identity = identity;

        if (!rooms.has(room)) rooms.set(room, new Set());
        rooms.get(room).add(ws);

        // 既存参加者リストを返す
        const peers = [...rooms.get(room)]
          .filter(c => c !== ws && c.readyState === WebSocket.OPEN)
          .map(c => c.identity);

        ws.send(JSON.stringify({ type: "room_joined", room, peers }));

        // 他の参加者に通知
        broadcast(room, ws, { type: "peer_joined", identity });
        console.log(`[WS] ${identity} joined room=${room}  peers=${peers.length}`);
        break;
      }

      // シグナリングメッセージ中継（offer / answer / candidate）
      case "signal": {
        const { to, payload } = msg;
        const target = [...(rooms.get(ws.roomName) || [])]
          .find(c => c.identity === to && c.readyState === WebSocket.OPEN);

        if (target) {
          target.send(JSON.stringify({
            type:    "signal",
            from:    ws.identity,
            payload,
          }));
        }
        break;
      }

      default:
        break;
    }
  });

  ws.on("close", () => {
    if (ws.roomName && rooms.has(ws.roomName)) {
      rooms.get(ws.roomName).delete(ws);
      broadcast(ws.roomName, ws, { type: "peer_left", identity: ws.identity });
      console.log(`[WS] ${ws.identity} left room=${ws.roomName}`);
    }
  });

  ws.on("error", (err) => {
    console.error("[WS] Error:", err.message);
  });
});

function broadcast(room, sender, msg) {
  const members = rooms.get(room);
  if (!members) return;
  const json = JSON.stringify(msg);
  for (const c of members) {
    if (c !== sender && c.readyState === WebSocket.OPEN)
      c.send(json);
  }
}

// ============================================================
// 起動
// ============================================================

server.listen(port, () => {
  console.log(`[Signaling] Server running on http://localhost:${port}`);
  console.log(`[Signaling] Token endpoint: GET http://localhost:${port}/token`);
  console.log(`[Signaling] WebSocket:      ws://localhost:${port}/ws`);
  console.log(`[Signaling] LiveKit URL:    ${process.env.LIVEKIT_URL}`);
});
