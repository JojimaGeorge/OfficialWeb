"""筐体のまわり（ゲームセンターの店内）の地の絵を1枚作る → main/pochamon-ufo/assets/room.webp

  py -I tools/pochamon-ufo/make_room.py

壁＝紫のグラデーション＋ほかの台の灯りのぼけ、床＝カーペット（紺の地に黄色の点・桃色の輪・水色の点）。
CSS の重ね塗り（全画面の疑似要素2枚）で作ると WebKit で毎コマ重くなった（2026-10-30・coin.js がコインの戻りで止まった）ので、
1枚の絵に焼いて body の地に貼る（前の単色グラデーションと同じ軽さ）。
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "main", "pochamon-ufo", "assets", "room.webp"))
W, H = 2048, 1536


def grad(top, mid, bot, h):
    t = np.linspace(0, 1, h)[:, None]
    top, mid, bot = (np.array(c, np.float32) for c in (top, mid, bot))
    a = np.where(t < 0.45, top + (mid - top) * (t / 0.45), mid + (bot - mid) * ((t - 0.45) / 0.55))
    return a


base = grad((95, 83, 163), (70, 60, 128), (47, 40, 88), H)[:, None, :].repeat(W, axis=1)
img = Image.fromarray(base.astype(np.uint8), "RGB").convert("RGBA")

# ほかの台の灯りのぼけ（x, y は画面に対する割合・r は高さに対する割合・色・濃さ）
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
g = ImageDraw.Draw(glow)
for x, y, r, col, a in [(0.06, 0.09, 0.07, (255, 130, 205), 150), (0.15, 0.04, 0.05, (120, 230, 255), 120),
                        (0.03, 0.30, 0.06, (255, 228, 120), 95), (0.12, 0.62, 0.09, (190, 160, 255), 90),
                        (0.92, 0.06, 0.07, (120, 230, 255), 135), (0.84, 0.12, 0.05, (255, 228, 120), 110),
                        (0.97, 0.34, 0.08, (255, 130, 205), 110), (0.88, 0.70, 0.10, (190, 160, 255), 80),
                        (0.50, 0.02, 0.14, (255, 255, 255), 45)]:
    cx, cy, rr = x * W, y * H, r * H
    g.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=col + (a,))
glow = glow.filter(ImageFilter.GaussianBlur(H * 0.035))
img.alpha_composite(glow)

# 床のカーペット（下 17%）
fh = int(H * 0.17)
carpet = Image.fromarray(grad((42, 36, 87), (35, 30, 74), (28, 24, 64), fh)[:, None, :].repeat(W, axis=1).astype(np.uint8), "RGB").convert("RGBA")
d = ImageDraw.Draw(carpet)
TW, TH = 92, 68
for ty in range(-1, fh // TH + 2):
    for tx in range(-1, W // TW + 2):
        ox, oy = tx * TW, ty * TH
        x, y = ox + 0.30 * TW, oy + 0.35 * TH
        d.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(255, 217, 106, 235))
        x, y = ox + 0.75 * TW, oy + 0.75 * TH
        d.ellipse((x - 12, y - 12, x + 12, y + 12), outline=(255, 140, 205, 140), width=4)
        for sx, sy in ((0.70, 0.20), (0.20, 0.80)):
            x, y = ox + sx * TW, oy + sy * TH
            d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(120, 230, 255, 170))
d.rectangle((0, 0, W, 4), fill=(255, 255, 255, 60))   # 壁との境目のうすい光
img.alpha_composite(carpet, (0, H - fh))
img.convert("RGB").save(OUT, "WEBP", quality=86, method=6)
print(OUT, os.path.getsize(OUT) // 1024, "KB")
