// =============================================================
//  lib/msgpack/codec.ts
//  WebRTC DataChannel 用 MessagePack コーデック
//  @msgpack/msgpack を使用
// =============================================================

import { encode, decode, ExtensionCodec } from "@msgpack/msgpack"
import type {
  DCPayload, DCSniperState, DCBodyguardState, DCSniperFired,
  DCCoverOrder, DCDispatchOrder, DCGameEvent, DCType,
} from "@plateau-sniper/shared"
import { DC } from "@plateau-sniper/shared"

// ─── エンコード ───────────────────────────────────────────────

/**
 * DCPayload → Uint8Array (MessagePack)
 * 配列フォーマットで最小バイト数を維持する
 */
export function encodePayload(payload: DCPayload): Uint8Array {
  const arr = payloadToArray(payload)
  return encode(arr)
}

function payloadToArray(p: DCPayload): unknown[] {
  switch (p.t) {
    case DC.SNIPER_STATE:
      return [p.t, p.px, p.py, p.pz, p.qx, p.qy, p.qz, p.qw, p.mode, p.tp]

    case DC.BODYGUARD_STATE:
      return [p.t, p.id, p.px, p.py, p.pz, p.qx, p.qy, p.qz, p.qw, p.sp]

    case DC.SNIPER_FIRED:
      return [p.t, p.ox, p.oy, p.oz, p.dx, p.dy, p.dz, p.hit,
              p.hx ?? null, p.hy ?? null, p.hz ?? null, p.tag ?? null]

    case DC.COVER_ORDER:
      return [p.t, p.bgId, p.cp]

    case DC.DISPATCH_ORDER:
      return [p.t, p.bgId, p.gid]

    case DC.GAME_EVENT:
      return [p.t, p.ev, p.data ?? null]
  }
}

// ─── デコード ─────────────────────────────────────────────────

/**
 * Uint8Array (MessagePack) → DCPayload
 * 不正データは null を返す
 */
export function decodePayload(buf: ArrayBuffer | Uint8Array): DCPayload | null {
  try {
    const arr = decode(buf) as unknown[]
    if (!Array.isArray(arr) || arr.length === 0) return null

    const t = arr[0] as DCType

    switch (t) {
      case DC.SNIPER_STATE:
        return {
          t,
          px: n(arr[1]), py: n(arr[2]), pz: n(arr[3]),
          qx: n(arr[4]), qy: n(arr[5]), qz: n(arr[6]), qw: n(arr[7]),
          mode: (arr[8] as DCSniperState["mode"]) ?? "walking",
          tp:   n(arr[9]),
        } satisfies DCSniperState

      case DC.BODYGUARD_STATE:
        return {
          t,
          id: s(arr[1]),
          px: n(arr[2]), py: n(arr[3]), pz: n(arr[4]),
          qx: n(arr[5]), qy: n(arr[6]), qz: n(arr[7]), qw: n(arr[8]),
          sp: Boolean(arr[9]),
        } satisfies DCBodyguardState

      case DC.SNIPER_FIRED:
        return {
          t,
          ox: n(arr[1]), oy: n(arr[2]), oz: n(arr[3]),
          dx: n(arr[4]), dy: n(arr[5]), dz: n(arr[6]),
          hit: Boolean(arr[7]),
          hx:  arr[8]  != null ? n(arr[8])  : undefined,
          hy:  arr[9]  != null ? n(arr[9])  : undefined,
          hz:  arr[10] != null ? n(arr[10]) : undefined,
          tag: arr[11] != null ? s(arr[11]) : undefined,
        } satisfies DCSniperFired

      case DC.COVER_ORDER:
        return { t, bgId: s(arr[1]), cp: s(arr[2]) } satisfies DCCoverOrder

      case DC.DISPATCH_ORDER:
        return { t, bgId: s(arr[1]), gid: s(arr[2]) } satisfies DCDispatchOrder

      case DC.GAME_EVENT:
        return {
          t, ev: s(arr[1]) as DCGameEvent["ev"],
          data: arr[2] as Record<string, unknown> ?? undefined,
        } satisfies DCGameEvent

      default:
        return null
    }
  } catch {
    return null
  }
}

// ─── 型変換ヘルパー ───────────────────────────────────────────
const n = (v: unknown): number => typeof v === "number" ? v : 0
const s = (v: unknown): string => typeof v === "string" ? v : ""
