"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import dynamic from "next/dynamic";
const LocationMap = dynamic(() => import("@/components/map/LocationMap"), { ssr: false, loading: () => <div style={{ height: 360, background: "var(--space-2)", borderRadius: "var(--radius-l)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>地図を読み込み中...</div> });
type LatLng = { lat: number; lng: number };

export default function NewCouponPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [pos, setPos] = useState<LatLng|null>(null);
  const [cap, setCap] = useState({ title: "", message: "", visibility: "public", expireAt: "" });
  const [coup, setCoup] = useState({ title: "", description: "", shopName: user?.shopName ?? "", redemptionType: "screen" as "qr"|"code"|"screen", redemptionCode: "", redeemLimit: "", expireAt: "" });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const setCap_ = (k: keyof typeof cap) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => setCap((f) => ({ ...f, [k]: e.target.value }));
  const setCoup_ = (k: keyof typeof coup) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => setCoup((f) => ({ ...f, [k]: e.target.value as never }));

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/admin/coupons" className="btn btn-ghost btn-sm">← 戻る</Link>
        <div><h1 style={{ fontSize: 24, fontWeight: 700 }}>クーポン付きカプセルを作成</h1><p style={{ color: "var(--muted)", fontSize: 14, marginTop: 2 }}>位置情報とクーポン情報を設定</p></div>
      </div>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (!pos) { setError("地図上で位置を選択してください"); return; }
        setError(""); setLoading(true);
        try {
          const res = await api.capsules.create({
            title: cap.title, message: cap.message || undefined, latitude: pos.lat, longitude: pos.lng,
            visibility: cap.visibility, expireAt: cap.expireAt ? new Date(cap.expireAt).toISOString() : undefined,
            coupon: { title: coup.title, description: coup.description || undefined, shopName: coup.shopName || user?.shopName || "", redemptionType: coup.redemptionType, redemptionCode: coup.redemptionCode || undefined, redeemLimit: coup.redeemLimit ? parseInt(coup.redeemLimit, 10) : undefined, expireAt: coup.expireAt ? new Date(coup.expireAt).toISOString() : undefined },
          });
          if (!res.success) { setError(res.error.message); return; }
          router.push("/admin/coupons");
        } catch { setError("作成に失敗しました"); } finally { setLoading(false); }
      }} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>📍 設置場所を選択</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>ユーザーがこの場所に到着するとクーポンを取得できます（デフォルト半径100m以内）</p>
          <LocationMap selectable selectedPos={pos ?? undefined} onSelect={setPos} height={360} zoom={14} />
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>💊 タイムカプセル情報</h2>
          <div className="form-group"><label className="label">カプセルのタイトル *</label><input className="input" value={cap.title} onChange={setCap_("title")} placeholder="〇〇店 来店特典" required maxLength={100} /></div>
          <div className="form-group"><label className="label">案内メッセージ（任意）</label><textarea className="textarea" value={cap.message} onChange={(e) => setCap((f) => ({ ...f, message: e.target.value }))} placeholder="このエリアに来たらぜひお立ち寄りください！" rows={3} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group"><label className="label">公開設定</label><select className="select" value={cap.visibility} onChange={setCap_("visibility")}><option value="public">公開</option><option value="private">非公開</option></select></div>
            <div className="form-group"><label className="label">カプセル有効期限（任意）</label><input className="input" type="datetime-local" value={cap.expireAt} onChange={setCap_("expireAt")} /></div>
          </div>
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 18, border: "1px solid rgba(245,166,35,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 24 }}>🎟️</span><h2 style={{ fontSize: 16, fontWeight: 600 }}>クーポン情報</h2></div>
          <div className="form-group"><label className="label">クーポン名 *</label><input className="input" value={coup.title} onChange={setCoup_("title")} placeholder="コーヒー1杯 20%OFF" required maxLength={100} /></div>
          <div className="form-group"><label className="label">説明（任意）</label><textarea className="textarea" value={coup.description} onChange={(e) => setCoup((f) => ({ ...f, description: e.target.value }))} placeholder="ご来店の際にスタッフにご提示ください" rows={2} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group"><label className="label">店舗名</label><input className="input" value={coup.shopName} onChange={setCoup_("shopName")} placeholder={user?.shopName ?? "店舗名"} required /></div>
            <div className="form-group"><label className="label">提示方法</label><select className="select" value={coup.redemptionType} onChange={setCoup_("redemptionType")}><option value="screen">画面提示</option><option value="code">コード提示</option><option value="qr">QRコード</option></select></div>
          </div>
          {(coup.redemptionType === "code" || coup.redemptionType === "qr") && <div className="form-group"><label className="label">{coup.redemptionType === "qr" ? "QRデータ" : "クーポンコード"}</label><input className="input" value={coup.redemptionCode} onChange={setCoup_("redemptionCode")} placeholder={coup.redemptionType === "qr" ? "https://..." : "SUMMER2024"} /></div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group"><label className="label">取得上限（任意）</label><input className="input" type="number" value={coup.redeemLimit} onChange={setCoup_("redeemLimit")} placeholder="空欄=無制限" min={1} /></div>
            <div className="form-group"><label className="label">クーポン有効期限（任意）</label><input className="input" type="datetime-local" value={coup.expireAt} onChange={setCoup_("expireAt")} /></div>
          </div>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {!pos && <div className="alert alert-info">📍 地図をクリックしてクーポンの設置場所を選択してください</div>}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <Link href="/admin/coupons" className="btn btn-ghost">キャンセル</Link>
          <button className="btn btn-primary" type="submit" disabled={loading || !pos} style={{ minWidth: 200, justifyContent: "center", background: "var(--amber)", color: "var(--space)" }}>{loading ? "作成中..." : "クーポンを設置する 🎟️"}</button>
        </div>
      </form>
    </div>
  );
}
