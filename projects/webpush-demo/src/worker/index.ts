import { Hono } from 'hono';

type Bindings = {
  ASSETS: Fetcher;
  SUBSCRIPTIONS: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// API Routes

// VAPID公開鍵を取得
app.get('/api/vapid-public-key', (c) => {
  try {
    const publicKey = c.env.VAPID_PUBLIC_KEY;
    if (!publicKey || publicKey === 'YOUR_PUBLIC_KEY_HERE') {
      return c.json({ 
        error: 'VAPID public key not configured' 
      }, 500);
    }
    return c.json({ publicKey });
  } catch (error) {
    console.error('Error getting VAPID key:', error);
    return c.json({ 
      error: 'Failed to get VAPID key',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// プッシュ通知の購読を保存
app.post('/api/subscribe', async (c) => {
  try {
    const subscription = await c.req.json();
    
    if (!subscription || !subscription.endpoint) {
      return c.json({ 
        success: false, 
        error: 'Invalid subscription data' 
      }, 400);
    }
    
    const endpoint = subscription.endpoint;
    
    // エンドポイントをキーとして購読情報を保存
    const subscriptionId = createSubscriptionId(endpoint);
    await c.env.SUBSCRIPTIONS.put(
      subscriptionId, 
      JSON.stringify(subscription),
      { expirationTtl: 60 * 60 * 24 * 30 } // 30日間保存
    );
    
    console.log('Subscription saved:', subscriptionId);
    return c.json({ success: true, id: subscriptionId });
  } catch (error) {
    console.error('Subscription error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to save subscription',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// プッシュ通知を送信
app.post('/api/send-push', async (c) => {
  try {
    const body = await c.req.json();
    const { message, data } = body;
    
    if (!message && !data) {
      return c.json({ 
        success: false, 
        error: 'Message or data is required' 
      }, 400);
    }
    
    // すべての購読を取得
    const list = await c.env.SUBSCRIPTIONS.list();
    
    if (list.keys.length === 0) {
      return c.json({ 
        success: true, 
        sent: 0,
        total: 0,
        message: 'No subscriptions found'
      });
    }
    
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
    const successCount = results.filter(r => 
      r.status === 'fulfilled' && !(r.value as any)?.error
    ).length;
    
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
      error: 'Failed to send push',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Static Assets - すべての非APIリクエストはフロントエンドへ
app.get('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

// Helper Functions

function createSubscriptionId(endpoint: string): string {
  const hash = endpoint.split('/').pop() || '';
  return hash.substring(0, 50);
}

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
  
  // シンプルな実装: ペイロードをそのまま送信
  // 本番環境では適切な暗号化が必要
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'TTL': '86400',
    },
    body: payload
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Push service error: ${response.status} - ${errorText}`);
  }
  
  return response;
}

export default app;
