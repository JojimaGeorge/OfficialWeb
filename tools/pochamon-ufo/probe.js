// 指定の場面まで進めてスクショを撮る（確認用）。
//   node tools/pochamon-ufo/probe.js --w=1024 --h=768 --phase=hold --x=1500 --y=2600 --out=probe.png [--browser=webkit] [--force=win,lose,win] [--wait=400] [--query=...]
// phase: title | moveX | moveY | descend | grab | lift | hold | carry | release | return | result
const path = require('path');
const fs = require('fs');
const { chromium, webkit } = require(path.join(__dirname, '..', 'pochamon-hoi', 'node_modules', 'playwright'));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const bt = args.browser === 'webkit' ? webkit : chromium;
  const browser = await bt.launch();
  const page = await browser.newPage({ viewport: { width: parseInt(args.w || '1024', 10), height: parseInt(args.h || '768', 10) }, deviceScaleFactor: parseFloat(args.dpr || '2') });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto((args.url || 'http://localhost:4876/pochamon-ufo/') + '?nosw=1' + (args.query ? '&' + args.query : ''), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ufo && window.__ufo.state().phase === 'title', null, { timeout: 60000 });
  await sleep(600);
  const state = () => page.evaluate(() => window.__ufo.state());
  const waitPhase = async (p, timeout = 40000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { const s = await state(); if (s.phase === p) return s; await sleep(30); }
    throw new Error('timeout waiting for ' + p + ' (now ' + (await state()).phase + ')');
  };
  const target = args.phase || 'title';
  const order = ['title', 'moveX', 'moveY', 'descend', 'grab', 'lift', 'hold', 'carry', 'release', 'return', 'between', 'result'];
  if (target !== 'title') {
    if (args.force) await page.evaluate((f) => window.__ufo.force(f.split(',')), args.force);
    await page.evaluate(() => window.__ufo.tap());
    await waitPhase('moveX');
    if (target !== 'moveX') {
      await sleep(200);
      await page.evaluate(() => window.__ufo.press('x', true));
      await sleep(parseInt(args.x || '1200', 10));
      await page.evaluate(() => window.__ufo.press('x', false));
      await waitPhase('moveY');
      if (target !== 'moveY') {
        await sleep(200);
        await page.evaluate(() => window.__ufo.press('y', true));
        await sleep(parseInt(args.y || '900', 10));
        await page.evaluate(() => window.__ufo.press('y', false));
        await waitPhase(target, 60000);
      }
    }
  }
  await sleep(parseInt(args.wait || '400', 10));
  const out = path.isAbsolute(args.out || '') ? args.out : path.join(__dirname, 'shots', args.out || 'probe.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  const s = await state();
  console.log('saved', out, 'phase', s.phase, 'claw', JSON.stringify(s.claw));
  if (errors.length) console.log('ERRORS', errors);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
