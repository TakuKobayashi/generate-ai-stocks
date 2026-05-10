'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminRallyApi } from '@/lib/api';
import { adminStorage } from '@/lib/storage';
import type { StampRally } from '@/types';
import ToggleDialog from '@/components/Dialog/ToggleDialog';
import styles from './page.module.css';

export default function AdminDashboardPage() {
  const [rallies, setRallies] = useState<StampRally[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggleTarget, setToggleTarget] = useState<StampRally | null>(null);

  useEffect(() => {
    const token = adminStorage.getToken();
    if (!token) return;
    adminRallyApi
      .list(token)
      .then(d => setRallies(d.rallies))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (rally: StampRally) => {
    const token = adminStorage.getToken();
    if (!token) return;
    try {
      const { isActive } = await adminRallyApi.toggle(rally.id, token);
      setRallies(prev =>
        prev.map(r => (r.id === rally.id ? { ...r, isActive } : r))
      );
    } finally {
      setToggleTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-center">
          <div className="spinner" />
          <p style={{ color: 'var(--fg-3)', fontSize: '0.875rem' }}>読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container map-bg-pattern">
      <div className="page-header">
        <div className={styles.headerRow}>
          <div>
            <h1>スタンプラリー一覧</h1>
            <p>あなたが作成したスタンプラリーを管理します</p>
          </div>
          <Link href="/admin/create" className="btn btn-primary">
            ＋ 新規作成
          </Link>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {rallies.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>◎</div>
          <h3>スタンプラリーがありません</h3>
          <p>最初のスタンプラリーを作成してみましょう</p>
          <Link href="/admin/create" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            スタンプラリーを作成
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {rallies.map(rally => (
            <RallyCard
              key={rally.id}
              rally={rally}
              onToggle={() => setToggleTarget(rally)}
            />
          ))}
        </div>
      )}

      {toggleTarget && (
        <ToggleDialog
          rally={toggleTarget}
          onConfirm={() => handleToggle(toggleTarget)}
          onCancel={() => setToggleTarget(null)}
        />
      )}
    </div>
  );
}

function RallyCard({ rally, onToggle }: { rally: StampRally; onToggle: () => void }) {
  const now = new Date().toISOString();
  const hasStarted = rally.startAt <= now;
  const hasEnded = rally.endAt ? rally.endAt < now : false;

  let statusLabel = '';
  let statusClass = '';
  if (!rally.isActive) { statusLabel = '無効'; statusClass = 'badge-inactive'; }
  else if (!hasStarted) { statusLabel = '開始前'; statusClass = 'badge-soon'; }
  else if (hasEnded) { statusLabel = '終了'; statusClass = 'badge-ended'; }
  else { statusLabel = '開催中'; statusClass = 'badge-active'; }

  // 地図のおおよその範囲をタイル画像で表示
  const centerLat = rally.locations.length > 0
    ? rally.locations.reduce((s, l) => s + l.latitude, 0) / rally.locations.length
    : 35.6812;
  const centerLng = rally.locations.length > 0
    ? rally.locations.reduce((s, l) => s + l.longitude, 0) / rally.locations.length
    : 139.7671;
  const mapUrl = `https://tile.openstreetmap.org/13/${lon2tile(centerLng, 13)}/${lat2tile(centerLat, 13)}.png`;

  return (
    <div className={`card ${styles.card}`}>
      {/* 地図サムネイル */}
      <Link href={`/admin/${rally.id}`} className={styles.mapThumb}>
        <img src={mapUrl} alt="地図" className={styles.mapImg} loading="lazy" />
        <div className={styles.mapOverlay}>
          <span className={styles.pinCount}>📍 {rally.locations.length}箇所</span>
        </div>
      </Link>

      <div className="card-body">
        <div className={styles.cardHeader}>
          <Link href={`/admin/${rally.id}`} className={styles.rallyName}>
            {rally.name}
          </Link>
          <span className={`badge ${statusClass}`}>{statusLabel}</span>
        </div>

        <div className={styles.stats}>
          <Stat label="参加者" value={rally.participantCount ?? 0} unit="人" />
          <Stat label="コンプリート" value={rally.completedCount ?? 0} unit="人" />
          <Stat label="スポット" value={rally.locations.length} unit="箇所" />
        </div>

        <div className={styles.dates}>
          <span>開始: {formatDate(rally.startAt)}</span>
          {rally.endAt && <span>終了: {formatDate(rally.endAt)}</span>}
          {!rally.endAt && <span style={{ color: 'var(--fg-3)' }}>終了日時: 無期限</span>}
        </div>

        <div className={styles.cardActions}>
          <Link href={`/admin/${rally.id}`} className="btn btn-secondary btn-sm">
            詳細・共有
          </Link>
          <button
            className={`btn btn-sm ${rally.isActive ? 'btn-danger' : 'btn-secondary'}`}
            onClick={onToggle}
          >
            {rally.isActive ? '無効にする' : '有効にする'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value.toLocaleString()}</span>
      <span className={styles.statUnit}>{unit}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function lon2tile(lon: number, zoom: number) {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function lat2tile(lat: number, zoom: number) {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** zoom
  );
}
