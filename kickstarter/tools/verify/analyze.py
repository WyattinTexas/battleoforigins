# python3 analyze.py <outdir> <label> <colCssW> <cssW> <dpr>
import sys, json, glob, os
import numpy as np
from PIL import Image
outdir, label, colW, cssW, dpr = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), float(sys.argv[5])
parts = sorted(glob.glob(f'{outdir}/{label}-part-*.png'))
ims = [Image.open(p).convert('RGB') for p in parts]
W = ims[0].width; H = sum(im.height for im in ims)
full = Image.new('RGB', (W, H), (255, 0, 255))
y = 0
for im in ims: full.paste(im, (0, y)); y += im.height
full.save(f'{outdir}/{label}-full.png')
a = np.asarray(full).astype(np.int16)
lay = json.load(open(f'{outdir}/{label}-layout.json'))
scale = W / cssW  # px per css px in the capture
colpx = int(min(colW, cssW) * scale)
x0 = (W - colpx) // 2; x1 = x0 + colpx
col = a[:, x0 + 4:x1 - 4, :]   # ignore edge px
print(f'{label}: capture {W}x{H}, scale {scale:.3f}, docH css {lay["docH"]}, column x {x0}-{x1}')
# gaps between images (css layout)
imgs = lay['imgs']; gaps = []
for i in range(len(imgs) - 1):
    g = imgs[i+1]['top'] - (imgs[i]['top'] + imgs[i]['h'])
    if abs(g) > 0.01: gaps.append((imgs[i]['src'], imgs[i+1]['src'], round(g, 3)))
print('layout gaps (non-zero):', gaps or 'none')
print('img widths:', sorted(set(round(im['w'], 2) for im in imgs)), 'lefts:', sorted(set(round(im['left'], 2) for im in imgs)))
print('incomplete/failed:', [im['src'] for im in imgs if not im['complete'] or im['nw'] == 0] or 'none')
# hairline scan: a row that is (near-)uniform and differs strongly from BOTH neighbours
rowstd = col.std(axis=1).mean(axis=1)                 # per-row spread across x (avg over channels)
rowmean = col.mean(axis=1)                            # per-row mean colour
d_prev = np.abs(rowmean[1:-1] - rowmean[:-2]).mean(axis=1)
d_next = np.abs(rowmean[1:-1] - rowmean[2:]).mean(axis=1)
hair = [(int(i+1), float(rowstd[i+1]), float(d_prev[i]), float(d_next[i])) for i in range(len(d_prev)) if rowstd[i+1] < 6 and d_prev[i] > 18 and d_next[i] > 18]
print('hairlines (row, std, dPrev, dNext):', hair[:20] or 'none', f'(total {len(hair)})')
# magenta (unpainted) check
mag = ((a[:,:,0] > 250) & (a[:,:,1] < 5) & (a[:,:,2] > 250)).sum()
print('unpainted px:', int(mag))
# boundary rows: map css tops to capture rows and report local diff (seam sanity at every strip join)
seams = []
for i in range(1, len(imgs)):
    r = int(round(imgs[i]['top'] * scale))
    if 2 <= r < H - 2:
        seams.append((imgs[i]['src'], r, round(float(np.abs(a[r-1, x0:x1] - a[r, x0:x1]).mean()), 1), round(float(rowstd[r-1]),1), round(float(rowstd[r]),1)))
print('seam rows (src, row, |Δ| prev→this, std prev, std this):')
for s in seams: print('  ', s)
