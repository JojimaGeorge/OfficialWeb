// 3Dカードをページ内の <canvas> に載せる小さな土台
// POCHA CARD LAB（~/dev/pocha-card-lab）の main.js を「全画面1枚」から「任意の canvas に複数」へ組み替えたもの
import * as THREE from 'three';
import { createCard, CARD_W, CARD_H } from './card.js';

const clamp = THREE.MathUtils.clamp;
const MAX_TILT_X = THREE.MathUtils.degToRad(20);   // 縦（上下に倒す）
const MAX_TILT_Y = THREE.MathUtils.degToRad(24);   // 横（左右に倒す）

// 端で透明になる楕円グラデーション（後光・落ち影に使う）
function makeRadialTexture(color, stops) {
  const S = 512, c = document.createElement('canvas'); c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  for (const [k, a] of stops) g.addColorStop(k, `rgba(${color},${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// 画像の実寸から fit を決める（`autoFit: { box, cx, cy }` を書いた層）
function loadDims(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = rej; im.src = src; });
}
async function resolveAutoFit(spec) {
  for (const L of spec.layers) {
    if (!L.autoFit || !L.src) continue;
    const d = await loadDims(L.src);
    const { box, cx = 0, cy = 0 } = L.autoFit;
    const s = Math.min(box / d.w, box / d.h);
    L.fit = { w: d.w * s, h: d.h * s, cx, cy };
  }
  return spec;
}

// 傾きセンサー（全カード共通で1つだけ聞く）
const gyroState = { on: false, x: 0, y: 0, lx: 0, ly: 0 };
function onOrient(e) {
  if (e.gamma == null || e.beta == null) return;
  gyroState.on = true;
  const gx = clamp(e.gamma / 35, -1, 1);          // 左右
  const gy = clamp((e.beta - 45) / 35, -1, 1);    // 前後（45°持ちを基準）
  gyroState.y = gx * MAX_TILT_Y; gyroState.x = gy * MAX_TILT_X;
  gyroState.lx = -gx * 1.2; gyroState.ly = gy * 1.2;
}
export const gyroAvailable = typeof DeviceOrientationEvent !== 'undefined' && ('ontouchstart' in window);
export async function enableGyro() {
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return false;
  }
  window.addEventListener('deviceorientation', onOrient);
  return true;
}

export function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// canvas 1枚につき1つ。load(spec) でカードを差し替え、dispose() で片付ける
export function mountCard(canvas, opts = {}) {
  const fill = opts.fill ?? 0.86;     // canvas の高さに対するカードの高さ
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, stencil: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  let restCamZ = 8, W = 1, H = 1;

  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    if (w === W && h === H) return;
    W = w; H = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dH = (CARD_H / fill / 2) / t;
    const dW = (CARD_W / (fill - 0.04) / 2) / (t * camera.aspect);
    restCamZ = Math.max(dH, dW);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  resize();

  const glow = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W * 2.6, CARD_H * 2.0),
    new THREE.MeshBasicMaterial({ map: makeRadialTexture('255,255,255', [[0, 0.55], [0.35, 0.22], [0.7, 0.05], [1, 0]]),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: opts.glow ?? 0.35 }));
  glow.position.z = -1.8; scene.add(glow);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W * 1.35, CARD_H * 1.25),
    new THREE.MeshBasicMaterial({ map: makeRadialTexture('0,0,0', [[0, 0.55], [0.45, 0.3], [0.8, 0.06], [1, 0]]),
      transparent: true, depthWrite: false, opacity: opts.shadow ?? 0.45 }));
  shadow.position.z = -1.3; scene.add(shadow);

  const st = {
    drag: { x: 0, y: 0 }, hover: { x: 0, y: 0 }, hoverT: { x: 0, y: 0 },
    light: new THREE.Vector2(), lightT: new THREE.Vector2(),
    dive: 0, diveT: 0, dragging: false, pointerOn: false, intro: 0,
  };
  let card = null, loadSeq = 0, active = true, disposed = false, raf = 0;

  async function load(spec) {
    const seq = ++loadSeq;
    await resolveAutoFit(spec);
    const next = await createCard(spec, renderer);
    if (seq !== loadSeq || disposed) { next.dispose(); return; }
    if (card) { scene.remove(card.group); card.dispose(); }
    card = next; scene.add(card.group);
    glow.material.color.set(spec.colors.main);
    st.intro = 1; st.drag.x = st.drag.y = 0; st.dive = st.diveT = 0;
    if (opts.onLoaded) opts.onLoaded(spec);
  }

  // ---- 操作（座標は canvas 基準） ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane();
  const hit = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpP = new THREE.Vector3();
  function local(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; }
  function updateLight(p) {
    if (!card) return;
    ndc.set((p.x / p.w) * 2 - 1, -(p.y / p.h) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    tmpN.set(0, 0, 1).applyQuaternion(card.group.quaternion);
    card.group.getWorldPosition(tmpP);
    plane.setFromNormalAndCoplanarPoint(tmpN, tmpP);
    if (ray.ray.intersectPlane(plane, hit)) {
      card.group.worldToLocal(hit);
      st.lightT.set(clamp(hit.x / (CARD_W / 2), -1.4, 1.4), clamp(hit.y / (CARD_H / 2), -1.4, 1.4));
    }
  }
  let last = { x: 0, y: 0 }, moved = 0, holdTimer = 0;
  const onMove = (e) => {
    const p = local(e);
    st.pointerOn = true;
    if (st.dragging) {
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 8 && holdTimer) { clearTimeout(holdTimer); holdTimer = 0; }
      if (!st.diveT) {
        st.drag.y = clamp(st.drag.y + dx * 0.006, -MAX_TILT_Y - st.hover.y, MAX_TILT_Y - st.hover.y);
        st.drag.x = clamp(st.drag.x + dy * 0.006, -MAX_TILT_X - st.hover.x, MAX_TILT_X - st.hover.x);
      }
      last = { x: e.clientX, y: e.clientY };
    } else if (!gyroState.on) {
      const nx = (p.x / p.w) * 2 - 1, ny = -(p.y / p.h) * 2 + 1;
      st.hoverT.x = -clamp(ny, -1, 1) * MAX_TILT_X;
      st.hoverT.y = clamp(nx, -1, 1) * MAX_TILT_Y;
    }
    updateLight(p);
  };
  const onDown = (e) => {
    canvas.setPointerCapture(e.pointerId);
    st.dragging = true; moved = 0; last = { x: e.clientX, y: e.clientY };
    canvas.classList.add('dragging');
    holdTimer = setTimeout(() => { if (moved < 8) st.diveT = 1; }, 380);   // 長押しでカードの中へ
  };
  const release = () => {
    st.dragging = false; st.diveT = 0;
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = 0; }
    canvas.classList.remove('dragging');
  };
  const onLeave = () => { st.pointerOn = false; st.hoverT.x = 0; st.hoverT.y = 0; };
  const onDbl = () => { st.drag.x = 0; st.drag.y = 0; };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('dblclick', onDbl);

  // 画面外では描画を止める（電池・発熱対策）
  const io = new IntersectionObserver(es => { for (const en of es) active = en.isIntersecting; }, { threshold: 0.05 });
  io.observe(canvas);

  let prev = performance.now();
  function tick(now) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (!active || !card) { prev = now; return; }
    const t = now / 1000;
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    const k = 1 - Math.pow(0.0001, dt);
    if (gyroState.on && !st.dragging) { st.hoverT.x = gyroState.x; st.hoverT.y = gyroState.y; st.lightT.set(gyroState.lx, gyroState.ly); }
    st.hover.x += (st.hoverT.x - st.hover.x) * k * 0.45;
    st.hover.y += (st.hoverT.y - st.hover.y) * k * 0.45;
    if (!st.dragging) { st.drag.x += (0 - st.drag.x) * k * 0.4; st.drag.y += (0 - st.drag.y) * k * 0.4; }
    st.dive += (st.diveT - st.dive) * k * 0.35;
    st.intro += (0 - st.intro) * k * 0.5;
    const activeIn = st.pointerOn || gyroState.on;
    const idleX = activeIn ? 0 : Math.sin(t * 0.6) * 0.02;
    const idleY = activeIn ? 0 : Math.cos(t * 0.45) * 0.03;
    const damp = 1 - st.dive * 0.75;
    const rx = clamp((st.drag.x + st.hover.x + idleX) * damp + st.intro * 0.12, -MAX_TILT_X, MAX_TILT_X);
    const ry = clamp((st.drag.y + st.hover.y + idleY) * damp - st.intro * 0.6, -MAX_TILT_Y * 1.05, MAX_TILT_Y * 1.05);
    if (!activeIn) st.lightT.set(clamp(-Math.sin(ry) * 2.2, -1.4, 1.4), clamp(Math.sin(rx) * 2.2, -1.4, 1.4));
    st.light.lerp(st.lightT, k * 0.5);

    card.group.rotation.set(rx, ry, 0);
    camera.position.z = restCamZ - st.dive * restCamZ * 0.42;
    camera.position.y = st.dive * card.art.cy * 0.5;
    card.update(t, { light: st.light, dive: st.dive, restCamZ, facing: 1, pointScale: renderer.domElement.height * 0.5 });
    shadow.position.x = -Math.sin(ry) * 0.6; shadow.position.y = Math.sin(rx) * 0.6 - 0.3;
    shadow.material.opacity = (opts.shadow ?? 0.45) * (1 - st.dive);
    glow.position.x = -Math.sin(ry) * 0.3; glow.position.y = Math.sin(rx) * 0.3;
    glow.material.opacity = (opts.glow ?? 0.35) * (1 - st.dive * 0.6);
    renderer.render(scene, camera);
    canvas.dataset.ready = '1';   // 検証スクリプト用の合図
  }
  raf = requestAnimationFrame(tick);

  function dispose() {
    disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
    canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointerup', release); canvas.removeEventListener('pointercancel', release);
    canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('dblclick', onDbl);
    if (card) { scene.remove(card.group); card.dispose(); card = null; }
    glow.material.map.dispose(); glow.material.dispose(); glow.geometry.dispose();
    shadow.material.map.dispose(); shadow.material.dispose(); shadow.geometry.dispose();
    renderer.dispose();
  }
  return { load, dispose, get card() { return card; } };
}
