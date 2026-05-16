'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import {
  getNotifications, markAsRead, markAllAsRead,
  type AppNotification,
} from '@/lib/api';
import Header from '@/components/Header/Header';
import NotificationItem from '@/components/NotificationItem/NotificationItem';
import styles from './page.module.css';

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = notifications.filter(n => n.isRead === 0).length;

  const load = useCallback(async (userId: string) => {
    setFetching(true);
    setError(null);
    try {
      const data = await getNotifications(userId);
      setNotifications(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '通知の取得に失敗しました');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) { router.replace('/setup/'); return; }
    if (user) load(user.id);
  }, [loading, user, router, load]);

  const handleRead = useCallback(async (notif: AppNotification) => {
    if (!user || notif.isRead === 1) return;
    // 楽観的更新
    setNotifications(prev =>
      prev.map(n => n.id === notif.id ? { ...n, isRead: 1 } : n)
    );
    try {
      await markAsRead(notif.id, user.id);
    } catch {
      // 失敗時はロールバック
      setNotifications(prev =>
        prev.map(n => n.id === notif.id ? { ...n, isRead: 0 } : n)
      );
    }
  }, [user]);

  const handleReadAll = useCallback(async () => {
    if (!user) return;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: 1 })));
    try {
      await markAllAsRead(user.id);
    } catch {
      if (user) load(user.id);
    }
  }, [user, load]);

  if (loading || !user) return null;

  return (
    <div className="page-wrapper">
      <Header
        showBack
        title={unreadCount > 0 ? `通知 (${unreadCount})` : '通知'}
        onBack={() => router.back()}
      />

      <main>
        {/* アクションバー */}
        <div className={styles.actionBar}>
          <button
            className={styles.refreshBtn}
            onClick={() => load(user.id)}
            disabled={fetching}
            aria-label="更新"
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              className={fetching ? styles.spinning : ''}
            >
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            更新
          </button>
          {unreadCount > 0 && (
            <button className={styles.readAllBtn} onClick={handleReadAll}>
              すべて既読にする
            </button>
          )}
        </div>

        {/* コンテンツ */}
        {fetching && notifications.length === 0 ? (
          <div className={styles.loadingWrap}>
            <span className={styles.spinnerLarge} />
          </div>
        ) : error ? (
          <div className={styles.errorWrap}>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.retryBtn} onClick={() => load(user.id)}>再試行</button>
          </div>
        ) : notifications.length === 0 ? (
          <div className={styles.emptyWrap}>
            <span className={styles.emptyIcon}>🍺</span>
            <p className={styles.emptyTitle}>まだ通知がありません</p>
            <p className={styles.emptySub}>友達が飲みに誘ってくれるとここに表示されます</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {notifications.map(n => (
              <li key={n.id}>
                <NotificationItem
                  notification={n}
                  onClick={() => handleRead(n)}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
