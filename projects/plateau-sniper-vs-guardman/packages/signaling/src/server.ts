// =============================================================
//  packages/signaling/src/server.ts
//  PartyKit シグナリングサーバー
//
//  役割: WebRTC の ICE / SDP 交換を中継するだけ
//        位置データは一切扱わない (DataChannel で P2P 送信)
//
//  PartyKit API:
//    party.room  → ルーム (= 1 試合)
//    connection  → 各クライアントの WebSocket
// =============================================================

import type * as Party from "partykit/server"
import type {
  SignalingClientMsg,
  SignalingServerMsg,
  PeerInfo,
  GamePhase,
  Role,
} from "@plateau-sniper/shared"

// ─── ルーム状態 ───────────────────────────────────────────────
interface RoomState {
  phase:      GamePhase
  peers:      Map<string, PeerInfo>
  gameDurSec: number
  remainSec:  number
  createdAt:  number
}

// ─── PartyKit Server ──────────────────────────────────────────
export default class SignalingServer implements Party.Server {
  private state: RoomState = {
    phase:      "lobby",
    peers:      new Map(),
    gameDurSec: 180,
    remainSec:  180,
    createdAt:  Date.now(),
  }

  // タイマー管理
  private timerInterval: ReturnType<typeof setInterval> | null = null

  constructor(readonly room: Party.Room) {}

  // ─── 接続時 ─────────────────────────────────────────────────
  onConnect(conn: Party.Connection) {
    // welcome は join メッセージ受信後に送る (role/displayName が必要)
    console.log(`[Signaling] connect: ${conn.id}`)
  }

  // ─── メッセージ受信 ──────────────────────────────────────────
  onMessage(raw: string, sender: Party.Connection) {
    let msg: SignalingClientMsg
    try {
      msg = JSON.parse(raw)
    } catch {
      this.sendTo(sender, { type: "error", code: "PARSE_ERROR", message: "Invalid JSON" })
      return
    }

    switch (msg.type) {
      case "join":        return this.handleJoin(sender, msg)
      case "offer":       return this.handleRelay(sender, msg.to, { type: "offer",   from: sender.id, sdp: msg.sdp })
      case "answer":      return this.handleRelay(sender, msg.to, { type: "answer",  from: sender.id, sdp: msg.sdp })
      case "ice":         return this.handleRelay(sender, msg.to, { type: "ice",     from: sender.id, candidate: msg.candidate })
      case "start_game":  return this.handleStartGame(sender)
      case "reset_game":  return this.handleResetGame()
      case "ping":        return this.sendTo(sender, { type: "pong", ts: msg.ts, serverTs: Date.now() })
      default:
        this.sendTo(sender, { type: "error", code: "UNKNOWN_MSG", message: `Unknown type` })
    }
  }

  // ─── 切断時 ─────────────────────────────────────────────────
  onClose(conn: Party.Connection) {
    const peer = this.state.peers.get(conn.id)
    if (!peer) return

    this.state.peers.delete(conn.id)
    this.broadcast({ type: "peer_left", clientId: conn.id, role: peer.role }, conn.id)
    console.log(`[Signaling] left: ${conn.id} (${peer.role})`)
  }

  onError(conn: Party.Connection, err: Error) {
    console.error(`[Signaling] error: ${conn.id}`, err)
  }

  // ─── ハンドラ ────────────────────────────────────────────────

  private handleJoin(
    conn: Party.Connection,
    msg: Extract<SignalingClientMsg, { type: "join" }>
  ) {
    // スナイパーは 1 人のみ
    if (msg.role === "sniper") {
      const hasSniper = [...this.state.peers.values()].some(p => p.role === "sniper")
      if (hasSniper) {
        this.sendTo(conn, { type: "error", code: "SNIPER_TAKEN", message: "Sniper already joined" })
        return
      }
    }

    const peer: PeerInfo = {
      clientId:    conn.id,
      role:        msg.role,
      displayName: msg.displayName,
      connectedAt: Date.now(),
    }
    this.state.peers.set(conn.id, peer)

    // welcome: 自分の clientId + 既存ピア一覧
    this.sendTo(conn, {
      type:     "welcome",
      clientId: conn.id,
      roomId:   this.room.id,
      peers:    [...this.state.peers.values()].filter(p => p.clientId !== conn.id),
    })

    // 現在のゲームフェーズを通知
    this.sendTo(conn, {
      type:         "game_phase",
      phase:        this.state.phase,
      remainingSec: this.state.remainSec,
    })

    // 他の全員に入室通知
    this.broadcast({ type: "peer_joined", peer }, conn.id)

    console.log(`[Signaling] joined: ${conn.id} (${msg.role}) room=${this.room.id}`)
  }

  /** ICE / SDP を特定の相手にリレー */
  private handleRelay(
    sender: Party.Connection,
    to:     string,
    msg:    SignalingServerMsg
  ) {
    const target = this.room.getConnection(to)
    if (!target) {
      this.sendTo(sender, {
        type: "error", code: "PEER_NOT_FOUND",
        message: `Peer ${to} not found`,
      })
      return
    }
    this.sendTo(target, msg)
  }

  private handleStartGame(sender: Party.Connection) {
    if (this.state.phase !== "lobby") return

    // 3 秒カウントダウン
    this.state.phase = "countdown"
    this.broadcast({ type: "game_phase", phase: "countdown", remainingSec: 3 })

    setTimeout(() => {
      this.state.phase     = "playing"
      this.state.remainSec = this.state.gameDurSec
      this.broadcast({ type: "game_phase", phase: "playing", remainingSec: this.state.remainSec })
      this.startTimer()
    }, 3000)
  }

  private startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval)
    this.timerInterval = setInterval(() => {
      if (this.state.phase !== "playing") {
        clearInterval(this.timerInterval!)
        return
      }
      this.state.remainSec -= 1
      // 残り 30 秒以下は毎秒、それ以外は 10 秒おきに送信
      if (this.state.remainSec <= 30 || this.state.remainSec % 10 === 0) {
        this.broadcast({ type: "game_phase", phase: "playing", remainingSec: this.state.remainSec })
      }
      if (this.state.remainSec <= 0) {
        clearInterval(this.timerInterval!)
        this.endGame("bodyguard")
      }
    }, 1000)
  }

  private endGame(winner: "sniper" | "bodyguard") {
    this.state.phase = "result"
    this.broadcast({ type: "game_phase", phase: "result", winner })
  }

  private handleResetGame() {
    if (this.timerInterval) clearInterval(this.timerInterval)
    this.state.phase     = "lobby"
    this.state.remainSec = this.state.gameDurSec
    this.broadcast({ type: "game_phase", phase: "lobby" })
  }

  // ─── 送信ユーティリティ ──────────────────────────────────────

  private sendTo(conn: Party.Connection, msg: SignalingServerMsg) {
    conn.send(JSON.stringify(msg))
  }

  private broadcast(msg: SignalingServerMsg, excludeId?: string) {
    const json = JSON.stringify(msg)
    for (const conn of this.room.getConnections()) {
      if (conn.id !== excludeId) conn.send(json)
    }
  }
}
