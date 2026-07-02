// =============================================================
//  lib/webrtc/PeerConnection.ts
//  WebRTC DataChannel (unreliable / unordered = UDP 相当)
//  1 ピアとの P2P 接続を管理する
// =============================================================

import type { SignalingClient } from "../signaling/SignalingClient"
import type { DCPayload } from "@plateau-sniper/shared"
import { encodePayload, decodePayload } from "../msgpack/codec"

// Public STUNサーバーリスト
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302"  },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.mozilla.org"         },
]

/** DataChannel の設定: unreliable + unordered = UDP 投げっぱなし */
const DC_OPTIONS: RTCDataChannelInit = {
  ordered:           false,   // 順序保証なし
  maxRetransmits:    0,       // 再送なし (= UDP)
  // maxPacketLifeTime は maxRetransmits と排他なので指定しない
}
const DC_LABEL = "position"

export type DCMessageHandler = (payload: DCPayload, peerId: string) => void

export class PeerConnection {
  private pc:      RTCPeerConnection
  private dc:      RTCDataChannel | null = null
  private ready =  false

  /** 送信キュー (DataChannel が open になるまで溜める) */
  private pendingBufs: Uint8Array[] = []

  constructor(
    readonly peerId:  string,
    private readonly signaling: SignalingClient,
    private readonly onMessage: DCMessageHandler,
    private readonly onClose:   (peerId: string) => void,
  ) {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.setupPCHandlers()
  }

  // ─── 接続確立 (Offer 側 = 後から入った人が既存ピアに offer) ──
  async createOffer() {
    // DataChannel はオファー側が作成する
    this.dc = this.pc.createDataChannel(DC_LABEL, DC_OPTIONS)
    this.setupDCHandlers(this.dc)

    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    this.signaling.sendOffer(this.peerId, offer.sdp!)
  }

  // ─── Answer 側 ────────────────────────────────────────────────
  async handleOffer(sdp: string) {
    await this.pc.setRemoteDescription({ type: "offer", sdp })
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    this.signaling.sendAnswer(this.peerId, answer.sdp!)
  }

  async handleAnswer(sdp: string) {
    await this.pc.setRemoteDescription({ type: "answer", sdp })
  }

  async handleIce(candidate: RTCIceCandidateInit) {
    await this.pc.addIceCandidate(candidate).catch(e =>
      console.warn("[WebRTC] addIceCandidate:", e)
    )
  }

  // ─── 送信 ──────────────────────────────────────────────────
  send(payload: DCPayload) {
    const buf = encodePayload(payload)

    if (!this.ready || this.dc?.readyState !== "open") {
      // 未開通の間は最新状態だけ保持 (古いものは捨てる)
      this.pendingBufs = [buf]
      return
    }

    try {
      this.dc!.send(buf)
    } catch (e) {
      console.warn("[WebRTC] send error:", e)
    }
  }

  close() {
    this.dc?.close()
    this.pc.close()
  }

  get isConnected() {
    return this.ready && this.dc?.readyState === "open"
  }

  // ─── 内部ハンドラ ─────────────────────────────────────────────
  private setupPCHandlers() {
    // ICE 候補 → シグナリング経由で相手に送る
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate)
        this.signaling.sendIce(this.peerId, ev.candidate.toJSON())
    }

    this.pc.oniceconnectionstatechange = () => {
      const s = this.pc.iceConnectionState
      console.log(`[WebRTC] ${this.peerId} ICE: ${s}`)
      if (s === "failed" || s === "closed") this.handleClose()
    }

    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState
      console.log(`[WebRTC] ${this.peerId} conn: ${s}`)
      if (s === "failed" || s === "closed") this.handleClose()
    }

    // Answer 側: DataChannel は ondatachannel で受け取る
    this.pc.ondatachannel = (ev) => {
      if (ev.channel.label === DC_LABEL) {
        this.dc = ev.channel
        this.setupDCHandlers(this.dc)
      }
    }
  }

  private setupDCHandlers(dc: RTCDataChannel) {
    dc.binaryType = "arraybuffer"

    dc.onopen = () => {
      console.log(`[WebRTC] DataChannel open: ${this.peerId}`)
      this.ready = true
      // 保留バッファを送信
      for (const buf of this.pendingBufs) {
        try { dc.send(buf) } catch { /* ignore */ }
      }
      this.pendingBufs = []
    }

    dc.onclose   = () => this.handleClose()
    dc.onerror   = (e) => console.warn("[WebRTC] dc error:", e)

    dc.onmessage = (ev) => {
      const payload = decodePayload(ev.data as ArrayBuffer)
      if (payload) this.onMessage(payload, this.peerId)
    }
  }

  private handleClose() {
    if (!this.ready && !this.dc) return
    this.ready = false
    this.onClose(this.peerId)
  }
}
