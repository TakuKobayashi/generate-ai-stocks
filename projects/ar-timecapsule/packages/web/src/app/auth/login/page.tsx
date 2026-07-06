"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 40 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--ghost)" }}>AR<span style={{ color: "var(--cyan)" }}>·</span>Timecapsule</span>
        </Link>
        <div className="card" style={{ padding: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>ログイン</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 32 }}>アカウントにサインイン</p>
          <form onSubmit={async (e) => { e.preventDefault(); setError(""); setLoading(true); try { await login(email, password); router.push("/admin"); } catch (err) { setError(err instanceof Error ? err.message : "失敗しました"); } finally { setLoading(false); } }} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="form-group"><label className="label">メールアドレス</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
            <div className="form-group"><label className="label">パスワード</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></div>
            {error && <div className="alert alert-error">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>{loading ? "ログイン中..." : "ログイン"}</button>
          </form>
        </div>
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "var(--muted)" }}>
          アカウントなし: <Link href="/auth/signup" style={{ color: "var(--cyan)" }}>ユーザー登録</Link> / <Link href="/store/signup" style={{ color: "var(--amber)" }}>店舗登録</Link>
        </div>
      </div>
    </div>
  );
}
