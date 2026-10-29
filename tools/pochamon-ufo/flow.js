// 動きの確認：コインを指でドラッグして投入 → 1回目（外す）→ 2回目（取る）を撮る。投入の途中コマ・山の崩れ・影・梁の裏を見る。
//   node tools/pochamon-ufo/flow.js [--w=1024 --h=768] [--browser=webkit] [--video=1] [--out=flow]
const path = require('path');
const fs = require('fs');
const { chromium, webkit } = require(path.join(__dirname, '..', 'pochamon-hoi', 'node_modules', 'playwright'));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = parseInt(args.w || '1024', 10), H = parseInt(args.h || '768', 10);
const outDir = path.join(__dirname, 'shots', args.out || 'flow');
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const bt = args.browser === 'webkit' ? webkit : chromium;
  const browser = await bt.launch();
  const ctxOpt = { viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true };
  if (args.video) ctxOpt.recordVideo = { dir: outDir, size: { width: W, height: H } };
  const ctx = await browser.newContext(ctxOpt);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shot = async (name) => { await page.screenshot({ path: path.join(outDir, name + '.png') }); console.log('shot', name); };
  const state = () => page.evaluate(() => window.__ufo.state());
  const waitPhase = async (p, timeout = 60000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { const s = await state(); if (s.phase === p) return s; await sleep(25); }
    throw new Error('timeout waiting for ' + p + ' (now ' + (await state()).phase + ')');
  };
  await page.goto('http://localhost:4876/pochamon-ufo/?nosw=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ufo && window.__ufo.state().phase === 'title', null, { timeout: 60000 });
  await sleep(700);
  await shot('00_title');
  // コインを指でドラッグして投入口へ（途中を撮る）
  const coin = await page.evaluate(() => window.__ufo.coin());
  const sx = coin.pos.x, sy = coin.pos.y, ex = coin.slit.x, ey = coin.slit.y + coin.slit.h / 2;
  await page.touchscreen.tap(sx, sy).catch(() => {});   // 音の解錠（タップはコインを揺らすだけ）
  await sleep(300);
  // pointer events で掴む → 動かす → 離す（touch の pointer は CDP で合成）
  const cdp = await ctx.newCDPSession(page).catch(() => null);
  const steps = 18;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await sleep(120);
  await shot('01_coin_grab');
  for (let i = 1; i <= steps; i++) {
    const u = i / steps, e = 1 - Math.pow(1 - u, 2);
    await page.mouse.move(sx + (ex - sx) * e, sy + (ey - sy) * e);
    await sleep(40);
    if (i === 6) await shot('02_coin_drag_mid');
    if (i === 14) await shot('03_coin_drag_near');
  }
  await sleep(150);
  await shot('04_coin_at_slit');
  await page.mouse.up();
  for (let i = 0; i < 9; i++) { await sleep(60); await shot('05_coin_insert_' + i); }
  const c2 = await page.evaluate(() => window.__ufo.coin());
  console.log('coin after release', c2.state);
  await page.evaluate(() => window.__ufo.force(['lose', 'win', 'win']));
  await waitPhase('moveX', 15000);
  await sleep(300);
  await shot('06_moveX');
  await page.evaluate(() => window.__ufo.press('x', true)); await sleep(1500); await page.evaluate(() => window.__ufo.press('x', false));
  await waitPhase('moveY'); await sleep(200);
  await page.evaluate(() => window.__ufo.press('y', true)); await sleep(900); await page.evaluate(() => window.__ufo.press('y', false));
  await waitPhase('descend'); await sleep(450); await shot('10_descend_shadow');
  await waitPhase('grab'); await sleep(300); await shot('11_grab');
  await waitPhase('lift');
  // 持ち上げ → すべり落ち → 落下 → 着地 を、相の変わり目で撮る（相は短いので回しながら見張る）
  let seen = {}, t0 = Date.now(), lastPhase = '';
  while (Date.now() - t0 < 25000) {
    const s = await state();
    if (s.phase !== lastPhase) {
      lastPhase = s.phase;
      if (s.phase === 'lift') { await sleep(450); await shot('12_lift_pile'); console.log('pile after lift', JSON.stringify((await page.evaluate(() => window.__ufo.pile())).filter((t) => t.state !== 'rest' || t.dz !== 0))); }
      if (s.phase === 'slipping') { await sleep(300); await shot('14_slip'); seen.slip = 1; }
      if (s.phase === 'return') { await sleep(250); await shot('15_fall'); await sleep(450); await shot('16_landed'); console.log('pile after fall', JSON.stringify((await page.evaluate(() => window.__ufo.pile())).filter((t) => t.state !== 'rest' || t.dz !== 0))); }
      if (s.phase === 'between' || s.phase === 'result') break;
    }
    await sleep(20);
  }
  await waitPhase('moveX'); await sleep(200);   // 'between' は 1.1 秒で過ぎるので待たない
  // 2回目：取る（奥へ）
  await page.evaluate(() => window.__ufo.press('x', true)); await sleep(1400); await page.evaluate(() => window.__ufo.press('x', false));
  await waitPhase('moveY'); await sleep(200);
  await page.evaluate(() => window.__ufo.press('y', true)); await sleep(3200); await page.evaluate(() => window.__ufo.press('y', false));
  await waitPhase('lift'); await sleep(800); await shot('20_lift2');
  await waitPhase('hold'); await sleep(150); await shot('21_hold_back');
  await waitPhase('carry'); await sleep(1200); await shot('22_carry');
  await waitPhase('release'); await sleep(500); await shot('23_release');
  console.log('bgm', JSON.stringify(await page.evaluate(() => window.__ufo.bgm())));
  if (errors.length) console.log('ERRORS', errors);
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
