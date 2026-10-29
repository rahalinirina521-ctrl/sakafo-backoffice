// Service worker minimal : notifications push de l'admin (pas de cache, pour toujours avoir la dernière version).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { titre: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titre || 'Sakafo', {
    body: d.texte || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    tag: d.id || undefined, data: { lien: d.lien || '' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL('index.html' + (e.notification.data.lien || ''), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    const w = ws.find((x) => x.url.includes('index.html') || x.url.endsWith('/'));
    if (w) { w.navigate(url).catch(() => {}); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
