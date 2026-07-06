"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api, type TimeCapsuleItem } from "@/lib/api";
import dynamic from "next/dynamic";
const CapsuleMap = dynamic(() => import("@/components/map/CapsuleMap"), { ssr: false, loading: () => <div style={{ height: 480, background: "var(--space-2)", borderRadius: "var(--radius-l)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>地図を読み込み中...</div> });

export default function CapsulesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const isAllView = searchParams.get("view") === "all" && (user?.role === "admin" || user?.role === "moderator");
  const [capsules, setCapsules] = useState<TimeCapsuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TimeCapsuleItem | null>(null);
  const [view, setView] = useState<"map"|"list">("map");
  const [deleting, setDeleting] = useState<string|null>(null);

  const fetchCapsules = useCallback(async () => {
    setLoading(true);
    const res = isAllView ? await api.capsules.all() : await api.capsules.my();
    if (res.success) setCapsules(res.data.items);
    setLoading(false);
  }, [isAllView]);

  useEffect(() => { fetchCapsules(); }, [fetchCapsules]);

  const handleDelete = async (id: string) => {
    if (!confirm("このカプセルを削除しますか？")) return;
    setDeleting(id);
    const res = await api.capsules.delete(id);
    if (res.success) { setCapsules((prev) => prev.filter((c) => c.id !== id)); setSelected(null); }
    setDeleting(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div><h1 style={{ fontSize: 24, fontWeight: 700 }}>{isAllView ? "全タイムカプセル (管理者)" : "マイカプセル"}</h1><p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>{capsules.length} 件</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", border: "1px solid var(--space-3)", borderRadius: "var(--radius-m)", overflow: "hidden" }}>
            <button className={`btn btn-sm ${view==="map"?"btn-primary":"btn-ghost"}`} onClick={() => setView("map")} style={{ borderRadius: 0 }}>🗺 マップ</button>
            <button className={`btn btn-sm ${view==="list"?"btn-primary":"btn-ghost"}`} onClick={() => setView("list")} style={{ borderRadius: 0 }}>📋 リスト</button>
          </div>
          <Link href="/admin/capsules/new" className="btn btn-primary btn-sm">+ 新規作成</Link>
        </div>
      </div>

      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><span className="spinner" style={{ width: 32, height: 32 }} /></div>
      : capsules.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>💊</div>
          <h3 style={{ marginBottom: 8 }}>カプセルがありません</h3>
          <Link href="/admin/capsules/new" className="btn btn-primary" style={{ marginTop: 16 }}>カプセルを作成</Link>
        </div>
      ) : view === "map" ? (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 500px" }}><CapsuleMap capsules={capsules} height={520} onCapsuleClick={(c) => setSelected(c)} /></div>
          {selected && (
            <div className="card" style={{ width: 300, flexShrink: 0, alignSelf: "flex-start" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <h3 style={{ fontWeight: 600, fontSize: 16 }}>{selected.title}</h3>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 18, cursor: "pointer" }}>×</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <span className={`badge ${selected.status==="active"?"badge-success":"badge-danger"}`}>{selected.status}</span>
                  <span className={`badge ${selected.mediaType==="audio"?"badge-cyan":"badge-muted"}`}>{selected.mediaType}</span>
                </div>
                <div style={{ color: "var(--muted)" }}><div>緯度: <span style={{ color: "var(--ghost)" }}>{selected.latitude.toFixed(6)}</span></div><div>経度: <span style={{ color: "var(--ghost)" }}>{selected.longitude.toFixed(6)}</span></div></div>
                {selected.expireAt && <div style={{ color: "var(--muted)" }}>期限: <span style={{ color: "var(--amber)" }}>{new Date(selected.expireAt).toLocaleDateString("ja-JP")}</span></div>}
                <div style={{ color: "var(--muted)" }}>閲覧数: {selected.viewCount}</div>
                {(user?.role === "admin" || user?.id === selected.userId) && <button className="btn btn-danger btn-sm" style={{ marginTop: 8 }} onClick={() => handleDelete(selected.id)} disabled={deleting === selected.id}>{deleting === selected.id ? "削除中..." : "削除"}</button>}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>タイトル</th><th>タイプ</th><th>公開</th><th>ステータス</th><th>閲覧数</th><th>期限</th><th>作成日</th><th></th></tr></thead>
            <tbody>{capsules.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}><div style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div><div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>{c.latitude.toFixed(4)},{c.longitude.toFixed(4)}</div></td>
                <td><span className={`badge ${c.mediaType==="audio"?"badge-cyan":"badge-muted"}`}>{c.mediaType==="audio"?"🎵":"📝"}</span></td>
                <td><span className="badge badge-muted">{c.visibility}</span></td>
                <td><span className={`badge ${c.status==="active"?"badge-success":"badge-danger"}`}>{c.status}</span></td>
                <td style={{ color: "var(--muted)" }}>{c.viewCount}</td>
                <td style={{ color: "var(--muted)", fontSize: 12 }}>{c.expireAt ? new Date(c.expireAt).toLocaleDateString("ja-JP") : "—"}</td>
                <td style={{ color: "var(--muted)", fontSize: 12 }}>{new Date(c.createdAt).toLocaleDateString("ja-JP")}</td>
                <td>{(user?.role === "admin" || user?.id === c.userId) && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)} disabled={deleting === c.id}>{deleting === c.id ? "..." : "削除"}</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
