'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { userApi } from '@/lib/api';
import { userStorage } from '@/lib/storage';
import type { Participation } from '@/types';
import { getParticipationStatus } from '@/types';
import styles from './page.module.css';

export default function UserHomePage() {
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);
  const user = userStorage.getUser();

  useEffect(() => {
    const token = userStorage.getToken();
    if (!token) { setLoading(false); return; }
    userApi
      .getMyParticipations(token)
      .then(d => setParticipations(d.participations))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={`${styles.page} map-bg-pattern`}>
      {/* ヘッダー */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>◈</span>
            <span className={styles.logoText}>STAMP RALLY</span>
          </div>
          <div className={styles.headerActions}>
            {user ? (
              <div className={styles.userBadge}>
                {user.isGuest ? '👤 ゲスト' : `👤 ${user.name}`}
              </div>
            ) : (
              <div className={styles.authLinks}>
                <Link href="/login" className="btn btn-ghost btn-sm">ログイン</Link>
                <Link href="/register" className="btn btn-primary btn-sm">アカウント作成</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* ヒーロー */}
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>現地を巡って<br />スタンプを集めよう</h1>
          <p className={styles.heroSub}>参加URLにアクセスして、スタンプラリーに参加できます</p>
        </div>

        {/* 参加中のスタンプラリー */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>🗺️</span>
            参加中のスタンプラリー
          </h2>

          {!user ? (
            <div className={styles.noAuth}>
              <p>ログインするとスタンプラリーの参加履歴が表示されます</p>
              <div className={styles.authButtons}>
                <Link href="/login" className="btn btn-secondary">ログイン</Link>
                <Link href="/register" className="btn btn-primary">アカウント作成</Link>
              </div>
            </div>
          ) : loading ? (
            <div className="loading-center">
              <div className="spinner" />
            </div>
          ) : participations.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🧭</div>
              <p>まだ参加しているスタンプラリーはありません</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--fg-3)' }}>
                主催者から参加URLを受け取って参加してみましょう
              </p>
            </div>
          ) : (
            <div className={styles.rallyList}>
              {participations.map(p => (
                <ParticipationCard key={p.id} participation={p} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function ParticipationCard({ participation }: { participation: Participation }) {
  const { rally } = participation;
  const status = getParticipationStatus(rally, participation);

  const statusConfig = {
    active: { label: '参加中', cls: 'badge-active' },
    completed: { label: 'コンプリート！', cls: 'badge-completed' },
    not_started: { label: '開始前', cls: 'badge-soon' },
    ended: { label: '終了', cls: 'badge-ended' },
    inactive: { label: '無効', cls: 'badge-inactive' },
  }[status];

  const progress = participation.totalCount > 0
    ? Math.round((participation.stampCount / participation.totalCount) * 100)
    : 0;

  return (
    <div className={styles.rallyCard}>
      <div className={styles.rallyCardHeader}>
        <div>
          <div className={styles.rallyCardName}>{rally.name}</div>
          {rally.endAt && (
            <div className={styles.rallyCardDate}>
              {new Date(rally.startAt).toLocaleDateString('ja-JP')} 〜 {new Date(rally.endAt).toLocaleDateString('ja-JP')}
            </div>
          )}
        </div>
        <span className={`badge ${statusConfig.cls}`}>{statusConfig.label}</span>
      </div>

      {/* スタンプ進捗バー */}
      <div className={styles.progressSection}>
        <div className={styles.progressLabel}>
          <span>スタンプ</span>
          <span className={styles.progressCount}>
            {participation.stampCount} / {participation.totalCount}
          </span>
        </div>
        <div className={styles.progressBar}>
          <div
            className={`${styles.progressFill} ${status === 'completed' ? styles.progressComplete : ''}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* アクション */}
      <div className={styles.rallyCardActions}>
        <Link href={`/stamp/${participation.id}`} className="btn btn-secondary btn-sm">
          詳細を見る
        </Link>
        {status === 'active' && (
          <Link href={`/stamp/${participation.id}`} className="btn btn-primary btn-sm">
            📍 スタンプを押す
          </Link>
        )}
      </div>
    </div>
  );
}
