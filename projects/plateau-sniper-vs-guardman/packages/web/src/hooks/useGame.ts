"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { RoomClient } from "@/lib/webrtc/RoomClient"
import { GameApp } from "@/lib/playcanvas/GameApp"
import type { Role, GamePhase, PeerInfo } from "@plateau-sniper/shared"
import { DC } from "@plateau-sniper/shared"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787"
const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST
  ?? "plateau-sniper-signaling.your-name.partykit.dev"

// ─── State型 ─────────────────────────────────────────────────
export type GameStatus =
  | "idle"          // ロビー前
  | "connecting"    // 接続中
  | "lobby"         // ルーム待機
  | "countdown"     // カウントダウン
  | "playing"       // ゲーム中
  | "result"        // 結果

export interface GameState {
  status:        GameStatus
  roomId:        string
  clientId:      string
  role:          Role | null
  peers:         PeerInfo[]
  timeRemaining: number
  winner:        "sniper" | "bodyguard" | null
  latencyMs:     number
  sniperMode:    string
  transProgress: number
}

export function useGame(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const [state, setState] = useState<GameState>({
    status:        "idle",
    roomId:        "",
    clientId:      "",
    role:          null,
    peers:         [],
    timeRemaining: 180,
    winner:        null,
    latencyMs:     0,
    sniperMode:    "walking",
    transProgress: 0,
  })

  const roomClientRef = useRef<RoomClient | null>(null)
  const gameAppRef    = useRef<GameApp | null>(null)
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)

  const patch = useCallback((p: Partial<GameState>) =>
    setState(s => ({ ...s, ...p })), [])

  // ─── ルーム作成 (スナイパー/ホスト) ─────────────────────────
  const createRoom = useCallback(async (role: Role, displayName: string) => {
    patch({ status: "connecting", role })
    try {
      const res  = await fetch(`${API_BASE}/api/rooms`, { method: "POST" })
      const body = await res.json() as { roomId: string; signalingUrl: string }
      await connectToRoom(body.roomId, body.signalingUrl, role, displayName, true)
    } catch (e) {
      console.error("[useGame] createRoom:", e)
      patch({ status: "idle" })
    }
  }, [])

  // ─── ルーム参加 ──────────────────────────────────────────────
  const joinRoom = useCallback(async (roomId: string, role: Role, displayName: string) => {
    patch({ status: "connecting", role })
    const signalingUrl = `wss://${PARTYKIT_HOST}/party/${roomId}`
    await connectToRoom(roomId, signalingUrl, role, displayName, false)
  }, [])

  // ─── 接続処理 ─────────────────────────────────────────────────
  const connectToRoom = useCallback(async (
    roomId:       string,
    signalingUrl: string,
    role:         Role,
    displayName:  string,
    isHost:       boolean,
  ) => {
    const client = new RoomClient({ signalingUrl, roomId, role, displayName })
    roomClientRef.current = client

    client
      .on("connected", ({ clientId }) => {
        patch({ clientId, roomId, status: "lobby" })
        // PlayCanvas 初期化
        if (canvasRef.current && !gameAppRef.current) {
          const app = new GameApp(canvasRef.current, client, role)
          gameAppRef.current = app
          // コールバック設定
          app.onGameEvent = (ev) => {
            if (ev === "target_eliminated") patch({ status: "result", winner: "sniper" })
            if (ev === "sniper_captured")   patch({ status: "result", winner: "bodyguard" })
            if (ev === "shot_missed")       {/* DetectionManagerへ */}
          }
        }
      })
      .on("peer_joined", (peer) => {
        patch({ peers: [...state.peers, peer] })
      })
      .on("peer_left", ({ clientId }) => {
        setState(s => ({ ...s, peers: s.peers.filter(p => p.clientId !== clientId) }))
      })
      .on("game_phase", ({ phase, remainingSec, winner }) => {
        if (phase === "countdown") patch({ status: "countdown" })
        if (phase === "playing") {
          patch({ status: "playing", timeRemaining: remainingSec ?? 180 })
          startLocalTimer()
        }
        if (phase === "result") {
          stopLocalTimer()
          patch({ status: "result", winner: winner ?? null })
        }
        if (phase === "lobby")   patch({ status: "lobby", winner: null })
      })

    client.connect()
  }, [canvasRef, state.peers])

  // ─── ゲーム開始 ───────────────────────────────────────────────
  const startGame = useCallback(() => {
    roomClientRef.current?.startGame()
  }, [])

  // ─── 射撃 ────────────────────────────────────────────────────
  const fire = useCallback(() => {
    gameAppRef.current?.fire()
  }, [])

  // ─── VIP 誘導命令 ─────────────────────────────────────────────
  const issueCoverOrder = useCallback((coverPointName: string) => {
    roomClientRef.current?.broadcast({
      t: DC.COVER_ORDER,
      bgId: state.clientId,
      cp:   coverPointName,
    })
  }, [state.clientId])

  // ─── NPC 派遣命令 ─────────────────────────────────────────────
  const issueDispatchOrder = useCallback((guardId: string) => {
    roomClientRef.current?.broadcast({
      t:   DC.DISPATCH_ORDER,
      bgId: state.clientId,
      gid:  guardId,
    })
  }, [state.clientId])

  // ─── PLATEAU glTF 読み込み ────────────────────────────────────
  const loadCity = useCallback((glbUrl: string) => {
    gameAppRef.current?.loadPlateau(glbUrl)
  }, [])

  // ─── ローカルタイマー ─────────────────────────────────────────
  const startLocalTimer = useCallback(() => {
    stopLocalTimer()
    timerRef.current = setInterval(() => {
      setState(s => {
        const t = s.timeRemaining - 1
        if (t <= 0) {
          stopLocalTimer()
          return { ...s, timeRemaining: 0, status: "result", winner: "bodyguard" }
        }
        return { ...s, timeRemaining: t }
      })
    }, 1000)
  }, [])

  const stopLocalTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  // ─── UI更新ループ (sniperMode / transProgress) ────────────────
  useEffect(() => {
    if (state.status !== "playing") return
    const id = setInterval(() => {
      const app = gameAppRef.current
      if (app) {
        patch({
          sniperMode:    app.getSniperMode(),
          transProgress: app.getTransitionProgress(),
        })
      }
    }, 100)
    return () => clearInterval(id)
  }, [state.status])

  // ─── クリーンアップ ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopLocalTimer()
      roomClientRef.current?.disconnect()
      gameAppRef.current?.destroy()
    }
  }, [])

  return {
    state,
    createRoom,
    joinRoom,
    startGame,
    fire,
    issueCoverOrder,
    issueDispatchOrder,
    loadCity,
  }
}
