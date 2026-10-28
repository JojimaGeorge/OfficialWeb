// 任意のサイズでタイトル画面のスクショを1枚撮る（縦向きの案内・PC幅の確認用）。
//   node tools/pochamon-ufo/shot.js --w=393 --h=852 --out=portrait.png [--browser=webkit] [--query=layout=B]
const path = require('path');
const fs = require('fs');
const { chromium, webkit } = require(path.join(__dirname, '..', 'pochamon-hoi', 'node_modules', 'playwright'));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
(async () => {
  const bt = args.browser === 'webkit' ? webkit : chromium;
  const browser = await bt.launch();
  const page = await browser.newPage({ viewport: { width: parseInt(args.w || '1280', 10), height: parseInt(args.h || '800', 10) }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:4876/pochamon-ufo/?nosw=1' + (args.query ? '&' + args.query : ''), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ufo && window.__ufo.state().phase === 'title', null, { timeout: 60000 });
  if (args.play) { await page.evaluate(() => window.__ufo.tap()); await page.waitForFunction(() => window.__ufo.state().phase === 'moveX', null, { timeout: 10000 }); await new Promise((r) => setTimeout(r, 400)); }
  const out = path.join(__dirname, 'shots', args.out || 'shot.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out });
  console.log('saved', out);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
