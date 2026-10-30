"""Blender の書き出し v3（ufo_export.py の claws=0：背景・電球・ぬいぐるみ・影）をゲームの assets/ に取り込む。

  py -I tools/pochamon-ufo/sync_pile.py <export_dir>

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
    if f.startswith(("bg.", "pocha_", "shadow_")) or (f.startswith("bulb_") and not f.startswith(("bulb_L", "bulb_R"))):
        os.remove(os.path.join(DEST, f))

bg_im = Image.open(os.path.join(src, "bg.png")).convert("RGB")
S["files"] = {"bg": put("bg.png", 90, bg_im)}

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
