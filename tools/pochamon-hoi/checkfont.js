const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 820, height: 1180 } })).newPage();
  await p.goto('http://127.0.0.1:8130/pochamon-hoi/index.html', { waitUntil: 'load' });
  await sleep(4000);
  const r = await p.evaluate(() => {
    const el = document.querySelector('.title-screen__rule-item');
    const cs = getComputedStyle(el);
    const loaded = [...document.fonts].map(f => f.family + '/' + f.weight + '/' + f.status);
    const chars = '耐水択戦負枚以選当出二回勝';
    const miss = [...chars].filter(c => !document.fonts.check('800 16px "Zen Maru Gothic"', c));
    return { fontFamily: cs.fontFamily, varMain: getComputedStyle(document.documentElement).getPropertyValue('--font-main'), loaded, missing: miss.join('') };
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
