"""Blender の書き出し v3（ufo_export.py の claws=0：背景・電球・ぬいぐるみ・影）をゲームの assets/ に取り込む。

  py -I tools/pochamon-ufo/sync_pile.py <export_dir> [<前の書き出しの bg.png>]

v9（2026-11-08・背面のモニター）：書き出しに monitor があれば、bg.png はモニターの画面が穴（透明）の絵。穴はそのまま残し（ゲームは
穴の下に電光パネルを描く）、穴の外で透明になった所（筐体の胴の外の下の角＝前は Blender の空の色）は、前の書き出しの bg.png で埋めて
今までと同じ見た目に保つ。正面の絵 front.png・札の切り出し fg_chute.png も WebP にする（どちらも透明つき）。

アームの絵（コマ表 claw_z*.webp）と UFO の影（clawsh_*.webp）は前の取り込みのまま残す（筐体の壁や山を変えてもアームの見た目は変わらない）。
やること
  - bg.png → assets/bg.webp
  - 電球の点灯コマ bulbw_NN.png → 「点灯−消灯（背景）」の差分 assets/bulb_NN.webp（ゲームは足し算で貼る＝sync_claw.py と同じ）
  - ぬいぐるみ pocha_NN.png・影 shadow_NN.png → WebP
  - assets/scene.json を新しい物に置き換え、claw_sheets / claw_shadows だけ前の物を引き継ぐ
カメラ（m_cam・fx・cx・cy）が前と違うとアームの位置が合わないので、その時は止める。
"""
import sys, os, json, time
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
from PIL import Image
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.normpath(os.path.join(HERE, "..", "..", "main", "pochamon-ufo", "assets"))
src = sys.argv[1]
S = json.load(open(os.path.join(src, "scene.json"), encoding="utf-8"))
OLD = json.load(open(os.path.join(DEST, "scene.json"), encoding="utf-8"))

# カメラが同じか（アームのコマ表は前のカメラで描いた絵）
c0, c1 = OLD["camera"], S["camera"]
err = max(abs(a - b) for ra, rb in zip(c0["m_cam"], c1["m_cam"]) for a, b in zip(ra, rb))
err = max(err, abs(c0["fx"] - c1["fx"]), abs(c0["cx"] - c1["cx"]), abs(c0["cy"] - c1["cy"]))
if err > 1e-3 or OLD["image"] != S["image"]:
    sys.exit("camera / image size differs from the current assets (max diff %.5f) — the claw sheets would not line up" % err)
if not OLD.get("claw_sheets"):
    sys.exit("the current assets have no claw_sheets to keep")

# 元の絵が全部そろっているか、消す前に確かめる（途中で欠けて止まると、古い scene.json が消えた絵を指したまま残る・10/30 検品）
need = ["bg.png"] + [t["file"] for t in S["bulbs"]["tiles"]]
if S.get("front_camera") and S["front_camera"].get("file"):
    need.append(S["front_camera"]["file"])
if S.get("fg_chute"):
    need.append(S["fg_chute"]["file"])
for t in S["toys"]:
    need += [x["file"] for x in (t.get("sprite"), t.get("shadow"), t.get("sprite_hang")) if x]
    need += [x["file"] for x in (t.get("sprite_tilt") or [])]
    for g in (t.get("grips") or []):   # 案A：つまむ所ごとの吊った姿と途中のコマ（10/30 午後）
        need += [g["hang"]["file"]] + [x["file"] for x in g.get("tilt", [])]
missing = [n for n in need if not os.path.exists(os.path.join(src, n))]
if missing:
    sys.exit("missing in the export: %s" % ", ".join(missing[:10]))

total_in = total_out = 0


def put(name, quality, im=None, out_name=None):
    global total_in, total_out
    p = os.path.join(src, name)
    total_in += os.path.getsize(p)
    if im is None:
        im = Image.open(p)
    out = out_name or (os.path.splitext(name)[0] + ".webp")
    im.save(os.path.join(DEST, out), "WEBP", quality=quality, method=6)
    total_out += os.path.getsize(os.path.join(DEST, out))
    return out


# 古い素材を掃除（背景・ぬいぐるみ・影・梁の電球）。アーム（claw_）と UFO の影（clawsh_）と操作盤の電球（bulb_L/R）は残す
for f in os.listdir(DEST):
    if f.split(".")[-1] not in ("png", "webp"):
        continue
    if f.startswith(("bg.", "pocha_", "shadow_", "front.", "fg_chute.")) or (f.startswith("bulb_") and not f.startswith(("bulb_L", "bulb_R"))):
        os.remove(os.path.join(DEST, f))

bg_src = Image.open(os.path.join(src, "bg.png"))
bg_im = bg_src.convert("RGB")
if S.get("monitor") and bg_src.mode == "RGBA":
    # 画面の穴（カメラで投影した四角を 4px 広げた中）だけ透明を残す。外の透明は前の bg.png で埋める
    from PIL import ImageDraw
    cam_ = S["camera"]; M_ = [x for r in cam_["m_cam"] for x in r]

    def P_(x, y, z):
        cx = M_[0] * x + M_[1] * y + M_[2] * z + M_[3]; cy = M_[4] * x + M_[5] * y + M_[6] * z + M_[7]; cz = M_[8] * x + M_[9] * y + M_[10] * z + M_[11]
        return (cam_["cx"] + cam_["fx"] * cx / -cz, cam_["cy"] - cam_["fy"] * cy / -cz)
    sc_ = S["monitor"]["screen"]
    quad_ = [P_(sc_["x0"], sc_["y"], sc_["z1"]), P_(sc_["x1"], sc_["y"], sc_["z1"]), P_(sc_["x1"], sc_["y"], sc_["z0"]), P_(sc_["x0"], sc_["y"], sc_["z0"])]
    hole_ = Image.new("L", bg_src.size, 0)
    ImageDraw.Draw(hole_).polygon(quad_, fill=255)
    hole_ = hole_.filter(__import__("PIL.ImageFilter", fromlist=["MaxFilter"]).MaxFilter(9))
    under_ = Image.open(sys.argv[2]).convert("RGBA") if len(sys.argv) > 2 else Image.new("RGBA", bg_src.size, (50, 44, 66, 255))
    if under_.size != bg_src.size:
        sys.exit("the old bg.png has another size")
    filled_ = under_.copy(); filled_.alpha_composite(bg_src.convert("RGBA"))
    bg_rgba = Image.composite(bg_src.convert("RGBA"), filled_, hole_)
    a_ = np.array(bg_rgba)[:, :, 3]
    print("bg: transparent px %d (inside the screen hole), outside the hole filled from %s" % (int((a_ < 250).sum()), sys.argv[2] if len(sys.argv) > 2 else "a flat colour"))
    S["files"] = {"bg": put("bg.png", 90, bg_rgba)}
else:
    S["files"] = {"bg": put("bg.png", 90, bg_im)}
if S.get("front_camera") and S["front_camera"].get("file"):
    S["front_camera"]["file"] = put(S["front_camera"]["file"], 90, Image.open(os.path.join(src, S["front_camera"]["file"])).convert("RGBA"))
if S.get("fg_chute"):
    S["fg_chute"]["file"] = put(S["fg_chute"]["file"], 92, Image.open(os.path.join(src, S["fg_chute"]["file"])).convert("RGBA"))

bg_arr = np.array(bg_im).astype(np.int16)
tiles = []
for t in S["bulbs"]["tiles"]:
    lit = np.array(Image.open(os.path.join(src, t["file"])).convert("RGB")).astype(np.int16)
    x, y, w, h = t["rect"]
    diff = np.clip(lit - bg_arr[y:y + h, x:x + w] - 3, 0, 255).astype(np.uint8)   # −3 でノイズの差を消す
    name = put(t["file"], 88, Image.fromarray(diff), "bulb_%02d.webp" % t["i"])
    tiles.append({"i": t["i"], "file": name, "rect": t["rect"], "c": t["c"], "r": t["r"], "blend": "lighter"})
S["bulbs"] = {"tiles": tiles, "pitch_px": S["bulbs"]["pitch_px"], "r_px": S["bulbs"]["r_px"], "n": 17}

for t in S["toys"]:
    if t.get("sprite"):
        t["sprite"]["file"] = put(t["sprite"]["file"], 92)
    if t.get("shadow"):
        t["shadow"]["file"] = put(t["shadow"]["file"], 80)
    # びろーんのぶら下がった姿（ufo_export.py v4・10/30 朝）。無い子は項目ごと落とす（null を残すとゲームが assets/null を読みに行く）
    if t.get("sprite_hang"):
        t["sprite_hang"]["file"] = put(t["sprite_hang"]["file"], 92)
    else:
        t.pop("sprite_hang", None)
    if t.get("sprite_tilt"):   # 寝た姿とぶら下がった姿の間の6コマ（10/30 昼）
        for st in t["sprite_tilt"]:
            st["file"] = put(st["file"], 92)
    else:
        t.pop("sprite_tilt", None)
    if not t.get("footprint"):
        t.pop("footprint", None)
    if t.get("grips"):
        for g in t["grips"]:
            g["hang"]["file"] = put(g["hang"]["file"], 92)
            for st in g.get("tilt", []):
                st["file"] = put(st["file"], 92)
    else:
        t.pop("grips", None)

S.pop("claw_sprites", None)
S["claw_sheets"] = OLD["claw_sheets"]
S["claw_shadows"] = OLD.get("claw_shadows", [])
S["synced"] = time.strftime("%Y-%m-%d %H:%M:%S")
S["source"] = os.path.abspath(src)
S["synced_claw"] = OLD.get("synced_claw")
S["source_claw"] = OLD.get("source_claw")
with open(os.path.join(DEST, "scene.json"), "w", encoding="utf-8") as fh:
    json.dump(S, fh, ensure_ascii=False, separators=(",", ":"))
kinds = {}
for t in S["toys"]:
    kinds[t.get("kind", "normal")] = kinds.get(t.get("kind", "normal"), 0) + 1
print("assets ->", DEST)
print("images: %.1f MB -> %.1f MB" % (total_in / 1e6, total_out / 1e6))
print("toys", len(S["toys"]), kinds, "shadows", sum(1 for t in S["toys"] if t.get("shadow")), "bulb tiles", len(tiles),
      "claw sheets kept", len(S["claw_sheets"]), "floor_z", S["machine"].get("floor_z"))
print("→ 忘れずに：sw.js の CACHE_NAME と index.html の ?v= を上げる（溜め込みが古い絵を出し続けるため）")
