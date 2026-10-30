// 台車を決めた座標に置いて、狙いの目印を撮る（検品で言われた所の確かめ用）。
//   node tools/pochamon-ufo/pointer_at.js --at=0.19:-0.28,0.11:-0.24 [--prefix=pa] [--w=1180] [--h=820] [--browser=webkit]
const path = require('path');
const { chromium, webkit } = require(path.join(__dirname, '..', 'pochamon-hoi', 'node_modules', 'playwright'));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
const AT = (args.at || '0,0').split(',').map((s) => s.split(':').map(Number));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await (args.browser === 'webkit' ? webkit : chromium).launch();
  const page = await browser.newPage({ viewport: { width: parseInt(args.w || '1180', 10), height: parseInt(args.h || '820', 10) }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:4876/pochamon-ufo/?nosw=1' + (args.query ? '&' + args.query : ''), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ufo && window.__ufo.state().phase === 'title', null, { timeout: 60000 });
  await page.evaluate(() => window.__ufo.tap());
  await page.waitForFunction(() => window.__ufo.state().phase === 'moveX', null, { timeout: 15000 });
  await page.evaluate(() => window.__ufo.press('x', true)); await sleep(300); await page.evaluate(() => window.__ufo.press('x', false));
  await page.waitForFunction(() => window.__ufo.state().phase === 'moveY', null, { timeout: 15000 });
  for (let n = 0; n < AT.length; n++) {
    const [x, y] = AT[n];
    await page.evaluate(([x, y]) => window.__ufo.aimAt(x, y), [x, y]);
    await page.evaluate(() => window.__ufo.setLastInput(performance.now()));
    await sleep(700);
    const p = await page.evaluate(() => window.__ufo.dbg.pointer);
    const name = (args.prefix || 'pa') + '_' + n + '.png';
    if (p) {
      const s = 2, k = (await page.evaluate(() => window.__ufo.consoles())).view, cx = (k.ox + p.uv.u * k.k) * s, cy = (k.oy + p.uv.v * k.k) * s;
      await page.screenshot({ path: path.join(__dirname, 'shots', name), clip: { x: Math.max(0, cx / s - 150), y: Math.max(0, cy / s - 190), width: 300, height: 260 } });
    }
    console.log(name, 'at', x, y, p ? JSON.stringify({ a: +p.a.toFixed(2), z: +p.z.toFixed(3), on: p.on, layer: p.layer, line: p.lineLayer, ghostRing: p.ghostRing, ghostLine: p.ghostLine }) : 'no pointer');
  }
  if (errors.length) console.log('ERRORS', errors.join(' | '));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
