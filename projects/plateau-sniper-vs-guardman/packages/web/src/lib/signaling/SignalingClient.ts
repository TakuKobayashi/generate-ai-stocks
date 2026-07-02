// =============================================================
//  lib/signaling/SignalingClient.ts
//  PartyKit WebSocket シグナリングクライアント
//  ICE / SDP のみを扱う。位置データは通さない。
// =============================================================

import type {
  SignalingClientMsg,
  SignalingServerMsg,
  PeerInfo,
  Role,
  GamePhase,
} from "@plateau-sniper/shared"

export type SignalingEventMap = {
  welcome:      { clientId: string; roomId: string; peers: PeerInfo[] }
  peer_joined:  PeerInfo
  peer_left:    { clientId: string; role: Role }
  offer:        { from: string; sdp: string }
  answer:       { from: string; sdp: string }
  ice:          { from: string; candidate: RTCIceCandidateInit }
  game_phase:   { phase: GamePhase; remainingSec?: number; winner?: "sniper" | "bodyguard" }
  connected:    void
  disconnected: void
  error:        { code: string; message: string }
}

type Listener<K extends keyof SignalingEventMap> =
  (data: SignalingEventMap[K]) => void

export class SignalingClient {
  private ws:       WebSocket | null = null
  private handlers: { [K in keyof SignalingEventMap]?: Listener<K>[] } = {}
  private _clientId = ""
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private closed = false

  get clientId() { return this._clientId }

  constructor(
    private readonly url: string,  // wss://...partykit.dev/party/<roomId>
    private readonly role:         Role,
    private readonly displayName:  string,
    private readonly roomId:       string,
  ) {}

  // ─── 接続 ──────────────────────────────────────────────────
  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.ws = new WebSocket(this.url)
    this.ws.binaryType = "arraybuffer"

    this.ws.onopen = () => {
      this.emit("connected", undefined as void)
      // 接続直後に join を送る
      this.send({ type: "join", roomId: this.roomId, role: this.role, displayName: this.displayName })
    }

    this.ws.onmessage = (ev) => {
      try {
        const msg: SignalingServerMsg = JSON.parse(ev.data as string)
        this.dispatch(msg)
      } catch {
        console.warn("[Signaling] parse error", ev.data)
      }
    }

    this.ws.onclose = () => {
      this.emit("disconnected", undefined as void)
      if (!this.closed) this.scheduleReconnect()
    }

    this.ws.onerror = (ev) => {
      console.error("[Signaling] ws error", ev)
    }
  }

  disconnect() {
    this.closed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  // ─── シグナリング送信 API ────────────────────────────────────

  sendOffer(to: string, sdp: string)  { this.send({ type: "offer",  to, sdp }) }
  sendAnswer(to: string, sdp: string) { this.send({ type: "answer", to, sdp }) }
  sendIce(to: string, candidate: RTCIceCandidateInit) {
    this.send({ type: "ice", to, candidate })
  }
  sendStartGame()  { this.send({ type: "start_game" }) }
  sendResetGame()  { this.send({ type: "reset_game" }) }

  // ─── イベント登録 ────────────────────────────────────────────
  on<K extends keyof SignalingEventMap>(event: K, fn: Listener<K>) {
    if (!this.handlers[event]) this.handlers[event] = []
    ;(this.handlers[event] as Listener<K>[]).push(fn)
    return this
  }

  off<K extends keyof SignalingEventMap>(event: K, fn: Listener<K>) {
    if (!this.handlers[event]) return
    this.handlers[event] = (this.handlers[event] as Listener<K>[]).filter(h => h !== fn)
  }

  // ─── 内部 ────────────────────────────────────────────────────
  private send(msg: SignalingClientMsg) {
    if (this.ws?.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify(msg))
  }

  private dispatch(msg: SignalingServerMsg) {
    switch (msg.type) {
      case "welcome":
        this._clientId = msg.clientId
        this.emit("welcome", msg)
        break
      case "peer_joined":   this.emit("peer_joined", msg.peer); break
      case "peer_left":     this.emit("peer_left",   { clientId: msg.clientId, role: msg.role }); break
      case "offer":         this.emit("offer",        { from: msg.from, sdp: msg.sdp }); break
      case "answer":        this.emit("answer",       { from: msg.from, sdp: msg.sdp }); break
      case "ice":           this.emit("ice",          { from: msg.from, candidate: msg.candidate }); break
      case "game_phase":    this.emit("game_phase",   msg); break
      case "error":         this.emit("error",        msg); break
      case "pong":          /* ラテンシ計測は上位で */ break
    }
  }

  private emit<K extends keyof SignalingEventMap>(event: K, data: SignalingEventMap[K]) {
    this.handlers[event]?.forEach(fn => fn(data))
  }

  private scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => {
      console.log("[Signaling] reconnecting...")
      this.connect()
    }, 3000)
  }
}
