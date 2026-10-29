// コインの投入を Playwright で実際にドラッグして確かめ、要所のスクショを撮る。
//   node tools/pochamon-ufo/coin.js [--browser=chromium|webkit] [--w=1180 --h=820] [--url=...]
// 事前に: py -m http.server 4876 --directory main
const path = require('path');
const fs = require('fs');
const { chromium, webkit } = require(path.join(__dirname, '..', 'pochamon-hoi', 'node_modules', 'playwright'));

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
const browserName = args.browser || 'chromium';
const W = parseInt(args.w || '1180', 10), H = parseInt(args.h || '820', 10);
const url = (args.url || 'http://localhost:4876/pochamon-ufo/') + '?nosw=1';
const outDir = path.join(__dirname, 'shots', 'coin-' + browserName + '-' + W + 'x' + H);
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const bt = browserName === 'webkit' ? webkit : chromium;
  const browser = await bt.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: browserName === 'webkit' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  const shot = async (name) => { await page.screenshot({ path: path.join(outDir, name + '.png') }); console.log('shot', name); };
  const state = () => page.evaluate(() => window.__ufo.state());

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ufo && window.__ufo.state().phase === 'title', null, { timeout: 60000 });
  await sleep(900);
  await shot('01_title_coin_in_tray');
  const c = await page.evaluate(() => window.__ufo.coin());
  const cons = await page.evaluate(() => window.__ufo.consoles());
  console.log('coin', JSON.stringify(c), 'consoles', JSON.stringify({ L: cons.L, R: cons.R }));
  if (c.state !== 'home') throw new Error('coin is not at home: ' + c.state);

  // 1) 投入口から外れた所で離す → 札の下へ戻る
  await page.mouse.move(c.pos.x, c.pos.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(c.pos.x + 320 * i / 8, c.pos.y - 60 * i / 8); await sleep(30); }   // 筐体の上まで持っていって離す
  await shot('02_dragging');
  await page.mouse.up();
  await sleep(700);
  const back = await page.evaluate(() => window.__ufo.coin());
  console.log('after miss-drop:', back.state, 'at', JSON.stringify(back.pos));
  if (back.state !== 'home') throw new Error('coin did not return: ' + back.state);

  // 2) 投入口の上で離す → 入る → スタート
  const target = { x: c.slit.x, y: c.slit.y + c.slit.h / 2 };
  await page.mouse.move(c.pos.x, c.pos.y);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) { await page.mouse.move(c.pos.x + (target.x - c.pos.x) * i / 14, c.pos.y + (target.y - c.pos.y) * i / 14); await sleep(30); }
  await shot('03_at_slot');
  await page.mouse.up();
  await sleep(380);
  await shot('04_inserting');
  await page.waitForFunction(() => window.__ufo.state().phase === 'moveX', null, { timeout: 15000 });
  await sleep(500);
  await shot('05_moveX_ring_lit');
  // よこボタンを押している最中（沈んだキャップ）
  await page.evaluate(() => window.__ufo.press('x', true));
  await sleep(500);
  await shot('06_pressing_x');
  await page.evaluate(() => window.__ufo.press('x', false));
  await page.waitForFunction(() => window.__ufo.state().phase === 'moveY', null, { timeout: 15000 });
  await sleep(400);
  await shot('07_moveY_ring_lit');
  // 残りは自動で最後まで（結果 → おしまい → コインが札の下へ戻る）
  await page.evaluate(() => { window.__ufo.force(['win', 'win', 'lose']); });
  await page.evaluate(() => window.__ufo.press('y', true));
  await sleep(600);
  await page.evaluate(() => window.__ufo.press('y', false));
  for (let i = 0; i < 2; i++) {
    await page.waitForFunction(() => window.__ufo.state().phase === 'moveX', null, { timeout: 60000 });
    await page.evaluate(() => window.__ufo.press('x', true)); await sleep(500); await page.evaluate(() => window.__ufo.press('x', false));
    await page.waitForFunction(() => window.__ufo.state().phase === 'moveY', null, { timeout: 15000 });
    await page.evaluate(() => window.__ufo.press('y', true)); await sleep(400); await page.evaluate(() => window.__ufo.press('y', false));
  }
  await page.waitForFunction(() => window.__ufo.state().phase === 'result', null, { timeout: 60000 });
  await sleep(1200);
  await shot('08_result_led');
  await page.click('#resultBtn');
  await sleep(300);
  await shot('09_coin_returning');
  await sleep(900);
  const again = await page.evaluate(() => window.__ufo.coin());
  console.log('after result:', again.state);
  await shot('10_title_again');
  const fin = await state();
  console.log('RESULT', JSON.stringify({ phase: fin.phase, got: fin.got }));
  if (errors.length) { console.log('CONSOLE/PAGE ERRORS:'); errors.forEach((e) => console.log('  ' + e)); } else console.log('no console errors');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
