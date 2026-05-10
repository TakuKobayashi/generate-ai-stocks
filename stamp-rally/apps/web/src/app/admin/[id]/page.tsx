'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { adminRallyApi } from '@/lib/api';
import { adminStorage } from '@/lib/storage';
import type { StampRally } from '@/types';
import ToggleDialog from '@/components/Dialog/ToggleDialog';
import styles from './page.module.css';

export default function AdminRallyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [rally, setRally] = useState<StampRally | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showToggle, setShowToggle] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = adminStorage.getToken();
    if (!token) { router.replace('/admin/login'); return; }
    adminRallyApi
      .get(id, token)
      .then(d => setRally(d.rally))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleToggle = async () => {
    const token = adminStorage.getToken();
    if (!token || !rally) return;
    const { isActive } = await adminRallyApi.toggle(rally.id, token);
    setRally(r => r ? { ...r, isActive } : r);
    setShowToggle(false);
  };

  const handleCopy = () => {
    if (!rally?.shareUrl) return;
    navigator.clipboard.writeText(rally.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="page-container"><div className="loading-center"><div className="spinner" /></div></div>;
  if (error || !rally) return <div className="page-container"><div className="error-msg">{error || '見つかりません'}</div></div>;

  const now = new Date().toISOString();
  const statusLabel = !rally.isActive ? '無効' : rally.startAt > now ? '開始前' : rally.endAt && rally.endAt < now ? '終了' : '開催中';
  const statusClass = !rally.isActive ? 'badge-inactive' : rally.startAt > now ? 'badge-soon' : rally.endAt && rally.endAt < now ? 'badge-ended' : 'badge-active';

  return (
    <div className="page-container">
      {/* ヘッダー */}
      <div className={styles.pageHeader}>
        <Link href="/admin" className="btn btn-ghost btn-sm">← 一覧に戻る</Link>
        <div className={styles.titleRow}>
          <div>
            <h1>{rally.name}</h1>
            {rally.description && <p style={{ marginTop: '0.4rem' }}>{rally.description}</p>}
          </div>
          <div className={styles.headerActions}>
            <span className={`badge ${statusClass}`} style={{ fontSize: '0.8rem', padding: '0.4rem 0.875rem' }}>
              {statusLabel}
            </span>
            <button className={`btn btn-sm ${rally.isActive ? 'btn-danger' : 'btn-secondary'}`} onClick={() => setShowToggle(true)}>
              {rally.isActive ? '無効にする' : '有効にする'}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        {/* 統計カード */}
        <div className="card card-body">
          <h3 style={{ marginBottom: '1rem' }}>統計情報</h3>
          <div className={styles.statsGrid}>
            <StatBox label="参加者数" value={rally.participantCount ?? 0} unit="人" color="var(--amber)" />
            <StatBox label="コンプリート" value={rally.completedCount ?? 0} unit="人" color="var(--green)" />
            <StatBox label="スポット数" value={rally.locations.length} unit="箇所" color="var(--blue)" />
          </div>
        </div>

        {/* 基本情報 */}
        <div className="card card-body">
          <h3 style={{ marginBottom: '1rem' }}>開催情報</h3>
          <div className={styles.infoList}>
            <InfoRow label="開始日時" value={formatDate(rally.startAt)} />
            <InfoRow label="終了日時" value={rally.endAt ? formatDate(rally.endAt) : '無期限'} />
            <InfoRow label="参加上限" value={rally.maxParticipants ? `${rally.maxParticipants}人` : '無制限'} />
            <InfoRow label="作成日" value={formatDate(rally.createdAt)} />
          </div>
        </div>

        {/* 共有 */}
        <div className={`card card-body ${styles.shareCard}`}>
          <h3 style={{ marginBottom: '1rem' }}>参加用URL・QRコード</h3>
          <div className={styles.shareUrl}>
            <code className={styles.urlText}>{rally.shareUrl}</code>
            <button className={`btn btn-secondary btn-sm ${styles.copyBtn}`} onClick={handleCopy}>
              {copied ? '✓ コピー済み' : 'コピー'}
            </button>
          </div>
          <div className={styles.qrWrap}>
            <div className={styles.qrBox}>
              <QRCodeSVG
                value={rally.shareUrl || ''}
                size={180}
                bgColor="transparent"
                fgColor="var(--fg)"
                level="M"
              />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--fg-3)', marginTop: '0.75rem', textAlign: 'center' }}>
              このQRコードをスキャンで参加できます
            </p>
          </div>
        </div>

        {/* スポット一覧 */}
        <div className={`card card-body ${styles.locationsCard}`}>
          <h3 style={{ marginBottom: '1rem' }}>スポット一覧</h3>
          <div className={styles.locationList}>
            {rally.locations.map((loc, i) => (
              <div key={loc.id} className={styles.locationItem}>
                <div className={styles.locationNum}>{i + 1}</div>
                <div className={styles.locationInfo}>
                  <div className={styles.locationName}>{loc.name}</div>
                  {loc.address && <div className={styles.locationAddr}>{loc.address}</div>}
                  <div className={styles.locationCoords}>
                    {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showToggle && (
        <ToggleDialog rally={rally} onConfirm={handleToggle} onCancel={() => setShowToggle(false)} />
      )}
    </div>
  );
}

function StatBox({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className={styles.statBox}>
      <div className={styles.statVal} style={{ color }}>{value.toLocaleString()}<span className={styles.statUnt}>{unit}</span></div>
      <div className={styles.statLbl}>{label}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value}</span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
