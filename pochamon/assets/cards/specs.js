// ぽちゃもんHP用のカード定義
// ・フルアート2枚（うきわ／あまやどり）は POCHA CARD LAB の定義をそのまま（素材パスだけ変更）
// ・ステッカー12枚は「窓型」＝既存の透過WebPをそのまま窓に入れる（層分けの作画は不要）
import { CARD_W, CARD_H, winU } from './card.js';

const IMG = 'assets/cards/img/';

export const FULLART = [
  {
    id: 'amayadori', style: 'fullart', name: 'ぽちゃもん', sub: 'あまやどり', hp: 110, type: 'みず',
    colors: { main: '#a9b8f0', dark: '#5d6fc9', light: '#eef1ff' },
    attack: { cost: 2, name: 'しとしとレイン', power: 40, text: 'つぎの相手の番、相手のバトルぽちゃもんはにげられない。' },
    weakness: 'かみなり', retreat: 1, no: '004/151', illus: '城島ジョージ',
    sparkColor: '#eaf2ff', bandRGB: '58,64,124', strokeRGB: '52,58,116',
    layers: [
      { kind: 'image', src: IMG + 'rain-sky.jpg', fit: { w: CARD_W, h: CARD_H, cx: 0, cy: 0 }, extend: 0.32, z: -0.8, masked: true,
        foil: 0.5, sparkle: 0.35, glare: 0.18, band: 2.0 },
      { kind: 'veil', fit: { w: CARD_W * 1.7, h: CARD_H * 1.7, cx: 0, cy: 0 }, z: -0.76, masked: true, opacity: 1,
        top: 0.30, mid: 0.10, foil: 0.0, sparkle: 0.0, glare: 0.0, band: 2.0 },
      { kind: 'raincloud', fit: { w: CARD_W * 1.5, h: 2.1, cx: 0, cy: 0.95 }, z: -0.55, masked: true, opacity: 1,
        foil: 0.15, sparkle: 0.1, glare: 0.15, band: 2.4 },
      { kind: 'rain', fit: { w: 3.4, h: 4.6, cx: 0, cy: 0 }, z: -0.5, masked: true,
        cols: 70, rep: 2, speed: 0.55, len: 0.16, width: 0.18, soft: 0.5, slant: 0.10, fill: 0.6, opacity: 0.85, color: '#eef4ff' },
      { kind: 'blob', fit: { w: 1.6, h: 0.44, cx: 0.05, cy: -0.72 }, z: -0.3, masked: true, opacity: 0.3 },
      { kind: 'puddle', fit: { w: 2.2, h: 0.66, cx: 0.03, cy: -0.70 }, z: -0.28, masked: true, opacity: 1,
        color: '#ffffff', squash: 0.30, body: 0.22, ring: 0.9 },
      { kind: 'rain', fit: { w: 3.2, h: 4.4, cx: 0, cy: 0 }, z: -0.1, masked: true,
        cols: 38, rep: 2, speed: 0.8, len: 0.2, width: 0.22, soft: 0.55, slant: 0.10, fill: 0.5, opacity: 0.95, color: '#f6faff' },
      { kind: 'image', src: IMG + 'umbrella.png', fit: { w: 1.94, h: 1.747, cx: 0, cy: 0.16 }, z: 0.16,
        foil: 0.14, sparkle: 0.05, glare: 0.2, rim: 1.2, band: 3.0 },
      { kind: 'rain', fit: { w: 0.34, h: 0.62, cx: -0.87, cy: -0.26 }, z: 0.2, masked: true,
        cols: 4, rep: 1, speed: 1.4, len: 0.34, width: 0.28, soft: 0.7, slant: 0.02, fill: 0.75, edgeTop: 0, opacity: 0.8, color: '#ffffff' },
      { kind: 'rain', fit: { w: 0.34, h: 0.62, cx: 0.80, cy: -0.35 }, z: 0.2, masked: true,
        cols: 4, rep: 1, speed: 1.15, len: 0.34, width: 0.28, soft: 0.7, slant: 0.02, fill: 0.75, edgeTop: 0, opacity: 0.8, color: '#ffffff' },
      { kind: 'rain', fit: { w: 3.0, h: 4.2, cx: 0, cy: 0 }, z: 0.45, masked: true,
        cols: 16, rep: 1, speed: 1.2, len: 0.26, width: 0.5, soft: 0.95, slant: 0.10, fill: 0.35, opacity: 0.5, color: '#ffffff' },
      { kind: 'particles', count: 40, x: [-1.1, 1.1], y: [-0.9, 1.2], z: [0.1, 0.55], size: [0.03, 0.07] },
      { kind: 'bokeh', fit: { w: 3.0, h: 3.6, cx: 0, cy: 0 }, z: 0.7, opacity: 0.4, masked: true,
        foil: 0.0, sparkle: 0.0, glare: 0.2, band: 3.0 },
    ],
  },
  {
    id: 'ukiwa', style: 'fullart', name: 'ぽちゃもん', sub: 'うきわぎゅうぎゅう', hp: 120, type: 'みず',
    colors: { main: '#7fc4ff', dark: '#2d6fb8', light: '#e6f4ff' },
    attack: { cost: 2, name: 'ぎゅうぎゅうスプラッシュ', power: 50, text: 'コインを1回投げオモテなら、相手のベンチのぽちゃもん1匹にも20ダメージ。' },
    weakness: 'かみなり', retreat: 2, no: '003/151', illus: '城島ジョージ',
    sparkColor: '#dff4ff',
    layers: [
      { kind: 'image', src: IMG + 'ukiwa-bg.jpg', crop: { x: 0, y: 0.112, w: 1, h: 0.7875 },
        fit: { w: CARD_W, h: CARD_H, cx: 0, cy: 0 }, extend: 0.32, z: -0.8, masked: true,
        foil: 0.55, sparkle: 0.3, glare: 0.2, band: 2.0 },
      { kind: 'image', src: IMG + 'ukiwa-bg.jpg', crop: { x: 0, y: 0.47, w: 1, h: 0.4295 },
        fit: { w: CARD_W, h: 1.909, cx: 0, cy: -0.795 }, extend: 0.26, fade: { top: 0.22 }, z: -0.35, masked: true,
        foil: 0.3, sparkle: 0.2, glare: 0.15, band: 2.0 },
      { kind: 'blob', fit: { w: 1.9, h: 0.55, cx: 0, cy: -0.74 }, z: -0.3, masked: true, opacity: 0.32 },
      { kind: 'ripple', fit: { w: 2.3, h: 0.674, cx: 0, cy: -0.72 }, z: -0.27, masked: true,
        foil: 0.0, sparkle: 0.2, glare: 0.3, band: 3.0 },
      { kind: 'image', src: IMG + 'ukiwa-char.png', fit: { w: 2.01, h: 1.459, cx: -0.007, cy: 0.0 }, z: 0.16,
        foil: 0.14, sparkle: 0.05, glare: 0.2, rim: 1.2, band: 3.0 },
      { kind: 'splash', fit: { w: 3.81, h: 1.777, cx: 0, cy: -0.10 }, z: 0.4,
        foil: 0.0, sparkle: 0.25, glare: 0.35, band: 3.0 },
      { kind: 'particles', count: 80, x: [-1.15, 1.15], y: [-1.0, 0.55], z: [0.12, 0.6], size: [0.035, 0.09] },
      { kind: 'bokeh', fit: { w: 3.0, h: 3.0, cx: 0, cy: -0.2 }, z: 0.7, opacity: 0.45,
        foil: 0.0, sparkle: 0.0, glare: 0.2, band: 3.0 },
    ],
  },
];

// ステッカー用の色（属性っぽく数種を回す）
const PALETTES = [
  { type: 'そら',   colors: { main: '#9ccdff', dark: '#3f8fe0', light: '#e4f2ff' }, spark: '#fff3c4', weakness: 'かみなり' },
  { type: 'こおり', colors: { main: '#bfe3ff', dark: '#6aa4e6', light: '#f1f9ff' }, spark: '#ffffff', weakness: 'ほのお' },
  { type: 'くさ',   colors: { main: '#b6e2a5', dark: '#5aa34a', light: '#eefae8' }, spark: '#fffbd6', weakness: 'ほのお' },
  { type: 'ほのお', colors: { main: '#ffc29a', dark: '#e07a3c', light: '#fff1e6' }, spark: '#fff6d2', weakness: 'みず' },
  { type: 'ゆめ',   colors: { main: '#d7c3f5', dark: '#8a5fd0', light: '#f4edff' }, spark: '#fff0ff', weakness: 'あく' },
  { type: 'みず',   colors: { main: '#7fc4ff', dark: '#2d6fb8', light: '#e6f4ff' }, spark: '#dff4ff', weakness: 'かみなり' },
];

// ステッカー1枚 → 窓型カードの定義
// st = { img, name, cap }（index.html の STICKERS と同じ形）
export function stickerCard(st, i) {
  const p = PALETTES[i % PALETTES.length];
  const no = String(i + 11).padStart(3, '0') + '/151';
  const isBiroon = false;   // 2026-08-21: biroon.webp 自体を時計回り90°に回したので、ここでの回転は不要
  return {
    id: 'st-' + st.img, style: 'window', name: 'ぽちゃもん', sub: st.name, hp: 90 + (i % 4) * 10, type: p.type,
    colors: p.colors,
    attack: { cost: 1 + (i % 2), name: st.name, power: 20 + (i % 3) * 10, text: st.cap },
    weakness: p.weakness, retreat: 1, no, illus: '城島ジョージ',
    sparkColor: p.spark,
    layers: [
      { kind: 'image', src: IMG + 'bg-sky.jpg', crop: { x: 0, y: 0.05 + (i % 3) * 0.04, w: 1, h: 0.723 },
        fit: { w: winU.w, h: winU.h, cx: winU.cx, cy: winU.cy }, extend: 0.32, z: -0.65, masked: true,
        foil: 0.45, sparkle: 0.3, glare: 0.18, band: 2.4 },
      { kind: 'clouds', fit: { w: winU.w * 1.4, h: winU.h * 1.4, cx: winU.cx, cy: winU.cy + 0.1 }, z: -0.3, masked: true,
        foil: 0.2, sparkle: 0.1, glare: 0.2, band: 2.4 },
      { kind: 'blob', fit: { w: 1.5, h: 0.45, cx: 0, cy: winU.cy - 0.9 }, z: -0.28, masked: true, opacity: 0.25 },
      // 本体：既存WebPをそのまま。実寸から大きさを決める（autoFit）。びろーんだけ横向き
      { kind: 'image', src: `assets/img/${st.img}.webp`, autoFit: { box: isBiroon ? 1.75 : 1.85, cx: 0, cy: winU.cy + (isBiroon ? 0.05 : -0.05) },
        rotate: isBiroon ? -Math.PI / 2 : 0, z: 0.18,
        foil: 0.12, sparkle: 0.05, glare: 0.18, rim: 1.1, band: 3.0 },
      { kind: 'particles', count: 60, x: [-1.0, 1.0], y: [-0.6, 1.3], z: [0.08, 0.5], size: [0.04, 0.1] },
    ],
  };
}
