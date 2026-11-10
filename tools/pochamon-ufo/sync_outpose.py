"""取り出し口から出てくる子の「正面を向いた絵」をゲームへ取り込む → main/pochamon-ufo/assets/out_*.webp と scene.json の out_pose

  py -I tools/pochamon-ufo/sync_outpose.py <Blender の書き出しフォルダ（outpose.json がある所）>

2026-11-10 本人「ゲットした時に出口から転がって出てくるんだけど、向きが下を向いたり変な方向を向いて出てくる。中に並んでた時の角度のまま
出てくるから、何をゲットしたか分からない。ゲットした時は正面を向くように」。
前は山にいた時の1枚（寝た向き・横向き）をそのまま回していた。種類ごと（ふつう・寝顔・びろーん）に、顔をカメラへまっすぐ向けた絵を描いた。

Blender の書き出し：ufo_export.py v12 に outpose=1 を足して、本番と同じ引数で流す（山は作らずに約30秒で止まる）。
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --python ufo_export.py -- <OUT> 17 24 2.0 F 128 0 1 full 0 full 0
      kinds=17,7,2 decor=pattern stones=mix claws=0 grips=1 monitor=full big=1.1,0.08,0.14,55,35 fcam=2.2,0.50,0.36
      fgchute=1 titlez=0.70 titlex=-0.38 outpose=1
1体ずつ、筐体の中のガラスの近く（outp・照明が山の子と同じ）に浮かせ、顔をカメラへ・頭を絵の上へ向けて、いつもの 1.5 倍の細かさで描く。
ゲーム（game.js の drawToyOut）は、絵の anchor（浮かせた点が絵のどこに写るか）を取り出し口の前の点に合わせ、奥行きの比で縮めて描く。

ゲームのカメラ（scene.json の camera）と照らし合わせ、違えば書かずに止める。
"""
import json, os, sys, time
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, "..", "..", "main", "pochamon-ufo", "assets"))
src_dir = sys.argv[1]
op = json.load(open(os.path.join(src_dir, "outpose.json"), encoding="utf-8"))
scene_path = os.path.join(ASSETS, "scene.json")
S = json.load(open(scene_path, encoding="utf-8"))

# ゲームと同じカメラ・同じ絵の大きさか
if op["image"]["width"] != S["image"]["width"] or op["image"]["height"] != S["image"]["height"]:
    sys.exit("STOP: 絵の大きさがゲームと違う（%s / %s）" % (op["image"], S["image"]))
worst = max(abs(a - b) for ra, rb in zip(op["camera"]["m_cam"], S["camera"]["m_cam"]) for a, b in zip(ra, rb))
worst = max(worst, *(abs(op["camera"][k] - S["camera"][k]) / 1000 for k in ("fx", "cx", "cy")))
if worst > 1e-4:
    sys.exit("STOP: カメラがゲームと違う（差 %.6f）" % worst)

kinds = {}
for kd in ("normal", "sleep", "biroon"):
    k = op["kinds"].get(kd)
    if not k:
        sys.exit("STOP: %s の絵が無い" % kd)
    im = Image.open(os.path.join(src_dir, k["file"])).convert("RGBA")
    if list(im.size) != k["size"]:
        sys.exit("STOP: %s の絵の大きさが書き出しの記録と違う（%s / %s）" % (kd, im.size, k["size"]))
    name = "out_%s.webp" % kd
    im.save(os.path.join(ASSETS, name), "WEBP", quality=92, method=6)
    kinds[kd] = dict(file=name, rect=k["rect"], size=k["size"], box=k["box"], zlo=k["zlo"], zhi=k["zhi"])
    print("  %s -> %s %s %d KB" % (k["file"], name, k["size"], os.path.getsize(os.path.join(ASSETS, name)) // 1024))

S["out_pose"] = dict(p=op["p"], anchor=op["anchor"], res=op["kinds"]["normal"]["res"], kinds=kinds,
                     generated=op["generated"], synced=time.strftime("%Y-%m-%d %H:%M:%S"), source=os.path.abspath(src_dir))
with open(scene_path, "w", encoding="utf-8") as fh:
    json.dump(S, fh, ensure_ascii=False, separators=(",", ":"))
print("OK scene.json out_pose  anchor", op["anchor"], "camera diff %.6f" % worst)
