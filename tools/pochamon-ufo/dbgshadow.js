// 爪の影の計算値を下降中に数回読む（影が見えない時の切り分け用）
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'pochamon-hoi', 'node_modules', 'playwright'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await page.goto('http://localhost:4876/pochamon-ufo/?nosw=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ufo && window.__ufo.state().phase === 'title', null, { timeout: 60000 });
  await page.evaluate(() => window.__ufo.tap());
  await page.waitForFunction(() => window.__ufo.state().phase === 'moveX', null, { timeout: 10000 });
  await page.evaluate(() => window.__ufo.press('x', true)); await sleep(1500); await page.evaluate(() => window.__ufo.press('x', false));
  await page.waitForFunction(() => window.__ufo.state().phase === 'moveY', null, { timeout: 10000 });
  await page.evaluate(() => window.__ufo.press('y', true)); await sleep(900); await page.evaluate(() => window.__ufo.press('y', false));
  await page.waitForFunction(() => window.__ufo.state().phase === 'descend', null, { timeout: 20000 });
  if (process.argv.includes('--boost')) await page.evaluate(() => { window.__ufo.dbg.shadowBoost = true; });
  await page.screenshot({ path: path.join(__dirname, 'shots', 'dbg_shadow_descend.png') });
  for (let i = 0; i < 6; i++) {
    const r = await page.evaluate(() => ({ s: window.__ufo.dbg.shadow, c: window.__ufo.state().claw, phase: window.__ufo.state().phase }));
    console.log(JSON.stringify(r));
    await sleep(250);
  }
  await page.screenshot({ path: path.join(__dirname, 'shots', 'dbg_shadow.png') });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
