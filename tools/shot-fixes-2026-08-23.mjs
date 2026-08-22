// 2026-08-23 修正分の検品：SPニュースタグ / SPアプリカード / PC FVキャプション / 年表 / Work05
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
const outDir = path.join(repo, 'tools', 'shots-fixes-0823');
fs.mkdirSync(outDir, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.mp4': 'video/mp4', '.css': 'text/css' };
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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const errors = [], report = [];

async function shotEl(page, sel, file) {
  const el = await page.$(sel);
  if (!el) { report.push(`MISS ${sel}`); return; }
  await el.scrollIntoViewIfNeeded();
  await sleep(1400);
  await el.screenshot({ path: path.join(outDir, file) });
}

// ---- SP (iPhone15) ----
{
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`[sp] ${e.message}`));
  await page.goto(base, { waitUntil: 'load' });
  await sleep(3800);
  await shotEl(page, '.app-grid-wrap', 'sp-appcards.png');
  await shotEl(page, '.news-list', 'sp-newslist.png');
  await shotEl(page, '.profile-timeline', 'sp-timeline.png');
  await shotEl(page, '.work-item.reversed', 'sp-work04.png');
  { const gp = await ctx.newPage(); await gp.goto(base.replace('/index.html','/ginpika2nd/index.htm'), { waitUntil: 'load' }); await sleep(2500);
    await gp.screenshot({ path: path.join(outDir, 'sp-ginpika.png') });
    report.push('[sp] ginpika title = ' + await gp.title()); await gp.close(); }
  // タグ枠のはみ出し実測
  const m = await page.evaluate(() => {
    const a = document.querySelector('.news-list a');
    const tag = a.querySelector('.news-tag');
    const col = getComputedStyle(a).gridTemplateColumns;
    return { cols: col, tagW: tag.getBoundingClientRect().width, scrollW: tag.scrollWidth, clientW: tag.clientWidth };
  });
  report.push(`[sp] news-tag cols=${m.cols} tagW=${m.tagW.toFixed(1)} scrollW=${m.scrollW} clientW=${m.clientW} ${m.scrollW <= m.clientW ? 'FIT' : 'OVERFLOW'}`);
  const tap = await page.evaluate(() => getComputedStyle(document.querySelector('.app-card')).webkitTapHighlightColor);
  report.push(`[sp] app-card tap-highlight = ${tap}`);
  await ctx.close();
}

// ---- PC ----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`[pc] ${e.message}`));
  await page.goto(base, { waitUntil: 'load' });
  await sleep(3800);
  const caps = [];
  for (let i = 0; i < 5; i++) {
    await page.evaluate((n) => window.heroSwiper.slideToLoop(n, 0), i);
    await sleep(900);
    caps.push(await page.evaluate(() => {
      const inner = document.querySelector('.hero-swiper .swiper-slide-active .swiper-slide-inner');
      const bg = inner ? inner.style.backgroundImage : '';
      return `${document.getElementById('slide-tag').textContent} | ${document.getElementById('slide-title-text').textContent} | ${document.getElementById('slide-caption-text').textContent} || ${bg}`;
    }));
    await page.screenshot({ path: path.join(outDir, `pc-hero-${i}.png`) });
  }
  caps.forEach((c, i) => report.push(`[pc] slide${i}: ${c}`));
  await shotEl(page, '.profile-timeline', 'pc-timeline.png');
  await shotEl(page, '.work-item.reversed', 'pc-work04.png');
  { const gp = await ctx.newPage(); await gp.goto(base.replace('/index.html','/ginpika2nd/index.htm'), { waitUntil: 'load' }); await sleep(2500);
    await gp.screenshot({ path: path.join(outDir, 'pc-ginpika.png'), fullPage: false });
    report.push('[pc] ginpika title = ' + await gp.title()); await gp.close(); }
  const w5 = (await page.$$('.work-item')).at(-1);
  await w5.scrollIntoViewIfNeeded(); await sleep(1400);
  await w5.screenshot({ path: path.join(outDir, 'pc-work05.png') });
  await ctx.close();
}

await browser.close(); server.close();
console.log(report.join('\n'));
console.log(errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nno page errors');
