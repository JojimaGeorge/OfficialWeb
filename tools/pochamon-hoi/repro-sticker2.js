const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.join(__dirname, 'shots-verify', 'sticker'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  await p.goto('http://127.0.0.1:8130/pochamon-hoi/index.html#admin', { waitUntil: 'load' });
  await sleep(3000);
  await p.click('#btn-debug-3win', { force: true });
  await sleep(4500);
  await p.locator('#sticker-selector-grid').screenshot({ path: path.join(OUT, '10-候補グリッド_選択前.png') });
  const items = await p.locator('.sticker-selector__item').count();
  // 3つ目を選ぶ
  await p.locator('.sticker-selector__item').nth(2).click({ force: true });
  await sleep(1500);
  await p.locator('#sticker-selector-grid').screenshot({ path: path.join(OUT, '11-候補グリッド_3つ目選択後.png') });
  await p.locator('#sticker-award-row').screenshot({ path: path.join(OUT, '12-確定分_3つ目選択後.png') });
  const d = await p.evaluate(() => {
    const g = document.getElementById('sticker-selector-grid');
    return { items: g.children.length,
      each: [...g.children].map((it,i)=>({ i, cls: it.className, imgs: it.querySelectorAll('img').length,
        html: it.outerHTML.replace(/\s+/g,' ').slice(0,260) })) };
  });
  console.log('候補数', items); console.log(JSON.stringify(d, null, 1).slice(0, 3000));
  await b.close();
})();
