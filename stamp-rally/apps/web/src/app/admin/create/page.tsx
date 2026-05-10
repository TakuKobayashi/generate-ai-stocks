'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAtom } from 'jotai';
import { createRallyAtom, defaultCreateRallyForm, genLocalId } from '@/store/createRally';
import { adminRallyApi } from '@/lib/api';
import { adminStorage } from '@/lib/storage';
import CreateRallyMap from '@/components/Map/CreateRallyMap';
import LocationDndList from '@/components/LocationList/LocationDndList';
import type { CreateRallyLocation } from '@/types';
import styles from './page.module.css';

export default function AdminCreatePage() {
  const router = useRouter();
  const [form, setForm] = useAtom(createRallyAtom);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePinAdded = (pin: Omit<CreateRallyLocation, 'id'>) => {
    setForm(prev => ({
      ...prev,
      locations: [
        ...prev.locations,
        { ...pin, id: genLocalId() },
      ],
    }));
  };

  const handleRemoveLocation = (id: string) => {
    setForm(prev => ({
      ...prev,
      locations: prev.locations.filter(l => l.id !== id),
    }));
  };

  const handleReorderLocations = (newLocations: CreateRallyLocation[]) => {
    setForm(prev => ({ ...prev, locations: newLocations }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.locations.length === 0) {
      setError('スポットを1箇所以上追加してください');
      return;
    }

    const token = adminStorage.getToken();
    if (!token) { router.replace('/admin/login'); return; }

    setLoading(true);
    try {
      const res = await adminRallyApi.create(
        {
          name: form.name,
          description: form.description || undefined,
          startAt: new Date(form.startAt).toISOString(),
          endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
          maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : undefined,
          locations: form.locations.map(l => ({
            name: l.name,
            address: l.address || undefined,
            latitude: l.latitude,
            longitude: l.longitude,
          })),
        },
        token
      );
      setForm(defaultCreateRallyForm);
      router.push(`/admin/${res.rally.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* ヘッダー */}
      <div className={styles.header}>
        <h1>新規スタンプラリー作成</h1>
        <p>地図でスポットを選択して、スタンプラリーを設計してください</p>
      </div>

      <div className={styles.layout}>
        {/* 左：地図 + 場所リスト */}
        <div className={styles.mapSection}>
          <div className={styles.mapContainer}>
            <CreateRallyMap onPinAdded={handlePinAdded} existingLocations={form.locations} />
          </div>
          <div className={styles.locationSection}>
            <div className={styles.locationHeader}>
              <h3>スポット一覧</h3>
              <span className={styles.locationCount}>{form.locations.length}箇所</span>
            </div>
            {form.locations.length === 0 ? (
              <div className={styles.emptyLocations}>
                <p>地図をクリックしてスポットを追加してください</p>
              </div>
            ) : (
              <LocationDndList
                locations={form.locations}
                onRemove={handleRemoveLocation}
                onReorder={handleReorderLocations}
              />
            )}
          </div>
        </div>

        {/* 右：フォーム */}
        <div className={styles.formSection}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <h3 className={styles.formTitle}>基本情報</h3>

            {error && <div className="error-msg">{error}</div>}

            <div className="form-group">
              <label>スタンプラリー名 <span className={styles.required}>*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="例: 府中市文化財めぐり"
                required
              />
            </div>

            <div className="form-group">
              <label>説明文</label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="スタンプラリーの説明を入力してください"
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="form-group">
              <label>開始日時 <span className={styles.required}>*</span></label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={e => setForm(p => ({ ...p, startAt: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label>終了日時 <span className={styles.optional}>任意 — 未設定の場合は無期限</span></label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={e => setForm(p => ({ ...p, endAt: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>参加可能人数 <span className={styles.optional}>任意 — 未設定の場合は無制限</span></label>
              <input
                type="number"
                value={form.maxParticipants}
                onChange={e => setForm(p => ({ ...p, maxParticipants: e.target.value }))}
                placeholder="例: 100"
                min={1}
              />
            </div>

            <div className={styles.formSummary}>
              <div className={styles.summaryItem}>
                <span>スポット数</span>
                <strong className={form.locations.length === 0 ? styles.warn : ''}>
                  {form.locations.length}箇所
                </strong>
              </div>
            </div>

            <div className={styles.formActions}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  if (confirm('入力内容をリセットしますか？')) {
                    setForm(defaultCreateRallyForm);
                  }
                }}
              >
                リセット
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading || form.locations.length === 0 || !form.name || !form.startAt}
              >
                {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : '作成する'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
