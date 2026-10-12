const CACHE = 'roam-shell-__REVISION__';
const ASSETS = __ASSETS__;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  // 不强制激活新版本，避免正在录音时替换代码。
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('roam-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(async response => {
      if (response.ok && url.pathname === '/') (await caches.open(CACHE)).put('/', response.clone());
      return response;
    }).catch(() => caches.match('/index.html')));
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
  }
});
