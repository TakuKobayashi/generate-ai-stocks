"use client"

import { useRef } from "react"
import { useGame } from "@/hooks/useGame"
import { LobbyScreen } from "@/components/lobby/LobbyScreen"
import { ResultScreen } from "@/components/lobby/ResultScreen"
import { HUD, ScopeOverlay, DetectCircle } from "@/components/hud/HUD"

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const {
    state, createRoom, joinRoom, startGame,
    fire, issueCoverOrder, issueDispatchOrder,
  } = useGame(canvasRef)

  const { status, role, winner, roomId, peers, sniperMode, transProgress } = state

  return (
    <main style={{ width: "100vw", height: "100vh", background: "#0a0a0f", overflow: "hidden" }}>

      {/* PlayCanvas キャンバス (常に存在) */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed", inset: 0,
          width: "100%", height: "100%",
          display: ["playing","countdown"].includes(status) ? "block" : "none",
        }}
      />

      {/* ─── ロビー ─── */}
      {(status === "idle" || status === "connecting") && (
        <LobbyScreen
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          isConnecting={status === "connecting"}
        />
      )}

      {/* ─── ルーム待機 ─── */}
      {status === "lobby" && (
        <div style={styles.lobbyWait}>
          <p style={styles.roomIdText}>Room ID: <strong>{roomId}</strong></p>
          <p style={styles.peerText}>参加者: {peers.length + 1}人</p>
          <button style={styles.startBtn} onClick={startGame}>
            ゲーム開始
          </button>
          <p style={styles.hint}>URLを共有してボディガードを招待してください</p>
          <p style={styles.hint2}>シグナリング: PartyKit WebSocket → 位置: WebRTC DataChannel (MessagePack)</p>
        </div>
      )}

      {/* ─── ゲーム中 HUD ─── */}
      {["playing", "countdown"].includes(status) && (
        <>
          <HUD
            state={state}
            onFire={fire}
            onCoverOrder={issueCoverOrder}
            onDispatchOrder={issueDispatchOrder}
          />

          {/* スコープオーバーレイ (スナイパー Aiming 中) */}
          {role === "sniper" && sniperMode === "aiming" && <ScopeOverlay />}

          {/* 発見円 (ボディガード) */}
          {role === "bodyguard" && <DetectCircle progress={0} />}

          {/* カウントダウン */}
          {status === "countdown" && (
            <div style={styles.countdown}>3</div>
          )}
        </>
      )}

      {/* ─── 結果 ─── */}
      {status === "result" && winner && (
        <ResultScreen
          winner={winner}
          roomId={roomId}
          onRetry={() => window.location.reload()}
        />
      )}
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  lobbyWait: {
    position: "fixed", inset: 0,
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: 14, color: "#e0e0e0",
    fontFamily: "'Segoe UI','Noto Sans JP',sans-serif",
    background: "#0a0a0f",
  },
  roomIdText: {
    fontSize: 18, background: "rgba(79,195,247,0.1)",
    border: "1px solid rgba(79,195,247,0.3)",
    padding: "8px 24px", borderRadius: 6,
  },
  peerText: { fontSize: 14, color: "#aaa" },
  startBtn: {
    padding: "12px 40px",
    background: "rgba(79,195,247,0.2)",
    border: "1px solid rgba(79,195,247,0.5)",
    borderRadius: 6, color: "#4fc3f7",
    fontSize: 15, fontWeight: 600, cursor: "pointer",
  },
  hint:  { fontSize: 13, color: "#666" },
  hint2: { fontSize: 11, color: "#444" },
  countdown: {
    position: "fixed", top: "50%", left: "50%",
    transform: "translate(-50%,-50%)",
    fontSize: 96, fontWeight: 900, color: "#fff",
    textShadow: "0 0 40px rgba(79,195,247,0.8)",
    pointerEvents: "none",
  },
}
