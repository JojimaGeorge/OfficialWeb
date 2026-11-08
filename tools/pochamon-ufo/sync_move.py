"""カメラが正面⇄いつもの斜め上を動く途中のコマ（ufo_export.py v10 の move=N,PCT）を、ゲームの assets/ に取り込む。

  py -I tools/pochamon-ufo/sync_move.py <export_dir>

2026-11-09 本人「コインを入れた後、一旦ホワイトアウトして斜めのアングルになるけど、そのままシームレスに斜めに滑らかに変わってほしい」
「最後ゲーム遊び終わった時に斜めから正面に戻る時も、ここも滑らかに繋がるようにしてほしい」。

やること
  - move_NN.png → assets/move_NN.webp（透明つき。モニターの画面は穴＝ゲームは穴の下に電光パネルを描く）
  - assets/scene.json に camera_move（コマごとのカメラ：s・fx・cx・cy・m_cam）を足す。ほかの所は触らない
コマの絵には、ぬいぐるみの並び・アーム・台車が描き込んである。並びがゲームの今の並び（assets/scene.json）と違う書き出しを
取り込むと、動き出しと止まる所で山が入れ替わって見える＝ぬいぐるみの位置と2つのカメラを照らし合わせて、違ったら止める。
"""
import sys, os, json
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.normpath(os.path.join(HERE, "..", "..", "main", "pochamon-ufo", "assets"))
src = sys.argv[1]
S = json.load(open(os.path.join(src, "scene.json"), encoding="utf-8"))
G = json.load(open(os.path.join(DEST, "scene.json"), encoding="utf-8"))
mv = S.get("camera_move")
if not mv or not mv.get("frames"):
    sys.exit("camera_move がない（ufo_export.py を move=N,PCT で回した書き出しを渡す）")


def maxdiff(a, b):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(a - b)
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        return max([maxdiff(x, y) for x, y in zip(a, b)] or [0])
    return 0 if a == b else float("inf")


# 照らし合わせ：2つのカメラと、ぬいぐるみ1体ずつの位置・形（中心・つかむ点・上下・箱・画面の箱）
errs = []
for key in ("camera", "front_camera"):
    d = maxdiff(S[key]["m_cam"], G[key]["m_cam"])
    if d > 1e-4:
        errs.append("%s の m_cam が違う（%.6f）" % (key, d))
if len(S["toys"]) != len(G["toys"]):
    errs.append("ぬいぐるみの数が違う（書き出し %d・ゲーム %d）" % (len(S["toys"]), len(G["toys"])))
else:
    worst = (0, None)
    for a, b in zip(S["toys"], G["toys"]):
        if a["id"] != b["id"] or a["kind"] != b["kind"]:
            errs.append("並びの順・種類が違う（%s と %s）" % (a["id"], b["id"]))
            break
        for k in ("center", "grab", "ztop", "zbottom", "bbox", "screen"):
            d = maxdiff(a[k], b[k])
            if d > worst[0]:
                worst = (d, "%s.%s" % (a["id"], k))
    print("ぬいぐるみの位置の違い：最大 %.6f（%s）" % worst)
    if worst[0] > 2e-4 and worst[1] and not worst[1].endswith(".screen"):
        errs.append("ぬいぐるみの位置が違う（最大 %.6f・%s）" % worst)
    if worst[0] > 0.6 and worst[1] and worst[1].endswith(".screen"):
        errs.append("ぬいぐるみの画面の箱が違う（最大 %.3f px・%s）" % worst)
if errs:
    sys.exit("止めた：\n  " + "\n  ".join(errs))

frames = []
total = 0
for f in mv["frames"]:
    png = os.path.join(src, f["file"])
    out = os.path.splitext(f["file"])[0] + ".webp"
    im = Image.open(png).convert("RGBA")
    im.save(os.path.join(DEST, out), "WEBP", quality=80, method=6)
    total += os.path.getsize(os.path.join(DEST, out))
    g = dict(f)
    g["file"] = out
    g.pop("err", None)
    g.pop("position_local", None)
    frames.append(g)
    print(out, im.size, "s=%.4f" % f["s"])
G["camera_move"] = dict(n=mv["n"], pct=mv["pct"], ease=mv["ease"], size=mv["size"], frames=frames,
                        source=os.path.basename(os.path.normpath(src)))
with open(os.path.join(DEST, "scene.json"), "w", encoding="utf-8") as fh:
    json.dump(G, fh, ensure_ascii=False, separators=(",", ":"))
print("取り込み %d 枚・合計 %.1f MB" % (len(frames), total / 1e6))
print("→ 忘れずに：sw.js の CACHE_NAME と index.html の ?v= を上げる（溜め込みが古い絵を出し続けるため）")
