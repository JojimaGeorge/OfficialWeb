// ぽちゃもんあっち向いてホイ Service Worker
// 全アセットを precache してオフライン動作可能にする
// 更新時は CACHE_NAME の version を bump する
const CACHE_NAME = 'pochamon-hoi-v6';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/bg.png',
  './assets/pochamon_idle.png',
  './assets/pochamon_idle.gif',
  './assets/pochamon_biron.gif',
  './assets/pochamon_pyon.gif',
  './assets/sticker_01.png',
  './assets/sticker_02.png',
  './assets/sticker_03.png',
  './assets/sticker_04.png',
  './assets/sticker_05.png',
  './assets/sticker_06.png',
  './assets/qr-homepage.png',
  './assets/mv/mv_01.mp4',
  './assets/mv/mv_02.mp4',
  './assets/mv/mv_03.mp4',
  './assets/mv/mv_04.mp4',
  './assets/mv/mv_05.mp4',
  './assets/mv/mv_06.mp4',
  './assets/mv/mv_07.mp4',
  './assets/mv/mv_08.mp4',
  './assets/mv/mv_09.mp4'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const results = await Promise.allSettled(
      ASSETS.map(url => cache.add(new Request(url, { cache: 'reload' })))
    );
    const failed = results.filter(r => r.status === 'rejected');
    console.log(`[SW] cached ${ASSETS.length - failed.length}/${ASSETS.length}`);
    if (failed.length) {
      console.warn('[SW] failed:', failed.map(f => (f.reason && f.reason.message) || String(f.reason)));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // 外部リソース（Google Fonts等）はパススルー
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(event.request);
      if (res && res.ok && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
      }
      return res;
    } catch (e) {
      // オフライン時は index.html をフォールバック
      if (event.request.mode === 'navigate') {
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
      }
      throw e;
    }
  })());
});
