'use client';
import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import type { GeoPosition } from '@/hooks/useGeolocation';
import type { Restaurant } from '@/lib/api';
import { createInvite, getNearbyRestaurants } from '@/lib/api';
import RestaurantCard from '@/components/RestaurantCard/RestaurantCard';
import styles from './CreateInviteForm.module.css';

const MapPicker = lazy(() => import('@/components/MapPicker/MapPicker'));

interface Props {
  userId: string;
  currentPosition: GeoPosition | null;
  onLocationRequest: () => void;
}

function padTwo(n: number) { return String(n).padStart(2, '0'); }

function defaultDateTimeLocal() {
  const d = new Date(Date.now() + 2 * 3600_000);
  return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}T${padTwo(d.getHours())}:${padTwo(d.getMinutes())}`;
}

export default function CreateInviteForm({ userId, currentPosition, onLocationRequest }: Props) {
  const [dateTimeLocal, setDateTimeLocal] = useState(defaultDateTimeLocal);
  const [participants, setParticipants] = useState(2);
  const [message, setMessage] = useState('');
  const [locationName, setLocationName] = useState('');
  const [selectedPos, setSelectedPos] = useState<GeoPosition | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  const [restaurantError, setRestaurantError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ inviteId: string; notified: number } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const searchPos = selectedPos ?? currentPosition;

  const handleSend = useCallback(async () => {
    setSending(true);
    setSendError(null);
    try {
      const epochMs = new Date(dateTimeLocal).getTime();
      const res = await createInvite({
        creatorId: userId,
        dateTime: epochMs,
        locationLat: searchPos?.lat,
        locationLng: searchPos?.lng,
        locationName: locationName.trim() || undefined,
        participantCount: participants,
        message: message.trim() || undefined,
      });
      setSent({ inviteId: res.inviteId, notified: res.notifiedCount.total });

      // 送信後に周辺飲食店を検索
      if (searchPos) {
        setLoadingRestaurants(true);
        setRestaurantError(null);
        try {
          const r = await getNearbyRestaurants(searchPos.lat, searchPos.lng);
          setRestaurants(r.results);
        } catch (e) {
          setRestaurantError(e instanceof Error ? e.message : '飲食店の取得に失敗しました');
        } finally {
          setLoadingRestaurants(false);
        }
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : '送信に失敗しました');
    } finally {
      setSending(false);
    }
  }, [userId, dateTimeLocal, searchPos, locationName, participants, message]);

  return (
    <div className={styles.form}>

      {/* ① 日時 */}
      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>
          <span>📅</span> 日時
        </h2>
        <input
          type="datetime-local"
          className={styles.dateInput}
          value={dateTimeLocal}
          min={defaultDateTimeLocal()}
          onChange={e => setDateTimeLocal(e.target.value)}
        />
      </section>

      {/* ② 募集人数 */}
      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>
          <span>👥</span> 募集人数
        </h2>
        <div className={styles.counterRow}>
          <button
            className={styles.counterBtn}
            onClick={() => setParticipants(p => Math.max(2, p - 1))}
            disabled={participants <= 2}
            aria-label="減らす"
          >−</button>
          <span className={styles.counterValue}>{participants}<span className={styles.counterUnit}>人</span></span>
          <button
            className={styles.counterBtn}
            onClick={() => setParticipants(p => Math.min(20, p + 1))}
            disabled={participants >= 20}
            aria-label="増やす"
          >+</button>
          <div className={styles.quickBtns}>
            {[2, 3, 4, 5].map(n => (
              <button
                key={n}
                className={`${styles.quickBtn} ${participants === n ? styles.quickBtnActive : ''}`}
                onClick={() => setParticipants(n)}
              >{n}</button>
            ))}
          </div>
        </div>
      </section>

      {/* ③ 場所 (オプション) */}
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span>📍</span> 場所（任意）
          </h2>
          <button
            className={styles.mapToggle}
            onClick={() => {
              if (!currentPosition) { onLocationRequest(); }
              setShowMap(v => !v);
            }}
          >
            {showMap ? 'マップを閉じる' : 'マップで選択'}
          </button>
        </div>
        <input
          type="text"
          className={styles.textInput}
          placeholder="例：渋谷駅周辺"
          value={locationName}
          onChange={e => setLocationName(e.target.value)}
        />
        {showMap && (
          <div className={styles.mapWrap}>
            {currentPosition ? (
              <Suspense fallback={<div className={styles.mapLoading}>マップを読み込み中...</div>}>
                <MapPicker
                  center={currentPosition}
                  selected={selectedPos}
                  onSelect={setSelectedPos}
                />
              </Suspense>
            ) : (
              <div className={styles.geoPrompt}>
                <p>位置情報の許可が必要です</p>
                <button className={styles.geoBtn} onClick={onLocationRequest}>位置情報を許可</button>
              </div>
            )}
            {selectedPos && (
              <p className={styles.selectedCoord}>
                📌 {selectedPos.lat.toFixed(4)}, {selectedPos.lng.toFixed(4)}
              </p>
            )}
          </div>
        )}
      </section>

      {/* ④ メッセージ */}
      <section className={styles.card}>
        <textarea
          className={styles.textarea}
          placeholder="一言メッセージ（任意）例：今夜飲もう！"
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={3}
          maxLength={200}
        />
        <p className={styles.charCount}>{message.length}/200</p>
      </section>

      {/* エラー */}
      {sendError && (
        <div className={styles.errorBox} role="alert">{sendError}</div>
      )}

      {/* 送信成功 */}
      {sent && (
        <div className={styles.successBox} role="status">
          <p className={styles.successTitle}>🎉 送信完了！</p>
          <p>{sent.notified}人の友達に通知しました</p>
        </div>
      )}

      {/* ⑤ 送信ボタン */}
      <button
        className={styles.sendBtn}
        onClick={handleSend}
        disabled={sending || !dateTimeLocal}
      >
        {sending ? (
          <span className={styles.spinner} />
        ) : (
          <>🍺 飲みに行きたい！</>
        )}
      </button>

      {/* ⑥ おすすめ飲食店 */}
      {(loadingRestaurants || restaurants.length > 0 || restaurantError) && (
        <section className={styles.restaurants}>
          <h2 className={styles.restaurantsTitle}>🍻 おすすめのお店</h2>
          {loadingRestaurants && (
            <div className={styles.restaurantLoading}>
              <span className={styles.spinner} style={{ background: 'var(--color-primary)' }} />
              <span>周辺のお店を検索中...</span>
            </div>
          )}
          {restaurantError && (
            <p className={styles.restaurantError}>{restaurantError}</p>
          )}
          <div className={styles.restaurantList}>
            {restaurants.map(r => (
              <RestaurantCard key={r.id} restaurant={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
