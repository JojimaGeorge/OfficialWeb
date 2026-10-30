// 80〜90年代の筐体の飾りとタイトルの字を、書体ごと画像に焼き出す（iPad には推しゴ・Bahnschrift が無いので、字は絵で持たせる）。
// 参考：宝島社「SEGA UFO CATCHER ほんものそっくりポーチBOOK」の表紙（紺の地に二重線のネオン文字・青い星の列）と付録のポーチ（白い看板・赤と青の細いライン・ふちだけの星）。
// 2026-10-30 本人がタイトル＝T1（表紙風）を選び、筐体の飾りは「実際に絵にしてみて」。
//   node tools/pochamon-ufo/make_retro.js     （表示用サーバー http://localhost:4876 が要る）
// 出力（main/pochamon-ufo/assets/）：
//   retro_sign.webp   上の梁の前面に貼る看板（絵の px そのまま 1800×250）
//   title_logo.webp   タイトルの「UFOキャッチャー」（二重線のネオン）
//   title_sub.webp    タイトルの「ぽちゃもん」＝公式のロゴ（pochamon/assets/img/logo.svg）をピンクに塗り替えたもの
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require(path.join(__dirname, '..', 'pochamon-hoi', 'node_modules', 'playwright'));
const U = 'C:/Users/spitz/AppData/Local/Microsoft/Windows/Fonts/';
const FONTS = { oshigo: U + 'oshigo.otf', bahn: 'C:/Windows/Fonts/bahnschrift.ttf' };
const OUT = path.join(__dirname, '..', '..', 'main', 'pochamon-ufo', 'assets');
const TMP = path.join(__dirname, 'shots', 'retro_bake');
fs.mkdirSync(TMP, { recursive: true });
const SIGN = { w: 1800, h: 250 };
// ぽちゃもんのロゴ（公式サイトと同じ 1色の SVG）。タイトルではピンクに塗り替えて、ひらがなの代わりに置く（2026-10-30 本人「ぽちゃもんはロゴを使って・同じピンクで・ひらがなより大きめに」）
const LOGO_SVG = fs.readFileSync(path.join(__dirname, '..', '..', 'pochamon', 'assets', 'img', 'logo.svg'), 'utf8');   // 梁の前面（背景の絵の y=0〜約248）。下の銀のレールは隠さない

// ページの中で使う部品（字の大きさを測ってから SVG を組む）
const PAGE_LIB = () => {
  const NS = 'http://www.w3.org/2000/svg';
  const STAR = (() => { const p = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.45 : 1, a = -Math.PI / 2 + i * Math.PI / 5; p.push((r * Math.cos(a)).toFixed(3) + ',' + (r * Math.sin(a)).toFixed(3)); } return 'M' + p.join('L') + 'Z'; })();
  window.mkStar = (x, y, r, fill, stroke, sw) => `<path d="${STAR}" transform="translate(${x} ${y}) scale(${r})" fill="${fill}" stroke="${stroke || 'none'}" stroke-width="${(sw || 0) / r}" stroke-linejoin="round"/>`;
  window.measure = (text, font, size, weight) => {
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('style', 'position:absolute;left:-9999px;top:0;visibility:hidden');
    const t = document.createElementNS(NS, 'text'); t.setAttribute('font-family', font); t.setAttribute('font-size', size); if (weight) t.setAttribute('font-weight', weight); t.textContent = text;
    s.appendChild(t); document.body.appendChild(s); const b = t.getBBox(); s.remove(); return b;
  };
  // 字の SVG。style：pouch（ピンク＋紺のふち＋内側の白い線）／red（同じ作りの赤）／neon（二重線のネオン）。ls＝字の間隔（px）
  let uid = 0;
  window.mkLogo = (text, font, size, style, ls) => {
    const id = 'L' + (uid++);
    const lsAttr = ls ? `letter-spacing="${ls}"` : '';
    const s0 = document.createElementNS(NS, 'svg'); s0.setAttribute('style', 'position:absolute;left:-9999px;visibility:hidden');
    const t0 = document.createElementNS(NS, 'text'); t0.setAttribute('font-family', font); t0.setAttribute('font-size', size); if (ls) t0.setAttribute('letter-spacing', ls); t0.textContent = text;
    s0.appendChild(t0); document.body.appendChild(s0); const b = t0.getBBox(); s0.remove();
    const out = size * (style === 'neon' || style === 'glow' ? 0.2 : 0.1);
    const w = b.width - (ls || 0) + out * 2, h = b.height + out * 2, x = out - b.x, y = out - b.y;
    const t = (attrs) => `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" ${lsAttr} ${attrs}>${text}</text>`;
    let body;
    if (style === 'glow') {   // 塗りつぶしのピンクに、ほのかな光（見本 T1 の「ぽちゃもん」）
      body = `<defs><filter id="${id}f" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="${size * 0.09}" result="b"/><feFlood flood-color="#ff5fae" flood-opacity=".75"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g filter="url(#${id}f)">${t('fill="#ff9fcd"')}</g>`;
    } else if (style === 'neon') {
      body = `<defs><filter id="${id}f" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="${size * 0.06}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g filter="url(#${id}f)">${t(`fill="none" stroke="#ff5fae" stroke-width="${size * 0.075}" stroke-linejoin="round"`)}</g>
        ${t(`fill="none" stroke="#ffe0ef" stroke-width="${size * 0.026}" stroke-linejoin="round"`)}`;
    } else {
      const g = style === 'red' ? ['#ff6a6f', '#d8242f'] : ['#ffa3cf', '#ef5299'];
      const edge = style === 'red' ? '#7a1020' : '#1d2a6b';
      body = `<defs><clipPath id="${id}c">${t('')}</clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${g[0]}"/><stop offset="1" stop-color="${g[1]}"/></linearGradient></defs>
        ${t(`fill="${edge}" stroke="${edge}" stroke-width="${size * 0.13}" stroke-linejoin="round"`)}
        ${t(`fill="url(#${id}g)"`)}
        <g clip-path="url(#${id}c)">${t(`fill="none" stroke="#fff" stroke-width="${size * 0.105}" stroke-linejoin="round"`)}${t(`fill="none" stroke="url(#${id}g)" stroke-width="${size * 0.06}" stroke-linejoin="round"`)}</g>`;
    }
    return { html: `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:visible">${body}</svg>`, w, h };
  };
  // ロゴ（1色の SVG）を色 fill に塗り替え、タイトルの「ぽちゃもん」と同じほのかなピンクの光をまとわせる。h＝ロゴの高さ（px）・まわりに光のぶん 12% の余白
  window.mkLogoSvg = (src, h, fill) => {
    const vb = src.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    const inner = src.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<style>[\s\S]*?<\/style>/, '').replace(/class="cls-1"/g, '');
    const k = h / vb[3], m = h * 0.12, w = vb[2] * k;
    const id = 'lg' + (uid++);
    return { html: `<svg width="${w + 2 * m}" height="${h + 2 * m}" viewBox="0 0 ${w + 2 * m} ${h + 2 * m}" style="display:block;overflow:visible">
      <defs><filter id="${id}" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="${h * 0.045}" result="b"/><feFlood flood-color="#ff5fae" flood-opacity=".75"/><feComposite in2="b" operator="in" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <g filter="url(#${id})"><g transform="translate(${m - vb[0] * k} ${m - vb[1] * k}) scale(${k})" fill="${fill}">${inner}</g></g></svg>`, w: w + 2 * m, h: h + 2 * m };
  };
  // ★★★★ POCHAMON ★★★★ の列（glow＝青く光らせる）
  window.mkStarRow = (n, r, color, size, glow) => {
    const tb = measure('POCHAMON', 'Bahn', size, 700), gap = r * 0.9, sw = n * (2 * r + gap), m = glow ? r * 0.8 : 0;
    const w = sw * 2 + tb.width + r * 3 + m * 2, h = Math.max(2 * r, tb.height) + 4 + m * 2;
    let s = '';
    for (let i = 0; i < n; i++) { s += mkStar(m + r + i * (2 * r + gap), h / 2, r, color); s += mkStar(w - m - r - i * (2 * r + gap), h / 2, r, color); }
    const f = glow ? `<defs><filter id="sr" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="${r * 0.25}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` : '';
    return { html: `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:visible">${f}<g ${glow ? 'filter="url(#sr)"' : ''}>${s}
      <text x="${w / 2}" y="${h / 2 - tb.y - tb.height / 2}" text-anchor="middle" font-family="Bahn" font-weight="700" font-style="italic" font-size="${size}" fill="${color}" letter-spacing="${size * 0.06}">POCHAMON</text></g></svg>`, w, h };
  };
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2000, height: 900 }, deviceScaleFactor: 1 });
  await page.route('**/_bake/f/*', (r) => { const k = r.request().url().split('/_bake/f/')[1]; r.fulfill({ path: FONTS[k], headers: { 'Access-Control-Allow-Origin': '*' } }); });
  await page.goto('http://localhost:4876/pochamon-ufo/?nosw=1');
  await page.setContent(`<html><head><style>
    @font-face { font-family: 'Oshigo'; src: url('http://localhost:4876/_bake/f/oshigo'); }
    @font-face { font-family: 'Bahn'; src: url('http://localhost:4876/_bake/f/bahn'); font-weight: 100 900; }
    html, body { margin: 0; background: transparent; }
    .box { position: absolute; left: 0; top: 0; }
    /* 上の看板（ポーチの看板）：白い帯・★ POCHAMON ★・ぽちゃもん＋UFOキャッチャー・左右に赤い3本線・下に赤と青の細いライン */
    #sign { width: ${SIGN.w}px; height: ${SIGN.h}px; box-sizing: border-box; overflow: hidden;
      background: linear-gradient(180deg, #ffffff 0%, #fff8fb 72%, #f3dde7 100%); border-top: 8px solid #f7a3c3; }
    #sign .row1 { position: absolute; left: 0; right: 0; display: flex; justify-content: center; }
    #sign .row2 { position: absolute; left: 0; right: 0; display: flex; align-items: center; justify-content: center; gap: 22px; }
    #sign .lines { flex: 1; height: 34px; display: flex; flex-direction: column; justify-content: space-between; }
    #sign .lines i { display: block; height: 5px; background: #e2333f; border-radius: 3px; }
    #sign .pin { position: absolute; left: 0; right: 0; }
    #sign .pin i { display: block; height: 6px; margin-bottom: 6px; }
  </style></head><body><div id="sign" class="box"></div><div id="t" class="box"></div></body></html>`);
  await page.evaluate(PAGE_LIB);
  await page.evaluate((svg) => { window.__logoSvg = svg; }, LOGO_SVG);
  await page.evaluate(() => Promise.all([document.fonts.load('40px Oshigo'), document.fonts.load('700 20px Bahn')]));
  const ok = await page.evaluate(() => document.fonts.check('40px Oshigo') && document.fonts.check('700 20px Bahn'));
  if (!ok) throw new Error('書体が読めていない');

  // 1) 看板
  await page.evaluate(({ W, H }) => {
    const sign = document.getElementById('sign');
    const row1 = `<div class="row1" style="top:${H * 0.08}px">${mkStarRow(4, H * 0.062, '#1d2a6b', H * 0.135, false).html}</div>`;
    const pochi = mkLogo('ぽちゃもん', 'Oshigo', H * 0.19, 'red'), logo = mkLogo('UFOキャッチャー', 'Oshigo', H * 0.42, 'pouch');
    const lines = '<div class="lines"><i></i><i></i><i></i></div>';
    const row2 = `<div class="row2" style="top:${H * 0.28}px;height:${H * 0.54}px;padding:0 ${W * 0.03}px">${lines}<div style="align-self:flex-start;margin-top:${H * 0.05}px">${pochi.html}</div>${logo.html}${lines}</div>`;
    const pin = `<div class="pin" style="top:${H * 0.86}px"><i style="background:#e2333f"></i><i style="background:#2b4fb5"></i></div>`;
    sign.innerHTML = row1 + row2 + pin;
  }, { W: SIGN.w, H: SIGN.h });
  await page.waitForTimeout(200);
  const shots = {};
  shots.retro_sign = path.join(TMP, 'retro_sign.png');
  await page.locator('#sign').screenshot({ path: shots.retro_sign, omitBackground: true });
  await page.evaluate(() => { document.getElementById('sign').style.display = 'none'; });

  // 2) タイトルの字（札に出す大きさの約2倍で描く）
  const parts = {
    title_logo: () => mkLogo('UFOキャッチャー', 'Oshigo', 150, 'neon'),
    title_sub: () => mkLogoSvg(window.__logoSvg, 200, '#ff9fcd'),
  };
  for (const [name, fn] of Object.entries(parts)) {
    await page.evaluate((src) => { const r = (0, eval)('(' + src + ')')(); document.getElementById('t').innerHTML = r.html; }, fn.toString());
    await page.waitForTimeout(150);
    shots[name] = path.join(TMP, name + '.png');
    await page.locator('#t > svg').screenshot({ path: shots[name], omitBackground: true });
  }
  await browser.close();
  // webp に（看板は写真寄りの圧縮・字は縁がにじまないよう可逆）
  const py = `
import sys
from PIL import Image
for src, dst, lossless in [${Object.entries(shots).map(([n, p]) => `(r'${p}', r'${path.join(OUT, n + '.webp')}', ${n === 'retro_sign' ? 'False' : 'True'})`).join(',')}]:
    im = Image.open(src).convert('RGBA')
    im.save(dst, 'WEBP', lossless=lossless, quality=92, method=6)
    print(dst.split('\\\\')[-1], im.size)
`;
  console.log(execFileSync('py', ['-X', 'utf8', '-c', py]).toString());
})().catch((e) => { console.error(e); process.exit(1); });
