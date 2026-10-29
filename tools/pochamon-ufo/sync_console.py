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
    if f.startswith(("console_", "cap", "ring", "coin_", "bulb_L", "bulb_R")) and f.split(".")[-1] in ("png", "webp"):
        os.remove(os.path.join(DEST, f))

import numpy as np
base = {side: np.array(Image.open(os.path.join(src, f"console_{side}.png")).convert("RGBA")).astype(np.int16) for side in ("L", "R")}
base_rect = {side: C["sprites"][f"console_{side}"]["rect"] for side in ("L", "R")}
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
