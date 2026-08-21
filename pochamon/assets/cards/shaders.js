// 箔（ホロ）オーバーレイ用シェーダー。
// 「見る角度」(vViewLocal) と「光の位置」(uLight) から虹色・ギラつき・粒子・リムライトを計算して元の絵に足す。

export const foilVertex = /* glsl */`
  varying vec2 vUv;
  varying vec3 vViewLocal;
  void main() {
    vUv = uv;
    // カメラ位置をカードのローカル座標に変換し、各頂点から見た視線方向を出す
    mat3 invRot = transpose(mat3(modelMatrix));
    vec3 camLocal = invRot * (cameraPosition - vec3(modelMatrix[3]));
    vViewLocal = camLocal - position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const foilFragment = /* glsl */`
  uniform sampler2D map;
  uniform vec2  uLight;      // -1..1 光(ポインタ)の位置。カードUV基準
  uniform float uTime;
  uniform float uFoil;       // 虹色の強さ
  uniform float uSparkle;    // 粒子(グリッター)の強さ
  uniform float uGlare;      // 白いテカリの強さ
  uniform float uRim;        // 輪郭の光（リムライト）の強さ
  uniform float uUvRot;      // 板を回転させている角度（光の位置をUV側へ合わせる）
  uniform float uBandScale;  // 虹色の縞の細かさ
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vViewLocal;

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec4 base = texture2D(map, vUv);
    if (base.a < 0.02) discard;

    vec3 v = normalize(vViewLocal);      // z が 1 に近いほど正面
    float tilt = clamp(1.0 - abs(v.z), 0.0, 1.0);   // 傾き量 0=正面
    vec2 p = vUv * 2.0 - 1.0;
    // 板が回転していれば、カード基準の光の位置を板のUV基準に回し直す
    float cr = cos(uUvRot), sr = sin(uUvRot);
    vec2 uLightL = vec2(cr * uLight.x + sr * uLight.y, -sr * uLight.x + cr * uLight.y);

    // 1) 角度で流れる虹色の縞（斜めの縞 + 視線方向で位相が動く）
    float stripe = (vUv.x * 1.1 + vUv.y * 0.9) * uBandScale;
    float hue = fract(stripe + v.x * 1.4 - v.y * 1.0 + uTime * 0.015);
    vec3 rainbow = hsv2rgb(vec3(hue, 0.7, 1.0));

    // 2) 光の位置を通る斜めの帯（ここが一番光る）
    vec2 dir = normalize(vec2(0.7, 0.72));
    float d = abs(dot(p - uLightL, dir));
    float band = smoothstep(1.1, 0.0, d);

    // 3) グリッター：細かいセルごとに乱数、角度と時間でチラつく
    vec2 cell = floor(vUv * vec2(260.0, 360.0));
    float g = hash(cell);
    float twinkle = 0.5 + 0.5 * sin(uTime * 2.0 + g * 80.0 + (v.x - v.y) * 40.0);
    float glitter = smoothstep(0.975, 1.0, g) * twinkle;   // 上位2.5%のセルだけ光る

    // 4) 光源に近いほど白く光る（テカリ）
    float glare = pow(max(0.0, 1.0 - length(p - uLightL) * 0.75), 3.0);

    // 5) リムライト：光の方向へ少しずらした所が透明なら「光の側の輪郭」
    float rim = 0.0;
    if (uRim > 0.0) {
      vec2 toLight = normalize(uLightL - p + vec2(0.0001));
      float aNear = texture2D(map, vUv + toLight * 0.010).a;
      float aFar  = texture2D(map, vUv + toLight * 0.022).a;
      rim = clamp(base.a - min(aNear, aFar), 0.0, 1.0);
      rim *= smoothstep(0.0, 0.6, base.a);
    }

    // 明るい部分ほど箔が乗る（印刷の箔っぽく見せる）
    float lum = dot(base.rgb, vec3(0.299, 0.587, 0.114));
    float foilMask = 0.35 + 0.65 * smoothstep(0.15, 0.9, lum);

    float foilAmt = (0.22 + 0.78 * band) * (0.35 + tilt * 1.6) * foilMask * uFoil;

    vec3 col = base.rgb;
    col += rainbow * foilAmt * 0.6;
    col += vec3(1.0, 0.98, 0.92) * glitter * (0.15 + band * 0.9 + tilt * 0.6) * uSparkle;
    col += vec3(1.0, 0.98, 0.9) * glare * uGlare;
    // リムライトは「白を足す」のではなく「元の色を明るくする」。黒い線画は黒のまま、毛の色だけ明るくなる
    col += base.rgb * vec3(1.0, 0.97, 0.88) * rim * uRim * (0.7 + 0.9 * band + 0.6 * tilt);

    gl_FragColor = vec4(col, base.a * uOpacity);
    #include <colorspace_fragment>
  }
`;

// キラキラ粒子（Points）用
export const sparkVertex = /* glsl */`
  attribute float aPhase;
  attribute float aSize;
  uniform float uTime;
  uniform float uScale;
  varying float vA;
  void main() {
    vec3 p = position;
    p.y += sin(uTime * 0.5 + aPhase * 6.2831) * 0.05;
    p.x += cos(uTime * 0.35 + aPhase * 6.2831) * 0.03;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float tw = 0.5 + 0.5 * sin(uTime * 2.2 + aPhase * 12.0);
    vA = tw;
    gl_PointSize = aSize * (0.5 + tw) * (uScale / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
export const sparkFragment = /* glsl */`
  uniform sampler2D uMap;
  uniform vec3 uColor;
  varying float vA;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(uColor, t.a * vA * 0.95);
    #include <colorspace_fragment>
  }
`;
