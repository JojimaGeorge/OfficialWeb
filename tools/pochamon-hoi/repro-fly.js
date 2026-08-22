// 選択した瞬間〜着地までを細かく撮って「2個見えている」瞬間を捉える
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.join(__dirname, 'shots-verify', 'fly'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })).newPage();
  await p.goto('http://127.0.0.1:8130/pochamon-hoi/index.html#admin', { waitUntil: 'load' });
  await sleep(3000);
  await p.click('#btn-debug-3win', { force: true });
  await sleep(4500);

  const state = () => p.evaluate(() => {
    const prev = document.getElementById('choice-sticker-display');
    return {
      枠の中身: prev ? (prev.querySelector('img') ? '画像:' + prev.querySelector('img').src.split('/').pop()
                    : (prev.textContent.trim() || '空')) : '枠なし',
      飛行中: document.querySelectorAll('.fly-sticker').length,
    };
  });
  console.log('選択前 :', JSON.stringify(await state()));
  await p.locator('.sticker-selector__item').nth(1).click({ force: true });
  for (const t of [0, 60, 120, 200, 300, 420, 500, 700]) {
    if (t) await sleep(t - (arguments.prev || 0));
    const s = await state();
    console.log(`+${String(t).padStart(3)}ms :`, JSON.stringify(s));
    await p.locator('#sticker-award-row').screenshot({ path: path.join(OUT, `t${String(t).padStart(3,'0')}.png`) });
  }
  await b.close();
})();
