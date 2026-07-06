"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import dynamic from "next/dynamic";
const LocationMap = dynamic(() => import("@/components/map/LocationMap"), { ssr: false, loading: () => <div style={{ height: 360, background: "var(--space-2)", borderRadius: "var(--radius-l)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>地図を読み込み中...</div> });
type LatLng = { lat: number; lng: number };

export default function NewCapsulePage() {
  const router = useRouter();
  const [pos, setPos] = useState<LatLng|null>(null);
  const [form, setForm] = useState({ title: "", message: "", visibility: "public", expireAt: "", discoverRadiusMeters: "100" });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/admin/capsules" className="btn btn-ghost btn-sm">← 戻る</Link>
        <div><h1 style={{ fontSize: 24, fontWeight: 700 }}>新しいタイムカプセル</h1><p style={{ color: "var(--muted)", fontSize: 14, marginTop: 2 }}>地図で位置を選択し、メッセージを入力</p></div>
      </div>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (!pos) { setError("地図上で位置を選択してください"); return; }
        setError(""); setLoading(true);
        try {
          const res = await api.capsules.create({ title: form.title, message: form.message || undefined, latitude: pos.lat, longitude: pos.lng, visibility: form.visibility, expireAt: form.expireAt ? new Date(form.expireAt).toISOString() : undefined, discoverRadiusMeters: parseInt(form.discoverRadiusMeters, 10) });
          if (!res.success) { setError(res.error.message); return; }
          router.push("/admin/capsules");
        } catch { setError("作成に失敗しました"); } finally { setLoading(false); }
      }} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="card"><h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>📍 位置を選択</h2><LocationMap selectable selectedPos={pos ?? undefined} onSelect={setPos} height={360} zoom={13} /></div>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>📝 カプセルの内容</h2>
          <div className="form-group"><label className="label">タイトル *</label><input className="input" value={form.title} onChange={set("title")} placeholder="この場所での思い出" required maxLength={100} /></div>
          <div className="form-group"><label className="label">メッセージ</label><textarea className="textarea" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="ここで起きた出来事や、発見した人へのメッセージ..." maxLength={5000} rows={5} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div className="form-group"><label className="label">公開設定</label><select className="select" value={form.visibility} onChange={set("visibility")}><option value="public">公開</option><option value="friends">フレンドのみ</option><option value="private">非公開</option></select></div>
            <div className="form-group"><label className="label">発見可能半径 (m)</label><input className="input" type="number" value={form.discoverRadiusMeters} onChange={set("discoverRadiusMeters")} min={10} max={1000} /><p className="hint">この距離内に近づくと発見可能</p></div>
            <div className="form-group"><label className="label">有効期限（任意）</label><input className="input" type="datetime-local" value={form.expireAt} onChange={set("expireAt")} /></div>
          </div>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {!pos && <div className="alert alert-info">地図をクリックして位置を選択してください</div>}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <Link href="/admin/capsules" className="btn btn-ghost">キャンセル</Link>
          <button className="btn btn-primary" type="submit" disabled={loading || !pos} style={{ minWidth: 160, justifyContent: "center" }}>{loading ? "作成中..." : "カプセルを埋める 💊"}</button>
        </div>
      </form>
    </div>
  );
}
