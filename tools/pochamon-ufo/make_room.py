"""筐体のまわり（ゲームセンターの店内）の地の絵を1枚作る → main/pochamon-ufo/assets/room.webp（2048×1536）

  py -I tools/pochamon-ufo/make_room.py [出力先]

壁（上）＝紫のグラデーション＋ほかの台の灯りのぼけ（2026-10-30 の絵のまま。11/10 に案を3つ作って見たうえで、本人が「上は今の背景のまま」）。
下の帯（下 17%）＝宇宙の柄（11/10 本人が案C「パステルの宇宙」の柄を、前の丸の柄・試したお菓子と果物の柄と差し替え）。
  帯は筐体の一部として、奥行き・傾きなしで平らに（本人「ドーナツやソフトクリームが斜めなのが気になる」「ここは筐体の一部だから床みたいな配置にしないで」）：
  紫の地に星くず、惑星・UFO・ロケット・月などをまっすぐ立てて、ちょうど3段の1マスおき。境目は前と同じうすい光の線
部品の絵＝tools/pochamon-ufo/room_motifs/sky_*.webp（fal の Nano Banana Pro で作った紙を1個ずつ切り抜いたもの）。
元の紙・切り抜く台本・ほかの案（A ストライプと星／B ネオン管／C 宇宙の壁＋お菓子と果物の帯）は E:/イラスト/ぽちゃもん/4_3D/UFOキャッチャー_2026-10-28/room_1110/。
CSS の重ね塗り（全画面の疑似要素2枚）で作ると WebKit で毎コマ重くなった（2026-10-30・coin.js がコインの戻りで止まった）ので、
1枚の絵に焼いて body の地に貼る。
"""
import glob
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
MOT = os.path.join(HERE, "room_motifs")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(os.path.join(HERE, "..", "..", "main", "pochamon-ufo", "assets", "room.webp"))
W, H = 2048, 1536
FH = int(H * 0.17)          # 下の帯の高さ（前のカーペットと同じ＝筐体と操作盤の足の線）
FY = H - FH


def grad(top, mid, bot, h):
    t = np.linspace(0, 1, h)[:, None]
    top, mid, bot = (np.array(c, np.float32) for c in (top, mid, bot))
    return np.where(t < 0.45, top + (mid - top) * (t / 0.45), mid + (bot - mid) * ((t - 0.45) / 0.55))


def wall():
    """2026-10-30 の絵と同じ作り方（紫のグラデーション＋ほかの台の灯りのぼけ）"""
    base = grad((95, 83, 163), (70, 60, 128), (47, 40, 88), H)[:, None, :].repeat(W, axis=1)
    img = Image.fromarray(base.astype(np.uint8), "RGB").convert("RGBA")
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    # ほかの台の灯りのぼけ（x, y は画面に対する割合・r は高さに対する割合・色・濃さ）
    for x, y, r, col, a in [(0.06, 0.09, 0.07, (255, 130, 205), 150), (0.15, 0.04, 0.05, (120, 230, 255), 120),
                            (0.03, 0.30, 0.06, (255, 228, 120), 95), (0.12, 0.62, 0.09, (190, 160, 255), 90),
                            (0.92, 0.06, 0.07, (120, 230, 255), 135), (0.84, 0.12, 0.05, (255, 228, 120), 110),
                            (0.97, 0.34, 0.08, (255, 130, 205), 110), (0.88, 0.70, 0.10, (190, 160, 255), 80),
                            (0.50, 0.02, 0.14, (255, 255, 255), 45)]:
        cx, cy, rr = x * W, y * H, r * H
        g.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=col + (a,))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(H * 0.035)))
    return img


def fit(im, size):
    s = size / max(im.width, im.height)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


def band():
    """下の帯＝宇宙の柄：紫の地に星くず、空と宇宙の部品をまっすぐ立てて、ちょうど3段の1マスおき（傾き・奥行きなし）"""
    rng = random.Random(1110)
    t = np.linspace(0, 1, FH)[:, None, None]
    a = (np.array((66, 54, 124), np.float32) * (1 - t) + np.array((46, 37, 92), np.float32) * t).repeat(W, axis=1)
    img = Image.fromarray(a.astype(np.uint8), "RGB").convert("RGBA")
    dust = Image.new("RGBA", (W, FH), (0, 0, 0, 0))
    d = ImageDraw.Draw(dust)
    for _ in range(90):
        x, y = rng.uniform(0, W), rng.uniform(0, FH)
        r = rng.choice([2, 2, 3])
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 246, 230, rng.randint(70, 150)))
    img.alpha_composite(dust)
    sky = [Image.open(f).convert("RGBA") for f in sorted(glob.glob(os.path.join(MOT, "sky_*.webp")))]
    S = FH / 3.0
    ox = (W / 2) % S                                   # 真ん中の線にます目の境をそろえる（左右で同じ見え方）
    k = 0
    for j in range(3):
        for i in range(-1, int(math.ceil(W / S)) + 2):
            if (i + j) % 2 != 0:
                continue
            m = fit(sky[(k * 5 + j * 3) % len(sky)], S * 0.78)   # 隣どうしで同じ絵が並ばないように飛ばして選ぶ
            k += 1
            cx, cy = ox + (i + 0.5) * S, (j + 0.5) * S
            img.alpha_composite(m, (int(round(cx - m.width / 2)), int(round(cy - m.height / 2))))
    line = Image.new("RGBA", (W, FH), (0, 0, 0, 0))
    ImageDraw.Draw(line).rectangle((0, 0, W, 4), fill=(255, 255, 255, 60))   # 壁との境目のうすい光（前の絵と同じ）
    img.alpha_composite(line)
    return img


img = wall()
img.alpha_composite(band(), (0, FY))
img.convert("RGB").save(OUT, "WEBP", quality=86, method=6)
print(OUT, os.path.getsize(OUT) // 1024, "KB")
