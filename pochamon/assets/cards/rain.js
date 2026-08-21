// 雨の表現：降る雨筋（GLSL）・水たまりの波紋（GLSL）・雨雲とベール（Canvas）
// 雨筋と波紋は時間で動くので、画像でなくシェーダーで毎フレーム計算する。
import * as THREE from 'three';

const rainVertex = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// 降る雨筋。列ごとに位相と速さを変えた雫が上から下へ落ちる。
// uCols=列の数（多いほど細かい）／uRep=1列あたり何粒／uLen=筋の長さ（板の高さ比）／uWidth=太さ（列幅比）
const rainFragment = /* glsl */`
  uniform float uTime;
  uniform vec2  uLight;
  uniform float uOpacity;
  uniform float uCols;
  uniform float uRep;
  uniform float uSpeed;
  uniform float uLen;
  uniform float uWidth;
  uniform float uSoft;
  uniform float uSlant;
  uniform float uFill;
  uniform float uEdgeTop;    // 上端のフェード幅（0 なら上端から始まる＝傘の縁からの滴り用）
  uniform vec3  uColor;
  varying vec2 vUv;

  float hash1(float n) { return fract(sin(n) * 43758.5453123); }

  float rainPass(vec2 uv, float cols, float seed, float speed, float len, float width) {
    uv.x += (uv.y - 0.5) * uSlant;                 // 少し斜めに降らせる
    float col = floor(uv.x * cols);
    float h  = hash1(col * 12.9898 + seed);
    float h2 = hash1(col * 78.233 + seed * 1.7);
    float on = step(1.0 - uFill, h);                // 雫のある列だけ
    float lx = (fract(uv.x * cols) - 0.5) * 2.0;    // 列の中の横位置 -1..1
    float line = 1.0 - smoothstep(width * (1.0 - uSoft), width, abs(lx));
    // 落下：fract の中を時間で進めると模様が下へ流れる。列ごとに位相と速さをばらす
    float y = fract(uv.y * uRep + h2 * 7.0 + uTime * speed * (0.8 + 0.4 * h));
    float tail = smoothstep(len, 0.0, y);           // 先端(下)が濃く、上へ向かって薄く
    float head = smoothstep(0.05 * len + 0.01, 0.0, y) * 0.6;
    return (tail + head) * line * on;
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float a = rainPass(vUv, uCols, 1.0, uSpeed, uLen, uWidth);
    a += rainPass(vUv + vec2(0.37, 0.0), uCols * 0.62, 7.0, uSpeed * 0.85, uLen * 1.2, uWidth * 0.8) * 0.8;
    // 板の端で切れないように上下左右をフェード（uv.y は上が1）
    float fadeTop = uEdgeTop > 0.001 ? smoothstep(1.0, 1.0 - uEdgeTop, vUv.y) : 1.0;
    float edge = smoothstep(0.0, 0.10, vUv.y) * fadeTop * smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
    // 光(ポインタ)に近い雫はきらっと光る
    float glint = pow(max(0.0, 1.0 - length(p - uLight) * 0.7), 2.0);
    a *= edge * (0.7 + 0.8 * glint) * uOpacity;
    vec3 col = mix(uColor, vec3(1.0), glint * 0.6);
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

// 水たまり：淡い楕円＋雨粒が落ちて広がる輪（上から見た遠近で縦に潰す）
const puddleFragment = /* glsl */`
  uniform float uTime;
  uniform vec2  uLight;
  uniform float uOpacity;
  uniform vec3  uColor;
  uniform float uSquash;
  uniform float uBody;     // 面（水たまり本体）の濃さ
  uniform float uRing;     // 波紋の濃さ
  varying vec2 vUv;

  float hash1(float n) { return fract(sin(n) * 43758.5453123); }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p * vec2(0.85, 1.0));
    float body = 1.0 - smoothstep(0.35, 1.0, r);
    float a = body * uBody;
    float rings = 0.0;
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      vec2 c = vec2(hash1(fi * 1.3 + 2.0) * 1.5 - 0.75, hash1(fi * 2.7 + 3.0) * 1.0 - 0.5);
      float ph = fract(uTime * 0.5 + hash1(fi * 5.1 + 9.0));
      float rad = ph * 0.6;
      float d = length((p - c) * vec2(1.0, 1.0 / max(0.15, uSquash)));
      rings += smoothstep(0.06, 0.0, abs(d - rad)) * (1.0 - ph);
    }
    rings = clamp(rings, 0.0, 1.0);
    a += rings * uRing * (0.35 + 0.65 * body);
    // 光の側が少し明るい（濡れた面の照り）
    float shine = pow(max(0.0, 1.0 - length(p * vec2(0.6, 1.0) - uLight * 0.5) * 0.8), 2.0);
    vec3 col = mix(uColor, vec3(1.0), clamp(rings + shine * 0.5, 0.0, 1.0));
    gl_FragColor = vec4(col, a * uOpacity);
    #include <colorspace_fragment>
  }
`;

function baseUniforms(L) {
  return {
    uTime: { value: 0 }, uLight: { value: new THREE.Vector2() }, uOpacity: { value: L.opacity ?? 1 },
    uColor: { value: new THREE.Color(L.color || '#eef5ff') },
  };
}

export function makeRainMaterial(L) {
  return new THREE.ShaderMaterial({
    vertexShader: rainVertex, fragmentShader: rainFragment,
    uniforms: {
      ...baseUniforms(L),
      uCols: { value: L.cols ?? 60 }, uRep: { value: L.rep ?? 2 }, uSpeed: { value: L.speed ?? 0.7 },
      uLen: { value: L.len ?? 0.1 }, uWidth: { value: L.width ?? 0.2 }, uSoft: { value: L.soft ?? 0.6 },
      uSlant: { value: L.slant ?? 0.1 }, uFill: { value: L.fill ?? 0.45 },
      uEdgeTop: { value: L.edgeTop ?? 0.10 },
    },
    transparent: true, depthWrite: false, side: THREE.FrontSide,
  });
}

export function makePuddleMaterial(L) {
  return new THREE.ShaderMaterial({
    vertexShader: rainVertex, fragmentShader: puddleFragment,
    uniforms: { ...baseUniforms(L), uSquash: { value: L.squash ?? 0.85 },
      uBody: { value: L.body ?? 0.3 }, uRing: { value: L.ring ?? 0.75 } },
    transparent: true, depthWrite: false, side: THREE.FrontSide,
  });
}

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// 雨雲：上端に沿って並ぶ、薄紫がかったやわらかい雲のかたまり（下へ向かって消える）
export function makeRaincloudCanvas() {
  const W = 1024, H = 512, c = makeCanvas(W, H), ctx = c.getContext('2d');
  const rnd = seeded(20260821);
  ctx.filter = 'blur(14px)';
  ctx.fillStyle = 'rgba(150,160,205,0.9)';
  ctx.fillRect(-40, -40, W + 80, 150);
  for (let i = 0; i < 14; i++) {
    const cx = -20 + rnd() * (W + 40), cy = 90 + rnd() * 120, base = 60 + rnd() * 70;
    ctx.fillStyle = 'rgba(150,160,205,0.75)';
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(cx + (k - 1.5) * base * 0.7, cy + rnd() * 20, base * (0.6 + rnd() * 0.4), 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(215,220,248,0.55)';
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(cx + (k - 1) * base * 0.7, cy - 24 + rnd() * 14, base * (0.45 + rnd() * 0.3), 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.filter = 'none';
  // 下端を透明へ
  ctx.globalCompositeOperation = 'destination-in';
  const g = ctx.createLinearGradient(0, 120, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

// ベール：雨の日の空気感。上ほど青紫がかって、下へ向かって消える薄い膜
export function makeVeilCanvas(L = {}) {
  const W = 64, H = 512, c = makeCanvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  const top = L.top ?? 0.34, mid = L.mid ?? 0.14;
  g.addColorStop(0, 'rgba(110,120,185,' + top + ')');
  g.addColorStop(0.45, 'rgba(140,150,215,' + mid + ')');
  g.addColorStop(1, 'rgba(200,210,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  return c;
}
