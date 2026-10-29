"""Blender の「アームだけ」書き出し（ufo_export.py の MODE=claw・出力 claw.json）をゲームの assets/ に取り込む。

  py -I tools/pochamon-ufo/sync_claw.py <export_claw_dir>

やること
  - bg.png（電球オフ）→ assets/bg.webp に差し替え
  - 電球の点灯コマ bulb_NN.png → assets/bulb_NN.webp（枠内の11個）
  - アームの絵（9高さ×18角度）→ 高さごとに1枚のコマ表 assets/claw_zNN.webp に詰める（枚数を減らす・読み込みが速い）
  - UFO の影 clawsh_*.png（全画面）→ 不透明な所だけ切り出して assets/clawsh_*.webp
  - assets/scene.json に files.bg / claw_sheets / claw_shadows / bulbs を書き込む（ぬいぐるみの項はそのまま）
ぬいぐるみの絵と影は前の書き出しのまま使う（カメラと筐体は同じ台本なので位置が合う）。
"""
import sys, os, json, time, math
from PIL import Image
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.normpath(os.path.join(HERE, "..", "..", "main", "pochamon-ufo", "assets"))
src = sys.argv[1]
C = json.load(open(os.path.join(src, "claw.json"), encoding="utf-8"))
S = json.load(open(os.path.join(DEST, "scene.json"), encoding="utf-8"))
total_in = total_out = 0


def save_webp(im, name, quality):
    global total_out
    out = os.path.join(DEST, name)
    im.save(out, "WEBP", quality=quality, method=6)
    total_out += os.path.getsize(out)
    return name


def load(name):
    global total_in
    p = os.path.join(src, name)
    total_in += os.path.getsize(p)
    return Image.open(p)


# 古い素材を掃除（アーム・影・電球・背景）
for f in os.listdir(DEST):
    if f.startswith(("claw_", "clawsh_", "bulb_", "bg.")) and f.split(".")[-1] in ("png", "webp") and not f.startswith(("bulb_L", "bulb_R")):
        os.remove(os.path.join(DEST, f))

# 背景
S["files"] = {"bg": save_webp(load("bg.png").convert("RGB"), "bg.webp", 90)}

# 電球（枠内のぶんだけ）
# 点灯の絵は「点灯−消灯（背景）」の差分にする（黒＝光なし）。ゲームは足し算（lighter）で貼るので、コマの縁に継ぎ目が出ず、隣と重なってもよい
bg_arr = np.array(load("bg.png").convert("RGB")).astype(np.int16)
tiles = []
for t in C["bulbs"]["tiles"]:
    lit = np.array(load(t["file"]).convert("RGB")).astype(np.int16)
    x, y, w, h = t["rect"]
    diff = np.clip(lit - bg_arr[y:y + h, x:x + w] - 3, 0, 255).astype(np.uint8)   # −3 でノイズの差を消す
    name = save_webp(Image.fromarray(diff), "bulb_%02d.webp" % t["i"], 88)
    tiles.append({"i": t["i"], "file": name, "rect": t["rect"], "c": t["c"], "r": t["r"], "blend": "lighter"})
S["bulbs"] = {"tiles": tiles, "pitch_px": C["bulbs"]["pitch_px"], "r_px": C["bulbs"]["r_px"], "n": 17}

# アームのコマ表：高さごとに 6×3 のます目（ますの大きさ＝その高さで一番大きい絵）
sheets = []
by_z = {}
for c in C["claw_sprites"]:
    by_z.setdefault(c["z"], []).append(c)
for z in sorted(by_z, reverse=True):
    frames = sorted(by_z[z], key=lambda c: c["angle"])
    cw = max(c["size"][0] for c in frames)
    chh = max(c["size"][1] for c in frames)
    cols = 6
    rows = math.ceil(len(frames) / cols)
    sheet = Image.new("RGBA", (cw * cols, chh * rows), (0, 0, 0, 0))
    out_frames = []
    for k, c in enumerate(frames):
        im = load(c["file"]).convert("RGBA")
        x = (k % cols) * cw
        y = (k // cols) * chh
        sheet.paste(im, (x, y))
        out_frames.append({"angle": c["angle"], "x": x, "y": y, "w": c["size"][0], "h": c["size"][1],
                           "ax": c["anchor"][0], "ay": c["anchor"][1], "depth": c["depth"]})
    SHEET_SCALE = 0.7   # 画面では 1024×768 の 2x でも 1:1 以上（絵の px より画面の px が少ない）。メモリと容量を 1/2 に
    sheet = sheet.resize((round(sheet.size[0] * SHEET_SCALE), round(sheet.size[1] * SHEET_SCALE)), Image.LANCZOS)
    for f in out_frames:
        for k in ("x", "y", "w", "h", "ax", "ay"):
            f[k] = f[k] * SHEET_SCALE
    name = save_webp(sheet, "claw_z%02d.webp" % int(round(z * 100)), 92)
    sheets.append({"file": name, "z": z, "cell": [cw * SHEET_SCALE, chh * SHEET_SCALE], "scale": SHEET_SCALE, "frames": out_frames})
    print("sheet", name, sheet.size, len(frames), "frames")
S["claw_sheets"] = sheets
S.pop("claw_sprites", None)

# 影：天井の大きな光が真下に落とす影だけを使う（正面・背面・横の光が離れた所に落とす別の塊と、床の縁の線は捨てる）。
# 中心（アームの真下の床の点）から半径 R_KEEP px の円で切り出し、縁は FEATHER px でぼかす。anchor は切り出し後の座標に直す
R_KEEP, FEATHER = 300, 70
shadows = []
for sh in C["claw_shadows"]:
    im = load(sh["file"]).convert("RGBA")
    arr = np.array(im)
    ax, ay = sh["anchor"]
    H, W = arr.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.hypot(xx - ax, yy - ay)
    mask = np.clip((R_KEEP - r) / FEATHER, 0, 1)
    arr[:, :, 3] = (arr[:, :, 3].astype(np.float32) * mask).astype(np.uint8)
    a = arr[:, :, 3]
    amax = int(a.max())
    if amax < 3:
        print("shadow (none)", sh["file"], "alpha max", amax)
        shadows.append({"file": None, "h": sh["h"], "angle": sh["angle"], "amax": amax})
        continue
    ys, xs = np.where(a > 1)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
    crop = Image.fromarray(arr).crop((x0, y0, x1, y1))
    name = save_webp(crop, os.path.splitext(sh["file"])[0] + ".webp", 85)
    shadows.append({"file": name, "h": sh["h"], "angle": sh["angle"], "rect": [x0, y0, x1 - x0, y1 - y0],
                    "anchor": [sh["anchor"][0] - x0, sh["anchor"][1] - y0], "depth": sh["depth"], "amax": amax})
    print("shadow", name, crop.size, "alpha max", amax)
S["claw_shadows"] = shadows

S["synced_claw"] = time.strftime("%Y-%m-%d %H:%M:%S")
S["source_claw"] = os.path.abspath(src)
with open(os.path.join(DEST, "scene.json"), "w", encoding="utf-8") as fh:
    json.dump(S, fh, ensure_ascii=False, separators=(",", ":"))
print("assets ->", DEST)
print("images: %.1f MB -> %.1f MB" % (total_in / 1e6, total_out / 1e6))
print("sheets", len(sheets), "shadows", len(shadows), "bulb tiles", len(tiles))
