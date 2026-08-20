# -*- coding: utf-8 -*-
"""ぽちゃもんあっちむいてホイ：同梱フォントの切り出し（2026-08-21）

index.html に出てくる文字＋かな全部＋ASCII だけを含む woff2 を
main/pochamon-hoi/assets/fonts/ に書き出す（会場オフライン対策で Google Fonts を外したため）。

■ いつ回すか
  index.html の文言に「今まで使ってない漢字」を足した時。かな・英数・記号は全部入っているので不要。
  回さないと、その漢字だけ端末の標準フォントで表示される（壊れはしない）。

■ 使い方
  py tools/pochamon-hoi/subset_fonts.py
  前提: py -m pip install fonttools brotli（3.11 環境に入っている）
  元の TTF は google/fonts（OFL）から毎回ダウンロードする（リポジトリには置かない）。
"""
import io
import pathlib
import subprocess
import sys
import tempfile
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = pathlib.Path(__file__).resolve().parents[2]
GAME = ROOT / 'main' / 'pochamon-hoi'
HTML = GAME / 'index.html'
OUT = GAME / 'assets' / 'fonts'

FONTS = [
    'zenmarugothic/ZenMaruGothic-Regular',
    'zenmarugothic/ZenMaruGothic-Medium',
    'zenmarugothic/ZenMaruGothic-Bold',
    'zenmarugothic/ZenMaruGothic-Black',
    'cherrybombone/CherryBombOne-Regular',
    'rubikmonoone/RubikMonoOne-Regular',
]
RAW = 'https://raw.githubusercontent.com/google/fonts/main/ofl/%s.ttf'


def collect_chars() -> str:
    chars = set(HTML.read_text(encoding='utf-8'))
    for a, b in [(0x20, 0x7E), (0x3041, 0x3096), (0x30A1, 0x30FC), (0xFF01, 0xFF5E), (0x3000, 0x303F)]:
        chars.update(chr(c) for c in range(a, b + 1))
    chars.update('¥〜◯✕－✓★☆♪♥…→←↑↓○●×')
    return ''.join(sorted(c for c in chars if ord(c) >= 0x20 and c not in '\u2028\u2029'))


def main() -> None:
    try:
        import fontTools  # noqa: F401
        import brotli  # noqa: F401
    except ImportError:
        sys.exit('fontTools / brotli が無い: py -m pip install fonttools brotli')

    chars = collect_chars()
    print('文字数 %d（うち漢字 %d）' % (len(chars), sum(1 for c in chars if '\u4e00' <= c <= '\u9fff')))
    OUT.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as td:
        tdp = pathlib.Path(td)
        chars_file = tdp / 'chars.txt'
        chars_file.write_text(chars, encoding='utf-8')
        for name in FONTS:
            ttf = tdp / (name.split('/')[1] + '.ttf')
            urllib.request.urlretrieve(RAW % name, ttf)
            woff2 = OUT / (ttf.stem + '.woff2')
            r = subprocess.run([
                sys.executable, '-m', 'fontTools.subset', str(ttf),
                '--text-file=' + str(chars_file), '--flavor=woff2',
                '--layout-features=*', '--no-hinting', '--desubroutinize',
                '--output-file=' + str(woff2),
            ], capture_output=True, text=True)
            if r.returncode != 0:
                sys.exit(r.stderr[-600:])
            print('%-32s %7d bytes' % (woff2.name, woff2.stat().st_size))
    print('完了。index.html を変えたら sw.js の CACHE_NAME も上げること。')


if __name__ == '__main__':
    main()
