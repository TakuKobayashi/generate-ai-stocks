import { useState, useEffect } from 'react';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [messages, setMessages] = useState<Array<{ 
    id: number; 
    message: string; 
    data: any; 
    timestamp: number;
    mode: string;
  }>>([]);
  const [messageText, setMessageText] = useState('');
  const [dataJson, setDataJson] = useState('{"count": 1, "status": "active"}');
  const [status, setStatus] = useState('');
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [notificationMode, setNotificationMode] = useState<'silent' | 'notify'>('silent');

  useEffect(() => {
    // Service Worker対応チェック
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      checkPermissionState();
      registerServiceWorker();
    }
  }, []);

  const checkPermissionState = () => {
    if ('Notification' in window) {
      setPermissionState(Notification.permission);
    }
  };

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);

      // Service Workerからのメッセージを受信
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'PUSH_DATA') {
          const newMessage = {
            id: Date.now(),
            message: event.data.payload.message,
            data: event.data.payload.data,
            timestamp: event.data.payload.timestamp,
            mode: notificationMode
          };
          setMessages((prev) => [newMessage, ...prev]);
          setStatus('✅ 新しいデータを受信しました!');
          
          // 音声フィードバック（オプション）
          playNotificationSound();
          
          setTimeout(() => setStatus(''), 3000);
        }
      });

      // 既存の購読を確認
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        setSubscription(existingSubscription);
      }
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      setStatus('❌ Service Worker登録エラー: ' + (error as Error).message);
    }
  };

  const playNotificationSound = () => {
    // 簡易的な音声フィードバック
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      setTimeout(() => oscillator.stop(), 100);
    } catch (e) {
      // 音声再生に失敗しても無視
    }
  };

  const requestNotificationPermission = async () => {
    try {
      setStatus('⏳ 通知の許可を求めています...');
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      
      if (permission === 'granted') {
        setStatus('✅ 通知が許可されました!');
        setTimeout(() => setStatus(''), 3000);
      } else if (permission === 'denied') {
        setStatus('❌ 通知が拒否されました。ブラウザの設定から変更できます。');
      } else {
        setStatus('⚠️ 通知の許可が保留されています');
      }
    } catch (error) {
      console.error('Permission request error:', error);
      setStatus('❌ 許可リクエストエラー: ' + (error as Error).message);
    }
  };

  const subscribeToPush = async () => {
    try {
      if (permissionState !== 'granted') {
        setStatus('⚠️ 先に通知の許可が必要です');
        return;
      }

      setStatus('⏳ 購読処理中...');
      
      const registration = await navigator.serviceWorker.ready;
      
      // VAPID公開鍵を取得
      const response = await fetch('http://localhost:8787/api/vapid-public-key');
      if (!response.ok) {
        throw new Error('Failed to fetch VAPID key');
      }
      const data = await response.json() as { publicKey: string };
      const publicKey = data.publicKey;
      
      // プッシュ通知を購読
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true, // ブラウザの要件に従う
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
      
      // サーバーに購読情報を送信
      const subscribeResponse = await fetch('http://localhost:8787/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sub)
      });

      if (!subscribeResponse.ok) {
        throw new Error('Failed to save subscription');
      }
      
      setSubscription(sub);
      setStatus('✅ プッシュ通知を購読しました!');
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      console.error('Subscription error:', error);
      setStatus('❌ 購読エラー: ' + (error as Error).message);
    }
  };

  const unsubscribeFromPush = async () => {
    if (subscription) {
      try {
        setStatus('⏳ 購読を解除中...');
        await subscription.unsubscribe();
        setSubscription(null);
        setStatus('✅ 購読を解除しました');
        setTimeout(() => setStatus(''), 3000);
      } catch (error) {
        console.error('Unsubscribe error:', error);
        setStatus('❌ 購読解除エラー: ' + (error as Error).message);
      }
    }
  };

  const resetPermission = () => {
    setStatus('ℹ️ ブラウザのアドレスバー左側の🔒をクリックして、通知の設定をリセットしてください。その後ページをリロードしてください。');
  };

  const toggleNotificationMode = async (mode: 'silent' | 'notify') => {
    setNotificationMode(mode);
    
    // Service Workerにモードを通知
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      registration.active?.postMessage({
        type: 'SET_NOTIFICATION_MODE',
        mode: mode
      });
    }
    
    setStatus(`🔔 モードを${mode === 'silent' ? 'サイレント' : '通知あり'}に変更しました`);
    setTimeout(() => setStatus(''), 3000);
  };

  const sendTestPush = async () => {
    try {
      setStatus('⏳ プッシュ送信中...');
      
      let data;
      try {
        data = JSON.parse(dataJson);
      } catch {
        data = { raw: dataJson };
      }
      
      const response = await fetch('http://localhost:8787/api/send-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: messageText || 'テストメッセージ',
          data: data
        })
      });

      if (!response.ok) {
        throw new Error('Push send failed');
      }
      
      const result = await response.json() as { sent: number; total: number };
      setStatus(`✅ ${result.sent}件のデバイスに送信しました`);
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      console.error('Send push error:', error);
      setStatus('❌ 送信エラー: ' + (error as Error).message);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  if (!isSupported) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <h1>❌ 非対応</h1>
          <p>お使いのブラウザはWeb Push APIに対応していません。</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>🔔 Web Push データ配信デモ</h1>
        <p className={styles.subtitle}>サーバーからリアルタイムでデータを受信</p>
      </div>

      {status && (
        <div className={styles.status}>
          {status}
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2>🔐 通知の許可</h2>
          <div className={styles.permissionInfo}>
            <p className={
              permissionState === 'granted' ? styles.permissionGranted :
              permissionState === 'denied' ? styles.permissionDenied :
              styles.permissionDefault
            }>
              状態: {
                permissionState === 'granted' ? '✓ 許可済み' :
                permissionState === 'denied' ? '✗ 拒否済み' :
                '? 未設定'
              }
            </p>
          </div>
          <div className={styles.buttonGroup}>
            {permissionState !== 'granted' && (
              <button className={styles.primaryButton} onClick={requestNotificationPermission}>
                通知を許可する
              </button>
            )}
            <button className={styles.secondaryButton} onClick={resetPermission}>
              許可をリセット
              </button>
          </div>
        </div>

        <div className={styles.card}>
          <h2>📱 購読管理</h2>
          <div className={styles.subscriptionInfo}>
            <p className={subscription ? styles.subscribed : styles.notSubscribed}>
              {subscription ? '✓ 購読中' : '✗ 未購読'}
            </p>
          </div>
          <div className={styles.buttonGroup}>
            {!subscription ? (
              <button 
                className={styles.primaryButton} 
                onClick={subscribeToPush}
                disabled={permissionState !== 'granted'}
              >
                購読を開始
              </button>
            ) : (
              <button className={styles.secondaryButton} onClick={unsubscribeFromPush}>
                購読を解除
              </button>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <h2>🔔 通知モード</h2>
          <div className={styles.modeToggle}>
            <button
              className={notificationMode === 'silent' ? styles.modeButtonActive : styles.modeButton}
              onClick={() => toggleNotificationMode('silent')}
            >
              🔕 サイレント
            </button>
            <button
              className={notificationMode === 'notify' ? styles.modeButtonActive : styles.modeButton}
              onClick={() => toggleNotificationMode('notify')}
            >
              🔔 通知あり
            </button>
          </div>
          <p className={styles.modeDescription}>
            {notificationMode === 'silent' 
              ? 'データのみ受信、通知は表示されません' 
              : 'データ受信時に通知が表示されます'}
          </p>
        </div>

        <div className={styles.card}>
          <h2>📤 プッシュ送信テスト</h2>
          <div className={styles.formGroup}>
            <label>メッセージ</label>
            <input
              type="text"
              className={styles.input}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="テストメッセージ"
            />
          </div>
          <div className={styles.formGroup}>
            <label>データ (JSON)</label>
            <textarea
              className={styles.textarea}
              value={dataJson}
              onChange={(e) => setDataJson(e.target.value)}
              placeholder='{"key": "value"}'
              rows={3}
            />
          </div>
          <button className={styles.primaryButton} onClick={sendTestPush}>
            プッシュを送信
          </button>
        </div>
      </div>

      <div className={styles.messagesSection}>
        <h2>📨 受信データ履歴</h2>
        {messages.length === 0 ? (
          <p className={styles.emptyState}>まだデータを受信していません</p>
        ) : (
          <div className={styles.messageList}>
            {messages.map((msg) => (
              <div key={msg.id} className={styles.messageCard}>
                <div className={styles.messageHeader}>
                  <span className={styles.messageTime}>
                    {new Date(msg.timestamp).toLocaleString('ja-JP')}
                  </span>
                  <span className={msg.mode === 'silent' ? styles.modeBadgeSilent : styles.modeBadgeNotify}>
                    {msg.mode === 'silent' ? '🔕 サイレント' : '🔔 通知あり'}
                  </span>
                </div>
                <div className={styles.messageBody}>
                  <p className={styles.messageText}>{msg.message}</p>
                  <div className={styles.dataSection}>
                    <h4>受信データ:</h4>
                    <pre className={styles.messageData}>
                      {JSON.stringify(msg.data, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
