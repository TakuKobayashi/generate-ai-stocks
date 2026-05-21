import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  SUBSCRIPTIONS: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/*', cors());

function urlBase64Encode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function sendWebPush(
  subscription: PushSubscription,
  data: any,
  vapidKeys: { publicKey: string; privateKey: string; subject: string }
) {
  const payload = JSON.stringify(data);
  
  const vapidHeader = {
    typ: 'JWT',
    alg: 'ES256',
  };

  const jwtPayload = {
    aud: new URL(subscription.endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: vapidKeys.subject,
  };

  const encoder = new TextEncoder();
  const header = urlBase64Encode(encoder.encode(JSON.stringify(vapidHeader)));
  const claims = urlBase64Encode(encoder.encode(JSON.stringify(jwtPayload)));
  const unsignedToken = `${header}.${claims}`;

  const privateKeyJwk = {
    kty: 'EC',
    crv: 'P-256',
    d: vapidKeys.privateKey,
    x: vapidKeys.publicKey.substring(0, 43),
    y: vapidKeys.publicKey.substring(43),
    ext: true,
  };

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(unsignedToken)
  );

  const jwt = `${unsignedToken}.${urlBase64Encode(new Uint8Array(signature))}`;

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      Authorization: `vapid t=${jwt}, k=${vapidKeys.publicKey}`,
      TTL: '86400',
    },
    body: payload,
  });

  return response;
}

app.get('/api/vapid-public-key', (c) => {
  return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY });
});

app.post('/api/subscribe', async (c) => {
  try {
    const subscription = await c.req.json<PushSubscription>();
    const subscriptionId = crypto.randomUUID();
    
    await c.env.SUBSCRIPTIONS.put(
      subscriptionId,
      JSON.stringify(subscription),
      { expirationTtl: 60 * 60 * 24 * 30 }
    );

    return c.json({ success: true, subscriptionId });
  } catch (error) {
    console.error('Subscribe error:', error);
    return c.json({ success: false, error: 'Failed to save subscription' }, 500);
  }
});

app.post('/api/unsubscribe', async (c) => {
  try {
    const { subscriptionId } = await c.req.json<{ subscriptionId: string }>();
    await c.env.SUBSCRIPTIONS.delete(subscriptionId);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete subscription' }, 500);
  }
});

app.post('/api/send-data', async (c) => {
  try {
    const { data } = await c.req.json<{ data: any }>();
    
    const list = await c.env.SUBSCRIPTIONS.list();
    const vapidKeys = {
      publicKey: c.env.VAPID_PUBLIC_KEY,
      privateKey: c.env.VAPID_PRIVATE_KEY,
      subject: c.env.VAPID_SUBJECT,
    };

    const sendPromises = list.keys.map(async (key) => {
      const subscriptionData = await c.env.SUBSCRIPTIONS.get(key.name);
      if (subscriptionData) {
        const subscription = JSON.parse(subscriptionData) as PushSubscription;
        try {
          await sendWebPush(
            subscription,
            { type: 'DATA', data, silent: true },
            vapidKeys
          );
        } catch (error) {
          console.error('Failed to send to subscription:', error);
          await c.env.SUBSCRIPTIONS.delete(key.name);
        }
      }
    });

    await Promise.all(sendPromises);

    return c.json({ success: true, sent: list.keys.length });
  } catch (error) {
    console.error('Send data error:', error);
    return c.json({ success: false, error: 'Failed to send data' }, 500);
  }
});

app.post('/api/send-notification', async (c) => {
  try {
    const { title, body, data } = await c.req.json<{
      title: string;
      body: string;
      data?: any;
    }>();
    
    const list = await c.env.SUBSCRIPTIONS.list();
    const vapidKeys = {
      publicKey: c.env.VAPID_PUBLIC_KEY,
      privateKey: c.env.VAPID_PRIVATE_KEY,
      subject: c.env.VAPID_SUBJECT,
    };

    const sendPromises = list.keys.map(async (key) => {
      const subscriptionData = await c.env.SUBSCRIPTIONS.get(key.name);
      if (subscriptionData) {
        const subscription = JSON.parse(subscriptionData) as PushSubscription;
        try {
          await sendWebPush(
            subscription,
            { type: 'NOTIFICATION', title, body, data, silent: false },
            vapidKeys
          );
        } catch (error) {
          console.error('Failed to send to subscription:', error);
          await c.env.SUBSCRIPTIONS.delete(key.name);
        }
      }
    });

    await Promise.all(sendPromises);

    return c.json({ success: true, sent: list.keys.length });
  } catch (error) {
    console.error('Send notification error:', error);
    return c.json({ success: false, error: 'Failed to send notification' }, 500);
  }
});

export default app;
