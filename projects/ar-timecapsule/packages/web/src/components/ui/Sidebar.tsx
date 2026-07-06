"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  return (
    <aside className="sidebar">
      <div className="sidebar-section">メニュー</div>
      <Link href="/admin" className={`sidebar-link ${pathname === "/admin" ? "active" : ""}`}><span>🏠</span> ダッシュボード</Link>
      <Link href="/admin/capsules" className={`sidebar-link ${isActive("/admin/capsules") ? "active" : ""}`}><span>💊</span> タイムカプセル</Link>
      {(user?.role === "store" || user?.role === "admin") && <>
        <div className="sidebar-section">クーポン管理</div>
        <Link href="/admin/coupons" className={`sidebar-link ${isActive("/admin/coupons") && !isActive("/admin/coupons/new") ? "active" : ""}`}><span>🎟️</span> クーポン一覧</Link>
        <Link href="/admin/coupons/new" className={`sidebar-link ${isActive("/admin/coupons/new") ? "active" : ""}`}><span>➕</span> クーポン作成</Link>
      </>}
      {user?.role === "admin" && <>
        <div className="sidebar-section">管理者</div>
        <Link href="/admin/capsules?view=all" className="sidebar-link"><span>🌍</span> 全カプセルマップ</Link>
      </>}
    </aside>
  );
}
