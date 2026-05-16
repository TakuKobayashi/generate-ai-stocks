'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { useWebPush } from '@/hooks/useWebPush';
import { useGeolocation } from '@/hooks/useGeolocation';
import { getUnreadCount } from '@/lib/api';
import Header from '@/components/Header/Header';
import CreateInviteForm from '@/components/CreateInviteForm/CreateInviteForm';
import WebPushToggle from '@/components/WebPushToggle/WebPushToggle';
import styles from './page.module.css';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const { state: pushState, error: pushError, foregroundMessage, subscribe, unsubscribe } =
    useWebPush(user?.id);
  const { position, request: requestLocation } = useGeolocation();
  const [unreadCount, setUnreadCount] = useState(0);

  // 未ログインなら setup へ
  useEffect(() => {
    if (!loading && !user) router.replace('/setup/');
  }, [loading, user, router]);

  // 未読件数を定期取得
  useEffect(() => {
    if (!user) return;
    const fetch_ = () => getUnreadCount(user.id).then(r => setUnreadCount(r.count)).catch(() => {});
    fetch_();
    const id = setInterval(fetch_, 30_000);
    return () => clearInterval(id);
  }, [user]);

  // 初回アクセス時に位置情報を取得
  useEffect(() => {
    if (user) requestLocation();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !user) {
    return (
      <div className={styles.loading}>
        <span>🍺</span>
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <Header unreadCount={unreadCount} />

      {/* フォアグラウンド通知トースト */}
      {foregroundMessage && (
        <div className={styles.toast} role="alert">
          <span className={styles.toastIcon}>🍺</span>
          <div className={styles.toastText}>
            <p className={styles.toastTitle}>{foregroundMessage.title}</p>
            <p className={styles.toastBody}>{foregroundMessage.body}</p>
          </div>
        </div>
      )}

      <main>
        <div className={styles.pushSection}>
          <WebPushToggle
            state={pushState}
            error={pushError}
            onSubscribe={subscribe}
            onUnsubscribe={unsubscribe}
          />
        </div>

        <CreateInviteForm
          userId={user.id}
          currentPosition={position}
          onLocationRequest={requestLocation}
        />
      </main>
    </div>
  );
}
