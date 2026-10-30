// ぽちゃもん UFOキャッチャーを Playwright で通しで遊び、要所のスクショを撮る。
//   node tools/pochamon-ufo/play.js [--browser=chromium|webkit] [--layout=A|B] [--force=win,lose,win] [--url=...] [--localjs]
// 事前に: py -m http.server 4876 --directory main   （URL は http://localhost:4876/pochamon-ufo/）
const path = require('path');
const fs = require('fs');
const { chromium, webkit } = require(path.join(__dirname, '..', 'pochamon-hoi', 'node_modules', 'playwright'));

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
const browserName = args.browser || 'chromium';
const layout = (args.layout || 'A').toUpperCase();
const force = args.force ? args.force.split(',') : ['win', 'lose', 'win'];
const url = (args.url || 'http://localhost:4876/pochamon-ufo/') + '?nosw=1';   // layout はもう無い（--layout は出力フォルダ名にだけ残す）
const outDir = path.join(__dirname, 'shots', browserName + '-' + layout);
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const bt = browserName === 'webkit' ? webkit : chromium;
  const browser = await bt.launch();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, isMobile: browserName === 'webkit' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url() + ' :: ' + (r.failure() && r.failure().errorText)));   // どのファイルの読み込みが落ちたか（コンソールのエラーには URL が出ない）
  const shot = async (name) => { await page.screenshot({ path: path.join(outDir, name + '.png') }); console.log('shot', name); };
  const state = () => page.evaluate(() => window.__ufo.state());
  // p は段階の名前か、そのどれかでよい名前の配列
  const waitPhase = async (p, timeout = 30000) => {
    const ps = Array.isArray(p) ? p : [p];
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) { const s = await state(); if (ps.includes(s.phase)) return s; await sleep(40); }
    throw new Error('timeout waiting for phase ' + ps.join('|') + ' (now ' + (await state()).phase + ')');
  };

  // --localjs：本番の絵と回線のまま、game.js だけ手元の版に差し替えて確かめる（push 前の直しを本番の条件で見る）
  if (args.localjs) await page.route('**/pochamon-ufo/game.js*', (r) => r.fulfill({ path: path.join(__dirname, '..', '..', 'main', 'pochamon-ufo', 'game.js'), contentType: 'application/javascript' }));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ufo && window.__ufo.state().phase === 'title', null, { timeout: 60000 });
  await sleep(800);
  await shot('01_title');
  await page.evaluate((f) => { window.__ufo.force(f); }, force);
  await page.evaluate(() => window.__ufo.unlockAudio());   // 音の合成コードも通す（ヘッドレスでは鳴らないが例外は拾える）
  await page.evaluate(() => window.__ufo.tap());
  await waitPhase('moveX');
  await sleep(300);
  await shot('02_moveX_guide');

  const results = [];
  for (let i = 0; i < 3; i++) {
    await waitPhase('moveX');
    await sleep(200);
    // よこ：1回目は長め、2回目は短め、3回目は中くらい
    await page.evaluate(() => window.__ufo.press('x', true));
    await sleep([1500, 800, 2600][i]);
    await page.evaluate(() => window.__ufo.press('x', false));
    await waitPhase('moveY');
    await sleep(250);
    if (i === 0) await shot('03_moveY_guide');
    await page.evaluate(() => window.__ufo.press('y', true));
    await sleep([900, 1800, 400][i]);
    await page.evaluate(() => window.__ufo.press('y', false));
    await waitPhase('descend');
    await sleep(500);
    await shot(`1${i}_descend`);
    await waitPhase('grab');
    await sleep(350);
    await shot(`1${i}_grab`);
    // 掴みそこねの回は持ち上げてすぐ滑り落ちることがあり、grab を撮っている0.6秒の間に lift が終わって取り逃した（10/30 昼）
    const s = await waitPhase(['lift', 'slipping', 'hold']);
    await sleep(900);
    await shot(`1${i}_lift`);
    results.push({ try: i, outcome: s.outcome, held: s.held });
    // 結末まで待つ
    const t0 = Date.now();
    let shotMid = false;
    while (Date.now() - t0 < 30000) {
      const st = await state();
      if (st.phase === 'carry' && !shotMid) { await sleep(900); await shot(`1${i}_carry`); shotMid = true; }
      if (st.phase === 'slipping' && !shotMid) { await sleep(250); await shot(`1${i}_slip`); shotMid = true; }
      if (st.phase === 'release') { await sleep(650); await shot(`1${i}_release`); }
      if (st.phase === 'between' || st.phase === 'result') break;
      await sleep(60);
    }
  }
  const fin = await waitPhase('result', 20000);
  await sleep(1200);
  await shot('20_result');
  console.log('RESULT', JSON.stringify({ got: fin.got, slots: fin.slots, results }));
  if (errors.length) { console.log('CONSOLE/PAGE ERRORS:'); errors.forEach((e) => console.log('  ' + e)); } else console.log('no console errors');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
