// 決定的再現: 各結果パターン(5連敗/1勝/3勝/パーフェクト)で結果画面→もう一回チャレンジ→
// プレイ画面の ぴょーん/びろーん が本当に押せるかを判定する
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL = 'http://127.0.0.1:8130/pochamon-hoi/index.html#admin';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await sleep(3000);

  const probe = async () => page.evaluate(() => {
    const out = {};
    for (const id of ['btn-pyon', 'btn-biron']) {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      const pts = [[r.left + r.width/2, r.top + r.height/2], [r.left + r.width*0.25, r.top + r.height*0.5], [r.left + r.width*0.75, r.top + r.height*0.5]];
      const blockers = pts.map(([x,y]) => {
        const t = document.elementFromPoint(x, y);
        if (!t) return 'null';
        return el.contains(t) ? 'OK' : (t.id || t.className || t.tagName);
      });
      out[id] = { disabled: el.disabled, blockers };
    }
    out.activeScreens = [...document.querySelectorAll('.screen--active')].map(e => e.id);
    out.selectorIn = document.getElementById('sticker-selector').classList.contains('sticker-selector--in');
    out.actionsIn = document.querySelector('.result-screen__actions').classList.contains('result-screen__actions--in');
    return out;
  });

  const cases = [
    ['btn-debug-lose-all', '0勝5敗'],
    ['btn-debug-1win', '1勝4敗'],
    ['btn-debug-3win', '3勝2敗'],
    ['btn-debug-perfect', '5勝0敗'],
  ];

  for (const [btnId, label] of cases) {
    await page.evaluate(() => { location.hash = ''; location.hash = '#admin'; });
    await sleep(500);
    await page.click('#' + btnId, { force: true });
    await sleep(4500); // 結果演出の完了待ち
    await page.click('#btn-retry-result', { force: true });
    await sleep(1800); // ワイプ600ms + startRound 400ms + acchi 300+300ms
    const p = await probe();
    const blocked = [...p['btn-pyon'].blockers, ...p['btn-biron'].blockers].filter(b => b !== 'OK');
    // 実際に押して次ラウンドへ進むかまで確認
    let played = 0;
    for (let r = 0; r < 5; r++) {
      const t0 = Date.now();
      let ready = false;
      while (Date.now() - t0 < 8000) {
        if (!(await page.evaluate(() => document.getElementById('btn-pyon').disabled))) { ready = true; break; }
        await sleep(100);
      }
      if (!ready) break;
      await page.click('#btn-pyon', { force: true });
      await sleep(2600);
      played++;
    }
    console.log(`[${label}] 当たり判定=${blocked.length ? '❌塞がれてる ' + JSON.stringify(blocked) : '✅クリア'} / リプレイ後に消化できたラウンド=${played}/5`);
  }
  await browser.close();
})();
