#!/usr/bin/env python3
"""
Build battleoforigins.com's Kickstarter preview page from the designer's PDF.

    python3 kickstarter/tools/build.py [path/to/preview.pdf]
    python3 kickstarter/tools/build.py --html-only      # rewrite /index.html from strips.json, strips untouched

What it does
  1. Renders every PDF page at DPI (default 100 -> 2040px wide, the native
     resolution of the embedded artwork; text is vector so it stays crisp).
  2. Flattens onto WHITE - the PDF has real alpha (torn edges, the end bushes,
     the ~85%-opaque HOW TO PLAY art) and the designer tuned it over
     Kickstarter's white page. Compositing on anything else changes the art.
  3. Slices each page into strips (~STRIP_H px tall) so phones never have to
     decode a 17,000px-tall image and the browser can lazy-load as you scroll.
  4. Writes kickstarter/img/NN.jpg + NN.webp, kickstarter/og.jpg (link card),
     and the root index.html that stacks the strips gap-free.

The column (the .ks rule in write_index) is as wide as the screen's HEIGHT allows:
max-width: clamp(500px, 82vh, 960px). The opening of page 1 (GET READY FOR, the
logo, the TRADING CARD GAME banner down to its tails: rows 0-2466 of the 2040 px
art) is 1.21x as tall as the column is wide, so at 82vh it ends ~1% above the
bottom of the first screen on any laptop or desktop (6-8 px at 620-950 px tall);
960px is the old fixed width (the cap), 500px the floor for windows shorter than
~610 px. Phones and tablets are narrower than the clamp and stay edge to edge.
This file owns index.html: edit the rule HERE, then run --html-only.

Requires: poppler (pdftocairo, pdfinfo) + Pillow with WebP.
Source PDF lives in kickstarter/src/ (gitignored - 81 MB).
"""
import json, os, re, subprocess, sys, tempfile
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
HTML_ONLY = '--html-only' in sys.argv[1:]
_args = [a for a in sys.argv[1:] if not a.startswith('--')]
PDF = _args[0] if _args else os.path.join(ROOT, 'kickstarter', 'src', 'kickstarter-preview.pdf')
IMG_DIR = os.path.join(ROOT, 'kickstarter', 'img')
DPI = 100
STRIP_H = 2000        # target strip height (px)
MIN_TAIL = 500        # a leftover shorter than this is merged into the previous strip
JPEG_Q = 88
WEBP_Q = 84
BG = (255, 255, 255)


def page_sizes_pt(pdf):
    out = subprocess.run(['pdfinfo', '-f', '1', '-l', '999', pdf], capture_output=True, text=True, check=True).stdout
    sizes = {}
    for m in re.finditer(r'Page\s+(\d+) size:\s+([\d.]+) x ([\d.]+) pts', out):
        sizes[int(m.group(1))] = (float(m.group(2)), float(m.group(3)))
    return [sizes[i] for i in sorted(sizes)]


def main():
    sizes = page_sizes_pt(PDF)
    print(f'{len(sizes)} pages')
    tmp = tempfile.mkdtemp(prefix='ks-render-')
    subprocess.run(['pdftocairo', '-png', '-transp', '-r', str(DPI), PDF, os.path.join(tmp, 'page')], check=True)

    for f in os.listdir(IMG_DIR):
        if re.match(r'^\d+\.(jpg|webp)$', f):
            os.remove(os.path.join(IMG_DIR, f))

    strips = []   # (file_stem, w, h, page, y0)
    n = 0
    width = None
    for pi, (wpt, hpt) in enumerate(sizes, start=1):
        src = os.path.join(tmp, f'page-{pi}.png')
        im = Image.open(src).convert('RGBA')
        # pdftocairo pads the fractional last column/row -> crop to the exact box
        w = int(wpt * DPI / 72)
        h = int(hpt * DPI / 72)
        im = im.crop((0, 0, w, h))
        if width is None:
            width = w
        assert w == width, f'page {pi} width {w} != {width}'
        flat = Image.new('RGB', (w, h), BG)
        flat.paste(im, (0, 0), im)   # alpha-composite onto white
        im.close()

        # slice
        y = 0
        bounds = []
        while y < h:
            y1 = min(y + STRIP_H, h)
            if h - y1 < MIN_TAIL:
                y1 = h
            bounds.append((y, y1))
            y = y1
        for (y0, y1) in bounds:
            n += 1
            stem = f'{n:02d}'
            strip = flat.crop((0, y0, w, y1))
            strip.save(os.path.join(IMG_DIR, stem + '.jpg'), 'JPEG', quality=JPEG_Q, optimize=True, progressive=True)
            strip.save(os.path.join(IMG_DIR, stem + '.webp'), 'WEBP', quality=WEBP_Q, method=6)
            strips.append((stem, w, y1 - y0, pi, y0))
            print(f'  strip {stem}: page {pi} y={y0}-{y1} ({y1-y0}px)')
        if pi == 1:
            # link-card image: the BATTLE OF ORIGINS logo + TRADING CARD GAME banner
            og_top = int(h * 0.098)
            og_h = int(w / 1.755)
            og = flat.crop((0, og_top, w, og_top + og_h)).resize((1200, int(1200 * og_h / w)), Image.LANCZOS)
            og.save(os.path.join(ROOT, 'kickstarter', 'og.jpg'), 'JPEG', quality=88, optimize=True)
            print('  og.jpg', og.size)
        flat.close()

    with open(os.path.join(ROOT, 'kickstarter', 'strips.json'), 'w') as f:
        json.dump([{'file': s, 'w': w_, 'h': h_, 'page': p, 'y': y_} for (s, w_, h_, p, y_) in strips], f, indent=1)

    write_index(strips)
    total_jpg = sum(os.path.getsize(os.path.join(IMG_DIR, s + '.jpg')) for s, *_ in strips)
    total_webp = sum(os.path.getsize(os.path.join(IMG_DIR, s + '.webp')) for s, *_ in strips)
    print(f'{len(strips)} strips; jpg {total_jpg/1e6:.1f} MB, webp {total_webp/1e6:.1f} MB; total height {sum(h_ for _,_,h_,_,_ in strips)} px @ {width}px wide')


def write_index(strips):
    tags = []
    for i, (stem, w, h, page, y0) in enumerate(strips):
        if i == 0:
            load = ' fetchpriority="high"'
        elif i == 1:
            load = ''
        else:
            load = ' loading="lazy"'
        tags.append(
            f'<picture><source type="image/webp" srcset="kickstarter/img/{stem}.webp">'
            f'<img src="kickstarter/img/{stem}.jpg" width="{w}" height="{h}" alt=""{load} decoding="async"></picture>'
        )
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Battle of Origins — Trading Card Game</title>
<meta name="description" content="Get ready for Battle of Origins: a new trading card game where players face off in a fast-paced 1v1 battle of dice, cards, luck and wit. Kickstarter preview.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://battleoforigins.com/">
<meta property="og:title" content="Battle of Origins — Trading Card Game">
<meta property="og:description" content="A fast-paced 1v1 battle of dice, cards, luck and wit. Coming to Kickstarter.">
<meta property="og:image" content="https://battleoforigins.com/kickstarter/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/play/art/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="/play/art/icon-192.png">
<style>
  html, body {{ margin: 0; padding: 0; background: #fff; }}
  body {{ -webkit-text-size-adjust: 100%; }}
  /* column: as wide as the screen's height allows so the opening (GET READY FOR + logo + banner,
     1.21x as tall as the column is wide) fits the first screen; never wider than 960px */
  .ks {{ max-width: 960px; max-width: clamp(500px, 82vh, 960px); margin: 0 auto; font-size: 0; line-height: 0; }}
  .ks img {{ display: block; width: 100%; height: auto; }}
</style>
</head>
<body>
<main class="ks" aria-label="Battle of Origins Kickstarter preview">
{chr(10).join(tags)}
</main>
</body>
</html>
'''
    with open(os.path.join(ROOT, 'index.html'), 'w') as f:
        f.write(html)
    print('wrote index.html')


def rebuild_html():
    """--html-only: regenerate /index.html from strips.json without touching a strip."""
    with open(os.path.join(ROOT, 'kickstarter', 'strips.json')) as f:
        strips = [(s['file'], s['w'], s['h'], s['page'], s['y']) for s in json.load(f)]
    print(f'{len(strips)} strips from strips.json')
    write_index(strips)


if __name__ == '__main__':
    rebuild_html() if HTML_ONLY else main()
