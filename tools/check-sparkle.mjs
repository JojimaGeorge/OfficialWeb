// 市松キラキラ（#spark-canvas）が PC のマウス移動／SP のタップで実際に描かれるかを数える。
// 使い方: node tools/check-sparkle.mjs          … main/ をローカル配信して確認
//         node tools/check-sparkle.mjs live     … 本番 https://www.jojima-george.com/ を確認
// 出力: ページのエラー一覧と、canvas 上で色が付いた画素の数（0 なら出ていない）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const PW_DIR = process.env.PW_DIR || 'C:/Users/spitz/AppData/Roaming/npm/node_modules/dev-browser/node_modules';
const require = createRequire(path.join(PW_DIR, 'x.js'));
const { chromium, devices } = require('playwright');

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(repo, 'main');
const live = process.argv[2] === 'live';

let server, base;
if (live) {
  base = 'https://www.jojima-george.com/';
} else {
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.mp4': 'video/mp4', '.css': 'text/css' };
  server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const p = path.join(root, u === '/' ? 'index.html' : u);
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/index.html`;
}

const countLit = () => {
  const c = document.getElementById('spark-canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
};

const browser = await chromium.launch({ headless: true });
const cases = [
  { name: 'PC', ctx: { viewport: { width: 1280, height: 800 } } },
  { name: 'SP', ctx: { ...devices['iPhone 13'] } },
];
for (const c of cases) {
  const context = await browser.newContext(c.ctx);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(() => document.getElementById('works').scrollIntoView());
  await page.waitForTimeout(800);
  const vp = page.viewportSize();
  const x = vp.width / 2, y = vp.height / 2;
  if (c.name === 'PC') {
    for (let i = 0; i < 10; i++) { await page.mouse.move(x + i * 8, y); await page.waitForTimeout(16); }
  } else {
    await page.touchscreen.tap(x, y);
  }
  await page.waitForTimeout(120);
  const lit = await page.evaluate(countLit);
  console.log(`${live ? 'live' : 'local'} ${c.name}: 色の付いた画素=${lit} / エラー=${errors.length ? errors.join(' | ') : 'なし'}`);
  await context.close();
}
await browser.close();
server?.close();
