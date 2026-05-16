'use client';
import { useState, useEffect, useCallback } from 'react';
import { getFcmToken, onForegroundMessage } from '@/lib/firebase';
import { updateWebFcmToken } from '@/lib/api';

export type PushState = 'unsupported' | 'denied' | 'unsubscribed' | 'subscribed' | 'loading';

export function useWebPush(userId: string | undefined) {
  const [state, setState] = useState<PushState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [foregroundMessage, setForegroundMessage] = useState<{
    title: string; body: string;
  } | null>(null);

  // 初期状態を確認
  useEffect(() => {
    if (!userId) return;
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setState('unsupported');
      return;
    }
    const perm = Notification.permission;
    if (perm === 'denied')  { setState('denied');      return; }
    if (perm === 'granted') { setState('subscribed');  return; }
    setState('unsubscribed');
  }, [userId]);

  // フォアグラウンド通知を受信して一時表示
  useEffect(() => {
    if (state !== 'subscribed') return;
    const unsub = onForegroundMessage((payload) => {
      setForegroundMessage({ title: payload.title, body: payload.body });
      setTimeout(() => setForegroundMessage(null), 4000);
    });
    return unsub;
  }, [state]);

  // 通知許可 → FCM トークン取得 → サーバー登録
  const subscribe = useCallback(async () => {
    if (!userId) return;
    setState('loading');
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState('denied'); return; }

      // Firebase Console の「クラウドメッセージング」→「ウェブプッシュ証明書」の公開鍵
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '';
      if (!vapidKey) throw new Error('NEXT_PUBLIC_FIREBASE_VAPID_KEY が設定されていません');

      const token = await getFcmToken(vapidKey);
      if (!token) throw new Error('FCM トークンを取得できませんでした');

      // サーバーの web_fcm_token カラムに保存
      await updateWebFcmToken(userId, token);
      setState('subscribed');
    } catch (e) {
      setError(e instanceof Error ? e.message : '通知の有効化に失敗しました');
      setState('unsubscribed');
    }
  }, [userId]);

  // トークンをサーバーから削除
  const unsubscribe = useCallback(async () => {
    if (!userId) return;
    setState('loading');
    try {
      await updateWebFcmToken(userId, null);
      setState('unsubscribed');
    } catch (e) {
      setError(e instanceof Error ? e.message : '通知の無効化に失敗しました');
      setState('subscribed');
    }
  }, [userId]);

  return { state, error, foregroundMessage, subscribe, unsubscribe };
}
