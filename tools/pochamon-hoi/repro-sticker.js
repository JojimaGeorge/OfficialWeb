const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.join(__dirname, 'shots-verify', 'sticker'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8130/pochamon-hoi/index.html#admin', { waitUntil: 'load' });
  await sleep(3000);
  await p.click('#btn-debug-3win', { force: true });
  await sleep(4500);
  await p.locator('#sticker-award-row').screenshot({ path: path.join(OUT, '01-選択前.png') });
  // 候補から1枚選ぶ
  await p.click('.sticker-selector__item', { force: true });
  await sleep(1400);
  await p.locator('#sticker-award-row').screenshot({ path: path.join(OUT, '02-選択後.png') });
  await p.screenshot({ path: path.join(OUT, '03-結果画面全体.png') });
  const dump = await p.evaluate(() => {
    const row = document.getElementById('sticker-award-row');
    return [...row.children].map((slot, i) => ({
      i, cls: slot.className, id: slot.id,
      imgs: [...slot.querySelectorAll('img')].map(im => ({ src: im.src.split('/').pop(), cls: im.className,
        rect: (r => ({x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}))(im.getBoundingClientRect()) })),
      html: slot.outerHTML.replace(/\s+/g,' ').slice(0, 400),
    }));
  });
  console.log(JSON.stringify(dump, null, 1));
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
