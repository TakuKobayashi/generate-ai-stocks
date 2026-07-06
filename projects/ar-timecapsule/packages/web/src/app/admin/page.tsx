"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { api, type TimeCapsuleItem } from "@/lib/api";
import dynamic from "next/dynamic";
const CapsuleMap = dynamic(() => import("@/components/map/CapsuleMap"), { ssr: false, loading: () => <div style={{ height: 300, background: "var(--space-2)", borderRadius: "var(--radius-l)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>地図を読み込み中...</div> });
export default function AdminDashboard() {
  const { user } = useAuth();
  const [capsules, setCapsules] = useState<TimeCapsuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { const res = await api.capsules.my(); if (res.success) setCapsules(res.data.items); setLoading(false); })(); }, []);
  const active = capsules.filter((c) => c.status === "active").length;
  const audio  = capsules.filter((c) => c.mediaType === "audio").length;
  const views  = capsules.reduce((s, c) => s + c.viewCount, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div><h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>こんにちは、{user?.displayName} さん 👋</h1><p style={{ color: "var(--muted)" }}>タイムカプセルの概要</p></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 16 }}>
        {[{label:"全カプセル",value:capsules.length,color:"var(--cyan)",icon:"💊"},{label:"アクティブ",value:active,color:"var(--success)",icon:"✅"},{label:"音声付き",value:audio,color:"var(--purple-l)",icon:"🎵"},{label:"総閲覧数",value:views,color:"var(--amber)",icon:"👁️"}].map((s) => (
          <div key={s.label} className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: s.color, fontFamily: "var(--font-display)" }}>{s.value}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>カプセルマップ</h2>
          <Link href="/admin/capsules" className="btn btn-ghost btn-sm">すべて見る →</Link>
        </div>
        <div style={{ padding: 16 }}>
          {loading ? <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}><span className="spinner" style={{ marginRight: 10 }} />読み込み中...</div>
          : capsules.length === 0 ? <div style={{ height: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: "var(--muted)" }}><span style={{ fontSize: 48 }}>💊</span><p>まだカプセルがありません</p><Link href="/admin/capsules/new" className="btn btn-primary btn-sm">最初のカプセルを作成</Link></div>
          : <CapsuleMap capsules={capsules} height={320} />}
        </div>
      </div>
      {capsules.length > 0 && (
        <div><h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>最近のカプセル</h2>
          <div className="card" style={{ padding: 0 }}>
            <table className="table"><thead><tr><th>タイトル</th><th>タイプ</th><th>ステータス</th><th>閲覧数</th><th>作成日</th></tr></thead>
              <tbody>{capsules.slice(0, 8).map((c) => (<tr key={c.id}><td style={{ fontWeight: 500 }}>{c.title}</td><td><span className={`badge ${c.mediaType==="audio"?"badge-cyan":"badge-muted"}`}>{c.mediaType==="audio"?"🎵 音声":"📝 テキスト"}</span></td><td><span className={`badge ${c.status==="active"?"badge-success":"badge-danger"}`}>{c.status}</span></td><td style={{ color: "var(--muted)" }}>{c.viewCount}</td><td style={{ color: "var(--muted)", fontSize: 13 }}>{new Date(c.createdAt).toLocaleDateString("ja-JP")}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
