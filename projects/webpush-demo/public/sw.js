self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('Push received:', event);

  if (!event.data) {
    console.log('No data in push event');
    return;
  }

  try {
    const payload = event.data.json();
    console.log('Payload:', payload);

    if (payload.type === 'DATA') {
      event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'PUSH_DATA',
              data: payload.data,
              timestamp: Date.now(),
            });
          });
        })
      );
    } else if (payload.type === 'NOTIFICATION') {
      const title = payload.title || 'New Notification';
      const options = {
        body: payload.body || '',
        icon: '/icon.png',
        badge: '/badge.png',
        data: payload.data,
        tag: 'notification-' + Date.now(),
        requireInteraction: false,
      };

      event.waitUntil(
        self.registration.showNotification(title, options).then(() => {
          return self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'PUSH_NOTIFICATION',
              title: payload.title,
              body: payload.body,
              data: payload.data,
              timestamp: Date.now(),
            });
          });
        })
      );
    }
  } catch (error) {
    console.error('Error handling push:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === self.registration.scope && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
