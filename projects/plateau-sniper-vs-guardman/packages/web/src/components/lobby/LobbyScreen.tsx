"use client"

import { useState } from "react"
import type { Role } from "@plateau-sniper/shared"

interface Props {
  onCreateRoom: (role: Role, name: string) => void
  onJoinRoom:   (roomId: string, role: Role, name: string) => void
  isConnecting: boolean
}

export function LobbyScreen({ onCreateRoom, onJoinRoom, isConnecting }: Props) {
  const [tab,         setTab]     = useState<"create" | "join">("create")
  const [role,        setRole]    = useState<Role>("sniper")
  const [name,        setName]    = useState("")
  const [roomIdInput, setRoomId]  = useState("")

  const handleSubmit = () => {
    const displayName = name.trim() || "Player"
    if (tab === "create") onCreateRoom(role, displayName)
    else                  onJoinRoom(roomIdInput.trim(), role, displayName)
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>🏙️ PLATEAU Sniper Simulation</h1>
        <p style={styles.sub}>実際の都市データを使ったセキュリティシミュレーション</p>

        {/* タブ */}
        <div style={styles.tabs}>
          <button style={tab === "create" ? styles.tabActive : styles.tab}
            onClick={() => setTab("create")}>ルーム作成</button>
          <button style={tab === "join" ? styles.tabActive : styles.tab}
            onClick={() => setTab("join")}>ルーム参加</button>
        </div>

        {/* ロール選択 */}
        <div style={styles.roleRow}>
          <button
            style={role === "sniper" ? styles.roleActive : styles.roleBtn}
            onClick={() => setRole("sniper")}
          >🎯 スナイパー</button>
          <button
            style={role === "bodyguard" ? styles.roleActiveBlue : styles.roleBtn}
            onClick={() => setRole("bodyguard")}
          >🛡️ ボディガード</button>
        </div>

        {/* 名前入力 */}
        <input
          style={styles.input}
          placeholder="表示名（任意）"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        {/* 参加時: ルームID入力 */}
        {tab === "join" && (
          <input
            style={styles.input}
            placeholder="ルームID"
            value={roomIdInput}
            onChange={e => setRoomId(e.target.value)}
          />
        )}

        <button
          style={isConnecting ? styles.btnDisabled : styles.btn}
          onClick={handleSubmit}
          disabled={isConnecting}
        >
          {isConnecting ? "接続中..." : tab === "create" ? "ゲームを始める" : "参加する"}
        </button>

        {/* 説明 */}
        <div style={styles.desc}>
          <p><strong>スナイパー</strong>: 1人称視点で高所に潜伏。VIPを狙撃して勝利。</p>
          <p><strong>ボディガード</strong>: VIPを護衛。スナイパーを3秒間視野に捉えると発見。</p>
          <p style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
            位置情報はWebRTC DataChannel(MessagePack)でP2P送信されます
          </p>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: "fixed", inset: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "#0a0a0f",
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12, padding: "36px 40px",
    width: 420, display: "flex", flexDirection: "column", gap: 14,
    color: "#e0e0e0",
    fontFamily: "'Segoe UI','Noto Sans JP',sans-serif",
  },
  title: { fontSize: 20, fontWeight: 700, color: "#4fc3f7", margin: 0 },
  sub:   { fontSize: 13, color: "#888", margin: 0 },
  tabs:  { display: "flex", gap: 0 },
  tab:   {
    flex: 1, padding: "8px 0",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#aaa", cursor: "pointer", fontSize: 13,
  },
  tabActive: {
    flex: 1, padding: "8px 0",
    background: "rgba(79,195,247,0.15)",
    border: "1px solid rgba(79,195,247,0.4)",
    color: "#4fc3f7", cursor: "pointer", fontSize: 13, fontWeight: 600,
  },
  roleRow: { display: "flex", gap: 8 },
  roleBtn: {
    flex: 1, padding: "10px 0",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#aaa", cursor: "pointer", borderRadius: 6, fontSize: 14,
  },
  roleActive: {
    flex: 1, padding: "10px 0",
    background: "rgba(239,83,80,0.15)",
    border: "1px solid rgba(239,83,80,0.5)",
    color: "#ef5350", cursor: "pointer", borderRadius: 6, fontSize: 14, fontWeight: 600,
  },
  roleActiveBlue: {
    flex: 1, padding: "10px 0",
    background: "rgba(66,165,245,0.15)",
    border: "1px solid rgba(66,165,245,0.5)",
    color: "#42a5f5", cursor: "pointer", borderRadius: 6, fontSize: 14, fontWeight: 600,
  },
  input: {
    padding: "10px 12px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 6, color: "#e0e0e0", fontSize: 14, outline: "none",
  },
  btn: {
    padding: "12px 0",
    background: "rgba(79,195,247,0.2)",
    border: "1px solid rgba(79,195,247,0.5)",
    borderRadius: 6, color: "#4fc3f7", fontSize: 15,
    fontWeight: 600, cursor: "pointer",
  },
  btnDisabled: {
    padding: "12px 0",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6, color: "#666", fontSize: 15,
  },
  desc: {
    fontSize: 13, color: "#aaa", lineHeight: 1.8,
    borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12,
    display: "flex", flexDirection: "column", gap: 2,
  },
}
