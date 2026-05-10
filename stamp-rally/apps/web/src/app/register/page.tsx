'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { userAuthApi } from '@/lib/api';
import { userStorage } from '@/lib/storage';
import styles from '../login/page.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await userAuthApi.register(email, password, name);
      userStorage.save(token, { ...user, isGuest: false });
      router.replace(next);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${styles.page} map-bg-pattern`}>
      <div className={styles.card}>
        <Link href="/" className={styles.back}>← トップに戻る</Link>
        <h1 className={styles.title}>アカウント作成</h1>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>ニックネーム</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="探検家 太郎" required autoFocus />
          </div>
          <div className="form-group">
            <label>メールアドレス</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>パスワード（8文字以上）</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
          </div>
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'アカウントを作成'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--fg-3)' }}>
          すでにアカウントをお持ちの方は{' '}
          <Link href={`/login?next=${next}`}>ログイン</Link>
        </p>
      </div>
    </div>
  );
}
