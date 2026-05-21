import { useEffect, useState } from 'react';
import Head from 'next/head';

interface PushMessage {
  type: string;
  data?: any;
  title?: string;
  body?: string;
  timestamp: number;
}

export default function Home() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PushMessage[]>([]);
  const [testData, setTestData] = useState('');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkSubscription();
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, []);

  const handleServiceWorkerMessage = (event: MessageEvent) => {
    console.log('Message from service worker:', event.data);
    if (event.data.type === 'PUSH_DATA' || event.data.type === 'PUSH_NOTIFICATION') {
      setMessages((prev) => [event.data, ...prev]);
    }
  };

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          setSubscription(sub);
          setIsSubscribed(true);
          const id = localStorage.getItem('subscriptionId');
          if (id) setSubscriptionId(id);
        }
      }
    } catch (err) {
      console.error('Error checking subscription:', err);
    }
  };

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
      return registration;
    } catch (err) {
      console.error('Service Worker registration failed:', err);
      throw err;
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribe = async () => {
    setLoading(true);
    setError(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('通知権限が拒否されました');
      }

      const registration = await registerServiceWorker();
      await navigator.serviceWorker.ready;

      const vapidResponse = await fetch('/api/vapid-public-key');
      const { publicKey } = await vapidResponse.json();

      const sub = await registration.pushManager.subscribe({
        userVisibleHint: false,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });

      const result = await response.json();
      if (result.success) {
        setSubscription(sub);
        setIsSubscribed(true);
        setSubscriptionId(result.subscriptionId);
        localStorage.setItem('subscriptionId', result.subscriptionId);
      } else {
        throw new Error('サブスクリプションの保存に失敗しました');
      }
    } catch (err) {
      console.error('Subscription error:', err);
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    setError(null);

    try {
      if (subscription) {
        await subscription.unsubscribe();
      }

      if (subscriptionId) {
        await fetch('/api/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscriptionId }),
        });
        localStorage.removeItem('subscriptionId');
      }

      setSubscription(null);
      setIsSubscribed(false);
      setSubscriptionId(null);
    } catch (err) {
      console.error('Unsubscribe error:', err);
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const sendTestData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/send-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { message: testData, timestamp: Date.now() } }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error('データ送信に失敗しました');
      }
      setTestData('');
    } catch (err) {
      console.error('Send data error:', err);
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: notificationTitle,
          body: notificationBody,
          data: { timestamp: Date.now() },
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error('通知送信に失敗しました');
      }
      setNotificationTitle('');
      setNotificationBody('');
    } catch (err) {
      console.error('Send notification error:', err);
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <>
      <Head>
        <title>Web Push Demo</title>
        <meta name="description" content="Web Push notification demo" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="/styles/globals.css" />
      </Head>

      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Web Push Demo</h1>
          <p style={styles.subtitle}>サーバーからブラウザへデータを送信</p>
        </header>

        <main style={styles.main}>
          {!isSupported ? (
            <div style={styles.errorBox}>
              <p>このブラウザはWeb Pushをサポートしていません</p>
            </div>
          ) : (
            <>
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>サブスクリプション設定</h2>
                <div style={styles.statusBox}>
                  <div style={styles.statusRow}>
                    <span style={styles.statusLabel}>ステータス:</span>
                    <span style={{
                      ...styles.statusValue,
                      color: isSubscribed ? '#10b981' : '#ef4444'
                    }}>
                      {isSubscribed ? '登録済み' : '未登録'}
                    </span>
                  </div>
                  {subscriptionId && (
                    <div style={styles.statusRow}>
                      <span style={styles.statusLabel}>ID:</span>
                      <span style={styles.statusValue}>{subscriptionId.substring(0, 8)}...</span>
                    </div>
                  )}
                </div>

                {error && (
                  <div style={styles.errorMessage}>
                    {error}
                  </div>
                )}

                <div style={styles.buttonGroup}>
                  {!isSubscribed ? (
                    <button
                      onClick={subscribe}
                      disabled={loading}
                      style={{
                        ...styles.button,
                        ...styles.primaryButton,
                        ...(loading ? styles.buttonDisabled : {})
                      }}
                    >
                      {loading ? '処理中...' : 'プッシュ通知を有効にする'}
                    </button>
                  ) : (
                    <button
                      onClick={unsubscribe}
                      disabled={loading}
                      style={{
                        ...styles.button,
                        ...styles.dangerButton,
                        ...(loading ? styles.buttonDisabled : {})
                      }}
                    >
                      {loading ? '処理中...' : 'プッシュ通知を無効にする'}
                    </button>
                  )}
                </div>
              </section>

              {isSubscribed && (
                <>
                  <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>データ送信(通知なし)</h2>
                    <p style={styles.description}>
                      通知を表示せずにデータのみをブラウザに送信します
                    </p>
                    <div style={styles.inputGroup}>
                      <input
                        type="text"
                        value={testData}
                        onChange={(e) => setTestData(e.target.value)}
                        placeholder="送信するメッセージを入力"
                        style={styles.input}
                      />
                      <button
                        onClick={sendTestData}
                        disabled={loading || !testData}
                        style={{
                          ...styles.button,
                          ...styles.secondaryButton,
                          ...(loading || !testData ? styles.buttonDisabled : {})
                        }}
                      >
                        データを送信
                      </button>
                    </div>
                  </section>

                  <section style={styles.section}>
                    <h2 style={styles.sectionTitle}>通知送信(通知あり)</h2>
                    <p style={styles.description}>
                      通知を表示してデータを送信します
                    </p>
                    <div style={styles.inputGroup}>
                      <input
                        type="text"
                        value={notificationTitle}
                        onChange={(e) => setNotificationTitle(e.target.value)}
                        placeholder="通知のタイトル"
                        style={styles.input}
                      />
                      <input
                        type="text"
                        value={notificationBody}
                        onChange={(e) => setNotificationBody(e.target.value)}
                        placeholder="通知の本文"
                        style={styles.input}
                      />
                      <button
                        onClick={sendTestNotification}
                        disabled={loading || !notificationTitle || !notificationBody}
                        style={{
                          ...styles.button,
                          ...styles.secondaryButton,
                          ...(loading || !notificationTitle || !notificationBody ? styles.buttonDisabled : {})
                        }}
                      >
                        通知を送信
                      </button>
                    </div>
                  </section>
                </>
              )}

              <section style={styles.section}>
                <div style={styles.messagesHeader}>
                  <h2 style={styles.sectionTitle}>受信メッセージ</h2>
                  {messages.length > 0 && (
                    <button onClick={clearMessages} style={styles.clearButton}>
                      クリア
                    </button>
                  )}
                </div>

                {messages.length === 0 ? (
                  <div style={styles.emptyState}>
                    <p>まだメッセージを受信していません</p>
                  </div>
                ) : (
                  <div style={styles.messageList}>
                    {messages.map((msg, index) => (
                      <div key={index} style={styles.messageCard}>
                        <div style={styles.messageHeader}>
                          <span style={{
                            ...styles.messageType,
                            backgroundColor: msg.type === 'PUSH_DATA' ? '#3b82f6' : '#8b5cf6'
                          }}>
                            {msg.type === 'PUSH_DATA' ? 'データ' : '通知'}
                          </span>
                          <span style={styles.messageTime}>
                            {new Date(msg.timestamp).toLocaleTimeString('ja-JP')}
                          </span>
                        </div>
                        {msg.title && (
                          <div style={styles.messageTitle}>{msg.title}</div>
                        )}
                        {msg.body && (
                          <div style={styles.messageBody}>{msg.body}</div>
                        )}
                        {msg.data && (
                          <pre style={styles.messageData}>
                            {JSON.stringify(msg.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>

        <footer style={styles.footer}>
          <p>Web Push API Demo - Cloudflare Workers + Hono + Next.js</p>
        </footer>
      </div>
    </>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
  },
  header: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '3rem 2rem',
    textAlign: 'center',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
  },
  title: {
    fontSize: '3rem',
    fontWeight: 'bold',
    margin: 0,
    color: '#ffffff',
    textShadow: '2px 2px 4px rgba(0, 0, 0, 0.3)',
  },
  subtitle: {
    fontSize: '1.25rem',
    margin: '0.5rem 0 0',
    color: '#e0e7ff',
  },
  main: {
    flex: 1,
    maxWidth: '900px',
    width: '100%',
    margin: '0 auto',
    padding: '2rem',
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '2rem',
    marginBottom: '2rem',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
  },
  sectionTitle: {
    fontSize: '1.75rem',
    fontWeight: '600',
    marginTop: 0,
    marginBottom: '1rem',
    color: '#f1f5f9',
  },
  description: {
    color: '#cbd5e1',
    marginBottom: '1.5rem',
    fontSize: '0.95rem',
  },
  statusBox: {
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  statusLabel: {
    fontSize: '1rem',
    color: '#94a3b8',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: '1rem',
    fontWeight: '600',
  },
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  button: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontWeight: '600',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
  },
  secondaryButton: {
    backgroundColor: '#8b5cf6',
    color: '#ffffff',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  input: {
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    backgroundColor: '#0f172a',
    border: '2px solid #334155',
    borderRadius: '8px',
    color: '#e2e8f0',
    outline: 'none',
  },
  messagesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  clearButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.9rem',
    backgroundColor: '#475569',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem 2rem',
    color: '#64748b',
    fontSize: '1.1rem',
  },
  messageList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  messageCard: {
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    padding: '1.25rem',
    border: '1px solid #334155',
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  messageType: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#ffffff',
  },
  messageTime: {
    fontSize: '0.875rem',
    color: '#94a3b8',
  },
  messageTitle: {
    fontSize: '1.125rem',
    fontWeight: '600',
    marginBottom: '0.5rem',
    color: '#f1f5f9',
  },
  messageBody: {
    fontSize: '1rem',
    marginBottom: '0.75rem',
    color: '#cbd5e1',
  },
  messageData: {
    backgroundColor: '#1e293b',
    padding: '1rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    overflow: 'auto',
    color: '#94a3b8',
    border: '1px solid #334155',
  },
  errorBox: {
    backgroundColor: '#7f1d1d',
    padding: '2rem',
    borderRadius: '8px',
    textAlign: 'center',
    color: '#fca5a5',
  },
  errorMessage: {
    backgroundColor: '#7f1d1d',
    padding: '1rem',
    borderRadius: '8px',
    marginBottom: '1rem',
    color: '#fca5a5',
  },
  footer: {
    textAlign: 'center',
    padding: '2rem',
    backgroundColor: '#0f172a',
    borderTop: '1px solid #334155',
    color: '#64748b',
  },
};
