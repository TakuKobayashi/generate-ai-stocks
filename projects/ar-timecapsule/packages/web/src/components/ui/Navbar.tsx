"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="navbar-logo" style={{ textDecoration: "none" }}>AR<span className="dot">·</span>Timecapsule</Link>
        <div className="navbar-links">
          {user && <>
            <Link href="/admin" className="navbar-link">ダッシュボード</Link>
            <Link href="/admin/capsules" className="navbar-link">カプセル</Link>
            {(user.role === "store" || user.role === "admin") && <Link href="/admin/coupons" className="navbar-link">クーポン</Link>}
          </>}
        </div>
        <div className="navbar-right">
          {user ? <>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>{user.displayName}<span className={`badge badge-${user.role === "admin" ? "danger" : user.role === "store" ? "amber" : "cyan"}`} style={{ marginLeft: 8 }}>{user.role}</span></span>
            <button className="btn btn-ghost btn-sm" onClick={async () => { await logout(); router.push("/"); }}>ログアウト</button>
          </> : <>
            <Link href="/auth/login" className="btn btn-ghost btn-sm">ログイン</Link>
            <Link href="/auth/signup" className="btn btn-primary btn-sm">登録</Link>
          </>}
        </div>
      </div>
    </nav>
  );
}
