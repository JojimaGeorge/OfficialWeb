"""カメラが正面⇄いつもの斜め上を動く途中のコマ（ufo_export.py v10 の move=N,PCT）を、ゲームの assets/ に取り込む。

  py -I tools/pochamon-ufo/sync_move.py <export_dir>

2026-11-09 本人「コインを入れた後、一旦ホワイトアウトして斜めのアングルになるけど、そのままシームレスに斜めに滑らかに変わってほしい」
「最後ゲーム遊び終わった時に斜めから正面に戻る時も、ここも滑らかに繋がるようにしてほしい」。

やること
  - move_NN.png → assets/move_NN.webp（透明つき。モニターの画面は穴＝ゲームは穴の下に電光パネルを描く）
  - assets/scene.json に camera_move（コマごとのカメラ：s・fx・cx・cy・m_cam）を足す。ほかの所は触らない
  - 11/10（v13 の ext=80）：書き出しに絵の下の描き足しがあれば、正面の絵 front.png → front.webp と、いつもの絵の下の帯
    bg_ext.png → bg_ext.webp も取り込む（scene.json の front_camera.ext・bg_ext）。いつもの絵 bg.webp は触らない
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
                        source=os.path.basename(os.path.normpath(src)), ext=mv.get("ext", 0))

# 11/10（ufo_export.py v13 の ext=80）：絵の下に描き足した行。4:3 や iPad で出る下の空きを、端の1行を伸ばさずに本当の絵で埋める
# （本人「景品取り出し口がゲームスタート時とタイトルで角度変わるときに表示がバグってる」＝伸ばした行が取り出し口を横切っていた）。
#  ・正面の絵 front.png（描き足した分ごと 1800×2080）→ assets/front.webp
#  ・いつもの絵の下の帯 bg_ext.png（いつもの絵の最後の数行＋描き足した行）→ 描き足した行だけ assets/bg_ext.webp。いつもの絵 bg.webp は触らない。
#    帯の中の筐体の外（透明）は、今の bg.webp の最後の行の色で埋める（今まで伸ばしていた色＝見た目を変えない）
fc = S.get("front_camera") or {}
if fc.get("ext") and os.path.exists(os.path.join(src, "front.png")):
    im = Image.open(os.path.join(src, "front.png")).convert("RGBA")
    if im.size[1] != S["image"]["height"] + fc["ext"]:
        sys.exit("front.png の高さが %d（絵 %d＋描き足し %d のはず）" % (im.size[1], S["image"]["height"], fc["ext"]))
    im.save(os.path.join(DEST, "front.webp"), "WEBP", quality=90, method=6)
    G["front_camera"]["ext"] = fc["ext"]
    print("front.webp", im.size, "ext", fc["ext"], "%.1f MB" % (os.path.getsize(os.path.join(DEST, "front.webp")) / 1e6))
be = S.get("bg_ext")
if be and os.path.exists(os.path.join(src, be["file"])):
    band = Image.open(os.path.join(src, be["file"])).convert("RGBA")
    ov, rows = be["overlap"], be["rows"]
    if band.size != (S["image"]["width"], ov + rows):
        sys.exit("bg_ext.png の大きさが %s（%d×%d のはず）" % (band.size, S["image"]["width"], ov + rows))
    import numpy as np
    bg = np.array(Image.open(os.path.join(DEST, G["files"]["bg"])).convert("RGBA")).astype(np.int16)
    b = np.array(band).astype(np.int16)
    # つなぎ目の確かめ：帯の上の数行（いつもの絵の最後の行と同じ所）と、今の bg.webp の最後の数行の違い（不透明な所だけ）
    top, last = b[:ov], bg[-ov:]
    m = (top[:, :, 3] > 250) & (last[:, :, 3] > 250)
    seam = np.abs(top[:, :, :3] - last[:, :, :3]).max(axis=2)[m]
    print("bg_ext seam: mean diff %.1f / 95%% %.0f (0-255, the bg.webp is lossy)" % (seam.mean(), np.percentile(seam, 95)))
    if seam.mean() > 12:
        sys.exit("止めた：帯の上の端が今の bg.webp と合わない（平均 %.1f）＝別の絵の書き出し" % seam.mean())
    ext = b[ov:].copy()
    clear = ext[:, :, 3] < 250
    fill = np.repeat(bg[-1:, :, :], rows, axis=0)
    ext[clear] = fill[clear]
    Image.fromarray(ext.clip(0, 255).astype(np.uint8), "RGBA").save(os.path.join(DEST, "bg_ext.webp"), "WEBP", quality=90, method=6)
    G["bg_ext"] = dict(file="bg_ext.webp", rows=rows)
    print("bg_ext.webp", (ext.shape[1], ext.shape[0]), "filled from the bg's last row:", int(clear.sum()), "px")
# 11/10（v13 の doorpatch=1）：いつもの絵の取り出し口のまわりを、1枚の枠で描き直した絵（bg.webp の枠は4本の箱の重なりで、角が暗い四角）。
# ゲームは bg の上にこれを貼る。bg.webp は触らない
bd = S.get("bg_door")
if bd and os.path.exists(os.path.join(src, bd["file"])):
    import numpy as np
    pd = Image.open(os.path.join(src, bd["file"])).convert("RGBA")
    x, y, w, h = bd["rect"]
    if pd.size != (w, h):
        sys.exit("bg_door.png の大きさが %s（%d×%d のはず）" % (pd.size, w, h))
    cur = np.array(Image.open(os.path.join(DEST, G["files"]["bg"])).convert("RGBA")).astype(np.int16)[y:y + h, x:x + w]
    p = np.array(pd).astype(np.int16)
    ring = np.zeros((h, w), bool); ring[:6, :] = ring[-6:, :] = True; ring[:, :6] = ring[:, -6:] = True   # ふちの 6px（扉の外の胴）
    edge = np.abs(p[:, :, :3] - cur[:, :, :3]).max(axis=2)[ring]
    print("bg_door edge vs bg.webp: mean diff %.1f / 95%% %.0f" % (edge.mean(), np.percentile(edge, 95)))
    if edge.mean() > 10:
        sys.exit("止めた：bg_door のふちが今の bg.webp と合わない（平均 %.1f）" % edge.mean())
    pd.save(os.path.join(DEST, "bg_door.webp"), "WEBP", quality=92, method=6)
    G["bg_door"] = dict(file="bg_door.webp", rect=bd["rect"])
    print("bg_door.webp", pd.size, "at", bd["rect"][:2])
with open(os.path.join(DEST, "scene.json"), "w", encoding="utf-8") as fh:
    json.dump(G, fh, ensure_ascii=False, separators=(",", ":"))
print("取り込み %d 枚・合計 %.1f MB" % (len(frames), total / 1e6))
print("→ 忘れずに：sw.js の CACHE_NAME と index.html の ?v= を上げる（溜め込みが古い絵を出し続けるため）")
