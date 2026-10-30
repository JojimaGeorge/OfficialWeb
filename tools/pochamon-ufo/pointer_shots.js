// 狙いの目印（台車の真下の点）を、アームをいくつかの所へ動かして撮る。
//   node tools/pochamon-ufo/pointer_shots.js [--w=1180] [--h=820] [--query=ptr=dot] [--prefix=ptr] [--browser=webkit]
// 事前に: py -m http.server 4876 --directory main
const path = require('path');
const fs = require('fs');
const { chromium, webkit } = require(path.join(__dirname, '..', 'pochamon-hoi', 'node_modules', 'playwright'));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// よこを押す秒数・たてを押す秒数の組（撮る所）
const PLAN = (args.plan || '0.9:0.0,1.6:0.9,2.6:1.6,3.6:2.6,1.2:3.4').split(',').map((s) => s.split(':').map(Number));

(async () => {
  const bt = args.browser === 'webkit' ? webkit : chromium;
  const browser = await bt.launch();
  const page = await browser.newPage({ viewport: { width: parseInt(args.w || '1180', 10), height: parseInt(args.h || '820', 10) }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const outDir = path.join(__dirname, 'shots');
  fs.mkdirSync(outDir, { recursive: true });
  const prefix = args.prefix || 'ptr';
  const state = () => page.evaluate(() => window.__ufo.state());
  const waitPhase = async (p, timeout = 30000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { const s = await state(); if (s.phase === p) return s; await sleep(40); }
    throw new Error('timeout ' + p + ' (now ' + (await state()).phase + ')');
  };
  for (let n = 0; n < PLAN.length; n++) {
    const [sx, sy] = PLAN[n];
    await page.goto('http://localhost:4876/pochamon-ufo/?nosw=1' + (args.query ? '&' + args.query : ''), { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ufo && window.__ufo.state().phase === 'title', null, { timeout: 60000 });
    await page.evaluate(() => window.__ufo.tap());
    await waitPhase('moveX');
    await page.evaluate(() => window.__ufo.press('x', true));
    await sleep(sx * 1000);
    await page.evaluate(() => window.__ufo.press('x', false));
    if (sy > 0) {
      await waitPhase('moveY');
      await page.evaluate(() => window.__ufo.press('y', true));
      await sleep(sy * 1000);
      // 押したまま撮る（離すと下りてしまう）
    }
    await sleep(600);
    const s = await state();
    const ptr = await page.evaluate(() => window.__ufo.dbg.pointer);
    const name = prefix + '_' + n + '.png';
    await page.screenshot({ path: path.join(outDir, name) });
    console.log(name, 'phase', s.phase, 'carriage', s.claw.cx.toFixed(3), s.claw.cy.toFixed(3), 'pointer', ptr ? JSON.stringify({ a: +ptr.a.toFixed(2), z: +ptr.z.toFixed(3), on: ptr.on, layer: ptr.layer }) : null);
  }
  if (errors.length) console.log('ERRORS\n' + errors.join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
