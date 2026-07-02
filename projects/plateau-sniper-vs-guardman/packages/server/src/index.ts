// =============================================================
//  packages/server/src/index.ts
//  Cloudflare Workers + Hono  (REST API のみ)
//  WebSocket / WebRTC シグナリングは PartyKit が担当
// =============================================================

import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { nanoid } from "nanoid"
import type {
  CreateRoomRes,
  HealthRes,
  RoomInfoRes,
} from "@plateau-sniper/shared"

const app = new Hono<{ Bindings: Env }>()

app.use("*", logger())
app.use("*", cors({ origin: "*", allowMethods: ["GET","POST","OPTIONS"] }))

// ─── ヘルスチェック ───────────────────────────────────────────
app.get("/api/health", c =>
  c.json<HealthRes>({ status: "ok", version: c.env.VERSION ?? "1.0.0", ts: Date.now() })
)

// ─── ルーム作成 ───────────────────────────────────────────────
// POST /api/rooms
// クライアントはここで roomId を取得し、
// PartyKit の ws://<project>.partykit.dev/<roomId> に接続する
app.post("/api/rooms", async c => {
  const roomId = nanoid(10)

  // PartyKit のシグナリング URL を返す
  const signalingUrl =
    `wss://${c.env.PARTYKIT_HOST ?? "plateau-sniper-signaling.your-name.partykit.dev"}` +
    `/party/${roomId}`

  const body: CreateRoomRes = { roomId, signalingUrl }
  return c.json(body, 201)
})

// ─── ルーム情報 (PartyKit REST API 経由) ─────────────────────
// GET /api/rooms/:roomId
app.get("/api/rooms/:roomId", async c => {
  const roomId = c.req.param("roomId")
  const host   = c.env.PARTYKIT_HOST ?? "plateau-sniper-signaling.your-name.partykit.dev"

  // PartyKit の REST API でルーム情報を取得
  const res = await fetch(`https://${host}/party/${roomId}`, {
    headers: { "Content-Type": "application/json" },
  }).catch(() => null)

  if (!res?.ok) return c.json({ error: "Room not found" }, 404)

  // PartyKit は独自フォーマットで返すため、ラップして返す
  const raw = await res.json<{ connections?: number }>().catch(() => ({}))
  const body: Partial<RoomInfoRes> = {
    roomId,
    phase: "lobby",
    peers: [],
    createdAt: Date.now(),
  }
  return c.json(body)
})

app.notFound(c => c.json({ error: "Not found" }, 404))

export default app
