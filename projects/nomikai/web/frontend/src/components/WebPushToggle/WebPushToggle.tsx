'use client';
import type { PushState } from '@/hooks/useWebPush';
import styles from './WebPushToggle.module.css';

interface Props {
  state: PushState;
  error: string | null;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
}

const STATE_LABEL: Record<PushState, string> = {
  loading:      '確認中...',
  unsupported:  'このブラウザは通知に非対応です',
  denied:       '通知がブロックされています',
  unsubscribed: 'プッシュ通知をオンにする',
  subscribed:   'プッシュ通知をオフにする',
};

export default function WebPushToggle({ state, error, onSubscribe, onUnsubscribe }: Props) {
  if (state === 'unsupported') return null;

  const isOn = state === 'subscribed';
  const isLoading = state === 'loading';
  const isDenied = state === 'denied';

  return (
    <div className={styles.wrap}>
      <button
        className={`${styles.toggle} ${isOn ? styles.on : ''} ${isDenied ? styles.denied : ''}`}
        onClick={isOn ? onUnsubscribe : onSubscribe}
        disabled={isLoading || isDenied}
        aria-pressed={isOn}
      >
        <span className={styles.icon}>
          {isLoading ? '⏳' : isOn ? '🔔' : isDenied ? '🔕' : '🔕'}
        </span>
        <span className={styles.label}>{STATE_LABEL[state]}</span>
        {!isDenied && !isLoading && (
          <span className={`${styles.pill} ${isOn ? styles.pillOn : styles.pillOff}`}>
            {isOn ? 'ON' : 'OFF'}
          </span>
        )}
      </button>
      {error && <p className={styles.error}>{error}</p>}
      {isDenied && (
        <p className={styles.denied_hint}>
          ブラウザの設定から通知の許可を変更してください
        </p>
      )}
    </div>
  );
}
