"""びろーんのコマの「画面上の向き」（ax / ax0）だけを、Blender の書き出しからゲームの assets/scene.json へ写す。

  py -I tools/pochamon-ufo/merge_ax.py <export_dir>

ufo_export.py v8（2026-11-05）が、つまむ所ごとの各コマに ax＝板の面の右と上（5cm 先）が画面のどこへ写るか、を書き出すようになった。
ゲームはこれを使って、コマとコマの間を「近いコマの絵を斜めにずらす」ことで埋める（game.js の morphOf）。
絵は1枚も変わらないので、sync_pile.py（全部の絵を WebP に変換し直す・2分超）は回さず、数値だけ足す。
並び・絵の位置が今のゲームと 1 体ずつ同じ（差 0）であることを確かめてから書く。違えば止める。
"""
import sys, os, json
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.normpath(os.path.join(HERE, "..", "..", "main", "pochamon-ufo", "assets", "scene.json"))
src = sys.argv[1]
A = json.load(open(os.path.join(src, "scene.json"), encoding="utf-8"))
B = json.load(open(DEST, encoding="utf-8"))

if A["order"] != B["order"] or len(A["toys"]) != len(B["toys"]):
    sys.exit("the pile differs (order / count)")
mx = 0.0
for ta, tb in zip(A["toys"], B["toys"]):
    if ta["id"] != tb["id"]:
        sys.exit("toy ids differ")
    mx = max(mx, max(abs(x - y) for x, y in zip(ta["center"], tb["center"])),
             max(abs(x - y) for x, y in zip(ta["sprite"]["rect"], tb["sprite"]["rect"])))
    ga_, gb_ = ta.get("grips") or [], tb.get("grips") or []
    if len(ga_) != len(gb_):
        sys.exit("grip counts differ (toy %d)" % ta["id"])
    for ga, gb in zip(ga_, gb_):
        if len(ga["tilt"]) != len(gb["tilt"]):
            sys.exit("tilt frame counts differ (toy %d)" % ta["id"])
        mx = max(mx, abs(ga["z"] - gb["z"]), max(abs(x - y) for x, y in zip(ga["grab"], gb["grab"])))
        for fa, fb in zip(ga["tilt"] + [ga["hang"]], gb["tilt"] + [gb["hang"]]):
            mx = max(mx, max(abs(x - y) for x, y in zip(fa["rect"], fb["rect"])), abs(fa["below"] - fb["below"]), abs(fa["f"] - fb["f"]))
if mx > 1e-6:
    sys.exit("the export differs from the current assets (max diff %.6f) - use sync_pile.py instead" % mx)

n = 0
for ta, tb in zip(A["toys"], B["toys"]):
    for ga, gb in zip(ta.get("grips") or [], tb.get("grips") or []):
        if "ax0" not in ga:
            sys.exit("the export has no ax0 (run ufo_export.py v8 or later)")
        gb["ax0"] = ga["ax0"]
        for fa, fb in zip(ga["tilt"] + [ga["hang"]], gb["tilt"] + [gb["hang"]]):
            fb["ax"] = fa["ax"]
            n += 1
B["source_ax"] = os.path.abspath(src)
with open(DEST, "w", encoding="utf-8") as fh:
    json.dump(B, fh, ensure_ascii=False, separators=(",", ":"))
print("max diff vs current assets: %g / ax written to %d frames ->" % (mx, n), DEST)
print("→ 忘れずに：sw.js の CACHE_NAME と index.html の ?v= を上げる")
