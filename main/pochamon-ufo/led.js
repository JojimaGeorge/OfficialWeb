/* ぽちゃもん UFOキャッチャー：背面の壁のモニター（電光パネル）
 * 2026-11-08 本人「背面の壁にデカめのモニターを付けて、そこに内容をアニメーションでテレビ風に表示」
 *   「背景の装飾は電光パネルみたいな表示でパラパラ。ぽちゃもんとか果物とか食べ物」「ゲットしたステッカーは普通の画像で表示して大丈夫」
 *   「ステッカーをゲットしたときも背面のパネルに表示しておいたら、何をゲットしたのか分かる」
 * 作り：128×43 の粒（1 粒＝1 画素の小さな絵 src）に色を置き、out（1 粒＝8px）へ「丸い粒＋にじみ」に描き直す。
 * ゲームは out を筐体の絵のモニターの穴に、カメラの投影どおりに貼る（game.js の drawLed）。
 * 文字＝PixelMplus12 Bold の点の並び（assets/led_font.json・tools/pochamon-ufo/make_led_font.py）。絵＝assets/led_art.json。
 */
(() => {
'use strict';
const COLS = 128, ROWS = 43, DOT = 8;
const W = COLS * DOT, H = ROWS * DOT;

let font = null, art = null, pal = null;
const stickerImgs = {};

// ---------------- 粒の絵（1 粒＝1 画素） ----------------
const src = document.createElement('canvas'); src.width = COLS; src.height = ROWS;
const sctx = src.getContext('2d');
const idata = sctx.createImageData(COLS, ROWS);
const buf = idata.data;
const out = document.createElement('canvas'); out.width = W; out.height = H;
const octx = out.getContext('2d');
const lit = document.createElement('canvas'); lit.width = W; lit.height = H;
const lctx = lit.getContext('2d');
const half = document.createElement('canvas'); half.width = COLS / 2; half.height = Math.ceil(ROWS / 2);
const hctx = half.getContext('2d');
let base = null, mask = null;

function buildBase() {
  base = document.createElement('canvas'); base.width = W; base.height = H;
  const g = base.getContext('2d');
  g.fillStyle = '#0c0a12'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#25212e';
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    g.beginPath(); g.arc(x * DOT + DOT / 2, y * DOT + DOT / 2, DOT * 0.3, 0, Math.PI * 2); g.fill();
  }
  // 粒の形（真ん中が明るく縁が落ちる丸）：拡大した色の上に destination-in で掛ける
  mask = document.createElement('canvas'); mask.width = W; mask.height = H;
  const one = document.createElement('canvas'); one.width = DOT; one.height = DOT;
  const og = one.getContext('2d');
  const gr = og.createRadialGradient(DOT / 2, DOT / 2, 0, DOT / 2, DOT / 2, DOT * 0.47);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.62, 'rgba(255,255,255,0.92)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  og.fillStyle = gr; og.fillRect(0, 0, DOT, DOT);
  const mg = mask.getContext('2d');
  mg.fillStyle = mg.createPattern(one, 'repeat'); mg.fillRect(0, 0, W, H);
}

// ---------------- 粒に描く道具 ----------------
function clear() { buf.fill(0); }
function erase(x0, y0, x1, y1) {   // その範囲の粒を消す（柄の上に文字や枠を置く所を暗く抜く）
  for (let y = Math.max(0, y0 | 0); y < Math.min(ROWS, y1); y++) buf.fill(0, (y * COLS + Math.max(0, x0 | 0)) * 4, (y * COLS + Math.min(COLS, x1)) * 4);
}
function px(x, y, c, a) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS || a <= 0) return;
  const i = (y * COLS + x) * 4, k = a >= 1 ? 1 : a;
  buf[i] = c[0] * k; buf[i + 1] = c[1] * k; buf[i + 2] = c[2] * k; buf[i + 3] = 255;
}
function sprite(name, x, y, opt) {
  const g = art.sprites[name]; if (!g) return;
  const a = opt && opt.a != null ? opt.a : 1, flip = opt && opt.flip, tint = opt && opt.tint, keep = opt && opt.keep;
  for (let j = 0; j < g.length; j++) {
    const row = g[j], w = row.length;
    for (let i = 0; i < w; i++) {
      const ch = row[flip ? w - 1 - i : i];
      if (ch === '.') continue;
      if (keep && !keep(x + i, y + j)) continue;
      px(x + i, y + j, tint || pal[ch], a);
    }
  }
}
function spriteSize(name) { const g = art.sprites[name]; return g ? [g[0].length, g.length] : [0, 0]; }
function glyph(ch) { return font.glyphs[ch] || font.glyphs['？']; }
function measure(str, scale) { let w = 0; for (const ch of str) w += glyph(ch).w; return w * (scale || 1); }
// 文字：c は色か (x, y)→色 の関数。scale 2＝2×2 粒で 1 点
function text(str, x, y, c, opt) {
  const scale = (opt && opt.scale) || 1, a = opt && opt.a != null ? opt.a : 1, keep = opt && opt.keep;
  let cx = x;
  for (const ch of str) {
    const g = glyph(ch), w = g.w, r = g.r, rows = r.length / 3;
    for (let j = 0; j < rows; j++) {
      const bits = parseInt(r.substr(j * 3, 3), 16);
      if (!bits) continue;
      for (let i = 0; i < w; i++) {
        if (!((bits >> (w - 1 - i)) & 1)) continue;
        for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
          const X = cx + i * scale + sx, Y = y + j * scale + sy;
          if (keep && !keep(X, Y)) continue;
          px(X, Y, typeof c === 'function' ? c(X, Y) : c, a);
        }
      }
    }
    cx += w * scale;
  }
  return cx - x;
}
function textC(str, y, c, opt) { const w = measure(str, opt && opt.scale); return text(str, Math.round((COLS - w) / 2), y, c, opt); }
function ring(cx, cy, r, c, a, th) {
  const t = th || 1;
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d <= r && d > r - t) px(x, y, c, a);
  }
}
function disc(cx, cy, r, c, a) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
    if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) px(x, y, c, a);
}
const C = (name) => pal[name];
const hsv = (h, s, v) => { const f = (n) => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5) * 255, f(3) * 255, f(1) * 255]; };

// 粒ごとの「切り替わる時刻」のばらつき（場面の切り替わりで粒がパラパラ入れ替わる）
const seedArr = new Float32Array(COLS * ROWS);
for (let i = 0; i < seedArr.length; i++) seedArr[i] = Math.random();
const seedAt = (x, y) => seedArr[((y | 0) * COLS + (x | 0)) % seedArr.length];

// ---------------- 粒の絵 → 光る粒（out） ----------------
function render() {
  sctx.putImageData(idata, 0, 0);
  octx.globalCompositeOperation = 'source-over'; octx.globalAlpha = 1;
  octx.drawImage(base, 0, 0);
  // にじみ：半分の粗さに縮めてから広げる（なめらかに広げた分だけ周りへ光が漏れる）
  hctx.clearRect(0, 0, half.width, half.height); hctx.imageSmoothingEnabled = true;
  hctx.drawImage(src, 0, 0, half.width, half.height);
  octx.globalCompositeOperation = 'lighter'; octx.imageSmoothingEnabled = true;
  octx.globalAlpha = 0.42; octx.drawImage(half, -DOT, -DOT, W + 2 * DOT, H + 2 * DOT);
  octx.globalAlpha = 0.5; octx.drawImage(src, 0, 0, W, H);
  // 粒：くっきり拡大して、丸い粒の形で切り抜いて足す
  lctx.globalCompositeOperation = 'copy'; lctx.imageSmoothingEnabled = false;
  lctx.drawImage(src, 0, 0, W, H);
  lctx.globalCompositeOperation = 'destination-in'; lctx.drawImage(mask, 0, 0);
  octx.globalAlpha = 1; octx.drawImage(lit, 0, 0);
  octx.globalCompositeOperation = 'source-over';
}

// 普通の画像（ステッカー）：白い丸の上に。u は出てくる途中（0〜1・大きさの弾み）、a は濃さ（場面の切り替わりで薄れる）
function stickerDisc(id, cx, cy, r, u, a) {
  const im = stickerImgs[id]; if (!im) return;
  const e = u >= 1 ? 1 : (u <= 0 ? 0 : 1 + 0.18 * Math.sin(u * Math.PI) * (1 - u) - Math.pow(1 - u, 3));
  if (e <= 0.01 || a === 0) return;
  const R = r * DOT * e, X = cx * DOT, Y = cy * DOT;
  octx.save();
  octx.globalAlpha = a == null ? 1 : a;
  octx.shadowColor = 'rgba(255,255,255,0.55)'; octx.shadowBlur = DOT * 1.6;
  octx.fillStyle = '#ffffff'; octx.beginPath(); octx.arc(X, Y, R, 0, Math.PI * 2); octx.fill();
  octx.shadowBlur = 0;
  const k = Math.min((R * 1.62) / im.width, (R * 1.62) / im.height);
  octx.drawImage(im, X - im.width * k / 2, Y - im.height * k / 2, im.width * k, im.height * k);
  octx.restore();
}

// ---------------- 背景の柄（薄く流れる・ひとつずつパラパラ入れ替わる） ----------------
const MINI = ['mini_mikan', 'mini_heart', 'mini_onigiri', 'mini_star', 'mini_pocha', 'mini_lemon', 'mini_ichigo'];
function wallpaper(t, a) {
  const sx = 16, sy = 14, off = (t * 3) % sx;   // 1 秒に 3 粒ずつ左へ
  for (let gy = -1; gy < ROWS / sy + 1; gy++) for (let gx = -1; gx < COLS / sx + 2; gx++) {
    const row = gy, col = gx + Math.floor(t * 3 / sx);
    const x0 = Math.round(gx * sx - off + (row % 2 ? sx / 2 : 0)), y0 = gy * sy + 3;
    // 2.4 秒ごとに入れ替わる。入れ替わる瞬間は粒ごとにずれて「パラパラ」
    const ph = t / 2.4 + ((col * 7 + row * 3) % 5) * 0.2, k = Math.floor(ph), f = ph - k;
    const name = MINI[((k + col * 2 + row) % MINI.length + MINI.length) % MINI.length];
    const prev = MINI[((k - 1 + col * 2 + row) % MINI.length + MINI.length) % MINI.length];
    if (f < 0.12) {
      const u = f / 0.12;
      sprite(prev, x0, y0, { a, keep: (X, Y) => seedAt(X, Y) > u });
      sprite(name, x0, y0, { a, keep: (X, Y) => seedAt(X, Y) <= u });
    } else sprite(name, x0, y0, { a });
  }
}

// ---------------- 場面 ----------------
// タイトル：繰り返し流す。各場面は (t＝場面の中の秒, a＝明るさ) で粒の絵を描く
const PINK = [255, 92, 170], WHITE = [255, 255, 255], YELLOW = [255, 222, 40], CYAN = [80, 220, 255], ORANGE = [255, 150, 30];
const titleScenes = [
  { name: 'challenge', len: 4.2, draw(t) {
    const shine = (X) => { const s = ((t * 60) % 220) - 40; return Math.abs(X - s) < 5 ? WHITE : PINK; };
    // 正面から見ると画面の下 3 分の 1 は手前の山に隠れる＝文字と絵は上へ寄せる（11/8）
    erase(0, 1, COLS, 15); erase(10, 15, 118, 36);   // 文字と絵の後ろは柄を抜く
    textC('3かい チャレンジ！', 2, (X) => shine(X));
    for (let i = 0; i < 3; i++) {
      const hop = Math.max(0, Math.sin((t * 2.2 - i * 0.33) * Math.PI)) ;
      const y = 18 - Math.round(hop * 3);
      const blink = ((t + i * 0.7) % 3.1) < 0.14;
      sprite(blink ? 'pocha_blink' : 'pocha', 14 + i * 40, y);
    }
  } },
  { name: 'prize', len: 2.8, draw(t) {
    erase(0, 1, COLS, 29);
    textC('とれた かずだけ', 2, WHITE);
    textC('ステッカーもらえる！', 16, (X) => (((X + Math.floor(t * 14)) >> 2) % 2 ? YELLOW : ORANGE));
  } },
  { name: 'lineup', len: 4.4, draw(t) {
    // 6 種を上に大きく（正面からは下が山に隠れる）。下の段は果物の行列（隠れても崩れて見えない飾り。前は「ぜんぶで 6しゅるい」の字が欠けて見えた）
    for (let i = 0; i < 6; i++) { erase(Math.floor(1 + i * 21), 1, Math.ceil(22.5 + i * 21), 25); ring(11.5 + i * 21, 12.5, 10.6, [90, 84, 110], 1); }
    erase(0, 26, COLS, ROWS);
    const parade = ['mikan', 'onigiri', 'lemon', 'ichigo', 'softcream', 'donut'];
    for (let k = 0; k < 8; k++) {
      const name = parade[k % parade.length], x = Math.round(((k * 22 - t * 14) % 176 + 176) % 176) - 24;
      const hop = Math.round(Math.max(0, Math.sin((t * 3 + k) * Math.PI)) * 2);
      sprite(name, x, 28 - hop + (name === 'softcream' ? -1 : 0));
    }
  }, overlay(t, a) {
    for (let i = 0; i < 6; i++) stickerDisc(i + 1, 11.5 + i * 21, 12.5, 9.8, Math.min(1, (t - 0.15 - i * 0.16) / 0.35), a);
  } },
  { name: 'howto', len: 4.8, draw(t) {
    erase(0, 1, COLS, 15); erase(12, 14, 122, 36);
    textC('ボタンで ねらってね', 2, WHITE);
    const on = Math.floor(t / 0.8) % 2;
    // 「→よこ」「↑たて」のボタン（光る方が交互に入れ替わる）
    [[26, 'よこ', '→'], [82, 'たて', '↑']].forEach(([cx, label, arrow], k) => {
      const hot = on === k;
      disc(cx, 25, 9, hot ? PINK : [150, 50, 100], 1);
      ring(cx, 25, 10.5, hot ? WHITE : [120, 110, 140], 1, 1.4);
      text(arrow, cx - 6, 19, WHITE);
      text(label, cx + 13, 19, hot ? WHITE : [160, 150, 180]);
    });
  } },
  { name: 'coin', len: 5.0, draw(t) {
    erase(0, 1, COLS, 15); erase(0, 17, COLS, 31);
    if ((t % 0.9) < 0.68) textC('コインを いれてね', 2, WHITE);
    // ◀ が左（投入口のある左の操作盤）へ流れる
    for (let i = 0; i < 4; i++) {
      const x = 96 - ((t * 26 + i * 22) % 88);
      const a = Math.min(1, (x - 8) / 20) * Math.min(1, (104 - x) / 14);
      for (let j = 0; j < 9; j++) { const d = Math.abs(j - 4); for (let w = 0; w < 3; w++) px(x + d + w, 19 + j, YELLOW, a); }
    }
    sprite('coin', 108, 18);
  } },
];
const TITLE_LEN = titleScenes.reduce((s, sc) => s + sc.len, 0);
const MIX = 0.45;   // 場面の切り替わり（粒がパラパラ入れ替わる時間）

// ゲーム中：3 つの枠（取れた順にステッカーが入る）
const SLOT_X = [22, 64, 106], SLOT_Y = 21.5, SLOT_R = 14.5;
const state = { mode: 'title', t0: 0, got: [], pops: [], startAt: -1, flashAt: -1 };

function drawTitle(t) {
  let tt = t % TITLE_LEN, i = 0;
  while (tt >= titleScenes[i].len) { tt -= titleScenes[i].len; i++; }
  const sc = titleScenes[i], next = titleScenes[(i + 1) % titleScenes.length];
  const rem = sc.len - tt;
  if (rem < MIX) {   // 終わり際：次の場面の粒が、ばらばらの時刻で入れ替わる（パラパラ）
    const u = 1 - rem / MIX;
    wallpaper(t, 0.16); sc.draw(tt); const a = buf.slice();
    clear(); wallpaper(t, 0.16); next.draw(0);
    for (let k = 0; k < COLS * ROWS; k++) {
      if (seedArr[k] <= u) continue;   // もう次の場面になった粒
      const q = k * 4; buf[q] = a[q]; buf[q + 1] = a[q + 1]; buf[q + 2] = a[q + 2]; buf[q + 3] = a[q + 3];
    }
    return () => { if (sc.overlay) sc.overlay(tt, 1 - u); if (next.overlay) next.overlay(0, u); };
  }
  wallpaper(t, 0.16);
  sc.draw(tt);
  return sc.overlay ? () => sc.overlay(tt, 1) : null;
}

function drawGame(t) {
  wallpaper(t, 0.2);
  const sinceStart = t - state.startAt;
  if (state.startAt >= 0 && sinceStart < 1.6) {   // コインを入れた直後：「スタート！」
    erase(2, 7, 126, 36);   // 文字の後ろは暗く抜く（柄が透けて読みにくくならない）
    const blink = Math.floor(sinceStart * 8) % 2;
    textC('スタート！', 9, (X) => hsv(((X / 128) + sinceStart * 0.8) % 1, 0.55, 1), { scale: 2 });
    if (blink) for (let k = 0; k < 10; k++) px(Math.floor(seedArr[k * 31] * COLS), Math.floor(seedArr[k * 17] * ROWS), WHITE, 1);
    return null;
  }
  const flash = state.flashAt >= 0 && t - state.flashAt < 0.9;
  for (let i = 0; i < SLOT_X.length; i++) {
    // 枠の中は暗く（柄を消す）、縁は明るい輪
    for (let y = Math.floor(SLOT_Y - SLOT_R - 1); y <= Math.ceil(SLOT_Y + SLOT_R + 1); y++) for (let x = Math.floor(SLOT_X[i] - SLOT_R - 1); x <= Math.ceil(SLOT_X[i] + SLOT_R + 1); x++)
      if (Math.hypot(x + 0.5 - SLOT_X[i], y + 0.5 - SLOT_Y) <= SLOT_R + 0.6) { const q = (y * COLS + x) * 4; if (x >= 0 && y >= 0 && x < COLS && y < ROWS) { buf[q] = buf[q + 1] = buf[q + 2] = 0; buf[q + 3] = 0; } }
    const has = i < state.got.length;
    const hot = flash && i === state.got.length - 1;
    const col = has ? (hot ? hsv((t * 2) % 1, 0.5, 1) : YELLOW) : [110, 100, 140];
    ring(SLOT_X[i], SLOT_Y, SLOT_R + 0.6, col, 1, 1.5);
    if (!has) text('？', SLOT_X[i] - 6, SLOT_Y - 6, [130, 120, 160], { a: 0.8 + 0.2 * Math.sin(t * 3 + i) });
    // はまった瞬間：枠のまわりに光の粒
    const pop = state.pops[i];
    if (pop != null && t - pop < 1.1) {
      const u = (t - pop) / 1.1;
      for (let k = 0; k < 14; k++) {
        const ang = k / 14 * Math.PI * 2 + i, r = SLOT_R + 2 + u * 9;
        const s = seedArr[k * 13 + i] > 0.5 ? 'sparkle' : null;
        const x = SLOT_X[i] + Math.cos(ang) * r, y = SLOT_Y + Math.sin(ang) * r * 0.9;
        if (s && u < 0.8) sprite('sparkle', Math.round(x - 2), Math.round(y - 2), { a: 1 - u });
        else px(x, y, YELLOW, 1 - u);
      }
    }
  }
  return () => {
    for (let i = 0; i < state.got.length; i++) {
      const pop = state.pops[i];
      stickerDisc(state.got[i], SLOT_X[i], SLOT_Y, SLOT_R - 1.2, pop == null ? 1 : Math.min(1, (t - pop) / 0.45));
    }
  };
}

// ---------------- 外から使う ----------------
let lastDraw = -1;
window.PochaLED = {
  COLS, ROWS, DOT, canvas: out,
  ready: () => !!(font && art),
  async load(fetchJSON) {
    const [f, a] = await Promise.all([fetchJSON('assets/led_font.json'), fetchJSON('assets/led_art.json')]);
    font = f; art = a; pal = a.palette; buildBase();
  },
  setStickers(map) { for (const k in map) stickerImgs[k] = map[k]; },
  // タイトル（説明を流す）／ゲーム中（取れたステッカーの枠）
  title(now) { state.mode = 'title'; state.t0 = now / 1000; state.got = []; state.pops = []; state.startAt = -1; },
  start(now) { state.mode = 'game'; state.t0 = state.t0 || now / 1000; state.got = []; state.pops = []; state.startAt = now / 1000 - state.t0; },
  // 取れたステッカーを枠に入れる（取り出し口のポップアップが消えた時に呼ぶ）
  reveal(id, now) { if (state.got.length >= SLOT_X.length) return; state.got.push(id); const t = now / 1000 - state.t0; state.pops[state.got.length - 1] = t; state.flashAt = t; },
  setGot(ids) { state.got = ids.slice(0, SLOT_X.length); state.pops = state.got.map(() => null); },
  state: () => ({ mode: state.mode, got: state.got.slice(), t: (performance.now() / 1000 - state.t0) }),
  // 1 コマ描く（同じ時刻なら描き直さない）。戻り値＝out
  draw(now) {
    if (!font || !art) return null;
    const t = now / 1000 - state.t0;
    if (t === lastDraw) return out;
    lastDraw = t;
    clear();
    const overlay = state.mode === 'title' ? drawTitle(t) : drawGame(t);
    render();
    if (overlay) overlay();
    return out;
  },
};
})();
