import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: '飲みに行きたい！',
  description: '友達と気軽に飲み会を企画しよう',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '飲みに行きたい！' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F59E0B',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="icon" href="/icons/beer-32.png" sizes="32x32" />
      </head>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Firebase Messaging が使う Service Worker を登録する。
              // getToken() が /firebase-messaging-sw.js を自動参照するが、
              // 明示登録することで scope を確実に設定できる。
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
                    .then(function(reg) {
                      console.log('[SW] FCM Service Worker 登録成功:', reg.scope);
                    })
                    .catch(function(err) {
                      console.error('[SW] FCM Service Worker 登録失敗:', err);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
