import { importPKCS8, SignJWT } from 'jose';

interface FcmMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface Env {
  FCM_PROJECT_ID: string;
  FCM_CLIENT_EMAIL: string;
  FCM_PRIVATE_KEY: string; // base64エンコードされたPEM秘密鍵
}

// FCM HTTP v1 API用アクセストークン取得 (JWTを使ったOAuth2)
async function getFcmAccessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // base64デコードして秘密鍵を取得
  const privateKeyPem = atob(env.FCM_PRIVATE_KEY);

  const privateKey = await importPKCS8(privateKeyPem, 'RS256');

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setIssuer(env.FCM_CLIENT_EMAIL)
    .setAudience('https://oauth2.googleapis.com/token')
    .setSubject(env.FCM_CLIENT_EMAIL)
    .sign(privateKey);

  // JWTをアクセストークンと交換
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`FCMトークン取得失敗: ${err}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  return tokenData.access_token;
}

// 単一デバイスへFCMプッシュ通知送信
export async function sendFcmNotification(env: Env, message: FcmMessage): Promise<boolean> {
  try {
    const accessToken = await getFcmAccessToken(env);
    const projectId = env.FCM_PROJECT_ID;

    const fcmPayload = {
      message: {
        token: message.token,
        notification: {
          title: message.title,
          body: message.body,
        },
        data: message.data ?? {},
        android: {
          notification: {
            channel_id: 'nomikai_channel',
            priority: 'HIGH',
            default_vibrate_timings: true,
            default_sound: true,
          },
          priority: 'HIGH',
        },
      },
    };

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fcmPayload),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error(`FCM送信エラー (token: ${message.token.slice(0, 20)}...): ${err}`);
      return false;
    }

    return true;
  } catch (e) {
    console.error('FCM送信例外:', e);
    return false;
  }
}

// 複数デバイスへ一斉送信
export async function sendFcmToMultiple(
  env: Env,
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: number; failure: number }> {
  const results = await Promise.allSettled(
    tokens.map((token) => sendFcmNotification(env, { token, title, body, data }))
  );

  const success = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  const failure = results.length - success;
  return { success, failure };
}
