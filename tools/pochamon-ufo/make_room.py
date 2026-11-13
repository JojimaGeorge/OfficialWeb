"""筐体のまわり（ゲームセンターの店内）の地の絵を1枚作る → main/pochamon-ufo/assets/room.webp（2048×1536）

  py -I tools/pochamon-ufo/make_room.py [出力先] [--pal=配色の名前]

配色（PALS・名前なしで実行すると本番の gunjo）：
- gunjo＝2026-11-14〜 の本番。壁を紫寄りの青（群青）に、灯りのぼけの黄色2つをうすいピンクに（黄色を青に重ねると灰色に濁る）。
  下の帯は purple と同じ（本人「下の模様の紫は変えなくていい」）。
  経緯：本人「目立つように黄色の配色に」→ 黄色3案（「意外に合わない」）→ 青系3案（群青・瑠璃・空色）→「ピンとこない」→
  ピンクの質感3案（pink_*）→「余計な模様はいらんかった。いったん群青で」
- purple＝2026-10-30〜11/13 の絵。壁＝紫のグラデーション＋ほかの台の灯りのぼけ（11/10 に案を3つ見たうえで本人が「上は今の背景のまま」）、
  下の帯＝紫の地に星くずと宇宙の柄。前の版に戻す時はこれ
- pink_*＝11/14 に見せて不採用の案（本人「余計な模様はいらんかった」）。参考＝昔のピンクの筐体の写真・「3Dというか質感を出して」
  「下の帯は筐体の白に合わせた白っぽい色に」。壁は高さの地図に左上からの光を当てて陰影を付ける（塗装の板／縦の溝／キルティング）
下の帯（下 17%）＝宇宙の柄（11/10 本人が案C「パステルの宇宙」の柄を、前の丸の柄・試したお菓子と果物の柄と差し替え）。
  帯は筐体の一部として、奥行き・傾きなしで平らに（本人「ドーナツやソフトクリームが斜めなのが気になる」「ここは筐体の一部だから床みたいな配置にしないで」）：
  地に惑星・UFO・ロケット・月などをまっすぐ立てて、ちょうど3段の1マスおき
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

# 帯＝上・下の地の色、星くずの色（None＝描かない）、境目の線（line＝前の絵のうすい光／edge＝暗い線と明るい線の段）
PURPLE_BAND = dict(band=((66, 54, 124), (46, 37, 92)), dust=(255, 246, 230), line=(255, 255, 255, 60))
# 白っぽい帯＝筐体の白に合わせる。ゲームの絵の筐体と操作盤は影で温かい灰色（157,138,131）に写るので、同じ色味のまま明るくした。
# 星くずは白い地では見えないので描かない
WHITE_BAND = dict(band=((238, 231, 228), (222, 213, 210)), dust=None, line=None,
                  edge=((205, 190, 190), (250, 247, 246)))
# ピンク＝参考の写真の胴体（光の当たった正面で (222,143,188) 前後）を中ほどに、上を明るく下を少し濃く
PINK = ((236, 160, 202), (224, 144, 189), (204, 124, 170))

# 青系の灯り＝紫の時の黄色2つをうすいピンクに（黄色を青に重ねると灰色に濁る）
GLOW_BLUE = [(255, 130, 205), (120, 230, 255), (255, 190, 230), (190, 160, 255), (120, 230, 255),
             (255, 190, 230), (255, 130, 205), (190, 160, 255), (255, 255, 255)]

PALS = {
    "gunjo": dict(style="bokeh", wall=((84, 104, 204), (62, 78, 160), (40, 52, 110)),   # 群青＝紫寄りの青（色相230°・今は249°）
                  glow=GLOW_BLUE, glow_k=1.0, **PURPLE_BAND),
    "purple": dict(
        style="bokeh",
        wall=((95, 83, 163), (70, 60, 128), (47, 40, 88)),
        glow=[(255, 130, 205), (120, 230, 255), (255, 228, 120), (190, 160, 255), (120, 230, 255),
              (255, 228, 120), (255, 130, 205), (190, 160, 255), (255, 255, 255)],
        glow_k=1.0, **PURPLE_BAND),
    "pink_panel": dict(style="panel", wall=PINK, **WHITE_BAND),   # 案1 塗装の板（写真の胴体）
    "pink_rib": dict(style="rib", wall=PINK, **WHITE_BAND),       # 案2 縦の溝（リブ）
    "pink_quilt": dict(style="quilt", wall=PINK, **WHITE_BAND),   # 案3 キルティング
}
args = [a for a in sys.argv[1:] if not a.startswith("--")]
opts = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
PAL = PALS[opts.get("pal", "gunjo")]
OUT = args[0] if args else os.path.normpath(os.path.join(HERE, "..", "..", "main", "pochamon-ufo", "assets", "room.webp"))
W, H = 2048, 1536
FH = int(H * 0.17)          # 下の帯の高さ（前のカーペットと同じ＝筐体と操作盤の足の線）
FY = H - FH


def grad(top, mid, bot, h):
    t = np.linspace(0, 1, h)[:, None]
    top, mid, bot = (np.array(c, np.float32) for c in (top, mid, bot))
    return np.where(t < 0.45, top + (mid - top) * (t / 0.45), mid + (bot - mid) * ((t - 0.45) / 0.55))


# ほかの台の灯りのぼけ（x, y は画面に対する割合・r は高さに対する割合・濃さ）。色は配色の glow から同じ順に
GLOWS = [(0.06, 0.09, 0.07, 150), (0.15, 0.04, 0.05, 120), (0.03, 0.30, 0.06, 95), (0.12, 0.62, 0.09, 90),
         (0.92, 0.06, 0.07, 135), (0.84, 0.12, 0.05, 110), (0.97, 0.34, 0.08, 110), (0.88, 0.70, 0.10, 80),
         (0.50, 0.02, 0.14, 45)]


def wall_bokeh():
    """2026-10-30 の絵と同じ作り方（グラデーション＋ほかの台の灯りのぼけ）。色は配色から"""
    base = grad(*PAL["wall"], H)[:, None, :].repeat(W, axis=1)
    img = Image.fromarray(base.astype(np.uint8), "RGB").convert("RGBA")
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    for (x, y, r, a), col in zip(GLOWS, PAL["glow"]):
        cx, cy, rr = x * W, y * H, r * H
        g.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=tuple(col) + (min(255, round(a * PAL["glow_k"])),))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(H * 0.035)))
    return img


def shade(h, light=(-0.3, -0.55, 0.78), amb=0.55, kd=0.45, ks=0.0, shin=20):
    """高さの地図 h（単位は画素）に左上からの光を当てた明るさの倍率と、つや（足す明るさ 0〜1）。平らな所は倍率1・つや0"""
    gy, gx = np.gradient(h)
    nz = 1.0 / np.sqrt(gx * gx + gy * gy + 1.0)
    nx, ny = -gx * nz, -gy * nz
    L = np.array(light, np.float32)
    L /= np.linalg.norm(L)
    diff = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    mul = (amb + kd * diff) / (amb + kd * L[2])
    spec = np.zeros_like(h)
    if ks:
        hv = L + np.array([0, 0, 1], np.float32)
        hv /= np.linalg.norm(hv)
        s = np.clip(nx * hv[0] + ny * hv[1] + nz * hv[2], 0, 1) ** shin
        spec = np.clip(s - hv[2] ** shin, 0, 1) * ks
    return mul, spec


def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def wall_lit():
    """ピンクの壁＝高さの地図に光を当てて立体に見せる（塗装の板／縦の溝／キルティング）。
    そのうえに天井の灯りの映り込み・部屋の明かり（下と左右の端を少し落とす）・帯の上の落ち影・塗装のきめ"""
    st = PAL["style"]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    h = np.zeros((H, W), np.float32)
    ao = np.ones((H, W), np.float32)          # 継ぎ目や溝の奥の暗がり
    sheen_k = 0.0
    if st == "panel":
        # 塗装の板：縦の継ぎ目を W/4 おき（真ん中の線をはさんで左右同じ）＋横の継ぎ目1本。板の縁は丸く面取り、表面はつや
        pitch = W / 4
        s = (xx - pitch / 2) % pitch
        dx = np.minimum(s, pitch - s)
        dy = np.abs(yy - H * 0.5)
        d = np.minimum(dx, dy)
        h = 9.0 * smooth(d / 22.0)
        ao = 1 - 0.35 * np.exp(-(d / 2.5) ** 2)
        mul, spec = shade(h, ks=0.12, shin=30)
        sheen_k = 0.12
    elif st == "rib":
        # 縦の溝（リブ）：幅 52 の丸い筋が縦に並ぶ。筋の左が光り、右が陰る
        w = 52.0
        u = (xx % w) / w * 2 - 1
        h = 12.0 * np.clip(np.cos(np.pi * u / 2), 0, 1) ** 0.8   # 端の cos は丸めでわずかに負になる（負の 0.8 乗は数にならない）
        ao = 1 - 0.30 * np.exp(-(((1 - np.abs(u)) * w / 2) / 2.5) ** 2)
        mul, spec = shade(h, ks=0.22, shin=26)
        sheen_k = 0.06
    else:
        # キルティング：菱形にふくらんだ布、縫い目の交点にボタン
        c = 150.0
        u, v = (xx + yy) / c, (xx - yy) / c
        fu, fv = u - np.floor(u), v - np.floor(v)
        cushion = 24.0 * np.clip(np.sin(np.pi * fu) * np.sin(np.pi * fv), 0, 1) ** 0.45
        ru, rv = np.round(u), np.round(v)
        r = np.hypot(xx - c * (ru + rv) / 2, yy - c * (ru - rv) / 2)
        rb = 0.055 * c
        btn = np.where(r < rb, 0.45 * 24.0 * np.sqrt(np.clip(1 - (r / rb) ** 2, 0, 1)), 0)
        h = np.maximum(cushion, btn)
        ds = np.minimum(np.minimum(fu, 1 - fu), np.minimum(fv, 1 - fv)) * c / math.sqrt(2)
        ao = (1 - 0.22 * np.exp(-(ds / 3.0) ** 2)) * np.where(r < rb, 1.0, 1 - 0.30 * np.exp(-(r / (0.10 * c)) ** 2))
        mul, spec = shade(h, ks=0.12, shin=14)
        sheen_k = 0.04
    albedo = grad(*PAL["wall"], H)[:, None, :]                     # (H, 1, 3)
    col = albedo * (mul * ao)[..., None] + (spec * 255)[..., None]
    room = (1.05 - 0.10 * yy / H) * (1 - 0.07 * np.abs(2 * xx / W - 1) ** 3)
    room *= np.where(yy < FY, 1 - 0.12 * np.exp(-(FY - yy) / 14.0), 1.0)   # 帯（筐体の一部＝手前）の上の落ち影
    col *= room[..., None]
    if sheen_k:   # 天井の灯りの映り込み（上の方に横長のうすい光）
        sheen = sheen_k * np.exp(-((yy - H * 0.06) / (H * 0.05)) ** 2) * (1 - 0.5 * np.abs(2 * xx / W - 1) ** 2)
        col += (255 - col) * sheen[..., None]
    # 塗装のきめ（ごく細かいむら・±1.5 くらい）
    rng = np.random.default_rng(1114)
    n = Image.fromarray(np.clip(128 + rng.standard_normal((H, W)) * 40, 0, 255).astype(np.uint8), "L")
    n = (np.asarray(n.filter(ImageFilter.GaussianBlur(0.8)), np.float32) - 128) / 40 * 1.5
    col += n[..., None]
    return Image.fromarray(np.clip(col, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def wall():
    return wall_bokeh() if PAL["style"] == "bokeh" else wall_lit()


def fit(im, size):
    s = size / max(im.width, im.height)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)


def band():
    """下の帯＝宇宙の柄：地に（星くず、）空と宇宙の部品をまっすぐ立てて、ちょうど3段の1マスおき（傾き・奥行きなし）"""
    rng = random.Random(1110)
    t = np.linspace(0, 1, FH)[:, None, None]
    top, bot = PAL["band"]
    a = (np.array(top, np.float32) * (1 - t) + np.array(bot, np.float32) * t).repeat(W, axis=1)
    img = Image.fromarray(a.astype(np.uint8), "RGB").convert("RGBA")
    if PAL.get("dust"):
        dust = Image.new("RGBA", (W, FH), (0, 0, 0, 0))
        d = ImageDraw.Draw(dust)
        for _ in range(90):
            x, y = rng.uniform(0, W), rng.uniform(0, FH)
            r = rng.choice([2, 2, 3])
            d.ellipse((x - r, y - r, x + r, y + r), fill=tuple(PAL["dust"]) + (rng.randint(70, 150),))
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
    if PAL.get("line"):
        line = Image.new("RGBA", (W, FH), (0, 0, 0, 0))
        ImageDraw.Draw(line).rectangle((0, 0, W, 4), fill=tuple(PAL["line"]))   # 壁との境目のうすい光（前の絵と同じ）
        img.alpha_composite(line)
    if PAL.get("edge"):     # 壁との境目＝暗い線の下に明るい線（帯の上の縁の面取り）
        dark, light = PAL["edge"]
        dr = ImageDraw.Draw(img)
        dr.rectangle((0, 0, W, 2), fill=tuple(dark))
        dr.rectangle((0, 3, W, 5), fill=tuple(light))
    return img


img = wall()
img.alpha_composite(band(), (0, FY))
img.convert("RGB").save(OUT, "WEBP", quality=86, method=6)
print(OUT, os.path.getsize(OUT) // 1024, "KB")
