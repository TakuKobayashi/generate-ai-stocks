"use client";
import { useAuth } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import styles from "./layout.module.css";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, username, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated && pathname !== "/admin/login") {
      router.push("/admin/login");
    }
  }, [isAuthenticated, pathname, router]);

  if (!isAuthenticated && pathname !== "/admin/login") return null;
  if (pathname === "/admin/login") return <>{children}</>;

  const navItems = [
    { href: "/admin", label: "ダッシュボード", icon: "⊞" },
    { href: "/admin/tenants", label: "テナント管理", icon: "🏢" },
    { href: "/admin/logs", label: "通話ログ", icon: "📋" },
  ];

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link href="/" className={styles.sidebarLogo}>
            <span className={styles.logoMark}>▶</span> PhoneRoute
          </Link>
        </div>
        <nav className={styles.sidebarNav}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${
                pathname === item.href ? styles.navItemActive : ""
              }`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.userBadge}>
            <span className={styles.userIcon}>👤</span>
            <span className={styles.userName}>{username}</span>
          </div>
          <button onClick={logout} className={styles.logoutBtn}>
            ログアウト
          </button>
        </div>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
