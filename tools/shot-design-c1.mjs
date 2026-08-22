// design_c1.html の描画確認：main/ をローカル配信し、headless Chromium で
// PC(1280x800) と iPhone15(393x852) のスクショを撮る。console エラーも拾う。
// 使い方: node tools/shot-design-c1.mjs   （出力: tools/shots-design-c1/*.png）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const PW_DIR = process.env.PW_DIR || 'C:/Users/spitz/AppData/Roaming/npm/node_modules/dev-browser/node_modules';
const require = createRequire(path.join(PW_DIR, 'x.js'));
const { chromium } = require('playwright');

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(repo, 'main');
const outDir = path.join(repo, 'tools', 'shots-design-c1');
fs.mkdirSync(outDir, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.mp4': 'video/mp4', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  let p = path.join(root, u === '/' ? 'index.html' : u);
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const report = [];

async function run(name, viewport, hasTouch) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: !!hasTouch, isMobile: !!hasTouch });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] console.error: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${name}] pageerror: ${e.message}`));
  page.on('requestfailed', r => errors.push(`[${name}] requestfailed: ${r.url()}`));
  await page.goto(base, { waitUntil: 'load' });
  await sleep(3500); // オープニング終了待ち

  // 1) ヒーロー：スライド自動送りが動くか（realIndex が時間で進む）
  const i0 = await page.evaluate(() => window.heroSwiper.realIndex);
  await sleep(5600);
  const i1 = await page.evaluate(() => window.heroSwiper.realIndex);
  report.push(`[${name}] hero autoplay: ${i0} -> ${i1} ${i1 !== i0 ? 'OK' : 'NG'}`);

  // 2) animating が立ちっぱなしでも進むか（「途中で止まる」の再現→復帰）
  await page.evaluate(() => { window.heroSwiper.animating = true; });
  const i2 = await page.evaluate(() => window.heroSwiper.realIndex);
  await sleep(5600);
  const i3 = await page.evaluate(() => window.heroSwiper.realIndex);
  report.push(`[${name}] hero stuck-recovery: ${i2} -> ${i3} ${i3 !== i2 ? 'OK' : 'NG'}`);

  // 3) ぽちゃもんスライドを表示して撮る
  await page.evaluate(() => {
    const slides = Array.from(document.querySelectorAll('.hero-swiper .swiper-slide:not(.swiper-slide-duplicate)'));
    const idx = slides.findIndex(s => s.querySelector('.slide-pochamon'));
    window.heroSwiper.slideToLoop(idx, 0);
  });
  await sleep(1200);
  await page.screenshot({ path: path.join(outDir, `${name}-hero-pochamon.png`) });

  // 4) 各セクション（キラキラをホバー/タップで出してから撮る）
  for (const id of ['works', 'profile', 'news', 'contact']) {
    const okEl = await page.evaluate((id) => { const el = document.getElementById(id); if (!el) return location.href + ' / ' + document.title; el.scrollIntoView({ behavior: 'instant', block: 'start' }); return true; }, id);
    if (okEl !== true) { report.push(`[${name}] section ${id} missing -> page is now: ${okEl}`); break; }
    await sleep(1800); // reveal 待ち
    const cx = Math.round(viewport.width * 0.5), cy = hasTouch ? 90 : 150; // 見出し付近＝リンクを踏んで遷移しない位置
    if (hasTouch) {
      await page.touchscreen.tap(cx, cy);
    } else {
      await page.mouse.move(cx - 40, cy - 30);
      await page.mouse.move(cx, cy, { steps: 8 });
    }
    await sleep(120);
    await page.screenshot({ path: path.join(outDir, `${name}-${id}.png`) });
  }

  // 5) Works 05 と年表を個別に
  await page.evaluate(() => { document.querySelector('.app-grid').scrollIntoView({ behavior: 'instant', block: 'center' }); });
  await sleep(1800);
  await page.screenshot({ path: path.join(outDir, `${name}-work05.png`) });
  await page.evaluate(() => { document.querySelector('.profile-timeline').scrollIntoView({ behavior: 'instant', block: 'start' }); });
  await sleep(2500);
  await page.screenshot({ path: path.join(outDir, `${name}-timeline.png`) });

  // 6) 全体
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);
  await page.screenshot({ path: path.join(outDir, `${name}-full.png`), fullPage: true });
  await ctx.close();
}

try { await run('pc', { width: 1280, height: 800 }, false); } catch (e) { report.push('[pc] crashed: ' + e.message); }
try { await run('sp', { width: 393, height: 852 }, true); } catch (e) { report.push('[sp] crashed: ' + e.message); }

await browser.close();
server.close();
console.log(report.join('\n'));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
