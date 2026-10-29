"""AE の素材（1080×1920 の全面レイヤー PNG）から、右下で見物しているぽちゃもんの顔パーツを切り出して assets/ へ。

  py -I tools/pochamon-ufo/sync_face.py

素体の不透明な範囲（右下の角で切れている）を共通の枠にして、目と口も同じ枠で切る＝ゲーム側は同じ位置に重ねるだけ。
出力は face_*.webp と face.json（枠の大きさ・ファイル名）。
"""
import os, json, time
from PIL import Image

SRC = r"E:\イラスト\ぽちゃもん\1_アニメ\UFOキャッチャー"
HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.normpath(os.path.join(HERE, "..", "..", "main", "pochamon-ufo", "assets"))
PARTS = {
    "body": "最前モモンガ素体.png",
    "eyes_open": "最前モモンガ_開き目.png",      # 真顔
    "eyes_half": "最前モモンガ_半目.png",        # ニヤッ（口と組）
    "eyes_closed": "最前モモンガ_閉じ目.png",    # まばたき
    "mouth": "最前モモンガ_口.png",
}

body = Image.open(os.path.join(SRC, PARTS["body"])).convert("RGBA")
box = body.getchannel("A").getbbox()
files, total = {}, 0
for key, name in PARTS.items():
    im = Image.open(os.path.join(SRC, name)).convert("RGBA")
    assert im.size == body.size, f"{name}: size {im.size} != {body.size}"
    out = f"face_{key}.webp"
    im.crop(box).save(os.path.join(DEST, out), "WEBP", quality=92, method=6)
    files[key] = out
    total += os.path.getsize(os.path.join(DEST, out))
meta = {"size": [box[2] - box[0], box[3] - box[1]], "crop": list(box), "canvas": list(body.size),
        "source": SRC, "synced": time.strftime("%Y-%m-%d %H:%M:%S"), "files": files}
with open(os.path.join(DEST, "face.json"), "w", encoding="utf-8") as fh:
    json.dump(meta, fh, ensure_ascii=False, separators=(",", ":"))
print("crop", box, "size", meta["size"], "files", len(files), "%.0f KB" % (total / 1024))
