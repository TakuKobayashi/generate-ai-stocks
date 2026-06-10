import type { Noroshi } from '../db/schema';

interface FcmMessage {
  message: {
    token: string;
    data: Record<string, string>;
    notification?: {
      title: string;
      body: string;
    };
    android?: {
      priority: string;
    };
    apns?: {
      headers: Record<string, string>;
    };
  };
}

/**
 * FCM HTTP v1 APIでPush通知を送信
 * data-onlyメッセージ（通知バーに表示せずアプリが処理）
 */
export async function sendNoroshiNotification(
  tokens: string[],
  noroshi: Noroshi,
  fcmServerKey: string,
  projectId: string
): Promise<void> {
  if (tokens.length === 0) return;

  const noroshiData = {
    type: 'new_noroshi',
    id: noroshi.id,
    userId: noroshi.userId,
    latitude: String(noroshi.latitude),
    longitude: String(noroshi.longitude),
    geohash: noroshi.geohash,
    address: noroshi.address,
    message: noroshi.message,
    startAt: String(noroshi.startAt instanceof Date ? noroshi.startAt.getTime() : noroshi.startAt),
    endAt: String(noroshi.endAt instanceof Date ? noroshi.endAt.getTime() : noroshi.endAt),
    createdAt: String(noroshi.createdAt instanceof Date ? noroshi.createdAt.getTime() : noroshi.createdAt),
  };

  // FCM HTTP v1 APIにアクセスするためのOAuthトークン取得
  const accessToken = await getAccessToken(fcmServerKey);

  // 各トークンに個別送信（FCM v1はマルチキャスト非対応）
  const sendPromises = tokens.map(token => {
    const message: FcmMessage = {
      message: {
        token,
        data: noroshiData,
        android: { priority: 'high' },
        apns: { headers: { 'apns-priority': '5' } },
      },
    };

    return fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(message),
    });
  });

  await Promise.allSettled(sendPromises);
}

/**
 * Service AccountのJWTからOAuthアクセストークンを取得
 * Cloudflare Workers環境でのWeb Crypto API使用
 */
async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const signingInput = `${encode(header)}.${encode(payload)}`;

  // PEM形式の秘密鍵をインポート
  const pemKey = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----\n/, '')
    .replace(/\n-----END PRIVATE KEY-----\n/, '')
    .replace(/\n/g, '');

  const binaryKey = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json() as { access_token: string };
  return tokenData.access_token;
}
