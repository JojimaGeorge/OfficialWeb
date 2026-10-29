/* ぽちゃもん UFOキャッチャー
 * Blender で描いた筐体の1枚絵の上で、書き出したぬいぐるみ（1体ずつ）とアームの絵を動かす 2D ゲーム。
 * 座標は筐体の中のメートル（x 右・y 奥・z 上）。画面への投影は scene.json のカメラ行列で行う。
 *
 * ルール：3回チャレンジ。3回のうち2回は必ず取れる（確定枠）、残り1回は確率 p で取れる（運枠）。
 * 取れた数だけステッカー。運枠が何回目かは設定（毎回ランダム／1回目／3回目）。
 */
(() => {
'use strict';

// ---------------- 設定（スタッフ用・端末に保存） ----------------
const LS_KEY = 'pochamon-ufo-settings-v1';
const DEFAULTS = { luckP: 0.3, luckSlot: 'random', volume: 0.8, speed: 1.0, muted: false, counters: {} };
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return Object.assign({}, DEFAULTS, s, { counters: Object.assign({}, s.counters || {}) });
  } catch (e) { return Object.assign({}, DEFAULTS, { counters: {} }); }
}
function saveSettings() { try { localStorage.setItem(LS_KEY, JSON.stringify(settings)); } catch (e) { /* private mode */ } }
const settings = loadSettings();
const CFG_LAYOUT_OVERRIDE = {};
const qs = new URLSearchParams(location.search);
if (qs.get('p')) settings.luckP = Math.max(0, Math.min(1, parseFloat(qs.get('p'))));
if (qs.get('slot')) settings.luckSlot = qs.get('slot');
// 配置の比較用（確認の時だけ）：?edge=0.018&gap=0.012&conh=0.9
for (const [q, key] of [['edge', 'edge'], ['gap', 'gap'], ['conh', 'conH']]) if (qs.get(q) != null && !isNaN(parseFloat(qs.get(q)))) CFG_LAYOUT_OVERRIDE[key] = parseFloat(qs.get(q));
const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

// ---------------- 動きの定数（メートル・秒） ----------------
const CFG = {
  tries: 3,
  moveSpeed: 0.16,      // 台車の速さ
  moveAccel: 3.0,       // 台車の加減速（急に止まるほど揺れる）
  driftSpeed: 0.10,     // 下降中に一番近い子へ寄る速さ（×速さ設定。残りは持ち上げ最初の0.3秒でなじませる）
  idleBackSec: 90,      // 操作が無いままこの秒数でタイトルへ
  descendSpeed: 0.30,
  liftSpeed: 0.24,
  carrySpeed: 0.16,
  raisedZ: 0.63,        // 上げ切った時の円盤の高さ（ケーブル 10cm ぶん垂れる＝揺れが見える）
  padDz: -0.14,         // 円盤の中心から爪先（当たる所）までの高さ
  holdDzToy: 0.05,      // ぬいぐるみの一番上から、つかむ点までの深さ（×scale）
  armOpen: -18, armHold: 0, armHoldBig: -7, armClosed: 16, armRate: 95,   // 度・度/秒
  dampFree: 0.9, dampHeld: 1.3, dampGround: 9,
  g: 9.81,
  slipMin: 0.30, slipMax: 0.72,   // 運枠で外す時、持ち上げのどの辺で落とすか
  coinSize: 0.17,       // 手に持ったコインの直径（画面の高さに対する割合。iPad 768px で約130px＝実物の500円玉に近い）
  coinAtSlit: 0.85,     // 投入口のそばでのコインの直径（投入口の縦幅に対する割合＝遠近で小さくなって口に入る）
  holdSec: 0.75,        // 上げ切った後に止まっている時間（本物のUFOキャッチャーの「間」）
  layout: { edge: 0.018, gap: 0.012, conH: 0.9 },   // 画面の端の余白・操作盤と筐体の隙間（幅に対する割合）・操作盤の高さ（筐体の絵の高さに対する割合。配置 A＝0.9・2026-10-29 本人「やっぱり配置A」。B は 1.0）
  bulbStep: 0.22,       // 電球の追いかけ点灯の1コマ（秒）
  bgmVol: 0.5,          // BGM の音量（効果音に対する割合）
  slump: 0.55,          // 持ち上げた子の上に乗っていた子が穴へ沈む深さ（持ち上げた子の高さに対する割合）
  shadowAlpha: 0.6,     // UFO の影の濃さ（Blender の影そのままだと絵の上で穴に見える）
  clawShadow: false,    // UFO の影を描くか（2026-10-29 本人「不自然だから一旦消す」＝止めている。絵と仕組みは残す）
};
Object.assign(CFG.layout, CFG_LAYOUT_OVERRIDE);

// ---------------- DOM ----------------
const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const ctx = canvas.getContext('2d', { alpha: true });
const ui = {
  coin: $('coin'), coinImg: $('coinImg'), titleCard: document.querySelector('.title-card'),
  msg: $('msg'), guide: $('guide'), btnX: $('btnX'), btnY: $('btnY'),
  title: $('title'), result: $('result'), loading: $('loading'), loadProg: $('loadProg'), admin: $('admin'),
  resultNum: $('resultNum'), resultStickers: $('resultStickers'), resultBtn: $('resultBtn'), muteBtn: $('muteBtn'),
};

// ---------------- 状態 ----------------
let scene = null;          // scene.json
let CAM = null, MC = null, UNIT = 1;
const img = { bg: null };
const toys = [];           // 実行時のぬいぐるみ
let clawSheets = [];       // アームのコマ表：{ img, z, frames: [{ angle, x, y, w, h, ax, ay, depth }] }（高さの昇順）
let clawHeights = [];
let clawShadows = [];      // UFO の影（Blender で床に落とした絵）：{ img, h, angle, anchor, depth }
let bulbTiles = [];        // 梁の電球の点灯の絵：{ img, i, rect }
const cab = {};            // 筐体の画面上の線（絵の px）：beamV（梁の下の縁）・railTopV/railBotV（手前のレール）・floorV（床の線）
const view = { dpr: 1, cw: 0, ch: 0, k: 1, ox: 0, oy: 0 };
const input = { x: false, y: false, pressedX: false, pressedY: false, xId: null, yId: null };
const claw = { cx: 0, cy: 0, vx: 0, vy: 0, L: 0.07, thx: 0, thy: 0, wx: 0, wy: 0, x: 0, y: 0, z: 0,
               arm: 16, armTarget: 16, held: null, damp: 0.9, cableTop: 0.73 };
const game = { phase: 'loading', phaseT: 0, tryIndex: 0, got: 0, slots: [], outcome: null, target: null,
               zTarget: 0, slipAt: 0, settleTarget: null, liftStartL: 0, timeScale: 1, lastInputAt: 0 };
let park = { x: 0, y: 0 };
let bounds = null;
let chuteClip = null;      // 画面上の多角形（景品口の「窓」）

// ---------------- 小道具 ----------------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const approach = (v, target, step) => v < target ? Math.min(target, v + step) : Math.max(target, v - step);
const lerp = (a, b, t) => a + (b - a) * t;
function project(x, y, z) {
  const m = MC;
  const cx = m[0] * x + m[1] * y + m[2] * z + m[3];
  const cy = m[4] * x + m[5] * y + m[6] * z + m[7];
  const cz = m[8] * x + m[9] * y + m[10] * z + m[11];
  const d = -cz;
  return { u: CAM.cx + CAM.fx * cx / d, v: CAM.cy - CAM.fy * cy / d, d };
}
// 長さ（m）を、その奥行きでの画面の px（画像の px）に
const lenPx = (len, d) => len * UNIT * CAM.fx / d;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------------- 音（WebAudio で合成・ファイル無し） ----------------
const audio = (() => {
  let ac = null, master = null, motor = null, motorGain = null;
  const ok = () => ac && !settings.muted;
  function unlock() {
    if (ac) { if (ac.state !== 'running') ac.resume().catch(() => {}); return; }   // WebKit は 'interrupted' もある
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = settings.volume; master.connect(ac.destination);
    } catch (e) { ac = null; }
    if (ac) decodeBgm();
  }
  function setVolume(v) { if (master) master.gain.value = v; }
  function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, when = 0) {
    if (!ok()) return;
    const t0 = ac.currentTime + when;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol = 0.3, freq = 800, q = 0.8, when = 0) {
    if (!ok()) return;
    const t0 = ac.currentTime + when;
    const n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(); s.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t0);
  }
  function motorOn(pitch = 1) {
    if (!ok()) return;
    if (!motor) {
      motor = ac.createOscillator(); motor.type = 'sawtooth';
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      motorGain = ac.createGain(); motorGain.gain.value = 0;
      motor.connect(lp); lp.connect(motorGain); motorGain.connect(master); motor.start();
    }
    motor.frequency.setTargetAtTime(72 * pitch, ac.currentTime, 0.05);
    motorGain.gain.setTargetAtTime(0.10, ac.currentTime, 0.04);
  }
  function motorOff() { if (motorGain) motorGain.gain.setTargetAtTime(0, ac.currentTime, 0.08); }
  // BGM（assets/bgm.mp3）：コインを入れたら切れ目なくループ、タイトルに戻ったら消える。
  // バイト列は最初に取っておき、最初の操作（AudioContext ができた時）に復号する。buffer source の loop は継ぎ目に隙間が出ない
  let bgmBytes = null, bgmBuf = null, bgmCur = null, bgmWant = false, bgmDecoding = false;   // bgmCur = { src, gain }（音源ごとに音量の節＝止めた直後に始めても二重に鳴らない）
  fetch('assets/bgm.mp3').then((r) => r.arrayBuffer()).then((b) => { bgmBytes = b; decodeBgm(); }).catch(() => {});
  function decodeBgm() {
    if (!ac || !bgmBytes || bgmBuf || bgmDecoding) return;
    bgmDecoding = true;
    try {
      const p = ac.decodeAudioData(bgmBytes.slice(0), (buf) => { bgmBuf = buf; bgmDecoding = false; if (bgmWant) bgmStart(); }, () => { bgmDecoding = false; });
      if (p && p.catch) p.catch(() => {});   // 失敗（壊れたファイル等）は無音で続ける（未処理の例外にしない）
    } catch (e) { bgmDecoding = false; }
  }
  function bgmStart() {
    bgmWant = true;
    if (!ac || !bgmBuf || bgmCur) return;
    const gain = ac.createGain(); gain.connect(master);
    const now = ac.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(settings.muted ? 0.0001 : CFG.bgmVol, now + 0.6);
    const src = ac.createBufferSource(); src.buffer = bgmBuf;
    src.loop = true; src.loopStart = 0; src.loopEnd = Math.min(bgmBuf.duration, 182.72);   // 尻の無音 0.6 秒を飛ばしてつなぐ
    src.connect(gain); src.start();
    bgmCur = { src, gain };
  }
  function bgmStop() {
    bgmWant = false;
    if (!bgmCur) return;
    const { src, gain } = bgmCur, now = ac.currentTime; bgmCur = null;
    gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    setTimeout(() => { try { src.stop(); } catch (e) { /* already stopped */ } try { gain.disconnect(); } catch (e) { /* ignore */ } }, 800);
  }
  function bgmMute(m) { if (bgmCur && ac) bgmCur.gain.gain.setTargetAtTime(m ? 0.0001 : CFG.bgmVol, ac.currentTime, 0.05); }
  return {
    unlock, setVolume, motorOn, motorOff, bgmStart, bgmStop, bgmMute,
    bgmState: () => ({ loaded: !!bgmBuf, playing: !!bgmCur, want: bgmWant }),
    tap: () => tone(880, 0.08, 'square', 0.12),
    clack: () => { noise(0.07, 0.5, 1800, 1.2); tone(220, 0.09, 'triangle', 0.25, 120); },
    bump: () => { noise(0.12, 0.35, 300, 0.7); },
    whir: () => tone(160, 0.25, 'triangle', 0.08, 190),
    slip: () => { tone(900, 0.45, 'sine', 0.25, 260); tone(1200, 0.3, 'triangle', 0.12, 400, 0.05); },
    thud: () => { noise(0.18, 0.5, 180, 0.6); tone(90, 0.18, 'sine', 0.35, 50); },
    drop: () => { noise(0.25, 0.4, 420, 0.5); tone(140, 0.25, 'sine', 0.3, 60); },
    win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'square', 0.16, null, i * 0.11)); tone(1568, 0.5, 'triangle', 0.14, null, 0.46); },
    miss: () => { tone(392, 0.25, 'triangle', 0.18); tone(330, 0.4, 'triangle', 0.18, null, 0.22); },
    fanfare: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, 'square', 0.15, null, i * 0.12)); },
    // 操作盤：コインの投入（チャリン）・クレジットの点灯（ピッ）・コインの返却（ガチャン）・ボタンのカチッ
    coinClink: () => { noise(0.05, 0.35, 5200, 2.5); tone(4200, 0.22, 'sine', 0.10, 3000); tone(6300, 0.16, 'triangle', 0.05, 5200, 0.015); tone(2600, 0.12, 'sine', 0.06, 2200, 0.05); },
    creditBeep: () => { tone(1568, 0.08, 'square', 0.10); tone(2093, 0.14, 'square', 0.10, null, 0.09); },
    coinReturn: () => { noise(0.10, 0.35, 1200, 0.9); tone(240, 0.10, 'triangle', 0.22, 150); tone(3600, 0.12, 'sine', 0.05, 2800, 0.06); },
    click: () => { noise(0.025, 0.2, 2600, 1.6); tone(760, 0.04, 'square', 0.05); },
  };
})();

// ---------------- 読み込み ----------------
function loadImage(src) {
  return new Promise((ok, ng) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ng(new Error('load ' + src)); im.src = src; });
}
async function load() {
  const res = await fetch('assets/scene.json');
  scene = await res.json();
  CAM = scene.camera;
  MC = scene.camera.m_cam.flat();
  UNIT = Math.hypot(MC[0], MC[4], MC[8]);
  claw.cableTop = scene.machine.cable.top_z;
  park = { x: scene.machine.claw.park[0], y: scene.machine.claw.park[1] };
  bounds = scene.machine.play_bounds;
  const jobs = [];
  let done = 0, total = 0;
  const track = (p) => { total++; return p.then((v) => { done++; ui.loadProg.textContent = done + ' / ' + total; return v; }); };
  jobs.push(track(loadImage('assets/' + (scene.files && scene.files.bg || 'bg.png'))).then((im) => { img.bg = im; }));
  const byId = {};
  for (const t of scene.toys) {
    const hold = { x: t.grab[0], y: t.grab[1], z: t.ztop - CFG.holdDzToy * t.scale };
    const toy = { id: t.id, data: t, state: 'rest', dx: 0, dy: 0, dz: 0, vz: 0, rot: 0, hang: 0, sag: 0, alpha: 1, shadowA: 1,
                  img: null, shImg: null, hold, holdUV: project(hold.x, hold.y, hold.z), below: hold.z - t.zbottom, armHold: t.scale > 1.15 ? CFG.armHoldBig : CFG.armHold };
    byId[t.id] = toy;
    jobs.push(track(loadImage('assets/' + t.sprite.file)).then((im) => { toy.img = im; }));
    if (t.shadow) jobs.push(track(loadImage('assets/' + t.shadow.file)).then((im) => { toy.shImg = im; }));
  }
  for (const id of scene.order) toys.push(byId[id]);   // 奥 → 手前
  // アームの絵：高さごとのコマ表（claw_sheets・2度きざみ）。無ければ古い1枚ずつの絵（claw_sprites）
  if (scene.claw_sheets) {
    for (const sh of scene.claw_sheets) {
      const sheet = { img: null, z: sh.z, frames: sh.frames.slice().sort((a, b) => a.angle - b.angle) };
      clawSheets.push(sheet);
      jobs.push(track(loadImage('assets/' + sh.file)).then((im) => { sheet.img = im; }));
    }
  } else {
    for (const c of scene.claw_sprites) {
      let sheet = clawSheets.find((s) => s.z === c.z);
      if (!sheet) { sheet = { img: null, z: c.z, frames: [] }; clawSheets.push(sheet); }
      const fr = { angle: c.angle, x: 0, y: 0, w: c.size[0], h: c.size[1], ax: c.anchor[0], ay: c.anchor[1], depth: c.depth, img: null };
      sheet.frames.push(fr);
      jobs.push(track(loadImage('assets/' + c.file)).then((im) => { fr.img = im; }));
    }
    for (const s of clawSheets) s.frames.sort((a, b) => a.angle - b.angle);
  }
  clawSheets.sort((a, b) => a.z - b.z);
  clawHeights = clawSheets.map((s) => s.z);
  // UFO の影（高さ × 開き具合）
  for (const sh of (scene.claw_shadows || [])) {
    if (!sh.file) continue;   // その高さでは影が写らない（天井の光が大きい＝高い所の影は散って消える）
    const spr = { img: null, h: sh.h, angle: sh.angle, anchor: sh.anchor, depth: sh.depth };
    clawShadows.push(spr);
    jobs.push(track(loadImage('assets/' + sh.file)).then((im) => { spr.img = im; }));
  }
  clawShadows.sort((a, b) => a.h - b.h || a.angle - b.angle);
  // 梁の電球（点灯の絵。消えた絵は背景に描いてある）
  for (const t of ((scene.bulbs && scene.bulbs.tiles) || [])) {
    const tile = { img: null, i: t.i, rect: t.rect, blend: t.blend };
    bulbTiles.push(tile);
    jobs.push(track(loadImage('assets/' + t.file)).then((im) => { tile.img = im; }));
  }
  // 左右の操作盤：絵（本体・キャップ・光る輪・コイン）と部品の画面上の位置
  jobs.push(track(fetch('assets/console.json').then((r) => r.json())).then((c) => {
    con.data = c;
    return Promise.all(Object.entries(c.sprites).map(([key, spr]) => track(loadImage('assets/' + spr.file)).then((im) => { con.img[key] = im; })));
  }));
  // 右下で見物しているぽちゃもん（顔のパーツ）
  jobs.push(track(fetch('assets/face.json').then((r) => r.json())).then((f) => {
    faceUI.data = f;
    return Promise.all(Object.entries(f.files).map(([key, file]) => track(loadImage('assets/' + file)).then((im) => { faceUI.img[key] = im; })));
  }));
  // フォントは先に読む：電光表示のラベルを canvas に描くため／題字（Cherry Bomb One）が届く前に札の高さを測るとコインの定位置がずれるため
  if (document.fonts && document.fonts.load) {
    jobs.push(track(Promise.all(['900 20px "Zen Maru Gothic"', '700 20px "Zen Maru Gothic"', '400 20px "Cherry Bomb One"'].map((f) => document.fonts.load(f).catch(() => {})))));
    document.fonts.addEventListener('loadingdone', () => layoutConsoles());   // 保険：遅れて届いたら置き直す
  }
  await Promise.all(jobs);
  // 景品口の「窓」：手前のふちから上に開いた四角（床より下に落ちた分を隠す）
  const ch = scene.machine.chute;
  chuteClip = [project(ch.x0, ch.y0, 0), project(ch.x1, ch.y0, 0), project(ch.x1, ch.y1, 0.5), project(ch.x0, ch.y1, 0.5)];
  // 筐体の線（絵の px）：手前の梁の下の縁（これより上は梁の裏）・手前のレールの上下（レールの裏に隠れる帯）・床の線（操作盤の足を揃える）
  const m = scene.machine;
  cab.beamV = project(0, m.front - 0.05, 0.815).v;
  cab.railTopV = project(0, m.rails.y_front, m.rails.z + m.rails.radius).v;
  cab.railBotV = project(0, m.rails.y_front, m.rails.z - m.rails.radius).v;
  cab.floorV = project(0, m.front - 0.03, -0.08).v;
  buildSupports();
}

// ---------------- 画面サイズ ----------------
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = window.innerWidth, ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  view.dpr = dpr; view.cw = cw; view.ch = ch;
  if (!scene) return;
  const W = scene.image.width, H = scene.image.height, LY = CFG.layout;
  // 筐体はまんなか・絵の下端を画面の下端に揃える（胴体は画面の下で切れる）。両脇の操作盤は筐体の絵と同じ高さ（配置 B・2026-10-29 本人が選択）＝天井を絵の上端、足の底を画面の下端に。
  // 横に入り切らない時（4:3 の iPad）は筐体を少し縮めて、端の余白と隙間を保つ
  const edge = cw * LY.edge, gap = cw * LY.gap;
  const bodyPx = con.data ? ((con.data.L.foot_bottom || con.data.L.bottom_edge) - con.data.L.top_edge) : 0;   // 操作盤の本体（天井から足の底まで・frame px）
  const conWperK = (con.data && bodyPx) ? con.data.sprites.console_L.rect[2] * H * LY.conH / bodyPx : 0;   // 筐体の k=1 のときの操作盤の幅
  view.k = Math.min(ch / H, (cw - 2 * edge - 2 * gap) / (W + 2 * conWperK));
  const imgW = W * view.k, imgH = H * view.k;
  view.ox = (cw - imgW) / 2;
  view.oy = 0;   // 上端に揃える（本人の指示＝上に隙間を作らない）。4:3 で出る下の空きは draw() が胴体の端の1行を伸ばして埋める
  document.documentElement.style.setProperty('--machine-left', view.ox + 'px');
  document.documentElement.style.setProperty('--machine-width', imgW + 'px');
  layoutConsoles();
}
window.addEventListener('resize', resize, { passive: true });
window.addEventListener('orientationchange', () => setTimeout(resize, 60), { passive: true });

// ---------------- 左右の操作盤（Blender で描いた絵・ボタンのキャップ・電光表示・コイン） ----------------
// console.json の座標は描き出しの枠（frame）のピクセル。各操作盤は自分の切り抜き rect ぶんずらして画面に置く
const con = { data: null, img: {}, L: null, R: null, flash: {} };
function conPt(side, p) { const c = con[side]; return { x: c.x + (p[0] - c.rect[0]) * c.k, y: c.y + (p[1] - c.rect[1]) * c.k }; }
function conRect(side, r) { const c = con[side]; return { x: c.x + (r[0] - c.rect[0]) * c.k, y: c.y + (r[1] - c.rect[1]) * c.k, w: r[2] * c.k, h: r[3] * c.k }; }
function layoutConsoles() {
  if (!con.data || !scene) return;
  const cw = view.cw, LY = CFG.layout;
  const rect = con.data.sprites.console_L.rect, L = con.data.L;   // 左右は同じ大きさ
  const bodyPx = (L.foot_bottom || L.bottom_edge) - L.top_edge;
  const k = scene.image.height * view.k * LY.conH / bodyPx, w = rect[2] * k, h = rect[3] * k;   // 天井の上端〜足の底＝筐体の絵の高さ × conH（A＝0.9）
  const gap = cw * LY.gap;
  const y = view.ch - ((L.foot_bottom || L.bottom_edge) - rect[1]) * k;   // 足の底を画面の下端に（A では天井が梁より一段低くなる）
  con.L = { x: view.ox - gap - w, y, w, h, k, rect };
  con.R = { x: view.ox + scene.image.width * view.k + gap, y, w, h, k, rect: con.data.sprites.console_R.rect };
  // ボタンの押す場所（HTML）をキャップの上に重ねる。文字の大きさはキャップの半径
  for (const key of ['X', 'Y']) {
    const b = con.data.R['btn' + key], c = conPt('R', b.c), r = b.r_cap * k, el = ui['btn' + key];
    el.style.left = (c.x - r) + 'px'; el.style.top = (c.y - r) + 'px'; el.style.width = el.style.height = (2 * r) + 'px'; el.style.fontSize = r + 'px';
  }
  con.L.cache = con.R.cache = null;   // 大きさが変わったので描き溜めを作り直す
  coinUI.layout();
  faceUI.layout();
}
function label(g, text, cx, baseY, px, color) {
  g.save();
  g.font = '900 ' + px + 'px "Zen Maru Gothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = color || 'rgba(59,42,74,.85)'; g.fillText(text, cx, baseY);
  g.restore();
}
// 動かない部分（足もとの影・本体の絵・板に印刷したラベル）は resize のたびに別の canvas へ描き溜めて、毎フレームは1枚貼るだけにする
function bakeConsole(side) {
  const c = con[side], im = con.img['console_' + side];
  if (!c || !im) return null;
  const pad = Math.ceil(c.w * 0.35), dpr = view.dpr;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil((c.w + pad * 2) * dpr); cv.height = Math.ceil((c.h + pad * 2) * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = c.w * 0.18; g.shadowOffsetY = c.w * 0.06;
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(pad + c.w * 0.08, pad + c.h * 0.03, c.w * 0.84, c.h * 0.96); g.restore();
  g.drawImage(im, pad, pad, c.w, c.h);
  if (side === 'L') {
    const L = con.data.L, ox = pad - c.x, oy = pad - c.y;
    for (const [key, text] of [['tries', 'のこり'], ['got', 'ゲット']]) {
      const r = conRect('L', L['bezel_' + key] || L['led_' + key]);   // 黒い縁の上端から frame 16px 上に基線（縁にめり込まない）
      label(g, text, r.x + r.w / 2 + ox, r.y - c.k * 16 + oy, c.k * 46);
    }
    const sp = conRect('L', L.slot_plate); label(g, 'コイン', sp.x + sp.w / 2 + ox, sp.y - c.k * 18 + oy, c.k * 48);
  }
  return { canvas: cv, x: c.x - pad, y: c.y - pad, w: c.w + pad * 2, h: c.h + pad * 2 };
}
// 7セグ：1×2 の箱の中の7本（a 上・b 右上・c 右下・d 下・e 左下・f 左上・g 中）。線の太さは箱の幅の 22%
const SEGS = { a: [0.1, 0, 0.8, 0.22], b: [0.78, 0.06, 0.22, 0.9], c: [0.78, 1.04, 0.22, 0.9], d: [0.1, 1.78, 0.8, 0.22], e: [0, 1.04, 0.22, 0.9], f: [0, 0.06, 0.22, 0.9], g: [0.1, 0.89, 0.8, 0.22] };
const DIGIT = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
function draw7seg(x, y, w, h, digit, alpha, color) {
  const lit = DIGIT[digit] || '';
  const gap = Math.max(0.5, w * 0.045);   // 線どうしの隙間。大きさに比例させる（固定の px だと小さい画面で線が消える）
  ctx.save();
  try {
    ctx.translate(x + w / 2, y + h / 2); ctx.transform(1, 0, -0.1, 1, 0, 0); ctx.translate(-(x + w / 2), -(y + h / 2));   // 少し斜体（本物の数字管の癖）
    for (const s in SEGS) {
      const [ux, uy, uw, uh] = SEGS[s];
      const on = lit.includes(s) && alpha > 0;
      const px = x + ux * w + gap, py = y + uy * (h / 2) + gap;
      const pw = Math.max(1, uw * w - 2 * gap), ph = Math.max(1, uh * (h / 2) - 2 * gap);
      ctx.globalAlpha = on ? alpha : 0.10; ctx.fillStyle = color;
      ctx.shadowColor = on && alpha > 0.5 ? color : 'transparent'; ctx.shadowBlur = on ? w * 0.25 : 0;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, Math.max(0, Math.min(pw, ph) / 2)); else ctx.rect(px, py, pw, ph);
      ctx.fill();
    }
  } finally { ctx.restore(); }
}
// 電球 i がいま点いているか：3つに1つが順に流れる（ゲーセンの看板）。ゲット！の直後は全部が速く点滅
let frameNow = 0;   // draw() の頭で1回だけ取る時刻（梁と操作盤で同じ値を使う＝点滅がずれない）
function bulbLit(i, step) {
  if (game.flashUntil && frameNow < game.flashUntil) return Math.floor(frameNow / 90) % 2 === 0;
  return ((i + step) % 3 + 3) % 3 === 0;
}
function drawLed(r, value, key) {
  const h = r.h * 0.76, w = h * 0.56, x = r.x + (r.w - w) / 2, y = r.y + (r.h - h) / 2;
  let alpha = value == null ? 0 : 1;   // null は消灯（薄く 8 が見える＝本物の消えた数字管）
  const f = con.flash[key];
  if (f != null) { const dt = (performance.now() - f) / 1000; if (dt < 0.9) { if (Math.floor(dt / 0.15) % 2) alpha = 0.12; } else delete con.flash[key]; }
  draw7seg(x, y, w, h, value == null ? 8 : value, alpha, '#ff3b30');
}
function drawConsoles() {
  if (!con.L || !con.img.console_L) return;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.globalAlpha = 1;
  for (const side of ['L', 'R']) {
    const c = con[side], im = con.img['console_' + side];
    if (!c.cache) c.cache = bakeConsole(side);
    if (c.cache) ctx.drawImage(c.cache.canvas, c.cache.x, c.cache.y, c.cache.w, c.cache.h);
    const bottom = c.y + c.h;   // 4:3 で出る下の空き：足の端の1行を画面の下端まで伸ばす
    if (im && view.ch > bottom + 0.5) ctx.drawImage(im, 0, im.height - 1, im.width, 1, c.x, bottom - 0.5, c.w, view.ch - bottom + 1);
  }
  const t = frameNow / 1000;
  // 天井の電球：筐体の梁と同じ追いかけ点灯。番号は左の操作盤 0〜2 → 梁 3〜13 → 右の操作盤 14〜16 で一続き。
  // 点灯の絵は「点灯−消灯」の差分なので足し算（lighter）で貼る（縁に継ぎ目が出ない）
  const step = Math.floor(t / CFG.bulbStep);
  for (const side of ['L', 'R']) {
    const list = con.data[side].bulbs || [];
    for (let i = 0; i < list.length; i++) {
      if (!bulbLit(side === 'R' ? i + 14 : i, step)) continue;
      const spr = con.data.sprites[list[i].sprite], im = con.img[list[i].sprite]; if (!im) continue;
      const r = conRect(side, spr.rect);
      ctx.save(); if (spr.blend === 'lighter') ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(im, r.x, r.y, r.w, r.h); ctx.restore();
    }
  }
  // ボタン：押す番は蓋そのものが光る（中の電球）＋輪が脈打つ＋まわりにほのかな光。押している間は沈んだ絵
  for (const key of ['X', 'Y']) {
    const el = ui['btn' + key];
    const active = el.classList.contains('active'), pressed = el.classList.contains('pressed');
    const pulse = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 1.1);
    if (active) {
      const b = con.data.R['btn' + key], c = conPt('R', b.c), rr = b.r_bezel * con.R.k * 1.8;
      const grd = ctx.createRadialGradient(c.x, c.y, b.r_cap * con.R.k * 0.5, c.x, c.y, rr);
      grd.addColorStop(0, 'rgba(255,120,175,' + (0.28 + 0.22 * pulse).toFixed(3) + ')'); grd.addColorStop(1, 'rgba(255,120,175,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (con.img['ring' + key]) {
        const r = conRect('R', con.data.sprites['ring' + key].rect);
        ctx.save(); ctx.globalAlpha = 0.65 + 0.35 * pulse; ctx.shadowColor = 'rgba(255,110,165,.95)'; ctx.shadowBlur = r.w * 0.14;
        ctx.drawImage(con.img['ring' + key], r.x, r.y, r.w, r.h); ctx.restore();
      }
    }
    const base = 'cap' + key + (pressed ? '_down' : '_up');
    const name = active && con.img[base + '_lit'] ? base + '_lit' : base;
    if (con.img[name]) { const cr = conRect('R', con.data.sprites[name].rect); ctx.drawImage(con.img[name], cr.x, cr.y, cr.w, cr.h); }
  }
  // 電光表示（のこり・ゲット）。コインが入った瞬間からクレジットとして点く（phase が変わる前でも）
  const L = con.data.L, inPlay = game.phase !== 'title' && game.phase !== 'loading';
  drawLed(conRect('L', L.led_tries), inPlay ? CFG.tries - game.tryIndex : (con.credit ? CFG.tries : null), 'tries');
  drawLed(conRect('L', L.led_got), inPlay ? game.got : (con.credit ? 0 : null), 'got');
  // タイトル中：投入口がやわらかく光って「ここに入れる」を教える
  if (game.phase === 'title' && coinUI.state !== 'inserting') {
    const sl = conRect('L', L.slit), g = 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 1.2));
    const cx = sl.x + sl.w / 2, cy = sl.y + sl.h / 2, rr = sl.h * 0.9;
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
    grd.addColorStop(0, 'rgba(255,170,205,' + g + ')'); grd.addColorStop(1, 'rgba(255,170,205,0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
  }
}
// コイン：タイトルの札の真下にある → 持つと縦向きになる → 投入口へドラッグして離すと入る（チャリン）→ 表示が点く → スタート。
// 「おしまい」で次の子のために札の下へ戻る。左の操作盤のトレーは返却口の飾り
const easeOut = (u) => 1 - Math.pow(1 - u, 3);
const coinUI = {
  state: 'hidden',   // hidden | home | drag | inserting | returning
  frame: 0, pos: { x: 0, y: 0 }, size: 1, frames: null, slit: null, slotZone: null, grab: null, timers: [], dragT: 0,
  D: 120, slitSize: 0.3,
  layout() {
    if (!con.L) return;
    const L = con.data.L;
    // コインの絵は console の描き出しの中で 2 倍の大きさで描いてある（細部のため）。画面での直径は画面の高さから決める
    const keys = Object.keys(con.data.sprites).filter((n) => /^coin_\d\d$/.test(n)).sort();
    this.D = clamp(view.ch * CFG.coinSize, 96, 200);
    const s = this.D / (2 * (L.coin_r_px || con.data.sprites[keys[0]].rect[2] / 2));   // 絵の px → 画面 px
    this.frames = keys.map((n) => { const spr = con.data.sprites[n]; return { key: n, deg: spr.deg || 0, w: spr.rect[2] * s, h: spr.rect[3] * s }; });
    const sl = conRect('L', L.slit), sp = conRect('L', L.slot_plate);
    this.slit = { x: sl.x + sl.w / 2, y: sl.y, h: sl.h };
    this.slitSize = clamp(sl.h * CFG.coinAtSlit / this.D, 0.12, 1);   // 投入口のそばでの縮尺＝手元から板の上へ（遠近）
    this.slotZone = { x: sp.x - sp.w * 0.5, y: sp.y - sp.h * 0.3, w: sp.w * 2, h: sp.h * 1.5 };   // この中で離すと入る
    // 定位置にある（戻る途中も）コインは新しい置き場へ。投入中は毎フレーム投入口を読み直すのでここでは触らない
    if (this.state === 'home' || this.state === 'returning') { const h = this.home(); this.place(h.x, h.y, 0, 1); ui.coin.classList.remove('hidden'); if (this.state === 'home') ui.coin.classList.add('bob'); }
  },
  home() {   // 定位置＝タイトルの札の真下・筐体のまんなか（札は flex でまんなか寄せなので、下端＝(画面の高さ＋札の高さ)/2）
    const mW = scene ? scene.image.width * view.k : view.cw;
    const cardH = ui.titleCard.offsetHeight || view.ch * 0.45;
    const y = (view.ch + cardH) / 2 + view.ch * 0.03 + this.frames[0].h / 2;
    return { x: view.ox + mW / 2, y: Math.min(y, view.ch - this.frames[0].h * 0.6 - 6) };
  },
  frameFor(deg) {   // 向き（度）に一番近い絵
    let best = 0;
    for (let i = 1; i < this.frames.length; i++) if (Math.abs(this.frames[i].deg - deg) < Math.abs(this.frames[best].deg - deg)) best = i;
    return best;
  },
  clearTimers() { for (const id of this.timers) clearTimeout(id); this.timers = []; },
  place(cx, cy, frame, size) {   // 中心の座標で置く。frame は向きの絵、size は縮尺（1＝手に持った大きさ）
    const f = this.frames[frame];
    if (frame !== this.frame || !ui.coinImg.getAttribute('src')) { this.frame = frame; const im = con.img[f.key]; if (im) ui.coinImg.src = im.src; }
    if (size != null) this.size = size;
    const w = f.w * this.size, h = f.h * this.size;
    ui.coin.style.width = w + 'px'; ui.coin.style.height = h + 'px';
    ui.coin.style.transform = 'translate(' + (cx - w / 2) + 'px,' + (cy - h / 2) + 'px)';
    this.pos = { x: cx, y: cy };
  },
  // ドラッグ中の見え方：投入口に近づくほど小さく（手元から板の上へ）、向きも寝ていく（30°→60°→75°→90°）
  dragPose(cx, cy) {
    const d = Math.hypot(cx - this.slit.x, cy - (this.slit.y + this.slit.h / 2)), R = this.D;
    const u = clamp((2.6 * R - d) / (2.0 * R), 0, 1), e = u * u * (3 - 2 * u);
    const size = lerp(1, this.slitSize, e) * 1.06;   // 持っている間は少し浮いて大きめ
    const turned = performance.now() - this.dragT > 70 ? 60 : 30;
    const deg = d < 1.2 * R ? 90 : d < 2.4 * R ? 75 : turned;
    return { size, frame: this.frameFor(deg) };
  },
  toHome(drop) {
    this.clearTimers(); con.credit = false;   // 投入の途中で中断された時：始まりのタイマーを止め、クレジットの表示を消す
    this.state = 'home';
    if (!this.frames) return;   // 置き場が決まる前（最初の読み込み中）は layout() が置く
    ui.coin.className = ''; ui.coin.style.opacity = ''; ui.coin.style.clipPath = '';
    const h = this.home(); this.place(h.x, h.y, 0, 1);
    if (drop) { audio.coinReturn(); ui.coin.classList.add('drop'); setTimeout(() => ui.coin.classList.remove('drop'), 750); }
    ui.coin.classList.add('bob');
  },
  hide() { this.state = 'hidden'; ui.coin.className = 'hidden'; ui.coin.style.clipPath = ''; },
  nudge() { if (this.state !== 'home') return; ui.coin.classList.remove('nudge'); void ui.coin.offsetWidth; ui.coin.classList.add('nudge'); audio.tap(); },
  springBack() {
    // 今の向き・大きさのまま札の下へ山なりに飛び、途中で正面に戻す（持った時の逆回し）。大きさも飛びながら手に持った大きさへ
    this.clearTimers();
    this.state = 'returning'; ui.coin.classList.remove('bob', 'dragging', 'nudge');
    const h = this.home(), start = { x: this.pos.x, y: this.pos.y, size: this.size }, f0 = this.frame, t0 = performance.now(), T = 0.45;
    const step = () => {
      if (this.state !== 'returning') return;   // 途中でつかみ直された／タイトルを出た
      const u = Math.min(1, (performance.now() - t0) / 1000 / T), e = 1 - Math.pow(1 - u, 3);
      const frame = u < 0.65 ? f0 : u < 1 ? Math.min(f0, this.frameFor(30)) : 0;
      this.place(lerp(start.x, h.x, e), lerp(start.y, h.y, e) - Math.sin(u * Math.PI) * this.D * 0.3, frame, lerp(start.size, 1, e));
      if (u < 1) { requestAnimationFrame(step); return; }
      this.state = 'home'; this.place(h.x, h.y, 0, 1); ui.coin.classList.add('bob');
    };
    requestAnimationFrame(step);
  },
  insert(fast) {
    if (this.state === 'inserting' || this.state === 'hidden' || !this.slit) return;
    this.state = 'inserting'; ui.coin.classList.remove('bob', 'dragging', 'nudge'); ui.coin.classList.add('inserting');
    const start = { x: this.pos.x, y: this.pos.y, size: this.size }, deg0 = this.frames[this.frame].deg, fe = this.frameFor(90);
    const end = () => ({ x: this.slit.x, y: this.slit.y + this.slit.h * 0.5 });   // 途中でリサイズされても今の投入口へ
    const T1 = fast ? 0.01 : 0.24, T2 = fast ? 0.01 : 0.32, t0 = performance.now();
    const step = () => {
      if (this.state !== 'inserting') return;   // 途中で中断（タイトルへ戻された）
      const t = (performance.now() - t0) / 1000, e = end();
      if (t < T1) {   // 投入口の真上へ寄りながら真横を向き、板の上の大きさへ（先の縁が口に掛かる）
        const u = easeOut(t / T1);
        this.place(lerp(start.x, e.x, u), lerp(start.y, e.y, u), this.frameFor(lerp(deg0, 90, u)), lerp(start.size, this.slitSize, u));
        requestAnimationFrame(step); return;
      }
      if (t < T1 + T2) {
        // 押し込む：真横から見た円のうち、板の外に残っている弦だけが見える＝上下から同じだけ隠れていく（ゆっくり入って、すっと消える）
        const u = (t - T1) / T2, c = Math.pow(u, 1.4), vis = Math.sqrt(Math.max(0, 1 - c * c));
        const f = this.frames[fe], h = f.h * this.slitSize, cut = (1 - vis) * 0.5 * h;
        ui.coin.style.clipPath = 'inset(' + cut.toFixed(1) + 'px 0 ' + cut.toFixed(1) + 'px 0)';
        this.place(e.x, e.y - c * h * 0.06, fe, this.slitSize);   // 奥へ行くぶん少し上へ（10° 見下ろしの分）
        requestAnimationFrame(step); return;
      }
      this.hide();
      audio.coinClink();
      this.clearTimers();
      this.timers.push(setTimeout(() => { audio.creditBeep(); con.credit = true; con.flash.tries = performance.now(); audio.bgmStart(); }, 150));   // クレジットが点く（3 が点滅）→ BGM
      this.timers.push(setTimeout(() => { if (game.phase === 'title') setPhase('intro'); }, fast ? 30 : 900));
    };
    requestAnimationFrame(step);
  },
};

// ---------------- 右下で見物しているぽちゃもん（アニメ動画と同じ配置） ----------------
// 絵は AE の元ファイル（詳細コンポ・タービュレントディスプレイス付き）から表情ごとに書き出したコマ表（assets/face_sheet_*.webp・face.json）。
// つかんで持ち上がったらニヤッ（口が上がる・開き目のまま）、途中で落ちたら真顔に戻る。画面の右下の角に、縁で切れる大きさで置く
const faceUI = {
  // 絵は AE の元ファイル（詳細コンポ・タービュレントディスプレイス付き）から表情ごとに書き出したコマ表（assets/face_sheet_*.webp・face.json）。
  // 30 コマ/秒のきざみで回す。ふだん＝open の 12 コマを秒 6 で回し、時々まばたき（半目→閉じ目→半目）。ニヤッ＝grin_in（9コマ）→ grin の 12 コマを秒 6。
  // 戻る＝grin_out（15コマ）→ ふだんへ。揺れのループは途中位置を保つので、表情が変わっても継ぎ目が出ない
  img: {}, data: null, rect: null, mode: 'normal',
  queue: [], clip: null, pending: null, cur: null, hold: 0, lastTick: 0, loopPos: 0, nextBlink: 0,
  layout() {
    if (!this.data || !con.R) return;
    const [fw, fh] = this.data.size;
    const b = con.data.R.btnY, c = conPt('R', b.c), bottom = c.y + b.r_bezel * con.R.k;   // 「たて」のボタンにはかぶせない
    const h = Math.round(Math.max(80, view.ch * 0.5));
    const w = Math.round(h * fw / fh);
    const y = Math.round(Math.max(view.ch - h * 0.84, bottom + 8));   // 体の下は画面の外へ（縁で切れる絵）。「たて」のボタンにはかぶせない
    this.rect = { x: view.cw - w, y, w, h };   // 右下の角。整数に丸める（端数だと隣のコマの縁がにじむ）
  },
  play(name, from) {
    const c = this.data && this.data.clips[name]; if (!c) return;
    this.clip = name; this.queue = c.slice(from || 0).map((f) => ({ name: f[0], ticks: f[1] })); this.hold = 0;
  },
  // 表情の切替。まばたきの途中なら終わってから。反対向きの途中（ニヤッになりかけで落ちた等）なら口の位置が合う所から折り返す
  transition(name) {
    const opp = name === 'grin_in' ? 'grin_out' : 'grin_in';
    if (this.clip === 'blink' || this.clip === 'grin_blink') { this.pending = (this.pending === opp) ? null : name; return; }
    this.pending = null;
    if (this.clip === opp && this.queue.length) {
      const total = this.data.clips[name].length, oppTotal = this.data.clips[opp].length, m = this.queue.length;
      this.play(name, Math.min(total - 1, Math.floor(total * m / oppTotal)));
      return;
    }
    this.play(name);
  },
  grin() { if (this.mode === 'grin') return; this.mode = 'grin'; this.loopPos = 0; this.transition('grin_in'); },
  normal() { if (this.mode === 'normal') return; this.mode = 'normal'; this.loopPos = 0; this.transition('grin_out'); },
  refill(nowSec) {
    if (this.pending) { const p = this.pending; this.pending = null; this.play(p); return; }
    const blink = this.mode === 'grin' ? 'grin_blink' : 'blink';
    if (nowSec > this.nextBlink) { this.nextBlink = nowSec + 2.5 + Math.random() * 3; this.play(blink); return; }
    const loopName = this.mode === 'grin' ? 'grin' : 'idle', loop = this.data.clips[loopName];
    const f = loop[this.loopPos % loop.length]; this.loopPos++;
    this.clip = loopName; this.queue = [{ name: f[0], ticks: f[1] }];
  },
  step(now) {
    const dt = 1000 / (this.data.tick_fps || 30);
    if (!this.lastTick) { this.lastTick = now; this.nextBlink = now / 1000 + 1.5; }
    let n = Math.floor((now - this.lastTick) / dt);
    if (n <= 0) return;
    if (n > 10) { this.lastTick = now; n = 1; this.nextBlink = now / 1000 + 1; }   // 時間が飛んだ時（タブ切替など）は追いつかせず、まばたきも仕切り直す
    else this.lastTick += n * dt;
    while (n-- > 0) {
      if (this.hold > 0) { this.hold--; continue; }
      if (!this.queue.length) this.refill(now / 1000);
      const f = this.queue.shift(); this.cur = f.name; this.hold = f.ticks - 1;
      if (n > 0) { this.lastTick -= n * dt; break; }   // 1描画で進めるコマは1つまで（1きざみのコマを飛ばさない）。残りは次の描画へ持ち越す
    }
  },
  draw() {
    if (!this.rect || !this.data) return;
    this.step(performance.now());
    const fr = this.data.frames[this.cur || 'open_00'], im = fr && this.img[fr.sheet];
    if (!im) return;
    const [fw, fh] = this.data.size, r = this.rect;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(im, fr.x, fr.y, fw, fh, r.x, r.y, r.w, r.h);
  },
};

// ---------------- ゲームの流れ ----------------
function showMsg(text, cls, ms = 1100) {
  const m = ui.msg;
  m.className = ''; void m.offsetWidth;
  m.textContent = text; m.className = 'show ' + (cls || '');
  clearTimeout(showMsg._t);
  showMsg._t = setTimeout(() => { m.className = 'hide ' + (cls || ''); }, ms);
}
function guide(text) { ui.guide.innerHTML = text ? '<span>' + text + '</span>' : ''; }
function setButtons(x, y) {
  ui.btnX.classList.toggle('active', x); ui.btnY.classList.toggle('active', y);
  const ready = game.phase !== 'title' && game.phase !== 'result' && game.phase !== 'loading';
  ui.btnX.classList.toggle('ready', ready); ui.btnY.classList.toggle('ready', ready);
}
function updateHud() {
  // 電光表示は毎フレーム canvas に描く。増えた時だけ点滅させる
  if (game.got > (updateHud.got || 0)) con.flash.got = performance.now();
  if (game.tryIndex > (updateHud.tries || 0)) con.flash.tries = performance.now();
  updateHud.got = game.got; updateHud.tries = game.tryIndex;
}
function resetClaw() {
  claw.cx = park.x; claw.cy = park.y; claw.vx = claw.vy = 0;
  claw.L = claw.cableTop - CFG.raisedZ; claw.thx = claw.thy = claw.wx = claw.wy = 0;
  claw.arm = claw.armTarget = CFG.armClosed; claw.held = null; claw.damp = CFG.dampFree;
}
function makeSlots() {
  const s = ['W', 'W', 'L'];
  if (settings.luckSlot === 'first') return ['L', 'W', 'W'];
  if (settings.luckSlot === 'last') return s;
  return shuffle(s);
}
function startGame() {
  game.tryIndex = 0; game.got = 0; game.slots = makeSlots(); game.outcome = null;
  for (const t of toys) {
    t.state = 'rest'; t.dx = t.dy = t.dz = t.vz = 0; t.rot = t.hang = t.sag = 0; t.alpha = 1; t.shadowA = 1;
    t.bounce = 0; t.bv = 0; t.target = null; t.reactors = null; t.reacted = false; t.landDz = 0; restPose(t);
  }
  resetClaw();
  updateHud();
}
function decideOutcome(i) {
  if (game.forcedOutcome) { const f = game.forcedOutcome[i]; if (f) return f; }
  if (game.slots[i] === 'W') return 'win';
  return Math.random() < settings.luckP ? 'win' : 'lose';
}
// 一番つかみやすい子：近くて、上に出ている子
function pickToy(x, y) {
  let best = null, bestScore = Infinity;
  for (const t of toys) {
    if (t.state !== 'rest' && t.state !== 'settle') continue;
    const d = Math.hypot(t.hold.x + t.dx - x, t.hold.y + t.dy - y);
    let covered = 0;
    for (const o of toys) {
      if (o === t || (o.state !== 'rest' && o.state !== 'settle')) continue;
      if (Math.hypot(o.hold.x - t.hold.x, o.hold.y - t.hold.y) < 0.11 && o.hold.z + o.dz > t.hold.z + t.dz + 0.04) { covered = 0.09; break; }
    }
    const score = d - 0.35 * (t.hold.z + t.dz) + covered;
    if (score < bestScore) { bestScore = score; best = t; }
  }
  return best;
}
function restingToys() { return toys.filter((t) => t.state === 'rest' || t.state === 'settle' || t.state === 'falling'); }

// ---------------- 山の反応（崩れ） ----------------
// 持ち上げた子の上に乗っていた子は、乗っていた割合だけ穴へ沈んで傾く（連鎖もする）。落ちてきた子は沈んだ子の上に乗って少し傾く。
// つかむ時は爪の下の子とその隣が押されて跳ね返る。絵は描き直さず、位置（dx/dy/dz＝m）と画面の回転（rot）と上下の弾み（bounce）で動かす
function floorZAt(y) { const m = scene.machine; return y > m.ramp_y0 ? m.ramp_h * (y - m.ramp_y0) / (m.back - m.ramp_y0) : 0; }
function buildSupports() {
  for (const t of toys) { t.supports = []; t.floorF = t.data.zbottom < floorZAt(t.data.center[1]) + 0.035 ? 1 : 0; t.u = t.data.screen_center[0]; }
  for (const a of toys) for (const b of toys) {
    if (a === b) continue;
    const A = a.data.bbox, B = b.data.bbox;
    const ox = Math.min(A[1][0], B[1][0]) - Math.max(A[0][0], B[0][0]);
    const oy = Math.min(A[1][1], B[1][1]) - Math.max(A[0][1], B[0][1]);
    if (ox <= 0 || oy <= 0) continue;
    const f = ox * oy / ((A[1][0] - A[0][0]) * (A[1][1] - A[0][1]));   // a の足もとのうち b と重なる割合
    if (f < 0.12) continue;
    if (b.data.center[2] < a.data.center[2] - 0.03 && b.data.ztop > a.data.zbottom - 0.01) a.supports.push({ t: b, f });   // b は a の下
  }
}
function restPose(t) { t.restDx = t.dx; t.restDy = t.dy; t.restDz = t.dz; t.restRot = t.rot; }
function restTarget(t) { return t.state === 'settle' && t.target ? t.target : { dx: t.restDx || 0, dy: t.restDy || 0, dz: t.restDz || 0, rot: t.restRot || 0 }; }
// src が無くなった（drop = null）／drop（m）だけ下がった時、その上に乗っていた子を沈める
function pileReact(src, drop, depth) {
  depth = depth || 0;
  if (depth > 3) return;
  for (const a of toys) {
    if (a === src || (a.state !== 'rest' && a.state !== 'settle')) continue;
    const s = a.supports.find((x) => x.t === src);
    let amount = 0, lean = 0;
    if (s) {
      const others = a.supports.reduce((acc, x) => acc + ((x.t !== src && (x.t.state === 'rest' || x.t.state === 'settle')) ? x.f : 0), 0) + a.floorF * 0.6;
      const loss = s.f / (s.f + others);   // 支えのうち src が占めていた割合
      if (loss >= 0.1) { amount = Math.min(0.09, (drop == null ? (src.data.ztop - src.data.zbottom) * CFG.slump : drop * 0.7) * loss); lean = loss; }
    } else if (depth === 0 && drop == null) {
      // 乗ってはいないが、横で寄りかかっていた子：空いた所へ少し寄って傾く（ぎゅうぎゅうの山から1体抜いた時）
      const A = a.data.bbox, B = src.data.bbox;
      const gapX = Math.max(A[0][0] - B[1][0], B[0][0] - A[1][0]), gapY = Math.max(A[0][1] - B[1][1], B[0][1] - A[1][1]);
      const zOverlap = Math.min(A[1][2], B[1][2]) - Math.max(A[0][2], B[0][2]);
      if (Math.max(gapX, gapY) < 0.015 && zOverlap > 0.05) { amount = 0.012; lean = 0.5; }
    }
    if (amount < 0.004) continue;
    const base = restTarget(a);
    const dir = Math.sign(src.u - a.u) || 1;   // 穴の側へ傾く（画面の回転）
    const nx = src.data.center[0] - a.data.center[0], ny = src.data.center[1] - a.data.center[1], nl = Math.hypot(nx, ny) || 1;
    a.target = { dx: base.dx + nx / nl * 0.02 * lean, dy: base.dy + ny / nl * 0.02 * lean, dz: base.dz - amount, rot: clamp(base.rot + dir * 0.28 * lean, -0.5, 0.5) };
    a.settleFrom = { dx: a.dx, dy: a.dy, dz: a.dz, rot: a.rot }; a.settleT = 0;
    a.settleDur = 0.45 + Math.random() * 0.25; a.settleDelay = 0.04 + Math.random() * 0.16 + 0.08 * depth;   // 子ごとに少しずらす＝一斉に動かない
    a.state = 'settle'; a.vz = 0;
    if (depth === 0 && drop == null) (src.reactors || (src.reactors = [])).push(a);
    if (s) pileReact(a, amount, depth + 1);
  }
}
// 上下に弾む（つかむ時に押される・落ちてきた子に押される）。減衰する ばね
function nudgeToy(t, impulse) {
  if (t.state !== 'rest' && t.state !== 'settle') return;
  t.bv = (t.bv || 0) - impulse;
}
function pressAround(x, y, r, impulse) {
  for (const t of toys) {
    if (t.state !== 'rest' && t.state !== 'settle') continue;
    const d = Math.hypot(t.hold.x - x, t.hold.y - y);
    if (d < r) nudgeToy(t, impulse * (1 - d / r));
  }
}

function setPhase(p) {
  const prev = game.phase;
  game.phase = p; game.phaseT = 0;
  document.body.className = document.body.className.replace(/\bphase-\S+/g, '').trim() + ' phase-' + p;
  switch (p) {
    case 'title':
      ui.title.classList.add('show'); ui.result.classList.remove('show'); setButtons(false, false); guide('');
      resetClaw(); audio.motorOff(); audio.bgmStop();
      coinUI.toHome(prev !== 'loading');   // 遊び終わり（や中断）ならコインが札の下に落ちて戻ってくる
      faceUI.normal(false);
      break;
    case 'intro':
      ui.title.classList.remove('show'); coinUI.hide(); startGame(); showMsg('1かいめ！', 'round', 900); setButtons(false, false);
      game.lastInputAt = performance.now(); break;
    case 'moveX':
      input.pressedX = false; input.x = false; setButtons(true, false);
      guide('「→よこ」を おしているあいだ よこに うごくよ'); break;
    case 'moveY':
      input.pressedY = false; input.y = false; setButtons(false, true);
      guide('つぎは「↑たて」！ はなすと アームが おりるよ'); break;
    case 'settle': {
      setButtons(false, false); guide('');
      // 景品口の上では何もつかめないので、山のはしまで自動で寄せる
      const ch = scene.machine.chute;
      let tx = clamp(claw.cx, bounds.x0, bounds.x1), ty = clamp(claw.cy, bounds.y0, bounds.y1);
      if (tx < ch.x1 + 0.07 && ty < ch.y1 + 0.06) tx = ch.x1 + 0.07;
      game.settleTarget = { x: tx, y: ty };
      break;
    }
    case 'descend':
      game.target = pickToy(claw.cx, claw.cy);
      game.zTarget = game.target ? Math.max(0.19, game.target.hold.z + game.target.dz - CFG.padDz) : 0.19;
      claw.armTarget = CFG.armOpen; audio.whir(); guide('どうかな…！'); break;
    case 'grab':
      claw.damp = CFG.dampGround; claw.wx *= 0.4; claw.wy *= 0.4;
      claw.armTarget = game.target ? game.target.armHold : CFG.armClosed;
      audio.bump(); setTimeout(() => audio.clack(), 260);
      // 爪が山に当たる：真下の子は押されて沈み、まわりも少し揺れる
      if (game.target) nudgeToy(game.target, 0.3);
      pressAround(claw.x, claw.y, 0.14, 0.15);
      game.outcome = decideOutcome(game.tryIndex);
      game.slipAt = CFG.slipMin + Math.random() * (CFG.slipMax - CFG.slipMin);
      break;
    case 'lift':
      if (game.target) { game.target.state = 'held'; game.target.attach = 0; claw.held = game.target; faceUI.grin(); }   // つかめた→右下の子がニヤッ
      claw.damp = CFG.dampHeld; game.liftStartL = claw.L; audio.whir(); break;
    case 'slipping': audio.slip(); faceUI.normal(true); break;   // 途中で落ちた→真顔に戻る
    case 'hold': audio.motorOff(); break;   // 上で一呼吸（ぶら下がった子が揺れて止まるのを見せる）
    case 'carry': claw.damp = CFG.dampHeld; guide(''); break;
    case 'release': claw.armTarget = CFG.armOpen; break;
    case 'return': claw.armTarget = CFG.armClosed; claw.damp = CFG.dampFree; break;
    case 'between': showMsg((game.tryIndex + 1) + 'かいめ！', 'round', 900); game.lastInputAt = performance.now(); faceUI.normal(false); break;
    case 'result': {
      setButtons(false, false); guide(''); audio.motorOff();
      if (game.got > 0) faceUI.grin(); else faceUI.normal(false);
      ui.resultNum.textContent = game.got;
      ui.resultStickers.innerHTML = '';
      for (let i = 0; i < game.got; i++) {
        const d = document.createElement('div'); d.className = 'sticker'; d.style.animationDelay = (0.15 + i * 0.18) + 's';
        const im = document.createElement('img'); im.src = 'assets/pochamon_idle.png'; im.alt = ''; d.appendChild(im); ui.resultStickers.appendChild(d);
      }
      ui.result.classList.add('show'); game.resultShownAt = performance.now();
      audio.fanfare();
      const k = todayKey(); const c = settings.counters[k] || { games: 0, stickers: 0 };
      c.games++; c.stickers += game.got; settings.counters[k] = c; saveSettings();
      break;
    }
  }
}

// ---------------- 物理 ----------------
function stepCarriage(dt, tx, ty, speed) {
  const vx0 = claw.vx, vy0 = claw.vy;
  claw.vx = approach(claw.vx, tx * speed, CFG.moveAccel * dt);
  claw.vy = approach(claw.vy, ty * speed, CFG.moveAccel * dt);
  let nx = claw.cx + claw.vx * dt, ny = claw.cy + claw.vy * dt;
  const b = bounds;
  if (nx < b.x0) { nx = b.x0; claw.vx = 0; } if (nx > b.x1) { nx = b.x1; claw.vx = 0; }
  if (ny < b.y0) { ny = b.y0; claw.vy = 0; } if (ny > b.y1) { ny = b.y1; claw.vy = 0; }
  claw.cx = nx; claw.cy = ny;
  return { ax: (claw.vx - vx0) / dt, ay: (claw.vy - vy0) / dt };
}
function stepPendulum(dt, ax, ay, rumble) {
  const Leff = claw.L + 0.09 + (claw.held ? 0.07 : 0);
  const c = claw.damp;
  let nx = 0, ny = 0;
  if (rumble) { nx = (Math.random() - 0.5) * 1.6; ny = (Math.random() - 0.5) * 1.6; }
  claw.wx += (-(CFG.g / Leff) * Math.sin(claw.thx) - (ax / Leff) * Math.cos(claw.thx) - c * claw.wx + nx) * dt;
  claw.wy += (-(CFG.g / Leff) * Math.sin(claw.thy) - (ay / Leff) * Math.cos(claw.thy) - c * claw.wy + ny) * dt;
  claw.thx = clamp(claw.thx + claw.wx * dt, -0.6, 0.6);
  claw.thy = clamp(claw.thy + claw.wy * dt, -0.6, 0.6);
  claw.x = claw.cx + claw.L * Math.sin(claw.thx);
  claw.y = claw.cy + claw.L * Math.sin(claw.thy);
  claw.z = claw.cableTop - claw.L;
}
function changeCable(dL) {
  // ケーブルが伸び縮みしても横の速さは保つ → 角速度を縮尺する
  const L0 = claw.L + 0.09, L1 = Math.max(0.02, claw.L + dL) + 0.09;
  claw.wx *= L0 / L1; claw.wy *= L0 / L1;
  claw.L = Math.max(0.02, claw.L + dL);
}
function moveTowards(dt, tx, ty, speed) {
  // 台車を (tx,ty) へ。ついたら true
  const dx = tx - claw.cx, dy = ty - claw.cy;
  const sx = Math.abs(dx) < 0.002 ? 0 : Math.sign(dx), sy = Math.abs(dy) < 0.002 ? 0 : Math.sign(dy);
  // 近づいたら減速（止まる位置を通り越さない）
  const fx = Math.min(1, Math.abs(dx) / 0.03), fy = Math.min(1, Math.abs(dy) / 0.03);
  const a = stepCarriage(dt, sx * fx, sy * fy, speed);
  const arrived = sx === 0 && sy === 0;
  if (arrived) { claw.cx = tx; claw.cy = ty; claw.vx = claw.vy = 0; }
  return { arrived, ax: a.ax, ay: a.ay };
}

function updateToys(dt) {
  for (const t of toys) {
    if (t.state === 'rest' || t.state === 'settle') {
      // 上下の弾み（押された・落ちてきた子に押された）：減衰するばね
      if (t.bounce || t.bv) {
        t.bv += (-t.bounce * 90 - t.bv * 9) * dt; t.bounce += t.bv * dt;   // ゆっくりめのばね（1.5Hz）＝押されてふわっと戻る
        if (Math.abs(t.bounce) < 0.0004 && Math.abs(t.bv) < 0.004) { t.bounce = 0; t.bv = 0; }
      }
    }
    if (t.state === 'held') {
      // 爪先の点にくっついて動く（つかんだ直後の0.3秒は、寄せ切れなかった残りをなじませる）
      t.attach = Math.min(1, (t.attach == null ? 1 : t.attach) + dt / 0.3);
      const k = t.attach * t.attach * (3 - 2 * t.attach);
      const sx = t.restDx || 0, sy = t.restDy || 0, sz = t.restDz || 0;   // 休んでいた位置（沈んでいた子はそこから）
      t.dx = lerp(sx, claw.x - t.hold.x, k); t.dy = lerp(sy, claw.y - t.hold.y, k); t.dz = (claw.z + CFG.padDz) - t.hold.z - t.sag * 0.05;
      const hangTarget = clamp(-Math.atan2(t.data.center[0] - t.hold.x, Math.max(0.03, t.hold.z - t.data.center[2])) * 0.8, -0.6, 0.6);
      t.hang = approach(t.hang, hangTarget, 1.5 * dt);
      t.rot = lerp(t.restRot || 0, claw.thx + t.hang, k) + t.sag * Math.sin(game.phaseT * 28) * 0.25;
      t.shadowA = clamp(1 - (t.dz - sz) / 0.25, 0, 1);
      // 山から抜けたら、上に乗っていた子が穴へ沈む
      if (!t.reacted && t.dz - sz > 0.05) { t.reacted = true; pileReact(t, null, 0); }
    } else if (t.state === 'falling') {
      // つかみそこねて、元の場所へ落ちる（沈んだ隣の子の上に乗るぶん、少し高い所に止まる）
      t.vz -= CFG.g * dt; t.dz += t.vz * dt;
      const land = t.landDz || 0;
      const k = clamp((t.dz - land) / Math.max(0.01, t.fallFrom - land), 0, 1);
      t.dx = lerp(t.restDx || 0, t.fallDx, k); t.dy = lerp(t.restDy || 0, t.fallDy, k); t.rot = lerp(t.landRot || 0, t.fallRot, k);
      t.shadowA = clamp(1 - (t.dz - land) / 0.25, 0, 1);
      if (t.dz <= land) {
        t.dz = land;
        for (const a of (t.reactors || [])) nudgeToy(a, 0.25 * Math.min(1, -t.vz));   // 落ちてきた子に押される
        if (t.vz < -0.7) { t.vz = -t.vz * 0.22; audio.thud(); }
        else { t.vz = 0; t.dx = t.restDx || 0; t.dy = t.restDy || 0; t.rot = t.landRot || 0; t.state = 'rest'; t.shadowA = 1; restPose(t); if (!t.landedMsg) { t.landedMsg = true; showMsg('おしい…！', 'miss', 1300); audio.miss(); } }
      }
    } else if (t.state === 'settle') {
      // 穴へ沈む：ゆっくり始まり、少し行き過ぎて戻って落ち着く（ぬいぐるみが崩れて収まる感じ）。時間で動かすのでカクつかない
      t.settleT += dt;
      const u = clamp((t.settleT - t.settleDelay) / t.settleDur, 0, 1);
      if (u > 0) {
        const c1 = 1.2, e = 1 + (c1 + 1) * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);   // ease-out-back（行き過ぎ 1.2）
        const f = t.settleFrom, tg = t.target;
        t.dx = lerp(f.dx, tg.dx, e); t.dy = lerp(f.dy, tg.dy, e); t.dz = lerp(f.dz, tg.dz, e); t.rot = lerp(f.rot, tg.rot, e);
      }
      if (u >= 1) { const tg = t.target; t.dx = tg.dx; t.dy = tg.dy; t.dz = tg.dz; t.rot = tg.rot; t.state = 'rest'; restPose(t); }
    } else if (t.state === 'chute') {
      t.vz -= CFG.g * dt; t.dz += t.vz * dt;
      t.rot += t.rotV * dt; t.rotV *= 0.98;
      const z = t.hold.z + t.dz;
      t.alpha = clamp(1 + (z + 0.04) / 0.14, 0, 1);
      if (z < -0.24) { t.state = 'gone'; t.alpha = 0; }
      if (!t.splashed && z < -0.02) { t.splashed = true; audio.drop(); }
    }
  }
}

function update(dt) {
  game.phaseT += dt;
  const spd = CFG.moveSpeed * settings.speed;
  let acc = { ax: 0, ay: 0 }, rumble = false;
  switch (game.phase) {
    case 'title': {
      // 待機中：たまに小さく揺れる
      if (Math.random() < dt * 0.25) { claw.wx += (Math.random() - 0.5) * 0.8; claw.wy += (Math.random() - 0.5) * 0.5; }
      acc = stepCarriage(dt, 0, 0, spd); break;
    }
    case 'intro': if (game.phaseT > 1.0) setPhase('moveX'); break;
    case 'moveX': {
      const tx = input.x ? 1 : 0;
      acc = stepCarriage(dt, tx, 0, spd); rumble = input.x;
      if (input.x) audio.motorOn(1); else audio.motorOff();
      if (input.pressedX && !input.x && Math.abs(claw.vx) < 1e-4) setPhase('moveY');
      break;
    }
    case 'moveY': {
      const ty = input.y ? 1 : 0;
      acc = stepCarriage(dt, 0, ty, spd); rumble = input.y;
      if (input.y) audio.motorOn(1.15); else audio.motorOff();
      if (input.pressedY && !input.y && Math.abs(claw.vy) < 1e-4) setPhase('settle');
      break;
    }
    case 'settle': {
      const r = moveTowards(dt, game.settleTarget.x, game.settleTarget.y, spd * 0.6);
      acc = r; if (!r.arrived) audio.motorOn(0.9); else audio.motorOff();
      if (r.arrived && game.phaseT > 0.35) setPhase('descend');
      break;
    }
    case 'descend': {
      changeCable(CFG.descendSpeed * settings.speed * dt);
      if (game.target) acc = moveTowards(dt, game.target.hold.x, game.target.hold.y, CFG.driftSpeed * settings.speed);
      else acc = stepCarriage(dt, 0, 0, spd);
      if (claw.z <= game.zTarget) { claw.L = claw.cableTop - game.zTarget; setPhase('grab'); }
      break;
    }
    case 'grab': {
      // 閉じている間も寄せ続ける
      if (game.target) acc = moveTowards(dt, game.target.hold.x, game.target.hold.y, CFG.driftSpeed * settings.speed);
      else acc = stepCarriage(dt, 0, 0, spd);
      if (game.phaseT > 0.6) setPhase('lift');
      break;
    }
    case 'lift': {
      changeCable(-CFG.liftSpeed * settings.speed * dt);
      acc = stepCarriage(dt, 0, 0, spd);
      const L0 = claw.cableTop - CFG.raisedZ;
      const prog = (game.liftStartL - claw.L) / Math.max(0.01, game.liftStartL - L0);
      if (game.outcome === 'lose' && claw.held && prog >= game.slipAt) { setPhase('slipping'); break; }
      if (claw.L <= L0) { claw.L = L0; setPhase('hold'); }   // 上げ切ったら一呼吸止まる（本物と同じ）
      break;
    }
    case 'hold': {
      acc = stepCarriage(dt, 0, 0, spd);
      if (game.phaseT > CFG.holdSec) setPhase(game.outcome === 'win' && claw.held ? 'carry' : 'return');
      break;
    }
    case 'slipping': {
      changeCable(-CFG.liftSpeed * 0.35 * dt);
      acc = stepCarriage(dt, 0, 0, spd);
      const t = claw.held;
      if (t) {
        t.sag = Math.min(1, game.phaseT / 0.45);
        if (game.phaseT >= 0.5) {
          // 手からすべり落ちる。沈んだ隣の子がいれば、その上に乗る高さで止まり、少し傾く
          const rs = (t.reactors || []).filter((a) => a.state === 'rest' || a.state === 'settle');
          t.landDz = rs.length ? Math.min(0.05, rs.reduce((s, a) => s + Math.abs(restTarget(a).dz), 0) / rs.length * 0.5) : 0;
          t.landRot = rs.length ? (Math.random() - 0.5) * 0.24 : 0;
          t.state = 'falling'; t.vz = 0; t.fallFrom = Math.max(0.01, t.dz); t.fallDx = t.dx; t.fallDy = t.dy; t.fallRot = t.rot; t.sag = 0; t.landedMsg = false;
          claw.held = null; claw.armTarget = CFG.armClosed; claw.damp = CFG.dampFree;
          claw.wx += 0.6 * (Math.random() - 0.5); // 軽くなってはねる
          setPhase('return');
        }
      } else setPhase('return');
      break;
    }
    case 'carry': {
      const r = moveTowards(dt, park.x, park.y, CFG.carrySpeed * settings.speed);
      acc = r; rumble = !r.arrived;
      if (!r.arrived) audio.motorOn(0.95); else audio.motorOff();
      const calm = Math.abs(claw.thx) < 0.05 && Math.abs(claw.wx) < 0.25;
      if (r.arrived && (calm || game.phaseT > 4.5) && game.phaseT > 0.4) setPhase('release');
      break;
    }
    case 'release': {
      acc = stepCarriage(dt, 0, 0, spd);
      const t = claw.held;
      if (t && claw.arm <= -11) {
        t.state = 'chute'; t.vz = 0; t.rotV = (Math.random() - 0.5) * 2.5; t.splashed = false;
        claw.held = null; claw.wx += 0.5 * (Math.random() - 0.5);
        game.got++; updateHud(); showMsg('ゲット！！', 'win', 1400); audio.win(); faceUI.grin();
        game.flashUntil = performance.now() + 1500;   // 電球が全部、速く点滅
      }
      if (!claw.held && game.phaseT > 1.0) setPhase('return');
      break;
    }
    case 'return': {
      if (claw.L > claw.cableTop - CFG.raisedZ) changeCable(-CFG.liftSpeed * settings.speed * dt);
      else claw.L = claw.cableTop - CFG.raisedZ;
      const r = moveTowards(dt, park.x, park.y, CFG.carrySpeed * settings.speed);
      acc = r; rumble = !r.arrived;
      if (!r.arrived) audio.motorOn(0.95); else audio.motorOff();
      const settled = !toys.some((t) => t.state === 'falling' || t.state === 'chute' || (t.state === 'settle' && game.phaseT < 3));
      if (r.arrived && claw.L <= claw.cableTop - CFG.raisedZ + 1e-6 && settled && game.phaseT > 0.8) {
        game.tryIndex++; updateHud();
        setPhase(game.tryIndex < CFG.tries ? 'between' : 'result');
      }
      break;
    }
    case 'between': { acc = stepCarriage(dt, 0, 0, spd); if (game.phaseT > 1.1) setPhase('moveX'); break; }
    case 'result': {
      acc = stepCarriage(dt, 0, 0, spd);
      if (game.phaseT > 120) setPhase('title');   // 放置されたらタイトルへ
      break;
    }
    default: acc = stepCarriage(dt, 0, 0, spd);
  }
  claw.arm = approach(claw.arm, claw.armTarget, CFG.armRate * dt);
  stepPendulum(dt, acc.ax, acc.ay, rumble);
  updateToys(dt);
  // 途中で子が去った時：操作待ちのまま一定時間たったらタイトルへ（次の子に回数を引き継がない）。ゲーム内の時間で数える
  if (game.phase === 'moveX' || game.phase === 'moveY') {
    game.idleT = (input.x || input.y) ? 0 : (game.idleT || 0) + dt;
    if (game.idleT > CFG.idleBackSec) setPhase('title');
  } else game.idleT = 0;
}

// ---------------- 描画 ----------------
function insertionIndex(list, depth, box) {
  // list（奥→手前）に、奥行き depth・画面の箱 box の物を差し込む位置
  let after = -1, firstNearer = -1;
  for (let i = 0; i < list.length; i++) {
    const s = list[i].data.screen;
    if (s[2] < box[0] || s[0] > box[2] || s[3] < box[1] || s[1] > box[3]) continue;
    if (list[i].data.depth > depth) after = i; else if (firstNearer < 0) firstNearer = i;
  }
  if (after >= 0) return after + 1;
  if (firstNearer >= 0) return firstNearer;
  return list.length;
}
function drawToyRest(t) {
  const r = t.data.sprite.rect;
  if (t.state === 'falling' || t.state === 'settle' || t.dz !== 0 || t.rot !== 0 || t.dx !== 0 || t.dy !== 0 || t.bounce) { drawToyDynamic(t, false); return; }
  ctx.drawImage(t.img, r[0], r[1]);
}
function drawToyDynamic(t, clipChute) {
  const h = t.hold, p0 = t.holdUV;
  const p1 = project(h.x + t.dx, h.y + t.dy, h.z + t.dz + (t.bounce || 0));
  const s = p0.d / p1.d;
  ctx.save();
  if (clipChute) {
    ctx.beginPath();
    ctx.moveTo(chuteClip[0].u, chuteClip[0].v);
    for (let i = 1; i < 4; i++) ctx.lineTo(chuteClip[i].u, chuteClip[i].v);
    ctx.closePath(); ctx.clip();
  }
  ctx.globalAlpha = t.alpha;
  ctx.translate(p1.u, p1.v); ctx.rotate(t.rot); ctx.scale(s, s);
  ctx.drawImage(t.img, t.data.sprite.rect[0] - p0.u, t.data.sprite.rect[1] - p0.v);
  ctx.restore();
}
function clawPick() {
  // 高さ：一番近いコマ表（5cm きざみ）。切り替わる所だけ区間の 20% を重ねて形のずれを隠す（前は2枚を常に重ねていて二重に見えた）
  // 開き具合：一番近い角度の絵（2度きざみ＝重ねずに滑らか）
  const hs = clawHeights, out = [];
  if (!hs.length) return out;
  const z = clamp(claw.z, hs[0], hs[hs.length - 1]);
  let i = 0; while (i < hs.length - 2 && z > hs[i + 1]) i++;
  const t = hs.length > 1 ? (z - hs[i]) / (hs[i + 1] - hs[i]) : 0;
  let hw;
  if (hs.length === 1 || t <= 0.4) hw = [[i, 1]]; else if (t >= 0.6) hw = [[i + 1, 1]]; else { const w = (t - 0.4) / 0.2; hw = [[i, 1 - w], [i + 1, w]]; }
  for (const [si, w] of hw) {
    const sheet = clawSheets[si], fr = sheet.frames;
    let best = 0, bd = Infinity;
    for (let k = 0; k < fr.length; k++) { const d = Math.abs(fr[k].angle - claw.arm); if (d < bd) { bd = d; best = k; } }
    out.push([sheet, fr[best], w]);
  }
  out.sort((a, b) => b[2] - a[2]);
  return out;
}
function clawBox() {
  const p = project(claw.x, claw.y, claw.z);
  const sheet = clawSheets[clawSheets.length - 1], fr = sheet.frames[0];
  const s = fr.depth / p.d / (sheet.scale || 1), w = fr.w * s, hgt = fr.h * s;
  return { p, box: [p.u - w * 0.6, p.v - hgt * 0.35, p.u + w * 0.6, p.v + hgt * 0.75] };
}
function drawClaw(p) {
  const picks = clawPick();
  let acc = 0;
  for (const [sheet, fr, w] of picks) {
    const im = fr.img || sheet.img;
    if (!im) continue;
    const alpha = acc === 0 ? 1 : w / (acc + w);
    acc += w;
    const K = 1 / (sheet.scale || 1), s = fr.depth / p.d * K;   // コマ表は縮めて持っている（scale）ので描く時に戻す
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.u, p.v); ctx.rotate(claw.thx); ctx.scale(s, s);
    ctx.drawImage(im, fr.x, fr.y, fr.w, fr.h, -fr.ax, -fr.ay, fr.w, fr.h);
    ctx.restore();
  }
}
// 手前の梁より上と、手前のレールの帯は、中の物（台車・ケーブル・UFO・持った子）より手前にある＝そこは描かない
function clipBehindFront() {
  const top = Math.max(cab.beamV || 0, cab.railBotV || 0);
  ctx.beginPath(); ctx.rect(-10000, top, 20000, 20000); ctx.clip();
}
function drawCable(p) {
  const top = project(claw.cx, claw.cy, claw.cableTop);
  const end = project(claw.x, claw.y, claw.z + scene.machine.claw.dome_top);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#5c6070'; ctx.lineWidth = Math.max(1.5, lenPx(0.007, p.d));
  ctx.beginPath(); ctx.moveTo(top.u, top.v); ctx.lineTo(end.u, end.v); ctx.stroke();
  ctx.strokeStyle = '#c9cdd6'; ctx.lineWidth = Math.max(0.8, lenPx(0.0025, p.d));
  ctx.beginPath(); ctx.moveTo(top.u - 1, top.v); ctx.lineTo(end.u - 1, end.v); ctx.stroke();
}
function drawGantry() {
  const m = scene.machine;
  const a = project(claw.cx, m.rails.y_front + 0.03, m.gantry.z), b = project(claw.cx, m.rails.y_back, m.gantry.z);   // 手前の端はレールの裏（見えない）
  const d = (a.d + b.d) / 2;
  // 手前の梁（上の太いピンク）と手前のレールの裏には出ない（丸いキャップの棒がレールの上に出て「鉤」に見えていた）
  ctx.save();
  clipBehindFront();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = '#6a6e7a'; ctx.lineWidth = lenPx(0.022, d);
  ctx.beginPath(); ctx.moveTo(a.u, a.v); ctx.lineTo(b.u, b.v); ctx.stroke();
  ctx.strokeStyle = '#b9bdc8'; ctx.lineWidth = lenPx(0.014, d);
  ctx.beginPath(); ctx.moveTo(a.u, a.v); ctx.lineTo(b.u, b.v); ctx.stroke();
  ctx.strokeStyle = '#eef0f4'; ctx.lineWidth = lenPx(0.005, d);
  ctx.beginPath(); ctx.moveTo(a.u - lenPx(0.004, d), a.v); ctx.lineTo(b.u - lenPx(0.004, d), b.v); ctx.stroke();
  // 台車（箱）
  const sz = m.carriage.size, cz = m.carriage.z;
  const hx = sz[0] / 2, hy = sz[1] / 2, hz = sz[2] / 2;
  const c = (x, y, z) => project(claw.cx + x, claw.cy + y, cz + z);
  const quad = (pts, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(pts[0].u, pts[0].v); for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].u, pts[i].v); ctx.closePath(); ctx.fill(); ctx.stroke(); };
  ctx.strokeStyle = '#a84f72'; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
  quad([c(-hx, -hy, -hz), c(hx, -hy, -hz), c(hx, -hy, hz), c(-hx, -hy, hz)], '#e3799f');   // 手前の面
  if (claw.cx < 0) quad([c(hx, -hy, -hz), c(hx, hy, -hz), c(hx, hy, hz), c(hx, -hy, hz)], '#d26a90');
  else quad([c(-hx, -hy, -hz), c(-hx, hy, -hz), c(-hx, hy, hz), c(-hx, -hy, hz)], '#d26a90');
  quad([c(-hx, -hy, hz), c(hx, -hy, hz), c(hx, hy, hz), c(-hx, hy, hz)], '#f7a3c3');       // 上の面
  ctx.restore();
}
function pileTopUnder(x, y) {
  // 爪の真下で一番高い所（床かぬいぐるみの頭）。影はその子の直後に描く
  let z = floorZAt(y);
  let on = null;
  for (const t of toys) {
    if (t.state !== 'rest' && t.state !== 'settle') continue;
    const top = t.data.ztop + t.dz;
    if (Math.hypot(t.hold.x + t.dx - x, t.hold.y + t.dy - y) < 0.09 && top > z) { z = top; on = t; }
  }
  return { z, on };
}
function drawClawShadow(p, zs) {
  if (!CFG.clawShadow) return;
  const h = Math.max(0, claw.z - zs);
  const ch = scene.machine.chute;
  const usable = clawShadows.filter((s) => s.h >= 0.04);   // 2cm の絵は触れる寸前の真っ黒な影＝絵の上では穴に見えるので使わない
  if (!top_onChute() && usable.length) {
    // Blender で床に落とした本物の影（同じ照明）。高さは両どなりの絵を混ぜる。開き具合は近い方の絵だけ（混ぜると爪の塊が4つになる）。一番高い絵より上はさらに薄く
    const hs = []; for (const s of usable) if (!hs.includes(s.h)) hs.push(s.h);
    hs.sort((a, b) => a - b);
    const hc = clamp(h, hs[0], hs[hs.length - 1]);
    let i = 0; while (i < hs.length - 2 && hc > hs[i + 1]) i++;
    const t = hs.length > 1 ? (hc - hs[i]) / (hs[i + 1] - hs[i]) : 0;
    const fade = h > hs[hs.length - 1] ? clamp(1 - (h - hs[hs.length - 1]) / 0.3, 0, 1) : 1;
    if (fade <= 0) return;
    const wantOpen = claw.arm < -1;
    const parts = [];
    for (const [hh, hw] of (hs.length > 1 ? [[hs[i], 1 - t], [hs[i + 1], t]] : [[hs[0], 1]])) {
      if (hw < 0.02) continue;
      const spr = usable.find((s) => s.h === hh && (wantOpen ? s.angle < 0 : s.angle > 0)) || usable.find((s) => s.h === hh);
      if (spr) parts.push([spr, hw]);
    }
    parts.sort((a, b) => b[1] - a[1]);
    let acc = 0;
    ctx.save();
    for (const [spr, w] of parts) {
      if (!spr.img) continue;
      const alpha = (acc === 0 ? 1 : w / (acc + w)) * fade * CFG.shadowAlpha;
      acc += w;
      const s = spr.depth / p.d;
      ctx.globalAlpha = alpha;
      ctx.setTransform(view.k * view.dpr, 0, 0, view.k * view.dpr, view.ox * view.dpr, view.oy * view.dpr);
      ctx.translate(p.u, p.v); ctx.scale(s, s);
      ctx.drawImage(spr.img, -spr.anchor[0], -spr.anchor[1]);
    }
    ctx.restore();
    return;
  }
  if (top_onChute()) return;   // 景品口の上：床が無い（穴の底は遠くて影は見えない）
  // 影の絵が無い時の代わり（ぼかした楕円）
  const rx = lenPx(scene.machine.claw.saucer_radius * (1.0 + 0.35 * h), p.d), ry = rx * 0.55;
  const a = clamp(0.36 - 0.36 * h, 0.05, 0.36);
  const g = ctx.createRadialGradient(p.u, p.v, 0, p.u, p.v, rx);
  g.addColorStop(0, 'rgba(30,20,50,' + a + ')'); g.addColorStop(0.7, 'rgba(30,20,50,' + (a * 0.6) + ')'); g.addColorStop(1, 'rgba(30,20,50,0)');
  ctx.save(); ctx.translate(p.u, p.v); ctx.scale(1, ry / rx); ctx.translate(-p.u, -p.v);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.u, p.v, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  function top_onChute() { return claw.x < ch.x1 && claw.y < ch.y1 && zs <= 0.001; }
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!img.bg) return;
  ctx.setTransform(view.k * view.dpr, 0, 0, view.k * view.dpr, view.ox * view.dpr, view.oy * view.dpr);
  ctx.drawImage(img.bg, 0, 0);
  {   // 4:3 で出る下の空き：胴体の端の1行を画面の下端まで伸ばす（筐体が床まで続いて見える）
    const W = scene.image.width, H = scene.image.height, bottom = (view.ch - view.oy) / view.k;
    if (bottom > H + 0.5) ctx.drawImage(img.bg, 0, H - 1, W, 1, 0, H - 0.5, W, bottom - H + 1);
  }
  // 梁の電球：点いているものだけ「点灯−消灯」の差分を足し算で貼る（消えた絵は背景に描いてある）
  frameNow = performance.now();
  const bstep = Math.floor(frameNow / 1000 / CFG.bulbStep);
  ctx.save();
  for (const b of bulbTiles) {
    if (!b.img || !bulbLit(b.i, bstep)) continue;
    ctx.globalCompositeOperation = b.blend === 'lighter' ? 'lighter' : 'source-over';
    ctx.drawImage(b.img, b.rect[0], b.rect[1]);
  }
  ctx.restore();
  // 影
  for (const t of toys) {
    if (t.state === 'gone' || t.state === 'chute' || !t.shImg) continue;
    const r = t.data.shadow.rect;
    ctx.globalAlpha = t.shadowA; ctx.drawImage(t.shImg, r[0], r[1]);
  }
  ctx.globalAlpha = 1;
  const rest = restingToys();
  const cb = clawBox();
  // UFO の層（ケーブル・UFO・持った子）をどの子の後に描くか：UFO の箱だけでなく、ぶら下がった子の範囲と奥行き（手前にある方）も見る
  let layerDepth = project(claw.x, claw.y, claw.z + CFG.padDz).d, layerBox = cb.box;
  if (claw.held) {
    const t = claw.held, h = t.hold, p1 = project(h.x + t.dx, h.y + t.dy, h.z + t.dz), s = t.holdUV.d / p1.d, r = t.data.sprite.rect;
    const x0 = p1.u - (t.holdUV.u - r[0]) * s, y0 = p1.v - (t.holdUV.v - r[1]) * s, w = r[2] * s, hh = r[3] * s, mg = Math.max(w, hh) * 0.15;
    layerBox = [Math.min(layerBox[0], x0 - mg), Math.min(layerBox[1], y0 - mg), Math.max(layerBox[2], x0 + w + mg), Math.max(layerBox[3], y0 + hh + mg)];
    layerDepth = Math.min(layerDepth, project(t.data.center[0] + t.dx, t.data.center[1] + t.dy, t.data.center[2] + t.dz).d);
  }
  const iClaw = insertionIndex(rest, layerDepth, layerBox);
  const top = pileTopUnder(claw.x, claw.y);
  const zs = top.z;
  const sp = project(claw.x, claw.y, zs);
  const iSh = top.on ? rest.indexOf(top.on) + 1 : 0;
  const drawClawLayer = () => {
    ctx.save(); clipBehindFront();   // 手前の梁とレールの裏に隠れる（奥の高い所にいる時に上へはみ出ない）
    if (claw.held) drawToyDynamic(claw.held, false);
    drawCable(cb.p);
    drawClaw(cb.p);
    ctx.restore();
  };
  dbg.shadow = { zs, sp, iSh, iClaw, n: rest.length, h: claw.z - zs };
  for (let i = 0; i <= rest.length; i++) {
    if (i === iSh) drawClawShadow(sp, zs);
    if (i === iClaw) drawClawLayer();
    if (i < rest.length) drawToyRest(rest[i]);
  }
  for (const t of toys) if (t.state === 'chute') drawToyDynamic(t, t.hold.z + t.dz - t.below < 0.0);
  drawGantry();
  drawConsoles();
  faceUI.draw();
}

// ---------------- メインループ ----------------
let lastTs = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  if (!lastTs) lastTs = ts;
  let dt = Math.min(0.05, (ts - lastTs) / 1000) * game.timeScale;
  lastTs = ts;
  if (game.phase === 'loading') return;
  if (!(dt > 0)) { draw(); return; }   // 最初のフレームや同じ時刻の呼び出し（0 で割らない）
  const sub = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / sub;
  for (let i = 0; i < sub; i++) update(h);
  draw();
}

// ---------------- 入力 ----------------
function release(key) {
  input[key] = false; input[key + 'Id'] = null;
  ui['btn' + key.toUpperCase()].classList.remove('pressed');
}
function bindHold(btn, key) {
  const down = (e) => {
    if (e.pointerType !== 'mouse' || e.button === 0) {
      e.preventDefault(); audio.unlock(); game.lastInputAt = performance.now();
      if (!btn.classList.contains('active')) return;
      audio.click();
      input[key] = true; input['pressed' + key.toUpperCase()] = true; input[key + 'Id'] = e.pointerId; btn.classList.add('pressed');
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
  };
  // 押している指（pointerId）が離れた時だけ止める。別の指が画面に触れて離れても切れない
  const up = (e) => {
    e.preventDefault(); audio.unlock();
    if (input[key + 'Id'] != null && e.pointerId !== input[key + 'Id']) return;
    release(key);
  };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('lostpointercapture', up);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}
bindHold(ui.btnX, 'x');
bindHold(ui.btnY, 'y');
// コイン：札の下から投入口へドラッグ。投入口のまわりで離すと入る。それ以外は札の下へ戻る（戻る途中でもつかみ直せる）
ui.coin.addEventListener('pointerdown', (e) => {
  if ((coinUI.state !== 'home' && coinUI.state !== 'returning') || game.phase !== 'title') return;
  e.preventDefault(); audio.unlock(); game.lastInputAt = performance.now();
  const midFlight = coinUI.state === 'returning';   // 飛んでる途中は見た目の位置が pos と違うので、指の位置へ寄せる
  coinUI.state = 'drag'; coinUI.grab = midFlight ? { id: e.pointerId, dx: 0, dy: 0 } : { id: e.pointerId, dx: e.clientX - coinUI.pos.x, dy: e.clientY - coinUI.pos.y }; coinUI.dragT = performance.now();
  if (midFlight) coinUI.place(e.clientX, e.clientY, coinUI.frame);
  ui.coin.classList.remove('bob', 'nudge'); ui.coin.classList.add('dragging');
  try { ui.coin.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  // 持った瞬間に縦向きへ（0°→30°→60° と素早く回す。指が止まっていても回り切るようにタイマーでも進める）
  coinUI.place(coinUI.pos.x, coinUI.pos.y, coinUI.frameFor(30), 1.06);
  coinUI.timers.push(setTimeout(() => { if (coinUI.state === 'drag') { const p = coinUI.dragPose(coinUI.pos.x, coinUI.pos.y); coinUI.place(coinUI.pos.x, coinUI.pos.y, p.frame, p.size); } }, 90));
});
ui.coin.addEventListener('pointermove', (e) => {
  if (coinUI.state !== 'drag' || !coinUI.grab || e.pointerId !== coinUI.grab.id) return;
  e.preventDefault();
  const cx = e.clientX - coinUI.grab.dx, cy = e.clientY - coinUI.grab.dy;
  const p = coinUI.dragPose(cx, cy);   // 投入口に近づくほど小さく・真横に
  coinUI.place(cx, cy, p.frame, p.size);
});
const coinUp = (e) => {
  if (coinUI.state !== 'drag' || (coinUI.grab && e.pointerId !== coinUI.grab.id)) return;
  ui.coin.classList.remove('dragging');
  const z = coinUI.slotZone, p = coinUI.pos;
  if (p.x > z.x && p.x < z.x + z.w && p.y > z.y && p.y < z.y + z.h) coinUI.insert(false); else coinUI.springBack();
};
ui.coin.addEventListener('pointerup', coinUp);
ui.coin.addEventListener('pointercancel', coinUp);
ui.coin.addEventListener('lostpointercapture', coinUp);
// 取りこぼしの保険：押している指そのものの pointerup を window でも拾う
window.addEventListener('pointerup', (e) => {
  if (input.xId != null && e.pointerId === input.xId) release('x');
  if (input.yId != null && e.pointerId === input.yId) release('y');
}, { passive: true });
window.addEventListener('blur', () => { release('x'); release('y'); });
document.addEventListener('pointerdown', () => { game.lastInputAt = performance.now(); game.idleT = 0; }, { passive: true, capture: true });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (!e.target.closest('.admin-card')) e.preventDefault(); }, { passive: false });

// タイトル：始めるのはコインの投入。タップはコインの場所を教えるだけ（「ぽちゃもん」の文字だけ、2秒の長押しで設定）
let pressTimer = null, longPressed = false;
const titleSub = document.querySelector('.title-sub');
ui.title.addEventListener('pointerdown', (e) => {
  audio.unlock(); longPressed = false;
  if (e.target.closest('#muteBtn')) return;
  clearTimeout(pressTimer);
  if (e.target.closest('.title-sub')) pressTimer = setTimeout(() => { longPressed = true; openAdmin(); }, 2000);
});
const titleUp = (e) => {
  clearTimeout(pressTimer); audio.unlock();
  if (e.target.closest('#muteBtn')) return;
  if (longPressed) return;
  if (game.phase === 'title' && performance.now() - game.titleShownAt > 350) coinUI.nudge();
};
ui.title.addEventListener('pointerup', titleUp);
ui.title.addEventListener('pointercancel', () => clearTimeout(pressTimer));
titleSub.addEventListener('pointerleave', () => clearTimeout(pressTimer));
ui.muteBtn.addEventListener('click', () => {
  settings.muted = !settings.muted; saveSettings(); ui.muteBtn.classList.toggle('muted', settings.muted); if (!settings.muted) { audio.unlock(); audio.tap(); }
  audio.bgmMute(settings.muted);
});
ui.muteBtn.classList.toggle('muted', settings.muted);
ui.resultBtn.addEventListener('click', () => {
  if (performance.now() - (game.resultShownAt || 0) < 500) return;
  audio.unlock(); audio.tap(); setPhase('title'); game.titleShownAt = performance.now();
});
// キーボード（PCでの確認用）：→ よこ、↑ おく、Enter スタート
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'ArrowRight' && ui.btnX.classList.contains('active')) { input.x = true; input.pressedX = true; ui.btnX.classList.add('pressed'); }
  if (e.key === 'ArrowUp' && ui.btnY.classList.contains('active')) { input.y = true; input.pressedY = true; ui.btnY.classList.add('pressed'); }
  if (e.key === 'Enter' || e.key === ' ') { if (game.phase === 'title') coinUI.insert(true); else if (game.phase === 'result') setPhase('title'); }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowRight') { input.x = false; ui.btnX.classList.remove('pressed'); }
  if (e.key === 'ArrowUp') { input.y = false; ui.btnY.classList.remove('pressed'); }
});

// ---------------- 設定画面 ----------------
const adm = { luckP: $('luckP'), luckPVal: $('luckPVal'), luckSlot: $('luckSlot'), volume: $('volume'), volVal: $('volVal'),
              speed: $('speed'), speedVal: $('speedVal'), cntGames: $('cntGames'), cntStickers: $('cntStickers'), cntReset: $('cntReset'),
              save: $('adminSave'), close: $('adminClose'), toTitle: $('adminToTitle') };
function openAdmin() {
  adm.luckP.value = Math.round(settings.luckP * 100); adm.luckSlot.value = settings.luckSlot;
  adm.volume.value = Math.round(settings.volume * 100); adm.speed.value = Math.round(settings.speed * 100);
  const c = settings.counters[todayKey()] || { games: 0, stickers: 0 };
  adm.cntGames.textContent = c.games; adm.cntStickers.textContent = c.stickers;
  adminLabels(); ui.admin.classList.add('show');
}
function adminLabels() {
  adm.luckPVal.textContent = adm.luckP.value + '%'; adm.volVal.textContent = adm.volume.value + '%'; adm.speedVal.textContent = adm.speed.value + '%';
}
['input', 'change'].forEach((ev) => { adm.luckP.addEventListener(ev, adminLabels); adm.volume.addEventListener(ev, adminLabels); adm.speed.addEventListener(ev, adminLabels); });
// カウンタのリセットは2段階（1回目「ほんとに？」→3秒以内にもう1回で消す）
let resetArmed = null;
adm.cntReset.addEventListener('click', () => {
  if (resetArmed) {
    clearTimeout(resetArmed); resetArmed = null; adm.cntReset.textContent = 'リセット';
    settings.counters[todayKey()] = { games: 0, stickers: 0 }; saveSettings(); adm.cntGames.textContent = 0; adm.cntStickers.textContent = 0;
    return;
  }
  adm.cntReset.textContent = 'ほんとに消す？（もう1回おす）';
  resetArmed = setTimeout(() => { resetArmed = null; adm.cntReset.textContent = 'リセット'; }, 3000);
});
adm.toTitle.addEventListener('click', () => { ui.admin.classList.remove('show'); setPhase('title'); game.titleShownAt = performance.now(); });
adm.save.addEventListener('click', () => {
  settings.luckP = adm.luckP.value / 100; settings.luckSlot = adm.luckSlot.value;
  settings.volume = adm.volume.value / 100; settings.speed = adm.speed.value / 100;
  saveSettings(); audio.setVolume(settings.volume); ui.admin.classList.remove('show');
});
adm.close.addEventListener('click', () => ui.admin.classList.remove('show'));
window.addEventListener('hashchange', () => { if (location.hash === '#admin') openAdmin(); });

// ---------------- 確認用の窓口（Playwright から使う） ----------------
const dbg = {};
window.__ufo = {
  dbg,
  unlockAudio: () => { audio.unlock(); audio.tap(); },
  setLastInput: (v) => { game.lastInputAt = v; },
  state: () => ({ phase: game.phase, phaseT: game.phaseT, lastInputAt: game.lastInputAt, now: performance.now(),
                  tryIndex: game.tryIndex, got: game.got, slots: game.slots.slice(), outcome: game.outcome,
                  claw: { x: claw.x, y: claw.y, z: claw.z, cx: claw.cx, cy: claw.cy, arm: claw.arm, thx: claw.thx, L: claw.L },
                  held: claw.held ? claw.held.id : null, toys: toys.map((t) => ({ id: t.id, state: t.state })) }),
  press: (key, on) => { input[key] = !!on; if (on) input['pressed' + key.toUpperCase()] = true; ui['btn' + key.toUpperCase()].classList.toggle('pressed', !!on); },
  tap: () => { if (game.phase === 'title') coinUI.insert(true); else if (game.phase === 'result') setPhase('title'); },
  insertCoin: (fast) => coinUI.insert(!!fast),
  coin: () => ({ state: coinUI.state, pos: coinUI.pos, frame: coinUI.frame, size: coinUI.size, D: coinUI.D, slitSize: coinUI.slitSize, slit: coinUI.slit, zone: coinUI.slotZone }),
  consoles: () => ({ loaded: !!con.data, L: con.L, R: con.R, view: Object.assign({}, view), cab: Object.assign({}, cab) }),
  bgm: () => audio.bgmState(),
  pile: () => toys.map((t) => ({ id: t.id, state: t.state, dz: +t.dz.toFixed(3), rot: +t.rot.toFixed(3), bounce: +(t.bounce || 0).toFixed(3), reactors: (t.reactors || []).map((a) => a.id) })),
  setLayout: (o) => { Object.assign(CFG.layout, o); resize(); },   // 配置の比較用（edge / gap / conH）
  face: () => ({ mode: faceUI.mode, rect: faceUI.rect }),
  force: (arr) => { game.forcedOutcome = arr; },   // 例: ['win','lose','win']（null で解除）
  setLuck: (p) => { settings.luckP = p; },
  setSlot: (s) => { settings.luckSlot = s; },
  timeScale: (k) => { game.timeScale = k; },
  settings, CFG, decideOutcome: (i) => decideOutcome(i), makeSlots,
  // ルールの検算：n ゲーム回して取れた枚数の分布を返す（実際の判定関数を使う）
  simulate: (n, p) => {
    const keepSlots = game.slots, keepP = settings.luckP, keepForced = game.forcedOutcome;
    if (p != null) settings.luckP = p;
    game.forcedOutcome = null;
    const dist = { 0: 0, 1: 0, 2: 0, 3: 0 }, luckPos = { 0: 0, 1: 0, 2: 0 };
    for (let g = 0; g < n; g++) {
      game.slots = makeSlots();
      luckPos[game.slots.indexOf('L')]++;
      let got = 0;
      for (let i = 0; i < CFG.tries; i++) if (decideOutcome(i) === 'win') got++;
      dist[got]++;
    }
    game.slots = keepSlots; settings.luckP = keepP; game.forcedOutcome = keepForced;
    return { n, dist, luckPos, mean: (dist[1] + 2 * dist[2] + 3 * dist[3]) / n };
  },
};

// ---------------- 起動 ----------------
async function init() {
  resize();
  try {
    await load();
  } catch (e) {
    ui.loadProg.textContent = 'よみこみに しっぱい: ' + e.message;
    console.error(e);
    return;
  }
  resize();
  ui.loading.classList.remove('show');
  setPhase('title'); game.titleShownAt = performance.now();
  requestAnimationFrame(loop);
  if (location.hash === '#admin') openAdmin();
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !qs.get('nosw')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
init();
})();
