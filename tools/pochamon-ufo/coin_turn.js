// コインを持って口へゆっくり運ぶ間の「向き（度）」の変化を記録し、途中のコマを撮る（なめらかさの確認）。
//   node tools/pochamon-ufo/coin_turn.js [--w=1024 --h=768] [--out=coin_turn]
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', 'pochamon-hoi', 'node_modules', 'playwright'));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = path.join(__dirname, 'shots', args.out || 'coin_turn');
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: parseInt(args.w || '1024', 10), height: parseInt(args.h || '768', 10) }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('http://localhost:4876/pochamon-ufo/?nosw=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ufo && window.__ufo.state().phase === 'title', null, { timeout: 60000 });
  await sleep(600);
  const c = await page.evaluate(() => window.__ufo.coin());
  const sx = c.pos.x, sy = c.pos.y, ex = c.slit.x, ey = c.slit.y + c.slit.h / 2;
  await page.mouse.move(sx, sy); await page.mouse.down();
  const log = [];
  const t0 = Date.now();
  // 最初の 250ms は指を止めたまま（持った瞬間の回り方）、その後 1.6 秒かけて口へ
  for (let i = 0; i < 8; i++) { await sleep(30); const s = await page.evaluate(() => window.__ufo.coin()); log.push([Date.now() - t0, s.deg, s.frame, +s.size.toFixed(2)]); }
  await page.screenshot({ path: path.join(outDir, 'a_grabbed.png'), clip: { x: sx - 120, y: sy - 120, width: 240, height: 240 } });
  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    await page.mouse.move(sx + (ex - sx) * u, sy + (ey - sy) * u);
    await sleep(40);
    const s = await page.evaluate(() => window.__ufo.coin());
    log.push([Date.now() - t0, s.deg, s.frame, +s.size.toFixed(2)]);
    if (i === 20 || i === 32 || i === 38) await page.screenshot({ path: path.join(outDir, 'b_step' + i + '.png'), clip: { x: s.pos.x - 120, y: s.pos.y - 120, width: 240, height: 240 } });
  }
  await page.mouse.up();
  await sleep(1200);
  console.log('deg log (ms, deg, frame, size):');
  console.log(log.map((r) => r.join('/')).join('  '));
  console.log('after', (await page.evaluate(() => window.__ufo.coin())).state, 'phase', (await page.evaluate(() => window.__ufo.state())).phase);
  if (errors.length) console.log('ERRORS', errors);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
