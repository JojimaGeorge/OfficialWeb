"""Blender の操作盤の書き出し（console_export.py の出力フォルダ）をゲームの assets/ に取り込む。

  py -I tools/pochamon-ufo/sync_console.py <export_console_dir> [--png]

PNG を WebP（可逆ではなく高品質）に変換して置き、console.json はファイル名を差し替えて assets/console.json に書く。
"""
import sys, os, json, shutil, time
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.normpath(os.path.join(HERE, "..", "..", "main", "pochamon-ufo", "assets"))
src = sys.argv[1]
use_png = "--png" in sys.argv
os.makedirs(DEST, exist_ok=True)

C = json.load(open(os.path.join(src, "console.json"), encoding="utf-8"))
total_in = total_out = 0


def put(name, quality):
    global total_in, total_out
    p = os.path.join(src, name)
    total_in += os.path.getsize(p)
    if use_png:
        shutil.copy2(p, os.path.join(DEST, name))
        total_out += os.path.getsize(os.path.join(DEST, name))
        return name
    out = os.path.splitext(name)[0] + ".webp"
    Image.open(p).save(os.path.join(DEST, out), "WEBP", quality=quality, method=6)
    total_out += os.path.getsize(os.path.join(DEST, out))
    return out


for f in os.listdir(DEST):
    if f.startswith(("console_", "cap", "ring", "coin_", "bulb_L", "bulb_R")) and f.split(".")[-1] in ("png", "webp"):   # coin_sheet も coin_ で掃除される
        os.remove(os.path.join(DEST, f))

import numpy as np
base = {side: np.array(Image.open(os.path.join(src, f"console_{side}.png")).convert("RGBA")).astype(np.int16) for side in ("L", "R")}
base_rect = {side: C["sprites"][f"console_{side}"]["rect"] for side in ("L", "R")}
# コイン：向きごとの絵（coin_NN.png）を1枚のコマ表にまとめる（ます目は一番大きい絵。0.6倍＝画面 130px の 2x でも 1:1 以上）
import math
COIN_SHEET_SCALE = 0.6
coin_keys = sorted(k for k in C["sprites"] if k.startswith("coin_"))
if coin_keys:
    frames = [(C["sprites"][k]["deg"], Image.open(os.path.join(src, C["sprites"][k]["file"])).convert("RGBA"), C["sprites"][k]) for k in coin_keys]
    cw = max(im.size[0] for _, im, _ in frames); chh = max(im.size[1] for _, im, _ in frames)
    cols = 8; rows = math.ceil(len(frames) / cols)
    sheet = Image.new("RGBA", (cw * cols, chh * rows), (0, 0, 0, 0))
    out_frames = []
    for i, (deg, im, spr) in enumerate(frames):
        x = (i % cols) * cw + (cw - im.size[0]) // 2; y = (i // cols) * chh + (chh - im.size[1]) // 2   # ます目の中央に
        sheet.paste(im, (x, y))
        out_frames.append({"deg": deg, "x": x * COIN_SHEET_SCALE, "y": y * COIN_SHEET_SCALE, "w": im.size[0] * COIN_SHEET_SCALE, "h": im.size[1] * COIN_SHEET_SCALE})
        total_in += os.path.getsize(os.path.join(src, spr["file"]))
    sheet = sheet.resize((round(sheet.size[0] * COIN_SHEET_SCALE), round(sheet.size[1] * COIN_SHEET_SCALE)), Image.LANCZOS)
    sheet.save(os.path.join(DEST, "coin_sheet.webp"), "WEBP", quality=92, method=6)
    total_out += os.path.getsize(os.path.join(DEST, "coin_sheet.webp"))
    C["coin"] = {"file": "coin_sheet.webp", "sheet": [sheet.size[0], sheet.size[1]], "scale": COIN_SHEET_SCALE, "frames": out_frames}
    for k in coin_keys:
        del C["sprites"][k]   # 1枚ずつの絵は置かない（コマ表で足りる）
    print("coin sheet", sheet.size, len(frames), "frames")
for key, spr in C["sprites"].items():
    if key.startswith("bulb_"):
        # 点灯の絵は「点灯−消灯」の差分（黒＝光なし）。ゲームは足し算（lighter）で貼る
        side = key[5]
        lit = np.array(Image.open(os.path.join(src, spr["file"])).convert("RGBA")).astype(np.int16)
        x, y, w, h = spr["rect"]; bx, by = base_rect[side][0], base_rect[side][1]
        # コマは操作盤の絵の外（天井の上）にはみ出すことがある＝はみ出た分はゼロ（透明＝光なし）で埋めて同じ大きさにそろえる
        sub = np.zeros((h, w, 4), np.int16)
        sx0, sy0 = max(0, x - bx), max(0, y - by)
        sx1, sy1 = min(base[side].shape[1], x - bx + w), min(base[side].shape[0], y - by + h)
        if sx1 > sx0 and sy1 > sy0:
            sub[sy0 - (y - by):sy1 - (y - by), sx0 - (x - bx):sx1 - (x - bx)] = base[side][sy0:sy1, sx0:sx1]
        diff = np.clip(lit[:, :, :3] - sub[:, :, :3] - 3, 0, 255).astype(np.uint8)
        # 透明情報＝操作盤の輪郭（天井の上の空きに足すと canvas では不透明な黒になるので、操作盤の外は透明にしておく）
        rgba = np.dstack([diff, sub[:, :, 3].astype(np.uint8)])
        total_in += os.path.getsize(os.path.join(src, spr["file"]))
        out = key + ".webp"
        Image.fromarray(rgba, "RGBA").save(os.path.join(DEST, out), "WEBP", quality=88, method=6)
        total_out += os.path.getsize(os.path.join(DEST, out))
        spr["file"] = out; spr["blend"] = "lighter"
        continue
    spr["file"] = put(spr["file"], 92)
C["synced"] = time.strftime("%Y-%m-%d %H:%M:%S")
C["source"] = os.path.abspath(src)
with open(os.path.join(DEST, "console.json"), "w", encoding="utf-8") as fh:
    json.dump(C, fh, ensure_ascii=False, separators=(",", ":"))
print("assets ->", DEST)
print("images: %.2f MB -> %.2f MB" % (total_in / 1e6, total_out / 1e6))
print("sprites", len(C["sprites"]))
