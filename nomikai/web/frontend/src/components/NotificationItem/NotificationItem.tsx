import type { AppNotification } from '@/lib/api';
import styles from './NotificationItem.module.css';

interface NotificationItemProps {
  notification: AppNotification;
  onClick: () => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}時間前`;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const unread = notification.isRead === 0;

  return (
    <button
      className={`${styles.item} ${unread ? styles.unread : ''}`}
      onClick={onClick}
    >
      <div className={styles.iconWrap}>
        <span className={styles.icon}>🍺</span>
        {unread && <span className={styles.dot} aria-label="未読" />}
      </div>

      <div className={styles.content}>
        <div className={styles.topRow}>
          <p className={`${styles.title} ${unread ? styles.titleUnread : ''}`}>
            {notification.title}
          </p>
          <time className={styles.time} dateTime={new Date(notification.createdAt).toISOString()}>
            {formatDate(notification.createdAt)}
          </time>
        </div>
        <p className={styles.body}>{notification.body}</p>
        {notification.inviteId && (
          <span className={styles.link}>詳細を見る →</span>
        )}
      </div>
    </button>
  );
}
