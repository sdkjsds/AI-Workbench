// 知流 PWA Service Worker：缓存应用外壳，API 走网络优先
const CACHE = 'zhiliu-v2';
const SHELL = ['/', '/index.html', '/styles.css', '/api.js', '/renderer.js', '/vendor/marked/lib/marked.umd.js', '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // API 请求：纯网络，不缓存（保证数据实时）
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"网络错误"}', { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  // 静态资源：网络优先 + 缓存回退（部署后立即拿到新文件，离线也能用）
  e.respondWith(
    fetch(e.request).then((resp) => {
      if (resp && resp.ok) {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      }
      return resp;
    }).catch(() => caches.match(e.request))
  );
});
