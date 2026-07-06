"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { api, type CouponDetail, type TimeCapsuleItem } from "@/lib/api";

type CouponWithCapsule = CouponDetail & { capsuleTitle?: string };

export default function CouponsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [coupons, setCoupons] = useState<CouponWithCapsule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "store" && user.role !== "admin") { router.push("/admin"); return; }
    (async () => {
      const res = await api.capsules.my();
      if (!res.success) { setLoading(false); return; }
      const list: CouponWithCapsule[] = [];
      for (const capsule of res.data.items) {
        const detail = await api.capsules.get(capsule.id);
        if (detail.success && detail.data.coupon) list.push({ ...detail.data.coupon, capsuleTitle: capsule.title });
      }
      setCoupons(list);
      setLoading(false);
    })();
  }, [user, router]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div><h1 style={{ fontSize: 24, fontWeight: 700 }}>クーポン管理</h1><p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>{user?.shopName ?? "店舗"} のクーポン</p></div>
        <Link href="/admin/coupons/new" className="btn btn-primary">+ クーポン付きカプセルを作成</Link>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 16 }}>
        {[{label:"全クーポン",value:coupons.length,icon:"🎟️",color:"var(--amber)"},{label:"アクティブ",value:coupons.filter((c)=>c.isActive).length,icon:"✅",color:"var(--success)"},{label:"総取得数",value:coupons.reduce((s,c)=>s+c.redeemCount,0),icon:"👥",color:"var(--cyan)"}].map((s) => (
          <div key={s.label} className="card" style={{ textAlign: "center" }}><div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div><div style={{ fontSize: 28, fontWeight: 700, color: s.color, fontFamily: "var(--font-display)" }}>{s.value}</div><div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{s.label}</div></div>
        ))}
      </div>
      {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><span className="spinner" style={{ width: 32, height: 32 }} /></div>
      : coupons.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎟️</div>
          <h3 style={{ marginBottom: 8 }}>クーポンがありません</h3>
          <Link href="/admin/coupons/new" className="btn btn-primary" style={{ marginTop: 16 }}>クーポン付きカプセルを作成</Link>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>クーポン名</th><th>カプセル</th><th>提示方法</th><th>取得数 / 上限</th><th>期限</th><th>状態</th></tr></thead>
            <tbody>{coupons.map((c) => (
              <tr key={c.id}>
                <td><div style={{ fontWeight: 500 }}>{c.title}</div>{c.description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{c.description}</div>}</td>
                <td style={{ color: "var(--muted)", fontSize: 13 }}>{c.capsuleTitle ?? "—"}</td>
                <td><span className="badge badge-purple">{c.redemptionType === "qr" ? "🔲 QR" : c.redemptionType === "code" ? "🔑 コード" : "📱 画面提示"}</span></td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--cyan)", fontWeight: 600 }}>{c.redeemCount}</span>
                    <span style={{ color: "var(--muted)" }}>/ {c.redeemLimit ?? "∞"}</span>
                    {c.redeemLimit && <div style={{ flex: 1, height: 4, background: "var(--space-3)", borderRadius: 2, minWidth: 60 }}><div style={{ height: "100%", background: "var(--cyan)", borderRadius: 2, width: `${Math.min(100,(c.redeemCount/c.redeemLimit)*100)}%` }} /></div>}
                  </div>
                </td>
                <td style={{ color: c.expireAt && new Date(c.expireAt) < new Date() ? "var(--danger)" : "var(--muted)", fontSize: 13 }}>{c.expireAt ? new Date(c.expireAt).toLocaleDateString("ja-JP") : "期限なし"}</td>
                <td><span className={`badge ${c.isActive ? "badge-success" : "badge-muted"}`}>{c.isActive ? "有効" : "無効"}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
