import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "PLATEAU Sniper Simulation",
  description: "WebRTC P2P 位置同期 × PLATEAU 都市データ スナイパーシミュレーション",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, padding: 0, background: "#0a0a0f" }}>
        {children}
      </body>
    </html>
  )
}
