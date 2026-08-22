const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.join(__dirname, 'shots-verify', 'sticker'); fs.mkdirSync(OUT, { recursive: true });
const scan = p => p.evaluate(() => ({
  fly: [...document.querySelectorAll('.fly-sticker')].map(e => { const r = e.getBoundingClientRect();
    return { src: e.src.split('/').pop(), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }; }),
  sweat: document.querySelectorAll('.sweat').length,
}));
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  await p.goto('http://127.0.0.1:8130/pochamon-hoi/index.html#admin', { waitUntil: 'load' });
  await sleep(3000);
  await p.click('#btn-debug-3win', { force: true });
  await sleep(4500);

  console.log('A) ゆっくり1枚選ぶ');
  await p.locator('.sticker-selector__item').nth(3).click({ force: true });
  await sleep(1500);
  console.log('   →', JSON.stringify(await scan(p)));

  console.log('B) 素早く別のを連続で選ぶ（4回）');
  for (const n of [0, 4, 1, 3]) { await p.locator('.sticker-selector__item').nth(n).click({ force: true }); await sleep(120); }
  await sleep(300);
  console.log('   飛行中 →', JSON.stringify(await scan(p)));
  await sleep(2500);
  console.log('   落ち着いた後 →', JSON.stringify(await scan(p)));
  await p.screenshot({ path: path.join(OUT, '20-連続選択後.png') });

  console.log('C) 選んだ状態で「もう一回チャレンジ」→ 次の結果画面へ');
  await p.click('#btn-retry-result', { force: true });
  await sleep(600);
  console.log('   画面遷移直後 →', JSON.stringify(await scan(p)));

  console.log('D) 選択中に画面遷移（飛行アニメの途中で抜ける）');
  await p.evaluate(() => { location.hash=''; location.hash='#admin'; });
  await sleep(400);
  await p.click('#btn-debug-3win', { force: true }); await sleep(4500);
  await p.locator('.sticker-selector__item').nth(2).click({ force: true });
  await sleep(100);
  await p.click('#btn-retry-result', { force: true });
  await sleep(2000);
  console.log('   →', JSON.stringify(await scan(p)));
  await p.screenshot({ path: path.join(OUT, '21-飛行中に画面遷移.png') });
  await b.close();
})();
