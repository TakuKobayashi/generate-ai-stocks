"use client"

interface Props {
  winner:   "sniper" | "bodyguard"
  roomId:   string
  onRetry:  () => void
}

export function ResultScreen({ winner, roomId, onRetry }: Props) {
  const isSniper = winner === "sniper"
  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={{ ...styles.icon }}>
          {isSniper ? "🎯" : "🛡️"}
        </div>
        <h2 style={{ ...styles.title, color: isSniper ? "#ef5350" : "#42a5f5" }}>
          {isSniper ? "スナイパー勝利" : "ボディガード勝利"}
        </h2>
        <p style={styles.sub}>
          {isSniper ? "ターゲットの排除に成功しました" : "VIPを守り切りました！"}
        </p>
        <p style={styles.roomId}>Room: {roomId}</p>
        <button style={styles.btn} onClick={onRetry}>
          もう一度プレイ
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: "fixed", inset: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
  },
  card: {
    background: "rgba(10,10,20,0.95)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12, padding: "40px 48px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
    color: "#e0e0e0", fontFamily: "'Segoe UI','Noto Sans JP',sans-serif",
  },
  icon:  { fontSize: 56 },
  title: { fontSize: 28, fontWeight: 800, margin: 0 },
  sub:   { fontSize: 15, color: "#bbb", margin: 0 },
  roomId:{ fontSize: 12, color: "#555" },
  btn: {
    marginTop: 8, padding: "12px 40px",
    background: "rgba(79,195,247,0.15)",
    border: "1px solid rgba(79,195,247,0.4)",
    borderRadius: 6, color: "#4fc3f7",
    fontSize: 15, cursor: "pointer",
  },
}
