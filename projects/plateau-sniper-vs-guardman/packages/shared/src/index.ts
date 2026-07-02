// =============================================================
//  @plateau-sniper/shared
//  シグナリング(PartyKit WebSocket)用メッセージ型 +
//  WebRTC DataChannel(MessagePack)用ペイロード型
// =============================================================

// ─── 共通プリミティブ ─────────────────────────────────────────

export interface Vec3  { x: number; y: number; z: number }
export interface Quat  { x: number; y: number; z: number; w: number }
export type Role       = "sniper" | "bodyguard"
export type SniperMode = "walking" | "transitioning" | "aiming"
export type GamePhase  = "lobby" | "countdown" | "playing" | "result"

// =============================================================
//  シグナリングメッセージ (PartyKit WebSocket / JSON)
//  WebRTC の ICE / SDP 交換専用。位置データは含まない。
// =============================================================

/** クライアント → PartyKit サーバー */
export type SignalingClientMsg =
  | { type: "join";        roomId: string; role: Role; displayName: string }
  | { type: "offer";       to: string; sdp: string }
  | { type: "answer";      to: string; sdp: string }
  | { type: "ice";         to: string; candidate: RTCIceCandidateInit }
  | { type: "start_game" }
  | { type: "reset_game" }
  | { type: "ping";        ts: number }

/** PartyKit サーバー → クライアント */
export type SignalingServerMsg =
  | { type: "welcome";       clientId: string; roomId: string; peers: PeerInfo[] }
  | { type: "peer_joined";   peer: PeerInfo }
  | { type: "peer_left";     clientId: string; role: Role }
  | { type: "offer";         from: string; sdp: string }
  | { type: "answer";        from: string; sdp: string }
  | { type: "ice";           from: string; candidate: RTCIceCandidateInit }
  | { type: "game_phase";    phase: GamePhase; remainingSec?: number; winner?: "sniper"|"bodyguard" }
  | { type: "pong";          ts: number; serverTs: number }
  | { type: "error";         code: string; message: string }

export interface PeerInfo {
  clientId:    string
  role:        Role
  displayName: string
  connectedAt: number
}

// =============================================================
//  WebRTC DataChannel ペイロード (MessagePack バイナリ)
//  unreliable / unordered (= UDP 投げっぱなし) で送信
//
//  MessagePack は配列フォーマットを使い最小バイト数を維持する
//  C# 側は MessagePack-CSharp、TS 側は @msgpack/msgpack を使用
// =============================================================

/**
 * DataChannel メッセージ種別
 * uint8 の先頭 1 バイトで判別する
 */
export const DC = {
  SNIPER_STATE:    0x01,
  BODYGUARD_STATE: 0x02,
  SNIPER_FIRED:    0x03,
  COVER_ORDER:     0x04,
  DISPATCH_ORDER:  0x05,
  GAME_EVENT:      0x06,
} as const
export type DCType = typeof DC[keyof typeof DC]

/**
 * 全 DataChannel ペイロードの共用体
 * MessagePack 配列フォーマット: [type, ...fields]
 */

/** [0x01, x, y, z, qx, qy, qz, qw, mode, transitionProgress] */
export interface DCSniperState {
  t:  typeof DC.SNIPER_STATE   // 0x01
  px: number; py: number; pz: number          // position
  qx: number; qy: number; qz: number; qw: number // rotation
  mode: SniperMode
  tp: number                                   // transitionProgress 0..1
}

/** [0x02, clientId, x, y, z, qx, qy, qz, qw, isSprinting] */
export interface DCBodyguardState {
  t:  typeof DC.BODYGUARD_STATE
  id: string
  px: number; py: number; pz: number
  qx: number; qy: number; qz: number; qw: number
  sp: boolean                                  // isSprinting
}

/** [0x03, ox, oy, oz, dx, dy, dz, hit, hx?, hy?, hz?, hitTag?] */
export interface DCSniperFired {
  t:  typeof DC.SNIPER_FIRED
  ox: number; oy: number; oz: number           // origin
  dx: number; dy: number; dz: number           // direction
  hit: boolean
  hx?: number; hy?: number; hz?: number        // hitPoint
  tag?: string
}

/** [0x04, bodyguardId, coverPointName] */
export interface DCCoverOrder {
  t:    typeof DC.COVER_ORDER
  bgId: string
  cp:   string                                 // coverPointName
}

/** [0x05, bodyguardId, guardId] */
export interface DCDispatchOrder {
  t:    typeof DC.DISPATCH_ORDER
  bgId: string
  gid:  string
}

/** [0x06, event] – ゲームロジックイベント */
export interface DCGameEvent {
  t:    typeof DC.GAME_EVENT
  ev:   "target_eliminated" | "sniper_captured" | "shot_missed" | "sniper_detected"
  data?: Record<string, unknown>
}

export type DCPayload =
  | DCSniperState
  | DCBodyguardState
  | DCSniperFired
  | DCCoverOrder
  | DCDispatchOrder
  | DCGameEvent

// =============================================================
//  REST API 型 (Hono サーバー)
// =============================================================

export interface CreateRoomRes  { roomId: string; signalingUrl: string }
export interface HealthRes      { status: "ok"; version: string; ts: number }
export interface RoomInfoRes    {
  roomId: string; phase: GamePhase
  peers: PeerInfo[]; createdAt: number
}
