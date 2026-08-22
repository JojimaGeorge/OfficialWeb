// 修正後の見た目確認: タイトル(QR非表示・新MV) / ワイプ途中 / 選択中のビネット / 結果 / タイトル復帰
const { chromium, webkit } = require('playwright');
const path = require('path'); const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const eng = process.argv[2] || 'chromium';
const OUT = path.join(__dirname, 'shots-verify', eng);
fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://127.0.0.1:8130/pochamon-hoi/index.html';

(async () => {
  const browser = await (eng === 'webkit' ? webkit : chromium).launch();
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: eng === 'chromium', hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL, { waitUntil: 'load' });
  await sleep(6000);
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });

  await shot('01-title');
  const mv = await page.evaluate(() => {
    const a = document.getElementById('title-mv-a');
    return { src: (a.currentSrc||a.src).slice(0,40), paused: a.paused, w: a.videoWidth, h: a.videoHeight,
             qrShown: getComputedStyle(document.querySelector('.title-screen__qr')).display };
  });
  console.log('MV:', JSON.stringify(mv));

  await page.click('#btn-start', { force: true });
  await sleep(250); await shot('02-wipe-mid');   // アイリスワイプ途中
  await sleep(1200); await shot('03-acchi-vignette'); // 「あっちむいて」＝ビネット中
  for (let r = 0; r < 5; r++) {
    const t0 = Date.now();
    while (Date.now() - t0 < 8000 && await page.evaluate(() => document.getElementById('btn-pyon').disabled)) await sleep(100);
    await page.click('#btn-pyon', { force: true }); await sleep(2600);
  }
  await sleep(5000); await shot('04-result');
  await page.click('#btn-back-to-title', { force: true });
  await sleep(1500); await shot('05-title-back');
  const mv2 = await page.evaluate(() => { const a=document.getElementById('title-mv-a'), b=document.getElementById('title-mv-b');
    return { aPaused: a.paused, bPaused: b.paused, aTime: +a.currentTime.toFixed(2) }; });
  console.log('タイトル復帰後のMV:', JSON.stringify(mv2));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})();
