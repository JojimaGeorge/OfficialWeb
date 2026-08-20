// ぽちゃもんホイ 演出の通し確認（Playwright・2026-08-21）
// 手順:
//   1) cd main/pochamon-hoi && py -m http.server 8765 --bind 127.0.0.1   （別窓で起動したまま）
//   2) cd tools/pochamon-hoi && npm i playwright && npx playwright install chromium webkit
//   3) node shoot.js [chromium|webkit] [ipad|iphone]   → shots/<engine>-<device>/ に連番PNG
// タイトル→5ラウンド→結果→（管理画面から）パーフェクト／3勝／5連敗 を自動で回し、
// 最後に console/page のエラー一覧を出す（none なら合格）。
// ボタンは鼓動アニメ中で「不安定」扱いになるため force クリックにしている。
const { chromium, webkit } = require('playwright');
const path = require('path');
const fs = require('fs');

const engineName = process.argv[2] || 'chromium';
const device = process.argv[3] || 'ipad';
const OUT = path.join(__dirname, 'shots', engineName + '-' + device);
fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://127.0.0.1:8765/index.html';
const VIEW = device === 'iphone' ? { width: 393, height: 852 } : { width: 820, height: 1180 };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const engine = engineName === 'webkit' ? webkit : chromium;
  const browser = await engine.launch();
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2, isMobile: engineName === 'chromium', hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  let n = 0;
  const shot = async (name) => {
    n++;
    const f = path.join(OUT, String(n).padStart(2, '0') + '-' + name + '.png');
    await page.screenshot({ path: f });
    console.log('shot', path.basename(f));
  };
  const telopText = () => page.$eval('#telop', el => (el.classList.contains('telop--visible') ? el.textContent.trim() : ''));

  await page.goto(URL);
  await sleep(1800);
  await shot('title');

  await page.click('#btn-start', { force: true });
  await sleep(300);
  await shot('wipe-mid');
  await sleep(900);
  await shot('acchi-wait');

  // 5ラウンド回す
  for (let r = 0; r < 5; r++) {
    await page.waitForSelector('#btn-pyon:not([disabled])', { timeout: 8000 });
    await sleep(r === 4 ? 100 : 200);
    if (r === 4) await shot('round5-wait');
    await page.click(r % 2 ? '#btn-biron' : '#btn-pyon', { force: true });
    await sleep(120);
    if (r === 0) await shot('hoi-flash');
    // 判定テロップが出るまで待つ
    const t0 = Date.now();
    let t = '';
    while (Date.now() - t0 < 4000) {
      t = await telopText();
      if (/やった|ちーん|れんしょう|がんばれ/.test(t)) break;
      await sleep(30);
    }
    await sleep(260);
    await shot('judge-r' + (r + 1) + '-' + (/やった|れんしょう/.test(t) ? 'win' : 'lose'));
    if (r === 3) {
      // ラストチャンス演出を撮る
      await sleep(900);
      await shot('lastchance');
    }
  }

  // 結果画面
  await page.waitForSelector('#screen-result.screen--active', { timeout: 8000 });
  await sleep(400);
  await shot('result-wipe');
  await sleep(900);
  await shot('result-flip-mid');
  await sleep(1600);
  await shot('result-done');
  const items = await page.$$('.sticker-selector__item');
  if (items.length) {
    await items[1].click({ force: true });
    await sleep(250);
    await shot('result-select-fly');
    await sleep(500);
    await shot('result-selected');
  }

  // 管理画面のデバッグから パーフェクト／5連敗
  await page.goto(URL + '#admin');
  await sleep(800);
  await page.click('#btn-debug-perfect', { force: true });
  await sleep(1300);
  await shot('perfect-mid');
  await sleep(1700);
  await shot('perfect-done');

  // 3勝：候補→確定枠へ飛ぶ
  await page.goto(URL + '#admin');
  await sleep(800);
  await page.click('#btn-debug-3win', { force: true });
  await sleep(2900);
  const items3 = await page.$$('.sticker-selector__item');
  await items3[2].click({ force: true });
  await sleep(220);
  await shot('3win-select-fly');
  await sleep(600);
  await shot('3win-selected');

  await page.goto(URL + '#admin');
  await sleep(800);
  await page.click('#btn-debug-lose-all', { force: true });
  await sleep(2900);
  const items2 = await page.$$('.sticker-selector__item');
  await items2[0].click({ force: true });
  await sleep(700);
  await items2[3].click({ force: true });
  await sleep(700);
  await shot('loseall-2picked');

  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('FAILED', e); process.exit(1); });
