const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.join(__dirname, 'shots-verify', 'phone'); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  await p.goto('http://127.0.0.1:8130/pochamon-hoi/index.html', { waitUntil: 'load' });
  await sleep(6000);
  await p.screenshot({ path: path.join(OUT, 'title-393.png') });
  const over = await p.evaluate(() => { const r = document.querySelector('.title-screen__rules').getBoundingClientRect();
    const btn = document.getElementById('btn-start').getBoundingClientRect();
    return { rules: {y: Math.round(r.y), h: Math.round(r.height), bottom: Math.round(r.bottom)},
             btn: {y: Math.round(btn.y), h: Math.round(btn.height)}, vh: window.innerHeight,
             はみ出し: r.bottom > window.innerHeight }; });
  console.log(JSON.stringify(over));
  await b.close();
})();
