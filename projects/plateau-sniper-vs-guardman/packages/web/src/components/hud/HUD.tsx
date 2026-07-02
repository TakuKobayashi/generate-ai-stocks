"use client"

import type { GameState } from "@/hooks/useGame"

interface Props {
  state:            GameState
  onFire:           () => void
  onCoverOrder:     (cp: string) => void
  onDispatchOrder:  (gid: string) => void
}

export function HUD({ state, onFire, onCoverOrder, onDispatchOrder }: Props) {
  const { role, timeRemaining, sniperMode, transProgress, status } = state

  const mm = String(Math.floor(timeRemaining / 60)).padStart(2, "0")
  const ss = String(timeRemaining % 60).padStart(2, "0")
  const isRed = timeRemaining < 30

  return (
    <div style={styles.hud}>
      {/* タイマー */}
      <div style={{ ...styles.timer, color: isRed ? "#ef5350" : "#fff" }}>
        {mm}:{ss}
      </div>

      {/* スナイパー専用UI */}
      {role === "sniper" && (
        <div style={styles.sniperPanel}>
          <div style={styles.modeLabel}>
            {sniperMode === "aiming"        && "[ 狙撃モード ]"}
            {sniperMode === "walking"       && "[ 移動モード ]"}
            {sniperMode === "transitioning" && "[ モード切替中... ]"}
          </div>

          {sniperMode === "transitioning" && (
            <div style={styles.progressWrap}>
              <div style={{ ...styles.progressBar, width: `${transProgress * 100}%` }} />
              <span style={styles.progressLabel}>{Math.round(transProgress * 10)}秒</span>
            </div>
          )}

          {sniperMode === "aiming" && (
            <button style={styles.fireBtn} onClick={onFire}>
              🎯 射撃
            </button>
          )}
        </div>
      )}

      {/* ボディガード専用UI */}
      {role === "bodyguard" && (
        <div style={styles.bodyguardPanel}>
          <button style={styles.orderBtn} onClick={() => onCoverOrder("CoverPoint_1")}>
            📢 [E] VIPを物陰へ
          </button>
          <button style={styles.orderBtn} onClick={() => onDispatchOrder("guard_1")}>
            🚔 [Q] 警備員を派遣
          </button>
        </div>
      )}

      {/* 操作ガイド */}
      <div style={styles.guide}>
        {role === "sniper" ? (
          <>WASD 移動 | マウス 視点 | 右クリック Aimモード切替(10秒) | 射撃はAiming中のみ</>
        ) : (
          <>WASD 移動 | マウス 視点 | Shift ダッシュ | E: VIP誘導 | Q: 警備員派遣</>
        )}
      </div>
    </div>
  )
}

// ─── スコープオーバーレイ ─────────────────────────────────────
export function ScopeOverlay() {
  return (
    <div style={styles.scopeOverlay}>
      {/* 円形クロップ */}
      <div style={styles.scopeFrame}>
        {/* 十字線 */}
        <div style={styles.crossH} />
        <div style={styles.crossV} />
        <div style={styles.crossCircle} />
      </div>
      {/* 四隅の暗転 */}
      <div style={styles.scopeVignette} />
    </div>
  )
}

// ─── 発見プログレス円 ─────────────────────────────────────────
export function DetectCircle({ progress }: { progress: number }) {
  const r       = 40
  const circ    = 2 * Math.PI * r
  const dashOffset = circ * (1 - progress)
  const color   = progress > 0 ? "#ffb300" : "rgba(255,255,255,0.3)"

  return (
    <div style={styles.detectWrap}>
      <svg width={100} height={100} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={50} cy={50} r={r} fill="none"
          stroke="rgba(255,255,255,0.15)" strokeWidth={4} />
        <circle cx={50} cy={50} r={r} fill="none"
          stroke={color} strokeWidth={4}
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.1s linear" }}
        />
      </svg>
      <div style={styles.detectDot} />
    </div>
  )
}

// ─── スタイル ─────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  hud: {
    position: "fixed", inset: 0, pointerEvents: "none",
    fontFamily: "'Segoe UI', 'Noto Sans JP', sans-serif",
  },
  timer: {
    position: "absolute", top: 16, left: "50%",
    transform: "translateX(-50%)",
    fontSize: 28, fontWeight: 700, letterSpacing: "0.1em",
    textShadow: "0 2px 8px rgba(0,0,0,0.8)",
  },
  sniperPanel: {
    position: "absolute", bottom: 80, left: "50%",
    transform: "translateX(-50%)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
  },
  modeLabel: {
    color: "#4fc3f7", fontSize: 16, fontWeight: 600,
    background: "rgba(0,0,0,0.5)", padding: "4px 16px", borderRadius: 4,
  },
  progressWrap: {
    width: 240, height: 6, background: "rgba(255,255,255,0.15)",
    borderRadius: 3, overflow: "hidden", position: "relative",
  },
  progressBar: {
    height: "100%", background: "linear-gradient(90deg,#1565c0,#4fc3f7)",
    borderRadius: 3, transition: "width 0.3s",
  },
  progressLabel: {
    position: "absolute", right: 0, top: -18, fontSize: 11, color: "#aaa",
  },
  fireBtn: {
    pointerEvents: "all",
    padding: "10px 32px", background: "rgba(239,83,80,0.85)",
    border: "none", borderRadius: 6, color: "#fff",
    fontSize: 16, fontWeight: 600, cursor: "pointer",
  },
  bodyguardPanel: {
    position: "absolute", bottom: 80, right: 24,
    display: "flex", flexDirection: "column", gap: 8,
  },
  orderBtn: {
    pointerEvents: "all",
    padding: "8px 20px", background: "rgba(30,60,120,0.85)",
    border: "1px solid rgba(79,195,247,0.4)",
    borderRadius: 6, color: "#4fc3f7", fontSize: 13, cursor: "pointer",
  },
  guide: {
    position: "absolute", bottom: 12, left: "50%",
    transform: "translateX(-50%)",
    fontSize: 12, color: "rgba(255,255,255,0.5)",
    textShadow: "0 1px 4px rgba(0,0,0,0.9)",
    whiteSpace: "nowrap",
  },
  // スコープ
  scopeOverlay: {
    position: "fixed", inset: 0, pointerEvents: "none",
  },
  scopeFrame: {
    position: "absolute", top: "50%", left: "50%",
    transform: "translate(-50%,-50%)",
    width: 300, height: 300, borderRadius: "50%",
    border: "2px solid rgba(0,200,50,0.6)",
    overflow: "hidden",
  },
  crossH: {
    position: "absolute", top: "50%", left: 0, right: 0,
    height: 1, background: "rgba(0,200,50,0.7)", transform: "translateY(-50%)",
  },
  crossV: {
    position: "absolute", left: "50%", top: 0, bottom: 0,
    width: 1, background: "rgba(0,200,50,0.7)", transform: "translateX(-50%)",
  },
  crossCircle: {
    position: "absolute", top: "50%", left: "50%",
    transform: "translate(-50%,-50%)",
    width: 8, height: 8, borderRadius: "50%",
    border: "1px solid rgba(0,200,50,0.9)",
  },
  scopeVignette: {
    position: "absolute", inset: 0,
    background: "radial-gradient(circle 150px at 50% 50%, transparent 148px, rgba(0,0,0,0.95) 150px)",
  },
  // 発見円
  detectWrap: {
    position: "fixed", top: "50%", left: "50%",
    transform: "translate(-50%,-50%)",
    pointerEvents: "none",
  },
  detectDot: {
    position: "absolute", top: "50%", left: "50%",
    transform: "translate(-50%,-50%)",
    width: 6, height: 6, borderRadius: "50%",
    background: "rgba(255,255,255,0.7)",
  },
}
