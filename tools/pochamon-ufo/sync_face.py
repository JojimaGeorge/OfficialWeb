"""右下で見物しているぽちゃもんのコマ表（スプライトシート）を、AE の書き出し（TIFF・アルファ付き）から作って assets/ へ。

  py -I tools/pochamon-ufo/sync_face.py [<export_face_dir>]

書き出しは ~/dev/ai-illust/ae/ufo_render_face2.jsx（元の aep の「詳細」コンポ＝タービュレントディスプレイス付き・
最前モモンガ層だけ表示・表情ごとの時刻を1コマずつレンダーキューへ）。コマの名前と時刻の対応はその台本が正。

ここでやること：全コマの不透明な範囲の和集合を共通の枠にして切る（右と下は画面の縁で切れている絵なので、枠の右下＝コンポの右下）
→ 0.75 倍に縮めて 2 枚のコマ表に並べる（A＝ふだん・まばたき・ニヤッになる途中、B＝ニヤッ中・そのまばたき・戻る途中）
→ face.json にコマの位置と「クリップ」（どのコマを何コマ分見せるか・30コマ/秒のきざみ）を書く。
"""
import sys, os, re, json, time, glob
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.normpath(os.path.join(HERE, "..", "..", "main", "pochamon-ufo", "assets"))
SRC = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else r"E:\イラスト\ぽちゃもん\1_アニメ\UFOキャッチャー\export_face"
SCALE = 0.75
COMP = (1080, 1920)

# 1) コマを読む（名前_フレーム番号.png → 名前）。AE の TIFF は PIL が透明を読めないので、先に ffmpeg で PNG に直しておく：
#    for f in *.tif; do ffmpeg -y -v error -i "$f" -pix_fmt rgba "${f%.tif}.png"; done
GROUPS = {
    "A": [f"open_{k:02d}" for k in range(12)] + ["blink_half_a", "blink_closed_a", "blink_closed_b", "blink_half_b"] + [f"grinin_{k:02d}" for k in range(9)],
    "B": [f"grin_{k:02d}" for k in range(12)] + ["gblink_half_a", "gblink_closed_a", "gblink_closed_b", "gblink_half_b"] + [f"grinout_{k:02d}" for k in range(15)],
}
WANT = set(GROUPS["A"] + GROUPS["B"])
frames = {}
for f in sorted(glob.glob(os.path.join(SRC, "*.png"))):
    m = re.match(r"^(.+)_(\d+)\.png$", os.path.basename(f))
    if not m or m.group(1) not in WANT:
        continue   # 試し書きの余分なファイルなどは無視
    im = Image.open(f).convert("RGBA")
    assert im.size == COMP, f"{f}: {im.size}"
    frames[m.group(1)] = im
missing = sorted(WANT - set(frames))
assert not missing, f"コマが足りない: {missing}"

# 2) 共通の枠：全コマの不透明な範囲の和集合。右と下はコンポの縁まで（絵が縁で切れている）
x0 = y0 = 10 ** 9
for im in frames.values():
    bb = im.getchannel("A").getbbox()
    x0, y0 = min(x0, bb[0]), min(y0, bb[1])
x0, y0 = max(0, x0 - 4), max(0, y0 - 4)
box = (x0, y0, COMP[0], COMP[1])
fw, fh = round((COMP[0] - x0) * SCALE), round((COMP[1] - y0) * SCALE)

# 3) 2枚のコマ表
os.makedirs(DEST, exist_ok=True)
for f in os.listdir(DEST):
    if f.startswith("face_") and f.split(".")[-1] in ("png", "webp"):
        os.remove(os.path.join(DEST, f))
index, files, total = {}, {}, 0
for key, names in GROUPS.items():
    cols = 5 if len(names) <= 25 else 6
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * fw, rows * fh), (0, 0, 0, 0))
    for i, n in enumerate(names):
        im = frames[n].crop(box).resize((fw, fh), Image.LANCZOS)
        sheet.alpha_composite(im, ((i % cols) * fw, (i // cols) * fh))
        index[n] = {"sheet": key, "x": (i % cols) * fw, "y": (i // cols) * fh}
    out = f"face_sheet_{key}.webp"
    sheet.save(os.path.join(DEST, out), "WEBP", quality=90, method=6)
    files[key] = out
    total += os.path.getsize(os.path.join(DEST, out))
    print(key, sheet.size, "%.0f KB" % (os.path.getsize(os.path.join(DEST, out)) / 1024))

# 4) クリップ：[コマ名, 見せる長さ（30分の1秒のきざみ）]。揺れの素は秒6コマ（元の式 posterizeTime(6)）＝5きざみ
T6 = 5
clips = {
    "idle": [[f"open_{k:02d}", T6] for k in range(12)],
    "blink": [["blink_half_a", 3], ["blink_closed_a", 4], ["blink_closed_b", 4], ["blink_half_b", 2]],
    "grin_in": [[f"grinin_{k:02d}", 1] for k in range(9)],
    "grin": [[f"grin_{k:02d}", T6] for k in range(12)],
    "grin_blink": [["gblink_half_a", 3], ["gblink_closed_a", 4], ["gblink_closed_b", 4], ["gblink_half_b", 2]],
    "grin_out": [[f"grinout_{k:02d}", 1] for k in range(15)],
}
meta = {"version": 2, "size": [fw, fh], "crop": list(box), "canvas": list(COMP), "scale": SCALE, "tick_fps": 30,
        "files": files, "frames": index, "clips": clips, "source": SRC, "synced": time.strftime("%Y-%m-%d %H:%M:%S")}
with open(os.path.join(DEST, "face.json"), "w", encoding="utf-8") as fh_:
    json.dump(meta, fh_, ensure_ascii=False, separators=(",", ":"))
print("crop", box, "frame", (fw, fh), "frames", len(index), "total %.0f KB" % (total / 1024))

# 5) 確認用：代表コマを並べた絵（Temp へ）
chk = ["open_00", "open_01", "open_02", "blink_closed_a", "grinin_04", "grin_00", "grin_01", "grinout_07"]
tw, th = 300, round(300 * fh / fw)
sheet = Image.new("RGB", (len(chk) * (tw + 6) + 6, th + 30), (74, 63, 102))
from PIL import ImageDraw
d = ImageDraw.Draw(sheet)
for i, n in enumerate(chk):
    im = frames[n].crop(box).resize((tw, th), Image.LANCZOS)
    tile = Image.new("RGBA", (tw, th), (74, 63, 102, 255)); tile.alpha_composite(im)
    sheet.paste(tile.convert("RGB"), (6 + i * (tw + 6), 24)); d.text((6 + i * (tw + 6), 6), n, fill=(255, 255, 255))
chk_path = os.path.join(os.environ.get("TEMP", "."), "ufo_report", "anim", "face_frames_check_" + time.strftime("%m%d-%H%M") + ".png")
os.makedirs(os.path.dirname(chk_path), exist_ok=True)
sheet.save(chk_path)
print("check", chk_path)
