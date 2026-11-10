/* ぽちゃもん UFOキャッチャー：結果画面の電光パネル（2026-11-10）
 * 本人「最後のステッカーゲット画面も、賑やかしデザイン性を良くしたい。後ろのテレビの電光掲示板みたいなデザインで、
 *   もうちょっとアニメーションを賑やかにしてユーザーを喜ばせたい」
 *
 * 作り：背面のパネル（led.js）と同じ粒の描き方。文字＝PixelMplus12（assets/led_font.json）・絵＝assets/led_art.json を led.js から借りる。
 * 粒の数は 192×144（4:3 の昔のテレビ）。1 粒＝8px の canvas に「丸い粒＋にじみ」で描き、CSS で枠いっぱいに縮めて見せる。
 * ステッカーの絵柄は粒にせず普通の画像で貼る（スタッフが絵柄を見分ける・背面のパネルと同じ。白い丸は粒）。
 * 絵は出してからの秒 t だけで決まる（花火・紙ふぶき・行列も t から計算）＝同じ t なら同じ絵（撮って比べられる）。
 *
 * 流れ（n＝取れた枚数）：
 *   0〜0.4 秒   テレビが点く（粒がパラパラ点く）・「けっか はっぴょう！」が 1 字ずつ
 *   0.5 秒〜    取れた数だけの丸（？が点滅＝ドラムロール）
 *   1.1 秒〜    0.65 秒ごとに 1 枚ずつ：丸が白く弾けて絵柄・光の輪と星が飛ぶ（音は game.js：onReveal）
 *   出そろったら「ステッカー ２まい ゲット！」・花火・紙ふぶき・「スタッフに みせてね」（音とボタン：onDone）。3 枚なら題が「パーフェクト！」
 *   ずっと：縁の電飾が流れる・下をぽちゃもんと果物の行列が歩く・左右のぽちゃもんが跳ねる
 */
(() => {
'use strict';
const DOT = 8, COLS = 192, ROWS = 144, W = COLS * DOT, H = ROWS * DOT;
const PINK = [255, 92, 170], WHITE = [255, 255, 255], YELLOW = [255, 222, 40], CYAN = [80, 220, 255], ORANGE = [255, 150, 30];
const DIM = [96, 88, 124], DISC = [246, 244, 250];

let font = null, art = null, pal = null;
let canvas = null, octx = null, src, sctx, idata, buf, lit, lctx, half, hctx, base = null, mask = null, seedArr = null, skipRender = false;

// ---------------- 粒に描く道具（led.js と同じ形） ----------------
function alloc() {
  src = document.createElement('canvas'); src.width = COLS; src.height = ROWS; sctx = src.getContext('2d');
  idata = sctx.createImageData(COLS, ROWS); buf = idata.data;
  lit = document.createElement('canvas'); lit.width = W; lit.height = H; lctx = lit.getContext('2d');
  half = document.createElement('canvas'); half.width = COLS / 2; half.height = ROWS / 2; hctx = half.getContext('2d');
  seedArr = new Float32Array(COLS * ROWS);
  let s = 12345;   // 決まった並びの乱数（点く順番が毎回同じ）
  for (let i = 0; i < seedArr.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; seedArr[i] = s / 0x7fffffff; }
  base = document.createElement('canvas'); base.width = W; base.height = H;
  const g = base.getContext('2d');
  g.fillStyle = '#0c0a12'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#231f2d';
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { g.beginPath(); g.arc(x * DOT + DOT / 2, y * DOT + DOT / 2, DOT * 0.3, 0, Math.PI * 2); g.fill(); }
  mask = document.createElement('canvas'); mask.width = W; mask.height = H;
  const one = document.createElement('canvas'); one.width = DOT; one.height = DOT;
  const og = one.getContext('2d'), gr = og.createRadialGradient(DOT / 2, DOT / 2, 0, DOT / 2, DOT / 2, DOT * 0.47);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.62, 'rgba(255,255,255,0.92)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  og.fillStyle = gr; og.fillRect(0, 0, DOT, DOT);
  const mg = mask.getContext('2d'); mg.fillStyle = mg.createPattern(one, 'repeat'); mg.fillRect(0, 0, W, H);
}
function clear() { buf.fill(0); }
function px(x, y, c, a) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS || !(a > 0)) return;
  const i = (y * COLS + x) * 4, k = a >= 1 ? 1 : a;
  buf[i] = c[0] * k; buf[i + 1] = c[1] * k; buf[i + 2] = c[2] * k; buf[i + 3] = 255;
}
function add(x, y, c, a) {   // 足し算（花火の重なり・光の輪）：今の色に足して 255 で止める
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS || !(a > 0)) return;
  const i = (y * COLS + x) * 4, k = a >= 1 ? 1 : a;
  buf[i] = Math.min(255, buf[i] + c[0] * k); buf[i + 1] = Math.min(255, buf[i + 1] + c[1] * k); buf[i + 2] = Math.min(255, buf[i + 2] + c[2] * k); buf[i + 3] = 255;
}
function erase(x0, y0, x1, y1) { for (let y = Math.max(0, y0 | 0); y < Math.min(ROWS, y1); y++) buf.fill(0, (y * COLS + Math.max(0, x0 | 0)) * 4, (y * COLS + Math.min(COLS, x1)) * 4); }
function sprite(name, x, y, opt) {
  const g = art.sprites[name]; if (!g) return;
  const a = opt && opt.a != null ? opt.a : 1, flip = opt && opt.flip, tint = opt && opt.tint, sc = (opt && opt.scale) || 1;
  for (let j = 0; j < g.length; j++) {
    const row = g[j], w = row.length;
    for (let i = 0; i < w; i++) {
      const ch = row[flip ? w - 1 - i : i];
      if (ch === '.') continue;
      for (let sy = 0; sy < sc; sy++) for (let sx = 0; sx < sc; sx++) px(x + i * sc + sx, y + j * sc + sy, tint || pal[ch], a);
    }
  }
}
function spriteSize(name) { const g = art.sprites[name]; return g ? [g[0].length, g.length] : [0, 0]; }
function glyph(ch) { return font.glyphs[ch] || font.glyphs['？']; }
function measure(str, scale) { let w = 0; for (const ch of str) w += glyph(ch).w; return w * (scale || 1); }
// 文字：c は色か (x, y, i＝何文字目)→色 の関数。upto＝何文字目まで出すか（1 字ずつ出す）
function text(str, x, y, c, opt) {
  const scale = (opt && opt.scale) || 1, a = opt && opt.a != null ? opt.a : 1, upto = opt && opt.upto != null ? opt.upto : 1e9;
  let cx = x, n = 0;
  for (const ch of str) {
    const g = glyph(ch), w = g.w, r = g.r, rows = r.length / 3;
    if (n < upto) {
      for (let j = 0; j < rows; j++) {
        const bits = parseInt(r.substr(j * 3, 3), 16);
        if (!bits) continue;
        for (let i = 0; i < w; i++) {
          if (!((bits >> (w - 1 - i)) & 1)) continue;
          for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
            const X = cx + i * scale + sx, Y = y + j * scale + sy;
            px(X, Y, typeof c === 'function' ? c(X, Y, n) : c, a);
          }
        }
      }
    }
    cx += w * scale; n++;
  }
  return cx - x;
}
function textC(str, y, c, opt) { return text(str, Math.round((COLS - measure(str, opt && opt.scale)) / 2), y, c, opt); }
function ring(cx, cy, r, c, a, th, fn) {
  const t = th || 1;
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d <= r && d > r - t) px(x, y, fn ? fn(x, y) : c, a);
  }
}
function disc(cx, cy, r, c, a) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
    if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) px(x, y, c, a);
}
const hsv = (h, s, v) => { const f = (n) => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5) * 255, f(3) * 255, f(1) * 255]; };
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // 0〜1（決まった値）
const easeOutBack = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : 1 + 2.4 * Math.pow(u - 1, 3) + 1.4 * Math.pow(u - 1, 2));

function render() {
  sctx.putImageData(idata, 0, 0);
  octx.globalCompositeOperation = 'source-over'; octx.globalAlpha = 1;
  octx.drawImage(base, 0, 0);
  hctx.clearRect(0, 0, half.width, half.height); hctx.imageSmoothingEnabled = true;
  hctx.drawImage(src, 0, 0, half.width, half.height);
  octx.globalCompositeOperation = 'lighter'; octx.imageSmoothingEnabled = true;
  octx.globalAlpha = 0.45; octx.drawImage(half, -DOT, -DOT, W + 2 * DOT, H + 2 * DOT);
  octx.globalAlpha = 0.5; octx.drawImage(src, 0, 0, W, H);
  lctx.globalCompositeOperation = 'copy'; lctx.imageSmoothingEnabled = false;
  lctx.drawImage(src, 0, 0, W, H);
  lctx.globalCompositeOperation = 'destination-in'; lctx.drawImage(mask, 0, 0);
  octx.globalAlpha = 1; octx.drawImage(lit, 0, 0);
  octx.globalCompositeOperation = 'source-over';
}

// ---------------- 場面 ----------------
const st = { on: false, t0: 0, ids: [], imgs: {}, raf: 0, lastRender: -1e9, freezeT: null, fired: 0, doneFired: false, onReveal: null, onDone: null };
const T_TITLE = 0.18, T_CHAR = 0.07, T_SLOTS = 0.5, T_FIRST = 1.1, T_EACH = 0.65, T_POP = 0.45;
const Y_TITLE = 5, Y_STK = 47, R_STK = 22, Y_DIGIT = 76, Y_NOTE = 107, Y_PARADE = 124;
const tReveal = (i) => T_FIRST + i * T_EACH;
const tDone = () => (st.ids.length ? tReveal(st.ids.length - 1) + T_POP : T_FIRST);
function slotXs(n) { return n <= 1 ? [COLS / 2] : n === 2 ? [COLS / 2 - 34, COLS / 2 + 34] : [COLS / 2 - 56, COLS / 2, COLS / 2 + 56]; }

// 縁の電飾：外から 1 粒内側の輪を、4 粒に 1 つ光らせて流す（色は 3 色の順）。出そろった瞬間から 1.2 秒は全部の粒がピカピカ
const PER = [];
function marquee(t, since) {
  if (!PER.length) {
    for (let x = 1; x < COLS - 1; x++) PER.push([x, 1]);
    for (let y = 2; y < ROWS - 1; y++) PER.push([COLS - 2, y]);
    for (let x = COLS - 3; x >= 1; x--) PER.push([x, ROWS - 2]);
    for (let y = ROWS - 3; y >= 2; y--) PER.push([1, y]);
  }
  const cols = [PINK, YELLOW, CYAN];
  if (since >= 0 && since < 1.2) {
    const on = Math.floor(since * 8) % 2 === 0;
    for (let i = 0; i < PER.length; i++) px(PER[i][0], PER[i][1], on ? cols[(i >> 1) % 3] : [70, 52, 90], 1);
    return;
  }
  const off = Math.floor(t * 18);
  for (let i = 0; i < PER.length; i++) {
    const k = ((i - off) % 4 + 4) % 4;
    if (k === 0) px(PER[i][0], PER[i][1], cols[Math.floor(((i - off) / 4) % 3 + 3) % 3], 1);
    else if (k === 1) px(PER[i][0], PER[i][1], [70, 52, 90], 1);
  }
}
// 背景のまたたく星（とても薄い）
function twinkle(t) {
  for (let k = 0; k < 46; k++) {
    const x = 3 + Math.floor(hash(k) * (COLS - 6)), y = 3 + Math.floor(hash(k + 99) * (ROWS - 6)), ph = hash(k + 7) * 6.28;
    const a = 0.10 + 0.14 * Math.max(0, Math.sin(t * (1.3 + hash(k + 3)) + ph));
    px(x, y, k % 3 ? WHITE : YELLOW, a);
  }
}
// 紙ふぶき：出そろってから。色とりどりの粒がゆれながら落ちる（t から計算）
function confetti(t, since) {
  if (since <= 0) return;
  const n = 54, cols = [PINK, YELLOW, CYAN, ORANGE, [140, 255, 120], [190, 120, 255]];
  for (let k = 0; k < n; k++) {
    const sp = 9 + hash(k + 21) * 9, y0 = -6 - hash(k + 5) * ROWS;   // はじめは画面の上に並んでいて、順に降りてくる
    let y = y0 + since * sp;
    if (y > ROWS + 2) y = ((y - ROWS - 2) % (ROWS + 8)) - 6;
    const x = 4 + hash(k + 11) * (COLS - 8) + Math.sin(t * (1.6 + hash(k) * 1.4) + k) * 3;
    // ひらひら：横長 → 縦長 → 細くなって消える、をくり返す（くるくる回る紙）
    const c = cols[k % cols.length], ph = Math.sin(t * 6 + k * 1.7);
    if (ph > 0.35) { px(x, y, c, 0.9); px(x + 1, y, c, 0.75); }
    else if (ph > -0.35) { px(x, y, c, 0.9); px(x, y + 1, c, 0.75); }
    else px(x, y, c, 0.45);
  }
}
// 花火：出そろった瞬間に 3 発（ジャーン）、あとは 0.75 秒ごとに 1 発。画面の上半分のどこか（ステッカーの丸の後ろで開く＝丸のまわりに光が散る）
function fireworks(since) {
  if (since <= 0) return;
  const life = 1.35, shots = [[-3, 0], [-2, 0.16], [-1, 0.32]];
  const k1 = Math.floor((since - 0.5) / 0.75);
  for (let k = Math.max(0, k1 - 2); k <= k1; k++) shots.push([k, 0.5 + k * 0.75]);
  for (const [k, at] of shots) {
    const age = since - at;
    if (age < 0 || age > life) continue;
    const u = age / life;
    const cx = 14 + hash(k * 3 + 1) * (COLS - 28), cy = 12 + hash(k * 3 + 2) * 40;
    const h0 = hash(k * 3 + 3), c = hsv(h0, 0.6, 1), c2 = hsv((h0 + 0.12) % 1, 0.35, 1);
    if (age < 0.16) { for (let j = 0; j < 3; j++) px(cx, cy + (0.16 - age) * 70 + j, WHITE, 1 - j * 0.3); continue; }   // 打ち上がる光
    const a = Math.pow(1 - u, 1.6), m = 26, R = 19 + hash(k * 3 + 4) * 8;
    for (let i = 0; i < m; i++) {
      const ang = i / m * Math.PI * 2 + h0 * 6, sp = R * (0.8 + 0.2 * hash(k * 13 + i));
      const r = sp * (1 - Math.exp(-(age - 0.16) * 3.4)), g = 8 * age * age;   // 広がって止まり、少し落ちる
      const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r * 0.9 + g;
      add(x, y, i % 2 ? c : c2, a);
      if (u < 0.55) add(cx + Math.cos(ang) * r * 0.82, cy + Math.sin(ang) * r * 0.74 + g, c2, a * 0.55);   // 尾
      if (u > 0.5 && (i + Math.floor(age * 20)) % 3 === 0) add(x, y + 1, WHITE, a);   // 消えぎわのチカチカ
    }
  }
}
// 下の行列：ぽちゃもんと果物が左から右へ歩く（背面のパネルの行列と同じ顔ぶれ）
const PARADE = ['pocha', 'mikan', 'biroon', 'onigiri', 'pocha', 'lemon', 'ichigo', 'softcream', 'donut', 'heart'];
function parade(t) {
  const gap = 26, total = PARADE.length * gap;
  for (let k = 0; k < PARADE.length; k++) {
    const name = PARADE[k], [w, h] = spriteSize(name);
    const x = Math.round(((k * gap + t * 12) % total + total) % total) - 24;
    if (x > COLS || x + w < 0) continue;
    const hop = name === 'biroon' ? Math.round(Math.sin(t * 2.5 + k) * 2) : -Math.round(Math.abs(Math.sin((t * 2.6 + k * 0.7) * Math.PI)) * 2);
    const blink = name === 'pocha' && ((t + k * 0.9) % 3.3) < 0.15;
    sprite(blink ? 'pocha_blink' : name, x, ROWS - 3 - h + hop);
  }
}
// 題：「けっか はっぴょう！」が 1 字ずつ。両脇の ★ がまたたく。3 枚取れたら、出そろった後に「パーフェクト！」へ
function title(t, since) {
  const perfect = st.ids.length >= 3 && since > 0.25;
  const str = perfect ? 'パーフェクト！' : 'けっか はっぴょう！';
  const scale = 1, w = measure(str, scale), x0 = Math.round((COLS - w) / 2);
  const upto = perfect ? 99 : Math.floor((t - T_TITLE) / T_CHAR) + 1;
  if (upto <= 0) return;
  const shine = (X) => { const s = ((t * 60) % 260) - 40; return Math.abs(X - s) < 5; };
  const col = perfect ? (X) => hsv(((X / COLS) * 1.5 + t * 0.6) % 1, 0.6, 1) : (X) => (shine(X) ? WHITE : YELLOW);
  text(str, x0, Y_TITLE, col, { scale, upto });
  if (upto >= [...str].length) {
    const on = Math.floor(t * 3) % 2;
    text('★', x0 - 18, Y_TITLE, on ? PINK : YELLOW);
    text('★', x0 + w + 6, Y_TITLE, on ? YELLOW : PINK);
  }
}
// 取れたステッカーの丸：出る前は「？」が点滅（ドラムロール）、出る時は白く弾けて光の輪と星
const stk = [];   // 普通の画像で貼る絵柄 { id, cx, cy, r, a, s }
function slots(t) {
  const n = st.ids.length, xs = slotXs(n);
  if (t < T_SLOTS) return;
  for (let i = 0; i < n; i++) {
    const cx = xs[i], cy = Y_STK, tr = tReveal(i), age = t - tr;
    const appear = Math.min(1, (t - T_SLOTS - i * 0.08) / 0.25);
    if (appear <= 0) continue;
    if (age < 0) {
      // まだ：暗い丸と点滅する「？」（出る直前ほど速く）
      ring(cx, cy, R_STK * easeOutBack(appear), DIM, 1, 1.5);
      const fast = age > -0.5 ? 10 : 4;
      if (Math.floor(t * fast) % 2 === 0) text('？', Math.round(cx - 6), Math.round(cy - 7), [170, 160, 200]);
      continue;
    }
    // 出た：白い丸（弾んで出る）＋ふちの輪（色が回る）
    const u = Math.min(1, age / T_POP), e = easeOutBack(u);
    const bob = Math.sin((t - tr) * 2.2 + i) * 0.6;   // ゆっくり上下
    disc(cx, cy + bob, (R_STK - 1.5) * e, DISC, 1);
    ring(cx, cy + bob, (R_STK + 0.6) * e, null, 1, 1.6, (x, y) => hsv(((Math.atan2(y - cy, x - cx) / 6.283) + t * 0.35 + i * 0.2 + 1) % 1, 0.45, 1));
    // 弾けた瞬間の光の輪と星（0.9 秒）
    if (age < 0.9) {
      const v = age / 0.9, rr = R_STK + 2 + v * 18;
      for (let k = 0; k < 40; k++) {
        const ang = k / 40 * Math.PI * 2;
        add(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, k % 2 ? YELLOW : WHITE, (1 - v) * 0.9);
      }
      for (let k = 0; k < 10; k++) {
        const ang = k / 10 * Math.PI * 2 + i, rr2 = R_STK + 4 + v * 26;
        if (v < 0.75) sprite('sparkle', Math.round(cx + Math.cos(ang) * rr2 - 2), Math.round(cy + Math.sin(ang) * rr2 * 0.85 - 2), { a: 1 - v / 0.75, tint: k % 3 ? YELLOW : PINK });
      }
    }
    // ときどき絵柄の上をキラッと光が横切る（描くのは drawAt の絵柄を貼る所）
    const gl = ((t - tr) % 2.6) / 2.6;
    stk.push({ id: st.ids[i], cx, cy: cy + bob, r: (R_STK - 2.4) * e, a: Math.min(1, u * 2.2), shine: age > 0.9 && gl < 0.25 ? gl / 0.25 : -1 });
  }
}
// 「ステッカー ２まい ゲット！」：出そろってから粒がパラパラ点いて出る。数は大きく、ゲット！は虹色の光が流れる
function mainLine(t, since) {
  if (since <= 0) return;
  const n = st.ids.length;
  const num = String.fromCharCode(0xFF10 + Math.min(9, n));
  const a = 'ステッカー', b = 'まい', c = 'ゲット！', gap = 3;
  const wa = measure(a), wn = measure(num, 2), wb = measure(b), wc = measure(c);
  const total = wa + gap + wn + gap + wb + gap + 2 + wc, x0 = Math.round((COLS - total) / 2);
  const yT = Y_DIGIT + 11;   // 1 倍の字の下の端を、2 倍の数の下の端に揃える
  const pulse = since < 0.6 ? (Math.floor(since * 12) % 2 ? WHITE : PINK) : PINK;
  let x = x0;
  x += text(a, x, yT, WHITE) + gap;
  x += text(num, x, Y_DIGIT, (X, Y) => (since > 0.6 && Math.abs(X - x - ((t * 30) % 60) + 18) < 3 ? WHITE : pulse), { scale: 2 }) + gap;
  x += text(b, x, yT, WHITE) + gap + 2;
  text(c, x, yT, (X) => hsv(((X - x) / 60 + t * 0.8) % 1, 0.55, 1));
}
// 「スタッフに みせてね」：出そろってから点滅（両脇に跳ねるぽちゃもんを置いたら、上の行に詰まって窮屈だった＝ぽちゃもんは下の行列だけ）
function note(t, since) {
  if (since < 0.5) return;
  const str = n0() ? 'また あそんでね！' : 'スタッフに みせてね';
  if (((since - 0.5) % 1.0) < 0.78) textC(str, Y_NOTE, CYAN);
}
const n0 = () => st.ids.length === 0;

function drawAt(t) {
  clear(); stk.length = 0;
  const since = t - tDone();
  twinkle(t);
  if (!n0()) { confetti(t, since); fireworks(since); }   // 0 枚（「ざんねん…」）の時はお祝いをしない（11/10 検品）
  marquee(t, n0() ? -1 : since);
  title(t, since);
  if (n0()) { if (t > T_SLOTS) textC('ざんねん…', Y_STK - 7, [200, 190, 230], { scale: 2 }); }
  else slots(t);
  mainLine(t, n0() ? -1 : since);
  note(t, since);
  parade(t);
  // テレビが点く：はじめの 0.4 秒は、粒がばらばらの時刻で点く
  if (t < 0.4) {
    const u = t / 0.4;
    for (let k = 0, m = COLS * ROWS; k < m; k++) if (seedArr[k] > u) { const q = k * 4; buf[q] = buf[q + 1] = buf[q + 2] = 0; buf[q + 3] = 0; }
  }
  if (skipRender) return;
  render();
  // 絵柄（普通の画像）：粒の白い丸の上に、丸の中の 1.62R 四方へ収めて貼る
  for (const s of stk) {
    const im = st.imgs[s.id]; if (!im || s.a <= 0.01 || s.r <= 1) continue;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, R = s.r * DOT, k = 1.62 * R / Math.max(iw, ih);
    const cx = s.cx * DOT, cy = s.cy * DOT;
    octx.save(); octx.globalAlpha = s.a;
    octx.drawImage(im, cx - iw * k / 2, cy - ih * k / 2, iw * k, ih * k);
    if (s.shine >= 0) {   // キラッ：細い斜めの光の帯が丸の上を横切る（太く強くすると絵柄が白く飛んだ）
      octx.beginPath(); octx.arc(cx, cy, R, 0, Math.PI * 2); octx.clip();
      const gx = cx - R * 1.4 + s.shine * R * 2.8, w = R * 0.16;
      const gr = octx.createLinearGradient(gx - w, cy - w * 0.4, gx + w, cy + w * 0.4);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      octx.globalCompositeOperation = 'lighter'; octx.fillStyle = gr; octx.fillRect(cx - R, cy - R, R * 2, R * 2);
    }
    octx.restore();
  }
}

function tick(now) {
  if (!st.on) return;
  st.raf = requestAnimationFrame(tick);
  const t = st.freezeT != null ? st.freezeT : (now - st.t0) / 1000;
  // 音とボタンの合図（t がその時刻を越えた時に 1 回）。画面が裏に回って描画が止まり、戻った時にまとめて越えた分は音を鳴らさない（late）
  while (st.fired < st.ids.length && t >= tReveal(st.fired)) { const i = st.fired++; if (st.onReveal && t - tReveal(i) < 0.5) st.onReveal(i); }
  if (!st.doneFired && t >= tDone()) { st.doneFired = true; if (st.onDone) st.onDone(t - tDone() >= 0.5); }
  if (now - st.lastRender < 1000 / 30 - 2 && now >= st.lastRender && st.freezeT == null) return;   // 秒 30 回に間引く
  st.lastRender = now;
  drawAt(t);
}

window.PochaResult = {
  // 文字と絵（led.js が読んだもの）がそろっていれば使える
  ready() { const L = window.PochaLED; return !!(L && L.font && L.art); },
  show(el, ids, imgs, opt) {
    const L = window.PochaLED;
    if (!this.ready() || !el) return false;
    if (!font) { font = L.font; art = L.art; pal = art.palette; alloc(); }
    if (canvas !== el) { canvas = el; canvas.width = W; canvas.height = H; octx = canvas.getContext('2d'); }
    st.ids = ids.slice(0, 3); st.imgs = imgs || {}; st.t0 = performance.now(); st.fired = 0; st.doneFired = false; st.freezeT = null; st.lastRender = -1e9;
    st.onReveal = opt && opt.onReveal; st.onDone = opt && opt.onDone;
    cancelAnimationFrame(st.raf); st.on = true; st.raf = requestAnimationFrame(tick);
    return true;
  },
  hide() { st.on = false; cancelAnimationFrame(st.raf); },
  // 確かめ用：t 秒の絵で止める（null で動かす）・今の様子
  freeze(t) { st.freezeT = t; if (st.on) drawAt(t); },
  state: () => ({ on: st.on, t: st.freezeT != null ? st.freezeT : (performance.now() - st.t0) / 1000, ids: st.ids.slice(), fired: st.fired, done: st.doneFired, tDone: tDone(), cols: COLS, rows: ROWS }),
  // 1 コマの時間（ms）：全部／粒を置くだけ（光る粒に描き直さない）
  bench(n) {
    const t0 = performance.now(); for (let i = 0; i < n; i++) drawAt(3 + i * 0.033);
    const t1 = performance.now(); skipRender = true; for (let i = 0; i < n; i++) drawAt(3 + i * 0.033); skipRender = false;
    const t2 = performance.now(); for (let i = 0; i < n; i++) render();
    return { all: (t1 - t0) / n, dots: (t2 - t1) / n, render: (performance.now() - t2) / n };
  },
};
})();
