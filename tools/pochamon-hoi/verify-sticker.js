// 確定分3枠が全部ちがう絵柄になるか＋選び直し中に前のシールが残らないかを10回確認
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.join(__dirname, 'shots-verify', 'sticker'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8130/pochamon-hoi/index.html#admin', { waitUntil: 'load' });
  await sleep(3000);
  let dup = 0, lingering = 0;
  for (let n = 0; n < 10; n++) {
    await p.evaluate(() => { location.hash=''; location.hash='#admin'; }); await sleep(400);
    await p.click('#btn-debug-3win', { force: true }); await sleep(4200);
    const cand = await p.locator('.sticker-selector__item').count();
    await p.locator('.sticker-selector__item').nth(0).click({ force: true }); await sleep(900);
    // 選び直し: 別の候補を押して、飛来中(120ms)に枠が空か見る
    if (cand > 1) {
      await p.locator('.sticker-selector__item').nth(1).click({ force: true });
      await sleep(120);
      const mid = await p.evaluate(() => { const e = document.getElementById('choice-sticker-display');
        return e && e.querySelector('img') ? 'まだ画像が残ってる' : '空'; });
      if (mid !== '空') lingering++;
      await sleep(900);
    }
    const ids = await p.evaluate(() => [...document.getElementById('sticker-award-row').querySelectorAll('img')]
      .map(i => i.src.split('/').pop()));
    const uniq = new Set(ids);
    if (uniq.size !== ids.length) dup++;
    console.log(`${n+1}回目 候補${cand}枚 / 確定分=[${ids.join(', ')}] ${uniq.size === ids.length ? '✅全部ちがう' : '❌ダブり'}`);
  }
  await p.locator('#sticker-award-row').screenshot({ path: path.join(OUT, '30-修正後.png') });
  console.log(`\nダブり ${dup}/10 回 / 飛来中に前のシールが残った ${lingering}/10 回`);
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
