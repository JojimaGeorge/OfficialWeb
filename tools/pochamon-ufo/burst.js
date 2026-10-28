// 揺れの確認：よこボタンを離した直後からアームまわりを連続でコマ撮りし、1枚の表（contact sheet）にする。
//   node tools/pochamon-ufo/burst.js [--frames=16] [--interval=70] [--phase=moveX|lift]
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', 'pochamon-hoi', 'node_modules', 'playwright'));
const { execFileSync } = require('child_process');

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
const frames = parseInt(args.frames || '16', 10);
const interval = parseInt(args.interval || '70', 10);
const mode = args.phase || 'moveX';
const outDir = path.join(__dirname, 'shots', 'burst-' + mode);
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4876/pochamon-ufo/?nosw=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ufo && window.__ufo.state().phase === 'title', null, { timeout: 60000 });
  if (mode !== 'moveX') await page.evaluate(() => window.__ufo.force(['lose', 'lose', 'lose']));
  await page.evaluate(() => window.__ufo.tap());
  await page.waitForFunction(() => window.__ufo.state().phase === 'moveX', null, { timeout: 10000 });
  await sleep(200);
  await page.evaluate(() => window.__ufo.press('x', true));
  await sleep(1400);
  const clipFor = async () => {
    // アームの画面位置（CSS px）を計算：canvas と同じ変換を JS 側で再現する代わりに、状態から大まかに切る
    return { x: 0, y: 0, width: 1180, height: 820 };
  };
  const shots = [];
  if (mode === 'moveX') {
    await page.evaluate(() => window.__ufo.press('x', false));
    for (let i = 0; i < frames; i++) {
      const s = await page.evaluate(() => window.__ufo.state());
      const p = path.join(outDir, `f${String(i).padStart(2, '0')}.png`);
      await page.screenshot({ path: p });
      shots.push({ p, thx: s.claw.thx });
      await sleep(interval);
    }
  } else {
    await page.evaluate(() => window.__ufo.press('x', false));
    await page.waitForFunction(() => window.__ufo.state().phase === 'moveY', null, { timeout: 10000 });
    await page.evaluate(() => window.__ufo.press('y', true));
    await sleep(900);
    await page.evaluate(() => window.__ufo.press('y', false));
    await page.waitForFunction(() => window.__ufo.state().phase === 'lift', null, { timeout: 20000 });
    for (let i = 0; i < frames; i++) {
      const s = await page.evaluate(() => window.__ufo.state());
      const p = path.join(outDir, `f${String(i).padStart(2, '0')}.png`);
      await page.screenshot({ path: p });
      shots.push({ p, thx: s.claw.thx, phase: s.phase });
      await sleep(interval);
    }
  }
  console.log('thx per frame (deg):', shots.map((s) => (s.thx * 180 / Math.PI).toFixed(1)).join(' '));
  await browser.close();
  // 表にする（PIL）
  const py = `
import sys, glob, os
from PIL import Image
d = sys.argv[1]; files = sorted(glob.glob(os.path.join(d, 'f*.png')))
ims = [Image.open(f) for f in files]
# アームの近く（左上〜中央）を切り出す
crop = (int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]))
tiles = [im.crop(crop) for im in ims]
w, h = tiles[0].size; cols = 8; rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, h * rows), (30, 30, 40))
for i, t in enumerate(tiles): sheet.paste(t, ((i % cols) * w, (i // cols) * h))
sheet.save(os.path.join(d, 'sheet.png')); print('sheet', sheet.size)
`;
  const crop = mode === 'moveX' ? ['300', '60', '760', '420'] : ['300', '120', '900', '620'];
  fs.writeFileSync(path.join(outDir, 'sheet.py'), py);
  console.log(execFileSync('py', ['-I', path.join(outDir, 'sheet.py'), outDir, ...crop]).toString());
})().catch((e) => { console.error(e); process.exit(1); });
