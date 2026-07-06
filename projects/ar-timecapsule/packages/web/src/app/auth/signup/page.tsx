"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, saveAuth } from "@/lib/api";
export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", displayName: "" });
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 40 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--ghost)" }}>AR<span style={{ color: "var(--cyan)" }}>·</span>Timecapsule</span>
        </Link>
        <div className="card" style={{ padding: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>ユーザー登録</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 32 }}>無料アカウントを作成</p>
          <form onSubmit={async (e) => { e.preventDefault(); setError(""); setLoading(true); try { const res = await api.auth.signup(form.email, form.password, form.displayName); if (!res.success) { setError(res.error.message); return; } saveAuth(res.data); router.push("/admin"); } catch { setError("登録に失敗しました"); } finally { setLoading(false); } }} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="form-group"><label className="label">表示名</label><input className="input" value={form.displayName} onChange={set("displayName")} placeholder="山田太郎" required /></div>
            <div className="form-group"><label className="label">メールアドレス</label><input className="input" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" required /></div>
            <div className="form-group"><label className="label">パスワード</label><input className="input" type="password" value={form.password} onChange={set("password")} placeholder="8文字以上、大文字・小文字・数字含む" required minLength={8} /></div>
            {error && <div className="alert alert-error">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>{loading ? "登録中..." : "アカウントを作成"}</button>
          </form>
        </div>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--muted)" }}>
          店舗: <Link href="/store/signup" style={{ color: "var(--amber)" }}>こちら</Link> / <Link href="/auth/login" style={{ color: "var(--cyan)" }}>ログイン</Link>
        </div>
      </div>
    </div>
  );
}
