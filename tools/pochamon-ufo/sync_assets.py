"""Blender の書き出し（ufo_export.py の出力フォルダ）をゲームの assets/ に取り込む。

  py -I tools/pochamon-ufo/sync_assets.py <export_dir> [--png]

PNG を WebP に変換して置く（iPadOS 14 以降は WebP を読める）。--png で変換せずそのまま複製。
scene.json はファイル名を差し替えた物を assets/scene.json に書く。
"""
import sys, os, json, shutil, time
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.normpath(os.path.join(HERE, "..", "..", "main", "pochamon-ufo", "assets"))
src = sys.argv[1]
use_png = "--png" in sys.argv
os.makedirs(DEST, exist_ok=True)

S = json.load(open(os.path.join(src, "scene.json"), encoding="utf-8"))
total_in = total_out = 0


def put(name, quality):
    """src/name -> DEST/<name or .webp>; returns the new file name."""
    global total_in, total_out
    p = os.path.join(src, name)
    total_in += os.path.getsize(p)
    if use_png:
        shutil.copy2(p, os.path.join(DEST, name))
        total_out += os.path.getsize(os.path.join(DEST, name))
        return name
    out = os.path.splitext(name)[0] + ".webp"
    im = Image.open(p)
    im.save(os.path.join(DEST, out), "WEBP", quality=quality, method=6)
    total_out += os.path.getsize(os.path.join(DEST, out))
    return out


# 古い素材を掃除（名前が変わった時の取り残し防止）。消すのは画像だけ。
for f in os.listdir(DEST):
    if f.startswith(("bg.", "pocha_", "shadow_", "claw_")) and f.split(".")[-1] in ("png", "webp"):
        os.remove(os.path.join(DEST, f))

S["files"] = {"bg": put("bg.png", 90)}
for t in S["toys"]:
    if t.get("sprite"):
        t["sprite"]["file"] = put(t["sprite"]["file"], 92)
    if t.get("shadow"):
        t["shadow"]["file"] = put(t["shadow"]["file"], 80)
for c in S["claw_sprites"]:
    c["file"] = put(c["file"], 92)
S["synced"] = time.strftime("%Y-%m-%d %H:%M:%S")
S["source"] = os.path.abspath(src)
with open(os.path.join(DEST, "scene.json"), "w", encoding="utf-8") as fh:
    json.dump(S, fh, ensure_ascii=False, separators=(",", ":"))
print("assets ->", DEST)
print("images: %.1f MB -> %.1f MB" % (total_in / 1e6, total_out / 1e6))
print("toys", len(S["toys"]), "shadows", sum(1 for t in S["toys"] if t.get("shadow")), "claw sprites", len(S["claw_sprites"]))
