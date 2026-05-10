'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { userApi } from '@/lib/api';
import { userStorage } from '@/lib/storage';
import type { Participation, Location } from '@/types';
import { getParticipationStatus } from '@/types';
import StampMap from '@/components/Map/StampMap';
import styles from './page.module.css';

const STAMP_RADIUS_M = 200;

function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function StampPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [participation, setParticipation] = useState<Participation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userPos, setUserPos] = useState<GeolocationPosition | null>(null);
  const [posError, setPosError] = useState('');
  const [pressing, setPressing] = useState<string | null>(null); // locationId
  const [completed, setCompleted] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // 参加情報取得
  const fetchParticipation = useCallback(async () => {
    const token = userStorage.getToken();
    if (!token) { router.replace('/'); return; }
    try {
      const { participation: p } = await userApi.getParticipation(id, token);

      // 期間外チェック
      const status = getParticipationStatus(p.rally, p);
      if (status === 'ended' || status === 'not_started' || status === 'inactive') {
        router.replace('/');
        return;
      }
      setParticipation(p);
    } catch {
      setError('参加情報が見つかりません');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchParticipation(); }, [fetchParticipation]);

  // 位置情報の取得
  useEffect(() => {
    if (!navigator.geolocation) {
      setPosError('このデバイスは位置情報をサポートしていません');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        setUserPos(pos);
        setPosError('');
      },
      err => {
        setPosError(
          err.code === 1
            ? '位置情報へのアクセスが拒否されました'
            : '位置情報を取得できませんでした'
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const getDistanceToLocation = (loc: Location): number | null => {
    if (!userPos) return null;
    return calcDistance(
      userPos.coords.latitude,
      userPos.coords.longitude,
      loc.latitude,
      loc.longitude
    );
  };

  const isStamped = (locationId: string) =>
    participation?.stamps.some(s => s.locationId === locationId) ?? false;

  const canPress = (loc: Location): boolean => {
    if (isStamped(loc.id)) return false;
    const dist = getDistanceToLocation(loc);
    if (dist === null) return false;
    return dist <= STAMP_RADIUS_M;
  };

  const handlePress = async (loc: Location) => {
    if (!canPress(loc) || !userPos || !participation) return;
    const token = userStorage.getToken();
    if (!token) return;

    setPressing(loc.id);
    try {
      const result = await userApi.pressStamp(
        {
          participationId: participation.id,
          locationId: loc.id,
          latitude: userPos.coords.latitude,
          longitude: userPos.coords.longitude,
        },
        token
      );

      if (result.completed) {
        setCompleted(true);
        setTimeout(() => router.push('/'), 3000);
      } else {
        await fetchParticipation();
        setSelectedLocation(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setPressing(null);
    }
  };

  if (loading) return (
    <div className={styles.page}>
      <div className="loading-center"><div className="spinner" /></div>
    </div>
  );

  if (error || !participation) return (
    <div className={styles.page}>
      <div className={styles.errorPage}>
        <p className="error-msg">{error || 'エラーが発生しました'}</p>
        <Link href="/" className="btn btn-secondary">トップに戻る</Link>
      </div>
    </div>
  );

  const { rally, stamps } = participation;
  const locations = rally.locations;
  const progress = participation.totalCount > 0
    ? Math.round((participation.stampCount / participation.totalCount) * 100) : 0;

  // コンプリート演出
  if (completed) return (
    <div className={styles.completePage}>
      <div className={styles.completeInner}>
        <div className={styles.completeIcon}>🎉</div>
        <h1>コンプリート！</h1>
        <p>おめでとうございます！全てのスタンプを集めました</p>
        <p style={{ color: 'var(--fg-3)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          3秒後に一覧へ戻ります...
        </p>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      {/* ヘッダー */}
      <header className={styles.header}>
        <Link href="/" className="btn btn-ghost btn-sm">← 一覧</Link>
        <div className={styles.headerCenter}>
          <div className={styles.rallyName}>{rally.name}</div>
          <div className={styles.progressLabel}>
            {participation.stampCount} / {participation.totalCount} スタンプ
          </div>
        </div>
        <div className={styles.progressCircle}>
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="17" fill="none" stroke="var(--border)" strokeWidth="3" />
            <circle
              cx="20" cy="20" r="17" fill="none"
              stroke={progress === 100 ? 'var(--green)' : 'var(--amber)'}
              strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 17}`}
              strokeDashoffset={`${2 * Math.PI * 17 * (1 - progress / 100)}`}
              strokeLinecap="round"
              transform="rotate(-90 20 20)"
              style={{ transition: 'stroke-dashoffset 0.4s ease' }}
            />
            <text x="20" y="24" textAnchor="middle" fontSize="9" fill="var(--fg)" fontWeight="bold">
              {progress}%
            </text>
          </svg>
        </div>
      </header>

      {/* 地図 */}
      <div className={styles.mapArea}>
        <StampMap
          locations={locations}
          stampedIds={stamps.map(s => s.locationId)}
          userPosition={userPos}
          onLocationSelect={setSelectedLocation}
          selectedLocation={selectedLocation}
        />
      </div>

      {/* 位置情報エラー */}
      {posError && (
        <div className={styles.posError}>
          ⚠️ {posError}
        </div>
      )}

      {/* スポット一覧 + アクションパネル */}
      <div className={styles.panel}>
        {selectedLocation ? (
          // 選択されたスポットのアクション
          <div className={styles.selectedPanel}>
            <button className={styles.closeSelected} onClick={() => setSelectedLocation(null)}>✕</button>
            <div className={styles.selectedName}>{selectedLocation.name}</div>
            {selectedLocation.address && (
              <div className={styles.selectedAddr}>{selectedLocation.address}</div>
            )}

            {isStamped(selectedLocation.id) ? (
              <div className={styles.alreadyStamped}>✅ スタンプ済み</div>
            ) : (
              <>
                {(() => {
                  const dist = getDistanceToLocation(selectedLocation);
                  const ok = canPress(selectedLocation);
                  return (
                    <>
                      <div className={`${styles.distanceBadge} ${ok ? styles.distOk : styles.distFar}`}>
                        {!userPos
                          ? '📍 位置情報取得中...'
                          : dist !== null
                          ? `📍 現在地まで ${Math.round(dist)}m ${ok ? '(範囲内)' : `(${STAMP_RADIUS_M}m以内が必要)`}`
                          : '📍 位置情報なし'}
                      </div>
                      <button
                        className={`btn btn-primary btn-full ${styles.stampBtn}`}
                        onClick={() => handlePress(selectedLocation)}
                        disabled={!ok || pressing === selectedLocation.id}
                      >
                        {pressing === selectedLocation.id
                          ? <span className="spinner" style={{ width: 18, height: 18 }} />
                          : ok
                          ? '📮 スタンプを押す'
                          : '📮 スタンプを押す（範囲外）'}
                      </button>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        ) : (
          // スポット一覧
          <div className={styles.locationList}>
            <div className={styles.panelTitle}>スポット一覧</div>
            {locations.map((loc, i) => {
              const stamped = isStamped(loc.id);
              const dist = getDistanceToLocation(loc);
              const inRange = dist !== null && dist <= STAMP_RADIUS_M;

              return (
                <button
                  key={loc.id}
                  className={`${styles.locItem} ${stamped ? styles.locStamped : ''} ${inRange && !stamped ? styles.locInRange : ''}`}
                  onClick={() => setSelectedLocation(loc)}
                >
                  <div className={`${styles.locIcon} ${stamped ? styles.locIconDone : ''}`}>
                    {stamped ? '✓' : i + 1}
                  </div>
                  <div className={styles.locInfo}>
                    <div className={styles.locName}>{loc.name}</div>
                    {dist !== null && (
                      <div className={styles.locDist}>
                        {Math.round(dist)}m {inRange && !stamped && <span className={styles.inRangeTag}>範囲内</span>}
                      </div>
                    )}
                  </div>
                  {!stamped && inRange && (
                    <span className={styles.readyDot} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
