import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'スタンプラリー',
  description: '現地を巡るデジタルスタンプラリーサービス',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
