// 背景の粒子エフェクト（Three.js）。body のテーマ色ごとに種類が変わる
//   theme-blue → あわ／theme-teal → キラ／theme-green → はっぱ／theme-purple → 星屑／theme-orange → ほたる／theme-pink → 花びら
// 奥行き（aDepth）で大きさ・動く量が変わり、マウスとスクロールで視差が付く。粒は全部 GPU 側（シェーダー）で動かす
import * as THREE from 'three';

// セクションの data-fx（body.dataset.fx に写される）→ 番号
export const MODES = { bubble: 0, sparkle: 1, leaf: 2, stardust: 3, firefly: 4, petal: 5 };
// 種類ごとの「出す割合」（粒全体のうち何割を使うか）。多すぎると賑やかを通り越すので控えめに
const KEEP = [0.34, 0.42, 0.5, 0.62, 0.45, 0.5];
const TINT = [
  [1.0, 1.0, 1.0],     // あわ
  [1.0, 1.0, 0.94],    // キラ
  [0.88, 1.0, 0.78],   // はっぱ
  [1.0, 0.97, 0.86],   // 星屑
  [1.0, 0.92, 0.62],   // ほたる
  [1.0, 0.92, 0.96],   // 花びら
];

// 8マス（4×2）のスプライト画像を Canvas で描く。全部白で描き、色はシェーダーで付ける
function makeAtlas() {
  const S = 128, c = document.createElement('canvas'); c.width = S * 4; c.height = S * 2;
  const ctx = c.getContext('2d');
  const cell = (i, draw) => { ctx.save(); ctx.translate((i % 4) * S + S / 2, Math.floor(i / 4) * S + S / 2); draw(); ctx.restore(); };
  // 0 あわ：輪＋うすい中身＋ハイライト
  cell(0, () => {
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.stroke();
    const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 46); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.35)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.ellipse(-18, -20, 9, 5, -0.7, 0, Math.PI * 2); ctx.fill();
  });
  // 1 キラ：4つ角の星
  const star4 = (r, w) => { ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a + Math.PI / 4) * w, Math.sin(a + Math.PI / 4) * w); } ctx.closePath(); ctx.fill(); };
  cell(1, () => { ctx.fillStyle = 'rgba(255,255,255,.35)'; star4(58, 14); ctx.fillStyle = '#fff'; star4(50, 9); });
  // 2 はっぱ：葉っぱ＋葉脈（葉脈は葉の形でクリップして、先端からはみ出さないようにする）
  cell(2, () => {
    const leaf = () => { ctx.beginPath(); ctx.moveTo(0, -50); ctx.quadraticCurveTo(42, -10, 0, 50); ctx.quadraticCurveTo(-42, -10, 0, -50); ctx.closePath(); };
    ctx.fillStyle = '#fff'; leaf(); ctx.fill();
    ctx.save(); leaf(); ctx.clip();
    ctx.strokeStyle = 'rgba(120,170,90,.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(0, 36); ctx.stroke();
    ctx.lineWidth = 2.5; for (const y of [-18, -4, 10]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(12, y + 8); ctx.moveTo(0, y); ctx.lineTo(-12, y + 8); ctx.stroke(); }
    ctx.restore();
  });
  // 3 星屑：細くて鋭い光
  cell(3, () => { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 40); g.addColorStop(0, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; star4(56, 4.5); });
  // 4 ほたる：やわらかい光の玉
  cell(4, () => { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 56); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.fill(); });
  // 5 花びら：しずく形
  cell(5, () => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -48); ctx.bezierCurveTo(46, -30, 40, 40, 0, 48); ctx.bezierCurveTo(-40, 40, -46, -30, 0, -48); ctx.fill(); ctx.fillStyle = 'rgba(255,200,220,.55)'; ctx.beginPath(); ctx.ellipse(0, 14, 14, 22, 0, 0, Math.PI * 2); ctx.fill(); });
  const tex = new THREE.CanvasTexture(c); tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const VERT = /* glsl */`
attribute vec2 aBase; attribute float aSeed; attribute float aDepth; attribute float aSize;
uniform float uTime, uMix, uScroll, uPix, uModeA, uModeB, uKeepA, uKeepB; uniform vec2 uMouse;
varying float vAlphaA, vAlphaB, vRotA, vRotB;
vec2 wrap(vec2 p){ return mod(p + 1.0, 2.0) - 1.0; }
void motion(float mode, float keep, float t, float s, float d, out vec2 pos, out float alpha, out float rot, out float scale){
  pos = aBase; alpha = 1.0; rot = 0.0; scale = 1.0;
  float sp = 0.5 + s;
  if(mode < 0.5){            // あわ：小さく・ゆらゆら昇る
    pos = wrap(aBase + vec2(sin(t*(0.6+s)+s*10.0)*0.02, t*0.04*sp*(0.6+d)));
    alpha = 0.5 + 0.3*d; scale = 0.5 + 0.3*s;
  } else if(mode < 1.5){     // キラ：その場で明滅
    float tw = 0.5+0.5*sin(t*(1.0+s*1.6)+s*25.0);
    alpha = smoothstep(0.25, 1.0, tw); rot = t*0.25 + s; scale = 0.6 + 0.6*tw;
  } else if(mode < 2.5){     // はっぱ：ひらひら落ちる
    pos = wrap(aBase + vec2(sin(t*0.8+s*6.0)*0.07, -t*0.05*sp*(0.6+d)));
    rot = sin(t*1.1+s*6.0)*0.9 + s*6.28; alpha = 0.85; scale = 0.9 + 0.3*s;
  } else if(mode < 3.5){     // 星屑：斜めに流れて鋭く瞬く
    pos = wrap(aBase + vec2(t*0.012, t*0.007)*(0.5+d));
    float tw = pow(max(0.0, sin(t*(1.8+s*2.5)+s*30.0)), 4.0);
    alpha = 0.25 + 0.75*tw; rot = s*3.0; scale = 0.5 + 0.7*tw;
  } else if(mode < 4.5){     // ほたる：漂って呼吸する
    pos = aBase + vec2(sin(t*0.5+s*7.0), cos(t*0.37+s*3.0))*0.06*(0.5+d);
    alpha = 0.25 + 0.75*pow(0.5+0.5*sin(t*(0.8+s)+s*10.0), 3.0); scale = 0.8 + 0.6*s;
  } else {                   // 花びら：軽く速く
    pos = wrap(aBase + vec2(sin(t*1.3+s*6.0)*0.09, -t*0.07*sp*(0.6+d)));
    rot = t*(1.2+s) + s*6.28; alpha = 0.9; scale = 0.8 + 0.3*s;
  }
  // 粒の「出す割合」：seed が keep を超える粒はその種類では出さない
  alpha *= step(s, keep);
}
void main(){
  vec2 pa, pb; float aa, ab, ra, rb, sa, sb;
  motion(uModeA, uKeepA, uTime, aSeed, aDepth, pa, aa, ra, sa);
  motion(uModeB, uKeepB, uTime, aSeed, aDepth, pb, ab, rb, sb);
  vec2 pos = mix(pa, pb, uMix);
  pos += uMouse * (0.015 + 0.05*aDepth);          // マウス視差（手前ほど動く）
  pos.y += sin(uScroll/600.0)*0.06*aDepth;         // スクロールのゆらぎ
  vAlphaA = aa; vAlphaB = ab; vRotA = ra; vRotB = rb;
  gl_Position = vec4(pos, 0.0, 1.0);
  gl_PointSize = aSize * (0.4 + 0.8*aDepth) * mix(sa, sb, uMix) * uPix;
}`;

const FRAG = /* glsl */`
// precision は Three.js が頂点側と揃えて付ける（自分で書くと uniform の精度が食い違ってリンクに失敗する）
uniform sampler2D uMap; uniform float uMix, uModeA, uModeB; uniform vec3 uColA, uColB;
varying float vAlphaA, vAlphaB, vRotA, vRotB;
vec4 samp(float kind, float rot){
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(rot), s = sin(rot);
  p = mat2(c, -s, s, c) * p + 0.5;
  float inside = step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0);
  vec2 uv = (vec2(mod(kind, 4.0), floor(kind / 4.0)) + clamp(p, 0.0, 1.0)) / vec2(4.0, 2.0);
  return texture2D(uMap, uv) * inside;
}
void main(){
  vec4 a = samp(uModeA, vRotA); vec4 b = samp(uModeB, vRotB);
  float wa = a.a * vAlphaA * (1.0 - uMix), wb = b.a * vAlphaB * uMix;
  float al = wa + wb;
  if(al < 0.01) discard;
  vec3 col = (uColA * wa + uColB * wb) / al;
  gl_FragColor = vec4(col, al * 0.92);
}`;

export function startBgFx(container, opts = {}) {
  performance.mark('bgfx:start');
  // 実際に見える数は KEEP（種類ごとの割合）でさらに絞られる。スマホ幅は3割減
  const COUNT = opts.count ?? (matchMedia('(max-width: 760px)').matches ? 105 : 150);
  const canvas = document.createElement('canvas');
  canvas.className = 'bgfx';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
  container.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));   // 全画面キャンバスなので上限1.5（4Kで重くしない）
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();

  // 粒の初期配置：画面を格子に割って1マス1粒（偏らない）
  const base = new Float32Array(COUNT * 2), seed = new Float32Array(COUNT), depth = new Float32Array(COUNT), size = new Float32Array(COUNT);
  const cols = 16, rows = Math.ceil(COUNT / cols);
  for (let i = 0; i < COUNT; i++) {
    const cx = i % cols, cy = Math.floor(i / cols);
    base[i * 2] = ((cx + Math.random()) / cols) * 2 - 1;
    base[i * 2 + 1] = ((cy + Math.random()) / rows) * 2 - 1;
    seed[i] = Math.random();
    depth[i] = Math.pow(Math.random(), 1.6);          // 手前は少なめ
    size[i] = 14 + Math.random() * 26;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  geo.setAttribute('aBase', new THREE.BufferAttribute(base, 2));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const u = {
    uMap: { value: makeAtlas() }, uTime: { value: 0 }, uMix: { value: 0 }, uScroll: { value: 0 }, uPix: { value: 1 },
    uModeA: { value: 0 }, uModeB: { value: 0 }, uKeepA: { value: 1 }, uKeepB: { value: 1 }, uMouse: { value: new THREE.Vector2() },
    uColA: { value: new THREE.Vector3(...TINT[0]) }, uColB: { value: new THREE.Vector3(...TINT[0]) },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, transparent: true, depthWrite: false, depthTest: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  scene.add(pts);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    u.uPix.value = renderer.getPixelRatio() * Math.min(1.4, Math.max(0.7, h / 900));
  }
  window.addEventListener('resize', resize); resize();

  // マウス／スクロール
  const mouseT = new THREE.Vector2();
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const onMove = (e) => { mouseT.set(-(e.clientX / window.innerWidth - 0.5) * 2, (e.clientY / window.innerHeight - 0.5) * 2); };
  if (fine) window.addEventListener('mousemove', onMove, { passive: true });
  const onScroll = () => { u.uScroll.value = window.scrollY; };
  window.addEventListener('scroll', onScroll, { passive: true });

  // 種類の切替（A→B へ 1.4秒でにじむ）。body の data-fx を見る
  let mixing = false;
  function setTheme(name) {
    const m = MODES[name]; if (m == null) return;
    const cur = mixing ? u.uModeB.value : u.uModeA.value;
    if (m === cur) return;
    u.uModeA.value = cur; u.uColA.value.set(...TINT[cur]); u.uKeepA.value = KEEP[cur];
    u.uModeB.value = m; u.uColB.value.set(...TINT[m]); u.uKeepB.value = KEEP[m];
    u.uMix.value = 0; mixing = true;
  }
  const mo = new MutationObserver(() => setTheme(document.body.dataset.fx));
  mo.observe(document.body, { attributes: true, attributeFilter: ['data-fx'] });
  const initial = MODES[document.body.dataset.fx] ?? MODES.sparkle;
  u.uModeA.value = initial; u.uModeB.value = initial;
  u.uColA.value.set(...TINT[initial]); u.uColB.value.set(...TINT[initial]);
  u.uKeepA.value = KEEP[initial]; u.uKeepB.value = KEEP[initial];

  let raf = 0, prev = performance.now(), disposed = false;
  function tick(now) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    u.uTime.value = now / 1000;
    u.uMouse.value.lerp(mouseT, 1 - Math.pow(0.001, dt));
    if (mixing) {
      u.uMix.value = Math.min(1, u.uMix.value + dt / 1.4);
      if (u.uMix.value >= 1) { u.uModeA.value = u.uModeB.value; u.uColA.value.copy(u.uColB.value); u.uKeepA.value = u.uKeepB.value; u.uMix.value = 0; mixing = false; }
    }
    renderer.render(scene, camera);
    if (!canvas.dataset.ready) { canvas.dataset.ready = '1'; performance.mark('bgfx:first-frame'); }
  }
  raf = requestAnimationFrame(tick);

  return {
    setTheme,
    dispose() {
      disposed = true; cancelAnimationFrame(raf); mo.disconnect();
      window.removeEventListener('resize', resize); window.removeEventListener('scroll', onScroll);
      if (fine) window.removeEventListener('mousemove', onMove);
      geo.dispose(); mat.dispose(); u.uMap.value.dispose(); renderer.dispose(); canvas.remove();
    },
  };
}
