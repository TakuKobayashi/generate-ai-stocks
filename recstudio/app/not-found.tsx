import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '404 — Page Not Found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        background: 'var(--bg)',
        fontFamily: 'var(--font-mono, monospace)',
        color: 'var(--text-dim)',
        textAlign: 'center',
        padding: '24px',
      }}
    >
      <span style={{ fontSize: '64px', lineHeight: 1 }}>404</span>
      <p style={{ fontSize: '14px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Page not found
      </p>
      <Link
        href="/"
        style={{
          fontSize: '12px',
          color: 'var(--cyan)',
          textDecoration: 'underline',
          letterSpacing: '0.08em',
        }}
      >
        ← Back to RecStudio
      </Link>
    </div>
  );
}
