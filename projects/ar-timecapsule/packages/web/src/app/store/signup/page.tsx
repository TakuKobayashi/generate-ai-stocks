"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, saveAuth } from "@/lib/api";
export default function StoreSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", displayName: "", shopName: "", inviteCode: "" });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 40 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--ghost)" }}>AR<span style={{ color: "var(--cyan)" }}>·</span>Timecapsule</span>
        </Link>
        <div className="card" style={{ padding: 32 }}>
          <div className="badge badge-amber" style={{ marginBottom: 16 }}>店舗アカウント</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>店舗・ビジネス登録</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 32 }}>クーポン付きARタイムカプセルを設置できます。招待コードが必要です。</p>
          <form onSubmit={async (e) => { e.preventDefault(); setError(""); setLoading(true); try { const res = await api.auth.storeSignup(form.email, form.password, form.displayName, form.shopName, form.inviteCode); if (!res.success) { setError(res.error.message); return; } saveAuth(res.data); router.push("/admin/coupons"); } catch { setError("登録に失敗しました"); } finally { setLoading(false); } }} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="form-group"><label className="label">店舗名</label><input className="input" value={form.shopName} onChange={set("shopName")} placeholder="スターバックス渋谷店" required /></div>
            <div className="form-group"><label className="label">担当者名</label><input className="input" value={form.displayName} onChange={set("displayName")} placeholder="山田太郎" required /></div>
            <div className="form-group"><label className="label">メールアドレス</label><input className="input" type="email" value={form.email} onChange={set("email")} placeholder="store@example.com" required /></div>
            <div className="form-group"><label className="label">パスワード</label><input className="input" type="password" value={form.password} onChange={set("password")} placeholder="8文字以上" required minLength={8} /></div>
            <div className="form-group"><label className="label">招待コード</label><input className="input" value={form.inviteCode} onChange={set("inviteCode")} placeholder="運営から発行された招待コード" required /><p className="hint">招待コードは運営にお問い合わせください</p></div>
            {error && <div className="alert alert-error">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center", background: "var(--amber)", color: "var(--space)" }}>{loading ? "登録中..." : "店舗アカウントを作成"}</button>
          </form>
        </div>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--muted)" }}>
          一般ユーザー: <Link href="/auth/signup" style={{ color: "var(--cyan)" }}>こちら</Link> / <Link href="/auth/login" style={{ color: "var(--cyan)" }}>ログイン</Link>
        </div>
      </div>
    </div>
  );
}
