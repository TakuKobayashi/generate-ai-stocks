import styles from './Header.module.css';
import Link from 'next/link';

interface HeaderProps {
  unreadCount?: number;
  showBack?: boolean;
  title?: string;
  onBack?: () => void;
}

export default function Header({ unreadCount = 0, showBack, title, onBack }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {showBack ? (
          <button className={styles.backBtn} onClick={onBack} aria-label="戻る">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
        ) : (
          <Link href="/" className={styles.logoLink}>
            <span className={styles.logoIcon}>🍺</span>
          </Link>
        )}

        <h1 className={styles.title}>{title ?? '飲みに行きたい！'}</h1>

        <div className={styles.actions}>
          {!showBack && (
            <Link href="/notifications/" className={styles.notifBtn} aria-label="通知">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && (
                <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
