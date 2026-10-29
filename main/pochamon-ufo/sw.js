// ぽちゃもん UFOキャッチャー Service Worker
// 会場のオフライン対策：本体と素材を全部 precache する。
// index.html / game.js / style.css / 素材を変えたら CACHE_NAME を bump すること（cache-first のため）。
const CACHE_NAME = 'pochamon-ufo-v2';

const CORE = [
  './',
  './index.html',
  './style.css?v=2',
  './game.js?v=2',
  './manifest.json',
  './assets/scene.json',
  './assets/console.json',
  './assets/pochamon_idle.png',
  './assets/icon-180.png',
  './assets/icon-512.png',
  './assets/fonts/ZenMaruGothic-Bold.woff2',
  './assets/fonts/ZenMaruGothic-Black.woff2',
  './assets/fonts/CherryBombOne-Regular.woff2',
];

async function assetList() {
  // scene.json に書いてある素材（背景・ぬいぐるみ・影・アーム）を全部
  try {
    const res = await fetch('./assets/scene.json', { cache: 'reload' });
    const s = await res.json();
    const files = new Set();
    files.add('./assets/' + ((s.files && s.files.bg) || 'bg.png'));
    for (const t of s.toys) {
      if (t.sprite) files.add('./assets/' + t.sprite.file);
      if (t.shadow) files.add('./assets/' + t.shadow.file);
    }
    for (const c of s.claw_sprites) files.add('./assets/' + c.file);
    // 左右の操作盤（本体・キャップ・光る輪・コイン）
    const cr = await fetch('./assets/console.json', { cache: 'reload' });
    const con = await cr.json();
    for (const spr of Object.values(con.sprites)) files.add('./assets/' + spr.file);
    return Array.from(files);
  } catch (e) {
    return [];
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const all = CORE.concat(await assetList());
    const results = await Promise.allSettled(all.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
    const failed = results.filter((r) => r.status === 'rejected');
    console.log(`[SW] cached ${all.length - failed.length}/${all.length}`);
    if (failed.length) {
      // 1枚でも欠けたまま「設置済み」にしない（オフラインで欠けた素材を踏むと止まる）。次に開いた時にやり直す
      console.warn('[SW] failed:', failed.map((f) => (f.reason && f.reason.message) || String(f.reason)));
      await caches.delete(CACHE_NAME);
      throw new Error('[SW] precache incomplete: ' + failed.length);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('pochamon-ufo-') && k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(event.request);
      if (res && res.ok && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
      }
      return res;
    } catch (e) {
      if (event.request.mode === 'navigate') {
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
      }
      throw e;
    }
  })());
});
