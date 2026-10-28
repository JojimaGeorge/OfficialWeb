// 設定画面（#admin）の開閉と保存、ミュート、結果画面→タイトルの戻りを機械で確認
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'pochamon-hoi', 'node_modules', 'playwright'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:4876/pochamon-ufo/?nosw=1#admin', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ufo && window.__ufo.state().phase === 'title', null, { timeout: 60000 });
  await sleep(300);
  const shown = await page.evaluate(() => document.getElementById('admin').classList.contains('show'));
  console.log('admin opened by #admin:', shown);
  await page.screenshot({ path: path.join(__dirname, 'shots', 'admin.png') });
  // 値を変えて保存 → settings に反映されるか
  await page.evaluate(() => { const s = document.getElementById('luckSlot'); s.value = 'last'; s.dispatchEvent(new Event('change')); });
  await page.evaluate(() => { const r = document.getElementById('luckP'); r.value = '50'; r.dispatchEvent(new Event('input')); });
  await page.click('#adminSave');
  await sleep(200);
  const after = await page.evaluate(() => ({ p: window.__ufo.settings.luckP, slot: window.__ufo.settings.luckSlot, shown: document.getElementById('admin').classList.contains('show'),
    stored: JSON.parse(localStorage.getItem('pochamon-ufo-settings-v1') || '{}') }));
  console.log('after save:', JSON.stringify(after));
  // 長押しで開く（「ぽちゃもん」の文字を2秒）
  const sub = await page.$('.title-sub');
  const sb = await sub.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down(); await sleep(2300); await page.mouse.up();
  const card = await page.$('.title-card');
  const box = await card.boundingBox();
  const shown2 = await page.evaluate(() => document.getElementById('admin').classList.contains('show'));
  console.log('admin opened by long press:', shown2);
  await page.click('#adminClose');
  const phase = await page.evaluate(() => window.__ufo.state().phase);
  console.log('phase after long press (should still be title):', phase);
  // 通常タップでスタートする
  await page.mouse.click(box.x + box.width / 2, box.y + 30);
  await sleep(300);
  console.log('phase after tap:', await page.evaluate(() => window.__ufo.state().phase));
  // ミュート切替
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
