'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { adminStorage } from '@/lib/storage';
import styles from './layout.module.css';

// 認証不要なページ
const PUBLIC_PATHS = ['/admin/login', '/admin/register'];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    setMounted(true);

    // 認証不要ページはスキップ
    if (PUBLIC_PATHS.includes(pathname)) return;

    const u = adminStorage.getUser();
    if (!u) {
      router.replace('/admin/login');
      return;
    }
    setUser(u);
  }, [pathname, router]);

  const handleLogout = () => {
    adminStorage.clear();
    setUser(null);
    router.replace('/admin/login');
  };

  // 認証不要ページはレイアウトなしで表示
  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  // マウント前はサーバー・クライアントで同じ何もない状態を返す（hydration mismatch 防止）
  if (!mounted) {
    return (
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarLogo}>
            <span className={styles.logoIcon}>◈</span>
            <div>
              <div className={styles.logoTitle}>STAMP RALLY</div>
              <div className={styles.logoSub}>管理者ダッシュボード</div>
            </div>
          </div>
          <nav className={styles.nav} />
          <div className={styles.sidebarBottom} />
        </aside>
        <main className={styles.main} />
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      {/* サイドバー */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <span className={styles.logoIcon}>◈</span>
          <div>
            <div className={styles.logoTitle}>STAMP RALLY</div>
            <div className={styles.logoSub}>管理者ダッシュボード</div>
          </div>
        </div>

        <nav className={styles.nav}>
          <NavItem href="/admin" icon="⊞" label="スタンプラリー一覧" active={pathname === '/admin'} />
          <NavItem href="/admin/create" icon="＋" label="新規作成" active={pathname === '/admin/create'} />
        </nav>

        <div className={styles.sidebarBottom}>
          {user && (
            <div className={styles.userInfo}>
              <div className={styles.userAvatar}>{user.name[0]}</div>
              <div className={styles.userText}>
                <div className={styles.userName}>{user.name}</div>
                <div className={styles.userEmail}>{user.email}</div>
              </div>
            </div>
          )}
          <button className={`btn btn-ghost btn-sm ${styles.logoutBtn}`} onClick={handleLogout}>
            ログアウト
          </button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}

function NavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link href={href} className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}>
      <span className={styles.navIcon}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
