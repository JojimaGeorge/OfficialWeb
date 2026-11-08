/* ぽちゃもん UFOキャッチャー：背面の壁の電光パネル
 * 2026-11-08 本人「背面の壁にデカめのモニターを付けて、そこに内容をアニメーションでテレビ風に表示」
 *   「背景の装飾は電光パネルみたいな表示でパラパラ。ぽちゃもんとか果物とか食べ物」「ゲットしたステッカーは普通の画像で表示して大丈夫」
 *   「ステッカーをゲットしたときも背面のパネルに表示しておいたら、何をゲットしたのか分かる」
 * 2026-11-09 本人「電光盤の大きさを全面にしてほしい。表示できる領域、情報とかも、もう少し増やせる」＝背面の壁いっぱい（144×103 粒）
 *
 * 作り：粒の数（cols×rows）の小さな絵 src に色を置き、out（1 粒＝8px）へ「丸い粒＋にじみ」に描き直す。
 * ゲームは out を筐体の絵のパネルの穴に、カメラの投影どおりに貼る（game.js の drawMonitor）。
 * 文字＝PixelMplus12 Bold の点の並び（assets/led_font.json・tools/pochamon-ufo/make_led_font.py）。絵＝assets/led_art.json。
 *
 * 見える所（game.js が setZones で渡す・行の番号）：
 *   正面（タイトル）：上から frontClear 行までは全部見える。その下は手前の山に隠れる所がある＝飾り（行列）だけ置く
 *   いつもの斜め上（ゲーム中）：gameTop 行より上は手前の梁の裏。gameBottom 行より下は奥の山に隠れる所がある
 */
(() => {
'use strict';
const DOT = 8;
let COLS = 128, ROWS = 43, W = COLS * DOT, H = ROWS * DOT;
const Z = { frontClear: 66, gameTop: 34, gameBottom: 80 };

let font = null, art = null, pal = null;
const stickerImgs = {};

let src, sctx, idata, buf, out, octx, lit, lctx, half, hctx, base = null, mask = null, seedArr;
function alloc(cols, rows) {
  COLS = cols; ROWS = rows; W = COLS * DOT; H = ROWS * DOT;
  src = document.createElement('canvas'); src.width = COLS; src.height = ROWS;
  sctx = src.getContext('2d');
  idata = sctx.createImageData(COLS, ROWS); buf = idata.data;
  out = document.createElement('canvas'); out.width = W; out.height = H; octx = out.getContext('2d');
  lit = document.createElement('canvas'); lit.width = W; lit.height = H; lctx = lit.getContext('2d');
  half = document.createElement('canvas'); half.width = Math.ceil(COLS / 2); half.height = Math.ceil(ROWS / 2); hctx = half.getContext('2d');
  // 粒ごとの「切り替わる時刻」のばらつき（場面の切り替わりで粒がパラパラ入れ替わる）
  seedArr = new Float32Array(COLS * ROWS);
  for (let i = 0; i < seedArr.length; i++) seedArr[i] = Math.random();
  buildBase();
}

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
// ドット絵。scale 2＝1 点を 2×2 粒で（大きく見せる）
function sprite(name, x, y, opt) {
  const g = art.sprites[name]; if (!g) return;
  const a = opt && opt.a != null ? opt.a : 1, flip = opt && opt.flip, tint = opt && opt.tint, keep = opt && opt.keep, sc = (opt && opt.scale) || 1;
  for (let j = 0; j < g.length; j++) {
    const row = g[j], w = row.length;
    for (let i = 0; i < w; i++) {
      const ch = row[flip ? w - 1 - i : i];
      if (ch === '.') continue;
      for (let sy = 0; sy < sc; sy++) for (let sx = 0; sx < sc; sx++) {
        const X = x + i * sc + sx, Y = y + j * sc + sy;
        if (keep && !keep(X, Y)) continue;
        px(X, Y, tint || pal[ch], a);
      }
    }
  }
}
function spriteSize(name, sc) { const g = art.sprites[name]; return g ? [g[0].length * (sc || 1), g.length * (sc || 1)] : [0, 0]; }
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
function eraseDisc(cx, cy, r) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++)
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) { const q = (y * COLS + x) * 4; buf[q] = buf[q + 1] = buf[q + 2] = buf[q + 3] = 0; }
}
const hsv = (h, s, v) => { const f = (n) => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5) * 255, f(3) * 255, f(1) * 255]; };
const seedAt = (x, y) => seedArr[(((y | 0) * COLS + (x | 0)) % seedArr.length + seedArr.length) % seedArr.length];

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
  const idx = (n) => ((n % MINI.length) + MINI.length) % MINI.length;
  for (let gy = -1; gy < ROWS / sy + 1; gy++) for (let gx = -1; gx < COLS / sx + 2; gx++) {
    const row = gy, col = gx + Math.floor(t * 3 / sx);
    const x0 = Math.round(gx * sx - off + (row % 2 ? sx / 2 : 0)), y0 = gy * sy + 3;
    // 2.4 秒ごとに入れ替わる。入れ替わる瞬間は粒ごとにずれて「パラパラ」
    const ph = t / 2.4 + ((((col * 7 + row * 3) % 5) + 5) % 5) * 0.2, k = Math.floor(ph), f = ph - k;
    const name = MINI[idx(k + col * 2 + row)], prev = MINI[idx(k - 1 + col * 2 + row)];
    if (f < 0.12) {
      const u = f / 0.12;
      sprite(prev, x0, y0, { a, keep: (X, Y) => seedAt(X, Y) > u });
      sprite(name, x0, y0, { a, keep: (X, Y) => seedAt(X, Y) <= u });
    } else sprite(name, x0, y0, { a });
  }
}

// ---------------- 正面（タイトル）の段 ----------------
const PINK = [255, 92, 170], WHITE = [255, 255, 255], YELLOW = [255, 222, 40], CYAN = [80, 220, 255], ORANGE = [255, 150, 30], DIM = [110, 100, 140];
// 上の段：右から左へ流れ続ける文（電光掲示板）
const TICKER = '★ ぽちゃもん UFOキャッチャー ★ 3かい チャレンジ！ とれた かずだけ ステッカーが もらえるよ ★ ボタンで ねらって ぬいぐるみを おとしてね ★ コインを いれて スタート！　';
function ticker(t) {
  erase(0, 0, COLS, 17);
  const w = measure(TICKER), speed = 26, x0 = COLS - ((t * speed) % (w + COLS));
  let x = Math.round(x0);
  for (const ch of TICKER) {
    const gw = glyph(ch).w;
    if (x + gw >= 0 && x < COLS) text(ch, x, 2, ch === '★' ? YELLOW : (ch === '！' ? PINK : WHITE));
    x += gw;
  }
  // 区切りの線：流れる光の粒（テレビの画面の帯）
  for (let x2 = 0; x2 < COLS; x2++) { const s = ((x2 - t * 40) % 24 + 24) % 24; px(x2, 15, s < 3 ? PINK : [80, 44, 80], 1); }
}
// 下の段：ぽちゃもんと果物が歩く行列（正面からは手前の山に一部が隠れる＝隠れても崩れて見えない物だけ）
const PARADE = ['pocha', 'mikan', 'biroon', 'onigiri', 'pocha', 'lemon', 'ichigo', 'softcream', 'donut'];
function parade(t, y0) {
  erase(0, y0, COLS, ROWS);
  const gap = 30, total = PARADE.length * gap;
  for (let k = 0; k < PARADE.length; k++) {
    const name = PARADE[k], [w, h] = spriteSize(name);
    const x = Math.round(((k * gap + t * 10) % total + total) % total) - 26;
    if (x > COLS || x + w < 0) continue;
    const hop = name === 'biroon' ? Math.round(Math.sin(t * 2.5 + k) * 3) : -Math.round(Math.abs(Math.sin((t * 2.6 + k * 0.7) * Math.PI)) * 2);
    const blink = name === 'pocha' && ((t + k * 0.9) % 3.3) < 0.15;
    sprite(blink ? 'pocha_blink' : name, x, y0 + 4 + (18 - h) + hop);
  }
}
// 真ん中の段の場面（t＝場面の中の秒）。y0 から下へ MAIN_H 行の中に描く
const MAIN_H = 50;
const titleScenes = [
  { name: 'challenge', len: 4.6, draw(t, y0) {
    const shine = (X) => { const s = ((t * 70) % 260) - 50; return Math.abs(X - s) < 6 ? WHITE : PINK; };
    textC('3かい', y0 + 1, shine, { scale: 2 });
    textC('チャレンジ！', y0 + 27, (X) => shine(X + 30));
    // まわりで 2 ひきのぽちゃもんが跳ねる
    for (let i = 0; i < 2; i++) {
      const hop = Math.max(0, Math.sin((t * 2.2 - i * 0.5) * Math.PI));
      const blink = ((t + i * 0.7) % 3.1) < 0.14;
      sprite(blink ? 'pocha_blink' : 'pocha', i ? COLS - 26 : 6, y0 + 6 - Math.round(hop * 4), { flip: !!i });
    }
    sprite('ufo', Math.round(COLS / 2 - 10 + Math.sin(t * 1.6) * 40), y0 + 42, { a: 0.9 });
  } },
  { name: 'prize', len: 3.4, draw(t, y0) {
    textC('とれた かずだけ', y0 + 1, WHITE);
    textC('ステッカー', y0 + 15, (X) => (((X + Math.floor(t * 16)) >> 3) % 2 ? YELLOW : ORANGE), { scale: 2 });
    textC('が もらえるよ！', y0 + 40, WHITE);
  } },
  // 6 種は字の下の段（正面からは左上に待機中のアームの爪がかかる＝絵は爪より下へ）
  { name: 'lineup', len: 4.8, draw(t, y0) {
    textC('ぜんぶで 6しゅるい！', y0 + 1, CYAN);
    for (let i = 0; i < 6; i++) ring(12 + i * 24, y0 + 32, 11.6, [90, 84, 110], 1);
  }, overlay(t, a, y0) {
    for (let i = 0; i < 6; i++) stickerDisc(i + 1, 12 + i * 24, y0 + 32, 10.8, Math.min(1, (t - 0.15 - i * 0.16) / 0.35), a);
  } },
  { name: 'howto', len: 5.4, draw(t, y0) {
    textC('あそびかた', y0 + 1, CYAN);
    const on = Math.floor(t / 0.9) % 3;   // ①よこ ②たて ③おりる が順に光る
    [['→', 'よこ'], ['↑', 'たて']].forEach(([arrow, label], k) => {
      const cx = 18 + k * 48, cy = y0 + 25, hot = on === k;
      disc(cx, cy, 9, hot ? PINK : [150, 50, 100], 1);
      ring(cx, cy, 10.5, hot ? WHITE : [120, 110, 140], 1, 1.4);
      text(arrow, cx - 6, cy - 6, WHITE);
      text(label, cx + 13, cy - 6, hot ? WHITE : [160, 150, 180]);
    });
    // ③ はなすと アームが おりる（UFO が下りる絵）
    const hot3 = on === 2, ux = 124, uy = y0 + 15 + (hot3 ? Math.round(((t % 0.9) / 0.9) * 8) : 0);
    for (let j = y0 + 15; j < uy; j++) px(ux, j, [150, 150, 170], hot3 ? 1 : 0.4);
    sprite(hot3 ? 'ufo_lit' : 'ufo', ux - 10, uy, { a: hot3 ? 1 : 0.55 });
    textC('はなすと おりるよ！', y0 + 39, hot3 ? YELLOW : [200, 190, 220]);   // 「はなすと アームが おりるよ」は 156 粒で横幅（144）からはみ出た
  } },
  { name: 'coin', len: 5.0, draw(t, y0) {
    if ((t % 0.9) < 0.68) { textC('コインを', y0 + 1, WHITE, { scale: 2 }); textC('いれてね', y0 + 26, WHITE, { scale: 2 }); }
    // ◀ が左（投入口のある左の操作盤）へ流れる
    for (let i = 0; i < 3; i++) {
      const x = 20 - ((t * 18 + i * 8) % 24);
      const a = Math.min(1, (x + 2) / 8) * Math.min(1, (22 - x) / 6);
      for (let j = 0; j < 11; j++) { const d = Math.abs(j - 5); for (let w = 0; w < 3; w++) px(x + d + w, y0 + 20 + j, YELLOW, a); }
    }
    sprite('coin', COLS - 16, y0 + 20);
  } },
];
const TITLE_LEN = titleScenes.reduce((s, sc) => s + sc.len, 0);
const MIX = 0.45;   // 場面の切り替わり（粒がパラパラ入れ替わる時間）

function drawTitle(t) {
  // 段の高さ：上の流れる文（0〜16）・真ん中の場面（18〜）・下の行列（正面で山に隠れ始める所から下）
  const y0 = 18, yP = Math.max(y0 + MAIN_H + 1, Z.frontClear - 4);
  let tt = t % TITLE_LEN, i = 0;
  while (tt >= titleScenes[i].len) { tt -= titleScenes[i].len; i++; }
  const sc = titleScenes[i], next = titleScenes[(i + 1) % titleScenes.length];
  const rem = sc.len - tt;
  const frame = (scene, st) => { wallpaper(t, 0.12); ticker(t); erase(0, y0, COLS, y0 + MAIN_H); scene.draw(st, y0); parade(t, yP); };
  if (rem < MIX) {   // 終わり際：真ん中の段だけ、次の場面の粒がばらばらの時刻で入れ替わる（パラパラ）
    const u = 1 - rem / MIX;
    frame(sc, tt); const a = buf.slice();
    clear(); frame(next, 0);
    for (let y = y0; y < Math.min(ROWS, y0 + MAIN_H); y++) for (let x = 0; x < COLS; x++) {
      const k = y * COLS + x;
      if (seedArr[k] <= u) continue;   // もう次の場面になった粒
      const q = k * 4; buf[q] = a[q]; buf[q + 1] = a[q + 1]; buf[q + 2] = a[q + 2]; buf[q + 3] = a[q + 3];
    }
    // 普通の画像（ステッカー）は粒より早く消して、次の場面の字に重ねない（11/9 検品：6種→あそびかたで白い丸が字に重なった）
    return () => { if (sc.overlay) sc.overlay(tt, Math.max(0, 1 - u * 2.2), y0); if (next.overlay) next.overlay(0, Math.max(0, (u - 0.55) / 0.45), y0); };
  }
  frame(sc, tt);
  return sc.overlay ? () => sc.overlay(tt, 1, y0) : null;
}

// ---------------- ゲーム中（いつもの斜め上から見える所＝gameTop〜gameBottom） ----------------
const state = { mode: 'title', t0: 0, got: [], pops: [], startAt: -1, flashAt: -1 };
function slotGeo() {
  const top = Z.gameTop + 15, bottom = Z.gameBottom, r = Math.max(8, Math.min(17, (bottom - top) / 2 - 0.5)), cy = top + (bottom - top) / 2;
  return { xs: [COLS / 2 - 46, COLS / 2, COLS / 2 + 46], cy, r };
}
function drawGame(t) {
  wallpaper(t, 0.2);
  const sinceStart = t - state.startAt;
  if (state.startAt >= 0 && sinceStart < 1.6) {   // コインを入れた直後：「スタート！」（正面からも斜め上からも見える高さ）
    const y = Math.max(Z.gameTop + 3, Math.min(Z.frontClear - 30, 42));
    erase(2, y - 3, COLS - 2, y + 28);   // 文字の後ろは暗く抜く（柄が透けて読みにくくならない）
    textC('スタート！', y, (X) => hsv(((X / COLS) + sinceStart * 0.8) % 1, 0.55, 1), { scale: 2 });
    if (Math.floor(sinceStart * 8) % 2) for (let k = 0; k < 14; k++) px(Math.floor(seedArr[k * 31] * COLS), Math.floor(seedArr[k * 17] * ROWS), WHITE, 1);
    return null;
  }
  const g = slotGeo(), flash = state.flashAt >= 0 && t - state.flashAt < 0.9;
  erase(0, Z.gameTop, COLS, Z.gameTop + 14);
  textC('ゲットした ステッカー', Z.gameTop + 1, [255, 200, 230]);
  for (let i = 0; i < g.xs.length; i++) {
    eraseDisc(g.xs[i], g.cy, g.r + 1.2);   // 枠の中は暗く（柄を消す）、縁は明るい輪
    const has = i < state.got.length, hot = flash && i === state.got.length - 1;
    ring(g.xs[i], g.cy, g.r + 0.6, has ? (hot ? hsv((t * 2) % 1, 0.5, 1) : YELLOW) : DIM, 1, 1.5);
    if (!has) text('？', Math.round(g.xs[i] - 6), Math.round(g.cy - 6), [130, 120, 160], { a: 0.8 + 0.2 * Math.sin(t * 3 + i) });
    // はまった瞬間：枠のまわりに光の粒
    const pop = state.pops[i];
    if (pop != null && t - pop < 1.1) {
      const u = (t - pop) / 1.1;
      for (let k = 0; k < 16; k++) {
        const ang = k / 16 * Math.PI * 2 + i, r = g.r + 2 + u * 10;
        const x = g.xs[i] + Math.cos(ang) * r, y = g.cy + Math.sin(ang) * r * 0.9;
        if (seedArr[k * 13 + i] > 0.5 && u < 0.8) sprite('sparkle', Math.round(x - 2), Math.round(y - 2), { a: 1 - u });
        else px(x, y, YELLOW, 1 - u);
      }
    }
  }
  return () => {
    for (let i = 0; i < state.got.length; i++) {
      const pop = state.pops[i];
      stickerDisc(state.got[i], g.xs[i], g.cy, g.r - 1.2, pop == null ? 1 : Math.min(1, (t - pop) / 0.45));
    }
  };
}

// ---------------- 外から使う ----------------
let lastDraw = -1, lastRender = -1e9;
window.PochaLED = {
  DOT, get COLS() { return COLS; }, get ROWS() { return ROWS; }, get canvas() { return out; },
  ready: () => !!(font && art && out),
  async load(fetchJSON, size) {
    const [f, a] = await Promise.all([fetchJSON('assets/led_font.json'), fetchJSON('assets/led_art.json')]);
    font = f; art = a; pal = a.palette;
    alloc((size && size.cols) || 128, (size && size.rows) || 43);
  },
  // 見える所（行の番号）：frontClear＝正面で手前の山に隠れない一番下の行／gameTop・gameBottom＝斜め上から見える範囲
  setZones(z) { Object.assign(Z, z); },
  setStickers(map) { for (const k in map) stickerImgs[k] = map[k]; },
  // タイトル（説明を流す）／ゲーム中（取れたステッカーの枠）
  title(now) { state.mode = 'title'; state.t0 = now / 1000; state.got = []; state.pops = []; state.startAt = -1; },
  start(now) { state.mode = 'game'; state.t0 = state.t0 || now / 1000; state.got = []; state.pops = []; state.startAt = now / 1000 - state.t0; },
  // 取れたステッカーを枠に入れる（取り出し口のポップアップが消えた時に呼ぶ）
  reveal(id, now) { if (state.got.length >= 3) return; state.got.push(id); const t = now / 1000 - state.t0; state.pops[state.got.length - 1] = t; state.flashAt = t; },
  setGot(ids) { state.got = ids.slice(0, 3); state.pops = state.got.map(() => null); },
  state: () => ({ mode: state.mode, got: state.got.slice(), t: (performance.now() / 1000 - state.t0), cols: COLS, rows: ROWS, zones: Object.assign({}, Z) }),
  // 1 コマ描く（同じ時刻なら描き直さない）。戻り値＝out
  draw(now) {
    if (!font || !art || !out) return null;
    const t = now / 1000 - state.t0;
    // 秒 30 回に間引く（粒の絵は細かい動きが要らない・11/9 検品：144×103 粒の描き直しで 1 コマ 5〜6ms・PC の headless）
    if (t === lastDraw || (now - lastRender < 1000 / 30 - 2 && now >= lastRender)) return out;
    lastDraw = t; lastRender = now;
    clear();
    const overlay = state.mode === 'title' ? drawTitle(t) : drawGame(t);
    render();
    if (overlay) overlay();
    return out;
  },
};
})();
