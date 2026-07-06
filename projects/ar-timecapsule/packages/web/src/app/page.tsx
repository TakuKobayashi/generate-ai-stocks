"use client";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function LandingPage() {
  const { user } = useAuth();
  return (
    <div style={{ minHeight: "100vh" }}>
      <nav className="navbar">
        <div className="navbar-inner">
          <span className="navbar-logo">AR<span className="dot">·</span>Timecapsule</span>
          <div className="navbar-links" />
          <div className="navbar-right">
            {user ? <Link href="/admin" className="btn btn-primary btn-sm">管理画面</Link> : <>
              <Link href="/auth/login" className="btn btn-ghost btn-sm">ログイン</Link>
              <Link href="/auth/signup" className="btn btn-primary btn-sm">無料で始める</Link>
            </>}
          </div>
        </div>
      </nav>
      <section style={{ padding: "120px 24px 80px", textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(107,63,160,0.3) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div className="container" style={{ position: "relative" }}>
          <div className="badge badge-cyan" style={{ marginBottom: 24, display: "inline-flex" }}><span>●</span> β 版公開中</div>
          <h1 style={{ fontSize: "clamp(40px,8vw,80px)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 24 }}>
            空間に、記憶を<br /><span style={{ color: "var(--cyan)" }}>埋める。</span>
          </h1>
          <p style={{ fontSize: 20, color: "var(--muted)", maxWidth: 560, margin: "0 auto 48px", lineHeight: 1.7 }}>
            現実世界の特定の場所にメッセージや音声、クーポンを埋め込む空間SNSです。
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/auth/signup" className="btn btn-primary btn-lg">カプセルを埋める →</Link>
            <Link href="/store/signup" className="btn btn-ghost btn-lg">店舗として登録</Link>
          </div>
        </div>
      </section>
      <section style={{ padding: "80px 24px", borderTop: "1px solid var(--space-3)" }}>
        <div className="container">
          <h2 style={{ fontSize: 36, fontWeight: 700, textAlign: "center", marginBottom: 64 }}>3ステップで始まる空間の物語</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 24 }}>
            {[
              { n: "01", t: "場所を選ぶ", d: "地図上で任意の位置を選択し、タイムカプセルを設置する場所を決めます。", c: "var(--cyan)" },
              { n: "02", t: "記憶を封入する", d: "テキストメッセージ、音声ファイル、クーポン情報を追加して埋め込みます。", c: "var(--purple-l)" },
              { n: "03", t: "現地で発見する", d: "実際にその場所に行くと、Unityアプリが検出し空間オーディオで再生します。", c: "var(--amber)" },
            ].map((f) => (
              <div key={f.n} className="card">
                <div style={{ fontSize: 48, fontFamily: "var(--font-display)", fontWeight: 700, color: f.c, opacity: 0.3, lineHeight: 1, marginBottom: 16 }}>{f.n}</div>
                <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>{f.t}</h3>
                <p style={{ color: "var(--muted)", lineHeight: 1.7 }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <footer style={{ borderTop: "1px solid var(--space-3)", padding: "32px 24px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>AR<span style={{ color: "var(--cyan)" }}>·</span>Timecapsule</span>
          <span>© 2024 AR Timecapsule. All rights reserved.</span>
          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/auth/login" style={{ color: "var(--muted)" }}>ログイン</Link>
            <Link href="/store/signup" style={{ color: "var(--muted)" }}>店舗登録</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
