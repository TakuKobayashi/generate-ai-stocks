'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import styles from './page.module.css';

export default function SetupPage() {
  const router = useRouter();
  const { user, loading, register } = useUser();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 登録済みならホームへ
  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  const handleSubmit = async () => {
    if (!name.trim()) { setError('名前を入力してください'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await register(name.trim());
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : '登録に失敗しました');
      setSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <span className={styles.heroIcon}>🍺</span>
        <h1 className={styles.heroTitle}>飲みに行きたい！</h1>
        <p className={styles.heroSub}>友達と気軽に飲み会を企画しよう</p>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>はじめに名前を教えてください</h2>
        <p className={styles.cardSub}>友達への通知に表示されます</p>

        <div className={styles.field}>
          <label htmlFor="name" className={styles.label}>ニックネーム</label>
          <input
            id="name"
            type="text"
            className={styles.input}
            placeholder="例：太郎"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            maxLength={20}
            autoFocus
          />
          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>

        <button
          className={styles.btn}
          onClick={handleSubmit}
          disabled={submitting || !name.trim()}
        >
          {submitting ? (
            <span className={styles.spinner} />
          ) : (
            'はじめる 🍺'
          )}
        </button>
      </div>

      <p className={styles.note}>
        ※ アカウント情報はこのデバイスにのみ保存されます
      </p>
    </div>
  );
}
