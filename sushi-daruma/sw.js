const CACHE_NAME = 'sushidaruma-v4';
const URLS_TO_CACHE = [
  // 図鑑ページ
  './zukan/',
  './zukan/index.html',
  './zukan/manifest.json',
  // くじページ
  './kuji/',
  './kuji/index.html',
  './kuji/admin.html',
  // くじ用バッジ画像
  './image/badge/maguro.webp',
  './image/badge/salmon.webp',
  './image/badge/ikura.webp',
  './image/badge/tamago.webp',
  './image/badge/uni.webp',
  './image/badge/anago.webp',
  './image/badge/amaebi.webp',
  './image/badge/hamachi.webp',
  './image/badge/hotaruika.webp',
  './image/badge/sayori.webp',
  './image/badge/bincho.webp',
  './image/badge/madako.webp',
  './image/badge/kurodai.webp',
  './image/badge/shake.webp',
  './image/badge/kinmedai.webp',
  // くじ用その他画像
  './image/logo.png',
  './image/kinmedai.webp',
  './image/shake.webp',
  // 診断ページ
  './shindan/',
  './shindan/index.html',
  './shindan/styles.css',
  './shindan/script.js',
  './shindan/img/amaebi.png',
  './shindan/img/hamachi.png',
  './shindan/img/hotaruika.png',
  './shindan/img/madako.png',
  './shindan/img/maguro.png',
  './shindan/img/salmon.png',
  './shindan/img/uni.png',
  // 共通リソース
  './image/logo_zukan.png',
  // 図鑑画像
  './image/maguro.webp',
  './image/salmon.webp',
  './image/ikura.webp',
  './image/tamago.webp',
  './image/uni.webp',
  './image/anago.webp',
  './image/amaebi.webp',
  './image/hamachi.webp',
  './image/hotaruika.webp',
  './image/sawara.webp',
  './image/sayori.webp',
  './image/sakuradai.webp',
  './image/buri.webp',
  './image/iwashi.webp',
  './image/bincho.webp',
  './image/aburiengawa.webp',
  './image/negitoro.webp',
  './image/tobiuo.webp',
  './image/madako.webp',
  './image/kurodai.webp',
  './image/katsuo.webp',
  './image/ebiten.webp',
  './image/hokkigai.webp',
  './image/tsubugai.webp',
  './image/akisake.webp',
  './image/shimesaba.webp',
  './image/nodoguro.webp',
  './image/botanebi.webp',
  './image/choco.webp',
  './image/nyanco.webp',
  './image/ba-ba.webp',
  // Google Fonts (キャッシュ試行、失敗してもOK)
  'https://fonts.googleapis.com/css?family=M+PLUS+Rounded+1c:400;500;700;800',
  'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@300;400;500;700&display=swap'
];

// インストール時に全リソースをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE).catch((err) => {
        // 個別にキャッシュ（一部失敗してもOK）
        return Promise.allSettled(
          URLS_TO_CACHE.map((url) => cache.add(url).catch(() => {}))
        );
      });
    })
  );
  self.skipWaiting();
});

// 古いキャッシュの削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// リクエスト時：キャッシュ優先、なければネットワーク
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((networkResponse) => {
        // 成功したらキャッシュに追加
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // オフラインでキャッシュにもない場合
        return new Response('オフラインです', { status: 503 });
      });
    })
  );
});
