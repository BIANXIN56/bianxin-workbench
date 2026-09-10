// sw.js — 应用壳离线缓存（不缓存 /api/ 同步接口，始终走网络）
const CACHE = 'wb-shell-v52';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon.svg'];

self.addEventListener('install', (e) => {
  /* v50：不再 skipWaiting——让新 SW 默默等待，下次自然打开再激活，绝不弹"要重新加载"原生对话框 */
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/api/')) return; // 同步接口走网络
  if (e.request.method !== 'GET') return;

  /* HTML/导航请求：网络优先。
     原来的"缓存优先"会把旧版 index.html 永久锁在本地，导致每次改版都要手动升版本号、
     用户还要硬刷新才看得到（已反复踩坑）。改为网络优先后，线上新版立刻生效；
     离线时自动回退到缓存壳，离线能力不受影响。 */
  const isHTML = e.request.mode === 'navigate'
    || u.pathname.endsWith('/')
    || u.pathname.endsWith('.html')
    || u.pathname.endsWith('.htm');
  if (isHTML) {
    e.respondWith(
      fetch(e.request).then((resp) => {
        const cp = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, cp));
        return resp;
      }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  /* 图标等静态资源：缓存优先（内容基本不变，优先保证秒开） */
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => {
      const cp = resp.clone();
      caches.open(CACHE).then((c) => c.put(e.request, cp));
      return resp;
    }).catch(() => r))
  );
});
