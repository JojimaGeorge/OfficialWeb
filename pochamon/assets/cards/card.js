// カード1枚を組み立てる：層（レイヤー）・枠・裏面・ステンシルマスク・粒子
import * as THREE from 'three';
import { foilVertex, foilFragment, sparkVertex, sparkFragment } from './shaders.js';
import { makeRainMaterial, makePuddleMaterial, makeRaincloudCanvas, makeVeilCanvas } from './rain.js';

export const CARD_W = 2.5;
export const CARD_H = 3.5;
const TEX_W = 1024, TEX_H = 1434;      // 2.5:3.5 と同じ比率
const PX = CARD_W / TEX_W;             // テクスチャ1pxが何ユニットか
const FONT = '"Noto Sans JP","Hiragino Sans","Yu Gothic UI","Meiryo",sans-serif';

// 絵の見える範囲（px）。window=中央の窓、fullart=カード全面
const WIN  = { x: 66, y: 150, w: 892, h: 860, r: 18 };
const FULL = { x: 0, y: 0, w: TEX_W, h: TEX_H, r: 52 };

function rectToUnits(r) {
  return { w: r.w * PX, h: r.h * PX, cx: (r.x + r.w / 2) * PX - CARD_W / 2, cy: CARD_H / 2 - (r.y + r.h / 2) * PX, r: r.r * PX };
}
export const winU = rectToUnits(WIN);   // 窓の中心・サイズ（ユニット）

// ---- カード定義 -------------------------------------------------------------
// 「浮き輪ぎゅうぎゅう」：BG.png は 1080x1920。カード比率(0.714)に合わせて縦を 0.112〜0.8995 で切り出す。
// 切り出し後の座標 → カード座標: y = 1.75 - ((r - 0.112) / 0.7875) * 3.5

// ---- キャンバス描画ヘルパー ---------------------------------------------------
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function wrapText(ctx, text, maxW) {
  const lines = []; let cur = '';
  for (const ch of text) { const t = cur + ch; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = ch; } else cur = t; }
  if (cur) lines.push(cur);
  return lines;
}
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function goldGradient(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#fff1b8'); g.addColorStop(0.35, '#d9a93a'); g.addColorStop(0.6, '#fff6d0'); g.addColorStop(1, '#b8842a');
  return g;
}
function texFromCanvas(c, renderer) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
function loadImage(src) {
  // decode() で画像の展開を先に非同期で済ませる（drawImage の瞬間に同期デコードが走って画面が止まるのを防ぐ）
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => { if (im.decode) im.decode().then(() => res(im), () => res(im)); else res(im); };
    im.onerror = rej; im.src = src;
  });
}

// 画像 → 切り出し(crop) → 縁を引き伸ばして余白を作る(extend) → 上端フェード(fade) → キャンバス
async function makeImageCanvas({ src, crop = { x: 0, y: 0, w: 1, h: 1 }, extend = 0, fade }) {
  const img = await loadImage(src);
  const sx = img.width * crop.x, sy = img.height * crop.y, sw = img.width * crop.w, sh = img.height * crop.h;
  const maxDim = 2048;
  let cw = sw, ch = sh;
  const total = Math.max(cw * (1 + 2 * extend), ch * (1 + 2 * extend));
  const k = total > maxDim ? maxDim / total : 1;
  cw = Math.round(cw * k); ch = Math.round(ch * k);
  const ox = Math.round(cw * extend), oy = Math.round(ch * extend);
  const c = makeCanvas(cw + ox * 2, ch + oy * 2);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, ox, oy, cw, ch);
  if (extend > 0) {
    // 上下左右の端1pxを余白に引き伸ばす（色帯の背景なら継ぎ目が出ない）
    ctx.drawImage(img, sx, sy, 1, sh, 0, oy, ox, ch);                       // 左
    ctx.drawImage(img, sx + sw - 1, sy, 1, sh, ox + cw, oy, ox, ch);        // 右
    ctx.drawImage(img, sx, sy, sw, 1, ox, 0, cw, oy);                       // 上
    ctx.drawImage(img, sx, sy + sh - 1, sw, 1, ox, oy + ch, cw, oy);        // 下
    ctx.drawImage(img, sx, sy, 1, 1, 0, 0, ox, oy);
    ctx.drawImage(img, sx + sw - 1, sy, 1, 1, ox + cw, 0, ox, oy);
    ctx.drawImage(img, sx, sy + sh - 1, 1, 1, 0, oy + ch, ox, oy);
    ctx.drawImage(img, sx + sw - 1, sy + sh - 1, 1, 1, ox + cw, oy + ch, ox, oy);
  }
  if (fade && fade.top) {
    ctx.globalCompositeOperation = 'destination-in';
    const g = ctx.createLinearGradient(0, oy, 0, oy + ch * fade.top);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'source-over';
  }
  return c;
}

// 水しぶき：浮き輪の左右から弧を描いて飛ぶ飛沫。
// 1px = 2.6/1024 ユニットの縮尺で、飛沫がキャンバスの端で切れないよう幅は余裕を持たせる（W=1500 → 3.81ユニット）
function makeSplashCanvas() {
  const W = 1500, H = 700, c = makeCanvas(W, H), ctx = c.getContext('2d');
  const rnd = seeded(20260820);
  ctx.lineCap = 'round';
  ctx.filter = 'blur(2.5px)';     // 一番手前の層なのでピントを少し外す
  // 飛沫の粒（左右2方向に弧を描く）
  const drop = (x, y, r, ang, stretch, alpha) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath(); ctx.ellipse(0, 0, r * stretch, r, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')'; ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.35); ctx.strokeStyle = 'rgba(110,180,255,' + (alpha * 0.9) + ')'; ctx.stroke();
    ctx.restore();
  };
  for (const s of [-1, 1]) {
    const ox = W / 2 + s * 330, oy = 330;
    for (let i = 0; i < 34; i++) {
      const t = i / 33;
      const ang = (-0.15 + t * 1.55);                        // -9°〜80°の扇
      const rad = 90 + rnd() * 300;
      const x = ox + Math.cos(ang) * rad * s, y = oy - Math.sin(Math.max(0, ang)) * rad * 0.95 + rnd() * 40;
      const r = 5 + rnd() * 17 * (1 - rad / 520);
      drop(x, y, r, -Math.atan2(oy - y, x - ox), 1.3 + rnd() * 0.8, 0.75 + rnd() * 0.25);
    }
    // 浮き輪の縁に当たった大きめの飛沫
    for (let i = 0; i < 5; i++) {
      const x = ox + s * (40 + rnd() * 80), y = 300 + rnd() * 120;
      drop(x, y, 16 + rnd() * 14, rnd() * 0.8, 1.1, 0.9);
    }
  }
  // 細かい霧
  for (let i = 0; i < 180; i++) {
    const x = W / 2 - 560 + rnd() * 1120, y = 60 + rnd() * 420;
    ctx.beginPath(); ctx.arc(x, y, 1 + rnd() * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + rnd() * 0.45) + ')'; ctx.fill();
  }
  ctx.filter = 'none';
  return c;
}

// 足元の波紋（本体より後ろの層に置く）
function makeRippleCanvas() {
  const W = 1024, H = 300, c = makeCanvas(W, H), ctx = c.getContext('2d');
  ctx.lineCap = 'round';
  for (const [rx, ry, a, lw] of [[360, 52, 0.85, 11], [262, 36, 0.6, 8], [440, 66, 0.4, 6]]) {
    ctx.beginPath(); ctx.ellipse(W / 2, H / 2, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = lw; ctx.stroke();
  }
  return c;
}

// 前ボケ：大きくボケた水滴（最前面）
function makeBokehCanvas() {
  const W = 1024, H = 1024, c = makeCanvas(W, H), ctx = c.getContext('2d');
  const rnd = seeded(4242);
  for (let i = 0; i < 16; i++) {
    const x = 60 + rnd() * (W - 120), y = 60 + rnd() * (H - 120);
    const r = 12 + rnd() * 30, a = 0.16 + rnd() * 0.26;
    ctx.filter = 'blur(' + (6 + rnd() * 10).toFixed(1) + 'px)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(235,248,255,' + a + ')'; ctx.fill();
    ctx.lineWidth = r * 0.25; ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.9) + ')'; ctx.stroke();
  }
  ctx.filter = 'none';
  return c;
}

// 雲の中景（窓型カード用）
function makeCloudsCanvas() {
  const W = 1024, H = 1024, c = makeCanvas(W, H), ctx = c.getContext('2d');
  const rnd = seeded(7);
  for (let i = 0; i < 9; i++) {
    const cx = 80 + rnd() * 860, cy = 80 + rnd() * 560, base = 40 + rnd() * 60;
    ctx.fillStyle = 'rgba(200,225,255,0.55)';
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(cx + (k - 2) * base * 0.8 + rnd() * 20, cy + 14 + rnd() * 10, base * (0.6 + rnd() * 0.5), 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(cx + (k - 2) * base * 0.8 + rnd() * 20, cy + rnd() * 10, base * (0.6 + rnd() * 0.5), 0, Math.PI * 2); ctx.fill(); }
  }
  return c;
}

// 落ち影（ぼんやりした楕円）
function makeBlobCanvas() {
  const W = 256, H = 128, c = makeCanvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, W / 2);
  g.addColorStop(0, 'rgba(20,30,60,1)'); g.addColorStop(0.5, 'rgba(20,30,60,0.5)'); g.addColorStop(1, 'rgba(20,30,60,0)');
  ctx.save(); ctx.scale(1, H / W); ctx.fillStyle = g; ctx.fillRect(0, 0, W, W); ctx.restore();
  return c;
}

// 粒子のスプライト（中心が白く外へ消える＋十字のきらめき）
function makeSpriteCanvas() {
  const S = 64, c = makeCanvas(S, S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(S / 2, 4); ctx.lineTo(S / 2, S - 4); ctx.moveTo(4, S / 2); ctx.lineTo(S - 4, S / 2); ctx.stroke();
  return c;
}

// 絵の見える範囲（角丸）のマスク
function makeMaskCanvas(rect) {
  const c = makeCanvas(rect.w, rect.h), ctx = c.getContext('2d');
  rr(ctx, 0, 0, rect.w, rect.h, rect.r); ctx.fillStyle = '#fff'; ctx.fill();
  return c;
}

// ---- 表面（枠＋文字） -----------------------------------------------------------
function drawHeader(ctx, spec, opts) {
  const { textColor, strokeColor } = opts;
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 62px ' + FONT; ctx.textAlign = 'left';
  if (strokeColor) { ctx.lineWidth = 10; ctx.lineJoin = 'round'; ctx.strokeStyle = strokeColor; ctx.strokeText(spec.name, 70, 98); }
  ctx.fillStyle = textColor; ctx.fillText(spec.name, 70, 98);
  const nw = ctx.measureText(spec.name).width;
  ctx.font = 'bold 28px ' + FONT;
  if (strokeColor) { ctx.lineWidth = 8; ctx.strokeText(spec.sub, 70 + nw + 18, 106); }
  ctx.fillText(spec.sub, 70 + nw + 18, 106);
  ctx.textAlign = 'right';
  ctx.font = 'bold 64px ' + FONT;
  const hpW = ctx.measureText(String(spec.hp)).width;
  ctx.font = 'bold 30px ' + FONT;
  if (strokeColor) { ctx.lineWidth = 8; ctx.strokeText('HP', TEX_W - 150 - hpW - 12, 104); }
  ctx.fillText('HP', TEX_W - 150 - hpW - 12, 104);
  ctx.font = 'bold 64px ' + FONT;
  if (strokeColor) { ctx.lineWidth = 10; ctx.strokeText(String(spec.hp), TEX_W - 150, 98); }
  ctx.fillText(String(spec.hp), TEX_W - 150, 98);
  ctx.beginPath(); ctx.arc(TEX_W - 92, 98, 36, 0, Math.PI * 2);
  ctx.fillStyle = spec.colors.dark; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.beginPath(); ctx.arc(TEX_W - 92, 98, 16, 0, Math.PI * 2); ctx.fillStyle = spec.colors.light; ctx.fill();
}

function drawAttackPanel(ctx, spec, y, h) {
  rr(ctx, 56, y, TEX_W - 112, h, 26); ctx.fillStyle = 'rgba(255,255,255,0.86)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.stroke();
  const a = spec.attack; const row = y + 58;
  for (let i = 0; i < a.cost; i++) {
    ctx.beginPath(); ctx.arc(100 + i * 50, row, 19, 0, Math.PI * 2);
    ctx.fillStyle = spec.colors.dark; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
  }
  ctx.fillStyle = '#1c2333'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = 'bold 44px ' + FONT; ctx.fillText(a.name, 100 + a.cost * 50 + 14, row);
  ctx.textAlign = 'right'; ctx.font = 'bold 58px ' + FONT; ctx.fillText(String(a.power), TEX_W - 96, row);
  ctx.textAlign = 'left'; ctx.font = '28px ' + FONT; ctx.fillStyle = '#2a3140';
  const lines = wrapText(ctx, a.text, TEX_W - 200);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, 100, y + 118 + i * 38));
}

function drawBottomRow(ctx, spec, y, color) {
  ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.textAlign = 'left';
  ctx.font = 'bold 26px ' + FONT; ctx.fillText('じゃくてん', 100, y);
  ctx.beginPath(); ctx.arc(250, y, 16, 0, Math.PI * 2); ctx.fillStyle = '#f4c542'; ctx.fill();
  ctx.fillStyle = color; ctx.fillText('×2', 276, y);
  ctx.fillText('にげる', 560, y);
  for (let i = 0; i < spec.retreat; i++) { ctx.beginPath(); ctx.arc(660 + i * 40, y, 16, 0, Math.PI * 2); ctx.fillStyle = '#c9ced8'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke(); }
}

function drawFooter(ctx, spec, y, color) {
  ctx.font = '22px ' + FONT; ctx.fillStyle = color; ctx.textBaseline = 'middle';
  ctx.textAlign = 'left'; ctx.fillText('Illus. ' + spec.illus, 72, y);
  ctx.textAlign = 'center'; ctx.fillText('© Jojima George · Pochamon', TEX_W / 2, y);
  ctx.textAlign = 'right'; ctx.fillText(spec.no + ' ★', TEX_W - 72, y);
}

function drawFrameWindow(spec) {
  const c = makeCanvas(TEX_W, TEX_H), ctx = c.getContext('2d');
  const { main, dark, light } = spec.colors;
  rr(ctx, 0, 0, TEX_W, TEX_H, 52);
  const g = ctx.createLinearGradient(0, 0, TEX_W, TEX_H); g.addColorStop(0, light); g.addColorStop(0.5, main); g.addColorStop(1, dark);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); rr(ctx, 0, 0, TEX_W, TEX_H, 52); ctx.clip();
  ctx.globalAlpha = 0.14; ctx.strokeStyle = '#fff'; ctx.lineWidth = 16;
  for (let i = -TEX_H; i < TEX_W + TEX_H; i += 64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + TEX_H, TEX_H); ctx.stroke(); }
  ctx.restore();
  rr(ctx, 22, 22, TEX_W - 44, TEX_H - 44, 36); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 5; ctx.stroke();
  drawHeader(ctx, spec, { textColor: '#1c2333' });
  // 窓をくり抜く
  ctx.globalCompositeOperation = 'destination-out'; rr(ctx, WIN.x, WIN.y, WIN.w, WIN.h, WIN.r); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  rr(ctx, WIN.x - 6, WIN.y - 6, WIN.w + 12, WIN.h + 12, WIN.r + 6);
  ctx.lineWidth = 12; ctx.strokeStyle = goldGradient(ctx, WIN.x, WIN.y, WIN.w, WIN.h); ctx.stroke();
  rr(ctx, WIN.x, WIN.y, WIN.w, WIN.h, WIN.r); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
  drawAttackPanel(ctx, spec, 1040, 220);
  drawBottomRow(ctx, spec, 1310, '#1c2333');
  drawFooter(ctx, spec, 1392, 'rgba(28,35,51,0.8)');
  return c;
}

function drawFrameFullart(spec) {
  const c = makeCanvas(TEX_W, TEX_H), ctx = c.getContext('2d');
  ctx.save(); rr(ctx, 0, 0, TEX_W, TEX_H, FULL.r); ctx.clip();
  // 上下の帯（名前・数字が読めるように少し暗くする）。色はカードごとに寄せられる
  const band = spec.bandRGB || '10,25,55';
  const g = ctx.createLinearGradient(0, 0, 0, 230); g.addColorStop(0, `rgba(${band},0.55)`); g.addColorStop(1, `rgba(${band},0)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, TEX_W, 230);
  drawHeader(ctx, spec, { textColor: '#ffffff', strokeColor: `rgba(${spec.strokeRGB || '20,40,80'},0.85)` });
  drawAttackPanel(ctx, spec, 1072, 232);
  const g2 = ctx.createLinearGradient(0, 1300, 0, TEX_H); g2.addColorStop(0, `rgba(${band},0)`); g2.addColorStop(1, `rgba(${band},0.6)`);
  ctx.fillStyle = g2; ctx.fillRect(0, 1300, TEX_W, TEX_H - 1300);
  drawBottomRow(ctx, spec, 1342, '#ffffff');
  drawFooter(ctx, spec, 1400, 'rgba(255,255,255,0.85)');
  ctx.restore();
  // 金の縁取り（ここに箔が一番乗る）
  rr(ctx, 9, 9, TEX_W - 18, TEX_H - 18, FULL.r - 6);
  ctx.lineWidth = 16; ctx.strokeStyle = goldGradient(ctx, 0, 0, TEX_W, TEX_H); ctx.stroke();
  rr(ctx, 20, 20, TEX_W - 40, TEX_H - 40, FULL.r - 14);
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
  return c;
}

function drawBack() {
  const c = makeCanvas(TEX_W, TEX_H), ctx = c.getContext('2d');
  rr(ctx, 0, 0, TEX_W, TEX_H, 52);
  const g = ctx.createLinearGradient(0, 0, TEX_W, TEX_H); g.addColorStop(0, '#232a52'); g.addColorStop(1, '#0d0f1f');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); rr(ctx, 0, 0, TEX_W, TEX_H, 52); ctx.clip();
  ctx.globalAlpha = 0.08; ctx.strokeStyle = '#fff'; ctx.lineWidth = 10;
  for (let i = -TEX_H; i < TEX_W + TEX_H; i += 48) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + TEX_H, TEX_H); ctx.stroke(); }
  ctx.restore();
  rr(ctx, 26, 26, TEX_W - 52, TEX_H - 52, 36); ctx.lineWidth = 14; ctx.strokeStyle = goldGradient(ctx, 0, 0, TEX_W, TEX_H); ctx.stroke();
  ctx.beginPath(); ctx.arc(TEX_W / 2, TEX_H / 2, 240, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
  ctx.lineWidth = 10; ctx.strokeStyle = goldGradient(ctx, 260, 470, 500, 500); ctx.stroke();
  ctx.fillStyle = '#f3d98b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 300px ' + FONT; ctx.fillText('ぽ', TEX_W / 2, TEX_H / 2 - 10);
  ctx.font = 'bold 40px ' + FONT; ctx.fillText('P O C H A M O N', TEX_W / 2, TEX_H / 2 + 330);
  return c;
}

// ---- 箔マテリアル -------------------------------------------------------------
function foilMaterial(tex, p, masked) {
  const m = new THREE.ShaderMaterial({
    vertexShader: foilVertex, fragmentShader: foilFragment,
    uniforms: {
      map: { value: tex }, uLight: { value: new THREE.Vector2() }, uTime: { value: 0 },
      uFoil: { value: p.foil || 0 }, uSparkle: { value: p.sparkle || 0 }, uGlare: { value: p.glare || 0 },
      uRim: { value: p.rim || 0 }, uUvRot: { value: p.rotate || 0 }, uBandScale: { value: p.band || 2.5 }, uOpacity: { value: 1 },
    },
    transparent: true, depthWrite: false, side: THREE.FrontSide,
  });
  if (masked) { m.stencilWrite = true; m.stencilRef = 1; m.stencilFunc = THREE.EqualStencilFunc; }
  return m;
}

// ---- カード生成 -----------------------------------------------------------------
export async function createCard(spec, renderer) {
  const group = new THREE.Group();
  const disposables = [];
  const foils = [];          // uLight/uTime を毎フレーム更新する対象
  const layers = [];         // 奥行き補正する対象
  const artRect = spec.style === 'fullart' ? FULL : WIN;
  const art = rectToUnits(artRect);

  // ステンシルマスク：絵の見える範囲だけに「1」を書く（色は描かない）
  const maskTex = texFromCanvas(makeMaskCanvas(artRect), renderer);
  const maskMat = new THREE.MeshBasicMaterial({ map: maskTex, alphaTest: 0.5, colorWrite: false, depthWrite: false, depthTest: false,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
  const mask = new THREE.Mesh(new THREE.PlaneGeometry(art.w, art.h), maskMat);
  mask.position.set(art.cx, art.cy, 0); mask.renderOrder = 0;
  group.add(mask); disposables.push(maskTex, maskMat, mask.geometry);

  // 裏面：裏から見た時だけ描く（表から見た時は奥の層を隠さない）
  const backTex = texFromCanvas(drawBack(), renderer);
  backTex.wrapS = THREE.RepeatWrapping; backTex.repeat.x = -1;
  const backMat = new THREE.MeshBasicMaterial({ map: backTex, side: THREE.BackSide, alphaTest: 0.5 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), backMat);
  back.position.z = -0.012; back.renderOrder = 1;
  group.add(back); disposables.push(backTex, backMat, back.geometry);

  // 表面（枠＋文字）
  const frameTex = texFromCanvas(spec.style === 'fullart' ? drawFrameFullart(spec) : drawFrameWindow(spec), renderer);
  const frameMat = foilMaterial(frameTex, { foil: 0.9, sparkle: 0.45, glare: 0.3, band: 1.6 }, false);
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), frameMat);
  frame.renderOrder = 10;
  group.add(frame); foils.push(frameMat); disposables.push(frameTex, frameMat, frame.geometry);

  // 層（1層ごとに一呼吸おいて、長い処理1回で画面を止めないようにする）
  const breathe = () => new Promise(r => setTimeout(r, 0));
  const sprite = texFromCanvas(makeSpriteCanvas(), renderer); disposables.push(sprite);
  for (const L of spec.layers) {
    await breathe();
    if (L.kind === 'particles') {
      const n = L.count, pos = new Float32Array(n * 3), ph = new Float32Array(n), sz = new Float32Array(n);
      const rnd = seeded(99);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = L.x[0] + rnd() * (L.x[1] - L.x[0]);
        pos[i * 3 + 1] = L.y[0] + rnd() * (L.y[1] - L.y[0]);
        pos[i * 3 + 2] = L.z[0] + rnd() * (L.z[1] - L.z[0]);
        ph[i] = rnd(); sz[i] = L.size[0] + rnd() * (L.size[1] - L.size[0]);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
      geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
      const mat = new THREE.ShaderMaterial({ vertexShader: sparkVertex, fragmentShader: sparkFragment,
        uniforms: { uMap: { value: sprite }, uTime: { value: 0 }, uScale: { value: 400 }, uColor: { value: new THREE.Color(spec.sparkColor) } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const pts = new THREE.Points(geo, mat);
      pts.renderOrder = 30;
      group.add(pts); disposables.push(geo, mat);
      layers.push({ mesh: pts, L, isPoints: true, mat });
      continue;
    }
    if (L.kind === 'rain' || L.kind === 'puddle') {
      // 時間で動く層（シェーダーで直接描く）。uLight/uTime は foils と同じ仕組みで毎フレーム更新
      const mat = L.kind === 'rain' ? makeRainMaterial(L) : makePuddleMaterial(L);
      if (L.masked) { mat.stencilWrite = true; mat.stencilRef = 1; mat.stencilFunc = THREE.EqualStencilFunc; }
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(L.fit.w, L.fit.h), mat);
      mesh.renderOrder = 10 + L.z * 10;
      group.add(mesh); foils.push(mat); disposables.push(mat, mesh.geometry);
      layers.push({ mesh, L, mat });
      continue;
    }
    let canvas;
    if (L.kind === 'image') canvas = await makeImageCanvas(L);
    else if (L.kind === 'raincloud') canvas = makeRaincloudCanvas();
    else if (L.kind === 'veil') canvas = makeVeilCanvas(L);
    else if (L.kind === 'splash') canvas = makeSplashCanvas();
    else if (L.kind === 'clouds') canvas = makeCloudsCanvas();
    else if (L.kind === 'blob') canvas = makeBlobCanvas();
    else if (L.kind === 'ripple') canvas = makeRippleCanvas();
    else if (L.kind === 'bokeh') canvas = makeBokehCanvas();
    const tex = texFromCanvas(canvas, renderer);
    const mat = foilMaterial(tex, L, !!L.masked);
    if (L.opacity != null) mat.uniforms.uOpacity.value = L.opacity;
    // extend 分だけ板を大きくする（画像の中身は fit の大きさのまま中央に描かれている）
    const e = L.kind === 'image' ? (L.extend || 0) : 0;
    const w = L.fit.w * (1 + 2 * e), h = L.fit.h * (1 + 2 * e);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.renderOrder = 10 + L.z * 10;
    group.add(mesh); foils.push(mat); disposables.push(tex, mat, mesh.geometry);
    layers.push({ mesh, L, mat });
  }

  // 毎フレーム更新：光の位置・時間・奥行き補正
  // （静止時に元の絵と同じ見え方になるよう、奥の層ほど大きく・手前の層ほど小さくして置く）
  function update(t, s) {
    for (const m of foils) { m.uniforms.uLight.value.copy(s.light); m.uniforms.uTime.value = t; }
    const spread = 1 + s.dive * 1.6;     // 長押しで層の間隔を広げる
    for (const { mesh, L, isPoints, mat } of layers) {
      if (isPoints) {
        mesh.visible = s.facing > 0.08;
        mat.uniforms.uTime.value = t; mat.uniforms.uScale.value = s.pointScale;
        mesh.scale.setScalar(1 + s.dive * 0.6);
        continue;
      }
      const z = L.z * spread;
      const k = (s.restCamZ - z) / s.restCamZ;
      let x = L.fit.cx, y = L.fit.cy, rz = L.rotate || 0;
      if (L.float) { y += Math.sin(t * 1.3) * L.float; rz = Math.sin(t * 0.9) * (L.tiltZ || 0.015); }
      if (L.bob) { y += Math.sin(t * 2.1 + 1.0) * L.bob; }
      if (L.drift) { x += Math.sin(t * 0.25) * L.drift; }
      mesh.position.set(x * k, y * k, z);
      mesh.scale.setScalar(k);
      mesh.rotation.z = rz;
    }
    frameMat.uniforms.uOpacity.value = 1 - s.dive * 0.85;   // 中に入ると枠が薄くなる
  }
  function dispose() { for (const d of disposables) { if (d.dispose) d.dispose(); } }
  return { group, update, dispose, art };
}
