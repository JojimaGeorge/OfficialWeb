// 「もう一回チャレンジ」後にボタンが反応しなくなるバグの再現テスト
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL = 'http://127.0.0.1:8130/pochamon-hoi/index.html';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL, { waitUntil: 'load' });
  await sleep(4000);

  const btnState = async () => page.evaluate(() => {
    const p = document.getElementById('btn-pyon');
    const r = p.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
    return {
      disabled: p.disabled,
      cls: p.className,
      activeScreens: [...document.querySelectorAll('.screen--active')].map(e => e.id),
      wiping: [...document.querySelectorAll('.screen--wiping')].map(e => e.id),
      topElAtBtn: top ? (top.id || top.className) : null,
    };
  });

  // ボタンが押せるようになるまで待つ
  const waitEnabled = async (timeout = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const s = await btnState();
      if (!s.disabled) return { ok: true, ms: Date.now() - t0, s };
      await sleep(100);
    }
    return { ok: false, ms: Date.now() - t0, s: await btnState() };
  };

  const playGame = async (label) => {
    for (let r = 1; r <= 5; r++) {
      const w = await waitEnabled();
      if (!w.ok) {
        console.log(`!! ${label} ROUND${r}: ボタンが有効にならへん (${w.ms}ms待ち)`, JSON.stringify(w.s));
        return false;
      }
      await page.click('#btn-pyon', { force: true });
      await sleep(2600);
    }
    return true;
  };

  console.log('--- 1回目 ---');
  await page.click('#btn-start', { force: true });
  await sleep(1200);
  if (!await playGame('1回目')) { await dump(); return; }

  await sleep(5000); // 結果画面の演出待ち
  console.log('結果画面:', JSON.stringify(await btnState()));

  for (let loop = 2; loop <= 4; loop++) {
    console.log(`--- ${loop}回目（もう一回チャレンジ） ---`);
    await page.click('#btn-retry-result', { force: true });
    await sleep(1200);
    console.log('リプレイ直後:', JSON.stringify(await btnState()));
    const ok = await playGame(`${loop}回目`);
    if (!ok) { await dump(); return; }
    await sleep(5000);
  }

  console.log('=> 再現せず（4回連続で完走）');
  await dump();

  async function dump() {
    await page.screenshot({ path: require('path').join(__dirname, 'repro-last.png') });
    console.log('errors:', errors.length ? errors : 'none');
    await browser.close();
  }
})();
