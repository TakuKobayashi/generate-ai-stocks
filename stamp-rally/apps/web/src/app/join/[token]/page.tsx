'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { userApi, userAuthApi } from '@/lib/api';
import { userStorage } from '@/lib/storage';
import type { StampRally } from '@/types';
import styles from './page.module.css';

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [rally, setRally] = useState<StampRally | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const user = userStorage.getUser();

  useEffect(() => {
    userApi
      .getRallyByToken(token)
      .then(d => {
        const r = d.rally;
        const now = new Date().toISOString();

        // 期間外 → トップにリダイレクト
        if (r.endAt && r.endAt < now) {
          router.replace('/');
          return;
        }
        setRally(r);

        // ログイン済みなら参加チェック
        const authToken = userStorage.getToken();
        if (authToken) {
          userApi.getMyParticipations(authToken).then(({ participations }) => {
            const existing = participations.find(p => p.rally.shareToken === token);
            if (existing) {
              router.replace(`/stamp/${existing.id}`);
            }
          }).catch(() => {});
        }
      })
      .catch(() => setError('スタンプラリーが見つかりません'))
      .finally(() => setLoading(false));
  }, [token, router]);

  const handleJoin = async () => {
    setJoining(true);
    setError('');
    try {
      let authToken = userStorage.getToken();

      // 未ログイン → ゲストとして参加
      if (!authToken) {
        const { token: t, user: u } = await userAuthApi.createGuest();
        userStorage.save(t, u);
        authToken = t;
      }

      const { participation } = await userApi.joinRally(token, authToken);
      router.push(`/stamp/${participation.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setJoining(false);
    }
  };

  if (loading) return (
    <div className={styles.page}>
      <div className="loading-center"><div className="spinner" /></div>
    </div>
  );

  if (error || !rally) return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className="error-msg">{error || 'スタンプラリーが見つかりません'}</div>
        <Link href="/" className="btn btn-secondary">トップに戻る</Link>
      </div>
    </div>
  );

  const now = new Date().toISOString();
  const notStarted = rally.startAt > now;

  return (
    <div className={`${styles.page} map-bg-pattern`}>
      <div className={styles.card}>
        {/* ロゴ */}
        <div className={styles.logoRow}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoIcon}>◈</span>
            <span className={styles.logoText}>STAMP RALLY</span>
          </Link>
        </div>

        <div className={styles.invite}>スタンプラリーに招待されています</div>

        <h1 className={styles.rallyName}>{rally.name}</h1>

        {rally.description && (
          <p className={styles.description}>{rally.description}</p>
        )}

        {/* 情報 */}
        <div className={styles.infoGrid}>
          <InfoItem icon="📍" label="スポット数" value={`${rally.locations.length}箇所`} />
          <InfoItem
            icon="📅"
            label="開催期間"
            value={rally.endAt
              ? `${fmtDate(rally.startAt)} 〜 ${fmtDate(rally.endAt)}`
              : `${fmtDate(rally.startAt)} 〜 無期限`}
          />
          {rally.maxParticipants && (
            <InfoItem icon="👥" label="参加上限" value={`${rally.maxParticipants}人`} />
          )}
        </div>

        {/* スポット一覧 */}
        <div className={styles.spotList}>
          {rally.locations.map((loc, i) => (
            <div key={loc.id} className={styles.spotItem}>
              <span className={styles.spotNum}>{i + 1}</span>
              <span className={styles.spotName}>{loc.name}</span>
            </div>
          ))}
        </div>

        {/* エラー */}
        {error && <div className="error-msg">{error}</div>}

        {/* 参加ボタン */}
        {notStarted ? (
          <div className={styles.notStarted}>
            このスタンプラリーはまだ開始していません<br />
            <strong>{fmtDate(rally.startAt)}</strong> から開始予定です
          </div>
        ) : (
          <>
            <button
              className="btn btn-primary btn-full btn-lg"
              onClick={handleJoin}
              disabled={joining}
            >
              {joining
                ? <span className="spinner" style={{ width: 18, height: 18 }} />
                : user
                  ? '参加する'
                  : 'ゲストとして参加する'}
            </button>

            {!user && (
              <div className={styles.authNote}>
                <p>アカウントを作成すると複数デバイスで進捗を引き継げます</p>
                <div className={styles.authLinks}>
                  <Link href={`/login?next=/join/${token}`} className="btn btn-ghost btn-sm">
                    ログイン
                  </Link>
                  <Link href={`/register?next=/join/${token}`} className="btn btn-secondary btn-sm">
                    アカウント作成
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.72rem', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: '0.875rem', color: 'var(--fg)', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
