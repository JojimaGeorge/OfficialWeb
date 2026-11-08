"""背面モニター（電光パネル）の文字の点の並びを作る（2026-11-08）。

  py -I tools/pochamon-ufo/make_led_font.py <PixelMplus12-Bold.ttf>

書体＝PixelMplus12 Bold（M+ FONT LICENSE＝商用・非商用・改変の有無を問わず自由に使える。配布元 github.com/itouhiro/PixelMplus）。
書体ファイルはゲームに入れない：ひらがな・カタカナ・英数字・よく使う記号を 12 ドットで描き、点の並びだけを
main/pochamon-ufo/assets/led_font.json に書く（1 行＝横の点を 16 進で。全角は 12 ドット幅・半角は 6 ドット幅）。
"""
import sys, os, json
from PIL import Image, ImageDraw, ImageFont

TTF = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "main", "pochamon-ufo", "assets", "led_font.json")
H = 12

chars = set()
chars |= {chr(c) for c in range(0x3041, 0x3097)}     # ひらがな
chars |= {chr(c) for c in range(0x30A1, 0x30FB)}     # カタカナ
chars |= set("ー〜・、。「」『』！？：（）＋－×÷＝％＆＃＊＠☆★♪♥♡○●◎◇◆□■△▲▽▼→←↑↓…")
chars |= {chr(c) for c in range(0x21, 0x7F)}         # 半角の英数字と記号
chars.add(" ")
chars.add("　")

font = ImageFont.truetype(TTF, H)
asc, desc = font.getmetrics()
glyphs = {}
for ch in sorted(chars):
    adv = round(font.getlength(ch))
    if adv <= 0:
        continue
    w = 6 if adv <= 7 else 12
    im = Image.new("1", (w, asc + desc), 0)
    d = ImageDraw.Draw(im)
    d.fontmode = "1"
    d.text((0, 0), ch, font=font, fill=1)
    # 14 段（上 asc 11・下 desc 3）。行の送りは 12 段（gjpqy と括弧だけが下の 2 段へはみ出す＝行の間に入る）
    rows = []
    for y in range(asc + desc):
        bits = 0
        for x in range(w):
            if y < im.size[1] and im.getpixel((x, y)):
                bits |= 1 << (w - 1 - x)
        rows.append(bits)
    glyphs[ch] = {"w": w, "r": "".join("%03x" % b for b in rows)}

missing = [c for c in "3かいチャレンジ！コインをいれてねステッカーもらえるゲット" if c not in glyphs]
assert not missing, missing
with open(OUT, "w", encoding="utf-8") as fh:
    json.dump({"h": H, "rows": asc + desc, "font": "PixelMplus12 Bold (M+ FONT LICENSE)", "glyphs": glyphs}, fh, ensure_ascii=False, separators=(",", ":"))
print("glyphs", len(glyphs), "ascent", asc, "descent", desc, "->", os.path.abspath(OUT), os.path.getsize(OUT), "bytes")
