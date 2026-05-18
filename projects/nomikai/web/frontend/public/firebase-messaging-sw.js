// public/firebase-messaging-sw.js
// Firebase Cloud Messaging のバックグラウンド通知を処理する Service Worker。
// このファイルは public/ に置くことで /firebase-messaging-sw.js として配信される。
// Firebase JS SDK の getToken() が自動的にこのパスを参照する。

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Firebase 設定（ビルド時に埋め込むか、環境変数から読み込む）
// ※ Service Worker 内では process.env が使えないため、
//   next.config.ts の rewrites か、別途設定ファイルを置く方法を使う。
//   ここでは /firebase-config.js を別途配置する方式を採用。
try {
  importScripts('/firebase-config.js'); // window.__FIREBASE_CONFIG__ を定義するスクリプト
} catch (e) {
  console.warn('[SW] firebase-config.js の読み込みに失敗しました:', e);
}

const config = self.__FIREBASE_CONFIG__ || {};

firebase.initializeApp(config);

const messaging = firebase.messaging();

// ─── バックグラウンド通知の表示 ──────────────────────────────────────
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || '🍺 飲みに誘われました！';
  const body  = payload.notification?.body  || '';
  const data  = payload.data || {};

  self.registration.showNotification(title, {
    body,
    icon:  '/icons/beer-192.png',
    badge: '/icons/badge-72.png',
    tag:   `nomikai-${data.inviteId || Date.now()}`,
    data,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    actions: [
      { action: 'view',    title: '確認する' },
      { action: 'dismiss', title: '閉じる'   },
    ],
  });
});

// ─── 通知クリック処理 ─────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate('/notifications/');
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/notifications/');
    })
  );
});
