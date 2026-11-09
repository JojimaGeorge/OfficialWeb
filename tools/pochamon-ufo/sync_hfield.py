"""ぬいぐるみの本当の形（上から見た高さの地図）をゲームへ取り込む → main/pochamon-ufo/assets/hfield.json

  py -I tools/pochamon-ufo/sync_hfield.py <Blender の書き出しフォルダ（hfield.json がある所）>

Blender の書き出し：ufo_export.py v11 に hfield=1 を足して、本番と同じ引数で流す（絵は描かずに約2分で止まる）。
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python ufo_export.py -- <OUT> 17 24 2.0 F 128 0 1 full 0 full 1
      kinds=17,7,2 decor=pattern stones=mix claws=0 grips=1 monitor=full big=1.1,0.08,0.14,55,35 fcam=2.2,0.50,0.36
      fgchute=1 titlez=0.70 titlex=-0.38 hfield=1
1体ずつ、筐体の床の上の 5mm のます目ごとに、見た目の形（体・ふちの線・しっぽ・耳）の一番高い所（top）と一番低い所（bot）。
ゲーム（game.js）は狙いの丸を top に置き、カメラへの見通しを top〜bot の柱で確かめる（隠れたら点線の輪）。

ゲームの今のぬいぐるみの並び（assets/scene.json）と、並び順・外形の箱・てっぺん・つかむ点を 0.5mm で照らし合わせ、
違えば書かずに止める（同じ引数でも条件を変えて落とし直すと別の並びになる＝10/30 の罠）。

高さは 0.25mm きざみの 16bit（(z + 0.05) * 4000・形の無います目は 65535）を base64 で（JSON の数字の並びの 1/3 の大きさ）。
"""
import base64, json, os, sys, time
from array import array

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, "..", "..", "main", "pochamon-ufo", "assets"))
src_dir = sys.argv[1]
hf = json.load(open(os.path.join(src_dir, "hfield.json"), encoding="utf-8"))
scene = json.load(open(os.path.join(ASSETS, "scene.json"), encoding="utf-8"))

# ゲームの並びと同じか
if hf["order"] != scene["order"] or len(hf["toys"]) != len(scene["toys"]):
    sys.exit("STOP: 並び順か数がゲームと違う（%s / %s）" % (len(hf["toys"]), len(scene["toys"])))
worst = 0.0
for a, b in zip(hf["toys"], scene["toys"]):
    if a["kind"] != b["kind"]:
        sys.exit("STOP: %d 番の種類が違う（%s / %s）" % (a["id"], a["kind"], b["kind"]))
    d = max([abs(x - y) for p, q in zip(a["bbox"], b["bbox"]) for x, y in zip(p, q)] +
            [abs(a["ztop"] - b["ztop"])] + [abs(x - y) for x, y in zip(a["grab"], b["grab"])])
    worst = max(worst, d)
    if d > 0.0005:
        sys.exit("STOP: %d 番の位置がゲームと %.1fmm 違う＝別の並び" % (a["id"], d * 1000))

out_toys = []
cells = 0
for t in hf["toys"]:
    enc = {}
    for key in ("top", "bot"):
        arr = array("H", [65535 if v is None else max(0, min(65534, round((v + 0.05) * 4000))) for v in t[key]])
        if sys.byteorder != "little":
            arr.byteswap()
        enc[key] = base64.b64encode(arr.tobytes()).decode("ascii")
    cells += t["nx"] * t["ny"]
    out_toys.append(dict(id=t["id"], x0=t["x0"], y0=t["y0"], nx=t["nx"], ny=t["ny"], top=enc["top"], bot=enc["bot"]))
doc = dict(version=1, step=hf["step"], enc="u16le:(z+0.05)*4000:65535=none", generated=hf["generated"],
           synced=time.strftime("%Y-%m-%d %H:%M:%S"), source=os.path.abspath(src_dir), toys=out_toys)
out = os.path.join(ASSETS, "hfield.json")
with open(out, "w", encoding="utf-8") as fh:
    json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
print("OK", out, "%d KB" % (os.path.getsize(out) // 1024), "toys", len(out_toys), "cells", cells, "worst diff %.3f mm" % (worst * 1000))
