import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  SUBSCRIPTIONS: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS設定
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// VAPID公開鍵を取得
app.get('/api/vapid-public-key', (c) => {
  return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY });
});

// プッシュ通知の購読を保存
app.post('/api/subscribe', async (c) => {
  try {
    const subscription = await c.req.json();
    const endpoint = subscription.endpoint;
    
    // エンドポイントをキーとして購読情報を保存
    const subscriptionId = createSubscriptionId(endpoint);
    await c.env.SUBSCRIPTIONS.put(subscriptionId, JSON.stringify(subscription));
    
    console.log('Subscription saved:', subscriptionId);
    return c.json({ success: true, id: subscriptionId });
  } catch (error) {
    console.error('Subscription error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to save subscription' 
    }, 500);
  }
});

// プッシュ通知を送信
app.post('/api/send-push', async (c) => {
  try {
    const { message, data } = await c.req.json();
    
    // すべての購読を取得
    const list = await c.env.SUBSCRIPTIONS.list();
    const sendPromises: Promise<any>[] = [];
    
    for (const key of list.keys) {
      const subscriptionJson = await c.env.SUBSCRIPTIONS.get(key.name);
      if (subscriptionJson) {
        try {
          const subscription = JSON.parse(subscriptionJson);
          sendPromises.push(
            sendPushNotification(subscription, message, data, c.env)
              .catch(err => {
                console.error(`Failed to send to ${key.name}:`, err);
                return { error: err.message };
              })
          );
        } catch (parseError) {
          console.error(`Failed to parse subscription ${key.name}:`, parseError);
        }
      }
    }
    
    const results = await Promise.allSettled(sendPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && !(r.value as any)?.error).length;
    
    console.log(`Push sent: ${successCount}/${results.length}`);
    return c.json({ 
      success: true, 
      sent: successCount,
      total: results.length 
    });
  } catch (error) {
    console.error('Send push error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send push' 
    }, 500);
  }
});

// 購読IDを生成
function createSubscriptionId(endpoint: string): string {
  // エンドポイントURLから一意なIDを生成
  const hash = endpoint.split('/').pop() || '';
  return hash.substring(0, 50);
}

// Web Push通知を送信
async function sendPushNotification(
  subscription: any,
  message: string,
  data: any,
  env: Bindings
): Promise<Response> {
  const payload = JSON.stringify({
    message,
    data,
    timestamp: Date.now()
  });
  
  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys.p256dh;
  const auth = subscription.keys.auth;
  
  // 暗号化されたペイロードを作成
  const encrypted = await encryptPayload(payload, p256dh, auth);
  
  // VAPID認証ヘッダーを作成
  const vapidHeaders = await createVAPIDHeaders(
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
    endpoint
  );
  
  // プッシュサービスに送信
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
      ...vapidHeaders
    },
    body: encrypted.ciphertext
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Push service error: ${response.status} ${errorText}`);
  }
  
  return response;
}

// ペイロードの暗号化 (簡略版)
async function encryptPayload(
  payload: string,
  userPublicKey: string,
  userAuth: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; publicKey: Uint8Array }> {
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);
  
  // 本番環境では適切なECDH鍵交換とAES-GCM暗号化が必要
  // ここでは簡略化のため最小限の実装
  // 実際の実装ではWeb Crypto APIを使用して完全な暗号化を行う必要があります
  
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  
  // ダミーの暗号化データ（本番環境では適切に暗号化する）
  const ciphertext = new Uint8Array([
    ...salt,
    ...new Uint8Array([0, 0, 0x10, 0]), // record size
    ...new Uint8Array([65]), // key length
    ...payloadBytes
  ]);
  
  return {
    ciphertext,
    salt,
    publicKey: new Uint8Array(65)
  };
}

// VAPID認証ヘッダーを作成
async function createVAPIDHeaders(
  publicKey: string,
  privateKeyPem: string,
  audience: string
): Promise<Record<string, string>> {
  const url = new URL(audience);
  const aud = `${url.protocol}//${url.host}`;
  
  // JWTヘッダー
  const header = {
    typ: 'JWT',
    alg: 'ES256'
  };
  
  // JWTペイロード
  const jwtPayload = {
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: 'mailto:webpush@example.com'
  };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));
  
  // 簡略化のため署名は省略（本番環境では必須）
  // 本番環境ではWeb Crypto APIを使用してES256署名を生成
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = 'dummy'; // 実際にはprivateKeyで署名
  const jwt = `${unsignedToken}.${signature}`;
  
  return {
    'Authorization': `vapid t=${jwt}, k=${publicKey}`
  };
}

// Base64 URL エンコード
function base64UrlEncode(str: string): string {
  const base64 = btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default app;
