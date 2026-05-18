import type { Metadata, Viewport } from 'next';
import '@fontsource/ibm-plex-mono/300.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-sans/300.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import './globals.css';

// ── Metadata ───────────────────────────────────────────────────────────────────
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://recstudio.example.com';
const APP_NAME = 'RecStudio';
const TITLE = 'RecStudio — Browser Screen Recorder';
const DESCRIPTION =
  'Record your screen directly in the browser. Choose screen audio or microphone, get real-time speech-to-text transcription, and save your recording as a video file — no installation, no server required.';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),

  title: {
    default: TITLE,
    template: `%s | ${APP_NAME}`,
  },
  description: DESCRIPTION,

  keywords: [
    'screen recorder',
    'browser screen recording',
    'speech to text',
    'transcription',
    'screen capture',
    'webrtc',
    'mediarecorder',
    'no install',
    'online screen recorder',
  ],

  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  publisher: APP_NAME,

  // ── Open Graph ───────────────────────────────────────────
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: APP_URL,
    siteName: APP_NAME,
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — Browser Screen Recorder`,
        type: 'image/png',
      },
    ],
  },

  // ── Twitter / X ──────────────────────────────────────────
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },

  // ── Robots ───────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // ── PWA / App metadata ───────────────────────────────────
  applicationName: APP_NAME,
  category: 'productivity',

  // ── Icons ────────────────────────────────────────────────
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#07090e',
};

// ── Layout ─────────────────────────────────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
