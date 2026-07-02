// =============================================================
//  lib/webrtc/RoomClient.ts
//  シグナリング (PartyKit) + WebRTC DataChannel のオーケストレーター
//  複数ピアとの P2P メッシュを管理する
// =============================================================

import { SignalingClient } from "../signaling/SignalingClient"
import { PeerConnection, type DCMessageHandler } from "./PeerConnection"
import type { DCPayload, Role, GamePhase, PeerInfo } from "@plateau-sniper/shared"

export type RoomEventMap = {
  connected:    { clientId: string }
  peer_joined:  PeerInfo
  peer_left:    { clientId: string; role: Role }
  message:      { payload: DCPayload; from: string }
  game_phase:   { phase: GamePhase; remainingSec?: number; winner?: "sniper"|"bodyguard" }
  dc_ready:     { peerId: string }
}

type Listener<K extends keyof RoomEventMap> = (data: RoomEventMap[K]) => void

export class RoomClient {
  private signaling:   SignalingClient
  private peers:       Map<string, PeerConnection> = new Map()
  private handlers:    { [K in keyof RoomEventMap]?: Listener<K>[] } = {}
  private _myClientId = ""
  private _role:       Role

  get clientId() { return this._myClientId }
  get role()     { return this._role }

  constructor(opts: {
    signalingUrl: string
    roomId:       string
    role:         Role
    displayName:  string
  }) {
    this._role     = opts.role
    this.signaling = new SignalingClient(
      opts.signalingUrl, opts.role, opts.displayName, opts.roomId
    )
    this.setupSignaling()
  }

  // ─── 接続 ──────────────────────────────────────────────────
  connect() {
    this.signaling.connect()
  }

  disconnect() {
    this.signaling.disconnect()
    for (const pc of this.peers.values()) pc.close()
    this.peers.clear()
  }

  // ─── ブロードキャスト送信 ─────────────────────────────────────
  /** 接続済みの全ピアに DataChannel 経由で送信 */
  broadcast(payload: DCPayload) {
    for (const pc of this.peers.values()) {
      pc.send(payload)
    }
  }

  /** 特定ピアに送信 */
  sendTo(peerId: string, payload: DCPayload) {
    this.peers.get(peerId)?.send(payload)
  }

  /** ゲーム開始をシグナリング経由で送信（ホストのみ） */
  startGame()  { this.signaling.sendStartGame() }
  resetGame()  { this.signaling.sendResetGame() }

  isConnected(peerId: string) {
    return this.peers.get(peerId)?.isConnected ?? false
  }

  // ─── イベント登録 ────────────────────────────────────────────
  on<K extends keyof RoomEventMap>(event: K, fn: Listener<K>) {
    if (!this.handlers[event]) this.handlers[event] = []
    ;(this.handlers[event] as Listener<K>[]).push(fn)
    return this
  }

  off<K extends keyof RoomEventMap>(event: K, fn: Listener<K>) {
    if (!this.handlers[event]) return
    this.handlers[event] = (this.handlers[event] as Listener<K>[]).filter(h => h !== fn)
  }

  // ─── シグナリングイベント処理 ─────────────────────────────────
  private setupSignaling() {
    const sig = this.signaling

    sig.on("welcome", ({ clientId, peers }) => {
      this._myClientId = clientId
      this.emit("connected", { clientId })

      // 既存ピアに対してこちらから offer を送る
      for (const peer of peers) {
        this.createPeerAndOffer(peer.clientId)
      }
    })

    sig.on("peer_joined", (peer) => {
      // 相手からのOffer待ち（先に入っていた側は offer しない）
      this.ensurePeer(peer.clientId)
      this.emit("peer_joined", peer)
    })

    sig.on("peer_left", ({ clientId, role }) => {
      this.peers.get(clientId)?.close()
      this.peers.delete(clientId)
      this.emit("peer_left", { clientId, role })
    })

    sig.on("offer", async ({ from, sdp }) => {
      const pc = this.ensurePeer(from)
      await pc.handleOffer(sdp)
    })

    sig.on("answer", async ({ from, sdp }) => {
      await this.peers.get(from)?.handleAnswer(sdp)
    })

    sig.on("ice", async ({ from, candidate }) => {
      await this.peers.get(from)?.handleIce(candidate)
    })

    sig.on("game_phase", (data) => {
      this.emit("game_phase", data)
    })
  }

  // ─── ピア管理 ─────────────────────────────────────────────────
  private createPeerAndOffer(peerId: string) {
    const pc = this.ensurePeer(peerId)
    pc.createOffer().catch(e => console.error("[RoomClient] offer failed:", e))
    return pc
  }

  private ensurePeer(peerId: string): PeerConnection {
    if (this.peers.has(peerId)) return this.peers.get(peerId)!

    const messageHandler: DCMessageHandler = (payload, from) => {
      this.emit("message", { payload, from })
    }

    const pc = new PeerConnection(
      peerId,
      this.signaling,
      messageHandler,
      (closedId) => {
        this.peers.delete(closedId)
        console.log(`[RoomClient] peer closed: ${closedId}`)
      }
    )

    this.peers.set(peerId, pc)
    return pc
  }

  private emit<K extends keyof RoomEventMap>(event: K, data: RoomEventMap[K]) {
    this.handlers[event]?.forEach(fn => fn(data))
  }
}
