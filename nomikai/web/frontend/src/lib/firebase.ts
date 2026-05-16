import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

// Firebase 設定は NEXT_PUBLIC_ 環境変数から取得
// .env.local に設定する（Firebase Console の「プロジェクトの設定」→「全般」→「マイアプリ」から取得）
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// SSG ビルド時に重複初期化しないようにシングルトン管理
let app: FirebaseApp;
let messaging: Messaging | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length === 0
      ? initializeApp(firebaseConfig)
      : getApps()[0];
  }
  return app;
}

/**
 * Firebase Messaging インスタンスを取得する。
 * サーバーサイド（SSG ビルド時）は null を返す。
 */
export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null;
  if (!messaging) {
    messaging = getMessaging(getFirebaseApp());
  }
  return messaging;
}

/**
 * FCM 登録トークンを取得する。
 * 通知許可が必要なため、ユーザー操作後に呼ぶこと。
 *
 * @param vapidKey - Firebase Console の「クラウドメッセージング」→「ウェブプッシュ証明書」のキーペア公開鍵
 */
export async function getFcmToken(vapidKey: string): Promise<string | null> {
  const m = getFirebaseMessaging();
  if (!m) return null;

  try {
    // Service Worker の登録を待つ
    const swReg = await navigator.serviceWorker.ready;
    const token = await getToken(m, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });
    return token || null;
  } catch (e) {
    console.error('[FCM] トークン取得失敗:', e);
    return null;
  }
}

/**
 * フォアグラウンド通知を受信したときのハンドラを登録する。
 * バックグラウンドは Service Worker (firebase-messaging-sw.js) が担当。
 */
export function onForegroundMessage(
  callback: (payload: { title: string; body: string; data?: Record<string, string> }) => void
) {
  const m = getFirebaseMessaging();
  if (!m) return () => {};

  return onMessage(m, (payload) => {
    const title = payload.notification?.title ?? '飲みに誘われました！';
    const body  = payload.notification?.body  ?? '';
    const data  = payload.data as Record<string, string> | undefined;
    callback({ title, body, data });
  });
}
