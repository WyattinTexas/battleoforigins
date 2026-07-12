#!/usr/bin/env python3
"""
Sprite factory for /play/ battle-stage characters (KICKOFF Phase A/B).

cards/{id}.webp (full-bleed card art, no frame)
  → rembg u2net cutout
  → alpha cleanup: hard-zero faint alpha, drop small disconnected
    blobs (background smudges/trails), keep the character
  → tight crop to alpha bounds (+pad)
  → FRONT: sprites/{id}-front.webp  (≤400px tall, alpha webp)
  → BACK:  sprites/{id}-back.webp   (front flipped horizontally,
           darkened ~12%, subtle top rim-light — reads as
           seen-from-behind at stage size for wispy Spiritkin)
  → sprites/manifest.json {"ids":[...]}  (merges with existing)

Usage: python3 tools/build-sprites.py 1 2 35 9 8 12
       python3 tools/build-sprites.py --all          (Phase B)
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

PLAY = Path(__file__).resolve().parent.parent
CARDS = PLAY / "cards"
OUT = PLAY / "sprites"
MAX_H = 400
PAD = 6
ALPHA_FLOOR = 40        # kill faint rembg haze outright
KEEP_FRACTION = 0.04    # drop blobs smaller than 4% of the biggest one
DARKEN = 0.88           # back-sprite brightness
RIM = 0.20              # back-sprite top rim-light strength

# u2net is the default; some cards segment much better under isnet
# (e.g. 35 Larry — u2net kept the volcano behind him). Add ids here
# as spot-checks find them.
MODEL_OVERRIDES = {35: "isnet-general-use"}

# Background props fused to the character that no model separates:
# alpha-zero these boxes (source-image px coords) before cropping.
ERASE_BOXES = {35: [(140, 128, 198, 247), (585, 312, 672, 400)]}


# in-process rembg (one model session for the whole batch) when this
# script runs under the pipx venv python; CLI fallback otherwise
try:
    from rembg import new_session, remove as rembg_remove
    _SESSIONS = {}

    def _session(model):
        if model not in _SESSIONS:
            _SESSIONS[model] = new_session(model)
        return _SESSIONS[model]
except ImportError:
    rembg_remove = None


def rembg_cutout(src: Path, card_id: int) -> Image.Image:
    model = MODEL_OVERRIDES.get(card_id, "u2net")
    if rembg_remove is not None:
        out = rembg_remove(Image.open(src).convert("RGBA"), session=_session(model))
        return out.convert("RGBA")
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    cmd = ["rembg", "i"]
    if card_id in MODEL_OVERRIDES:
        cmd += ["-m", MODEL_OVERRIDES[card_id]]
    cmd += [str(src), str(tmp_path)]
    subprocess.run(cmd, check=True, capture_output=True)
    im = Image.open(tmp_path).convert("RGBA")
    im.load()
    tmp_path.unlink(missing_ok=True)
    return im


def clean_alpha(im: Image.Image) -> Image.Image:
    """Zero faint alpha, then keep only meaningful connected components."""
    arr = np.array(im)
    a = arr[..., 3].astype(np.int32)
    a[a < ALPHA_FLOOR] = 0

    mask = a > 0
    labels = np.zeros(mask.shape, dtype=np.int32)
    sizes = {}
    cur = 0
    # iterative flood fill (4-connectivity) — plenty fast at card size
    for sy, sx in zip(*np.nonzero(mask & (labels == 0))):
        if labels[sy, sx]:
            continue
        cur += 1
        stack = [(sy, sx)]
        labels[sy, sx] = cur
        n = 0
        while stack:
            y, x = stack.pop()
            n += 1
            if y > 0 and mask[y - 1, x] and not labels[y - 1, x]:
                labels[y - 1, x] = cur; stack.append((y - 1, x))
            if y + 1 < mask.shape[0] and mask[y + 1, x] and not labels[y + 1, x]:
                labels[y + 1, x] = cur; stack.append((y + 1, x))
            if x > 0 and mask[y, x - 1] and not labels[y, x - 1]:
                labels[y, x - 1] = cur; stack.append((y, x - 1))
            if x + 1 < mask.shape[1] and mask[y, x + 1] and not labels[y, x + 1]:
                labels[y, x + 1] = cur; stack.append((y, x + 1))
        sizes[cur] = n

    if sizes:
        biggest = max(sizes.values())
        drop = {k for k, v in sizes.items() if v < biggest * KEEP_FRACTION}
        if drop:
            a[np.isin(labels, list(drop))] = 0

    arr[..., 3] = a.astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def tight_crop(im: Image.Image) -> Image.Image:
    bbox = im.getchannel("A").getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    l = max(0, l - PAD); t = max(0, t - PAD)
    r = min(im.width, r + PAD); b = min(im.height, b + PAD)
    return im.crop((l, t, r, b))


def scale(im: Image.Image) -> Image.Image:
    if im.height <= MAX_H:
        return im
    w = round(im.width * MAX_H / im.height)
    return im.resize((w, MAX_H), Image.LANCZOS)


def make_back(front: Image.Image) -> Image.Image:
    im = front.transpose(Image.FLIP_LEFT_RIGHT)
    arr = np.array(im).astype(np.float32)
    rgb, a = arr[..., :3], arr[..., 3:4]
    rgb *= DARKEN
    # top rim-light: cool glow fading out by ~25% down the sprite
    h = arr.shape[0]
    ramp = np.clip(1.0 - (np.arange(h, dtype=np.float32) / (h * 0.25)), 0, 1)[:, None, None]
    light = np.array([225.0, 238.0, 255.0])
    rgb += (light - rgb) * (ramp * RIM)
    arr[..., :3] = np.clip(rgb, 0, 255)
    out = arr.astype(np.uint8)
    out[..., 3:4] = np.array(im)[..., 3:4]  # alpha untouched
    return Image.fromarray(out, "RGBA")


def build(card_id: int) -> dict:
    src = CARDS / f"{card_id}.webp"
    if not src.exists():
        return {"id": card_id, "ok": False, "err": "no card art"}
    cut = rembg_cutout(src, card_id)
    for (l, t, r, b) in ERASE_BOXES.get(card_id, []):
        arr = np.array(cut)
        arr[t:b, l:r, 3] = 0
        cut = Image.fromarray(arr, "RGBA")
    front = scale(tight_crop(clean_alpha(cut)))
    back = make_back(front)
    OUT.mkdir(exist_ok=True)
    fp = OUT / f"{card_id}-front.webp"
    bp = OUT / f"{card_id}-back.webp"
    front.save(fp, "WEBP", quality=82, method=6)
    back.save(bp, "WEBP", quality=82, method=6)
    cov = np.array(front.getchannel("A"), dtype=np.uint16)
    coverage = float((cov > 0).mean())
    return {
        "id": card_id, "ok": True, "size": front.size,
        "kb": (fp.stat().st_size // 1024, bp.stat().st_size // 1024),
        "coverage": round(coverage, 2),  # alpha fill of the crop box — sanity signal
    }


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)
    if args == ["--all"]:
        ids = sorted(int(p.stem) for p in CARDS.glob("*.webp") if p.stem.isdigit())
    else:
        ids = [int(a) for a in args]

    results = [build(i) for i in ids]
    ok = [r for r in results if r["ok"]]
    for r in results:
        if r["ok"]:
            print(f"  {r['id']:>4}  {r['size'][0]}x{r['size'][1]}  {r['kb'][0]}/{r['kb'][1]}KB  fill={r['coverage']}")
        else:
            print(f"  {r['id']:>4}  FAILED: {r['err']}")

    manifest_path = OUT / "manifest.json"
    ids_now = set()
    if manifest_path.exists():
        try:
            ids_now = set(json.loads(manifest_path.read_text()).get("ids", []))
        except Exception:
            pass
    ids_now.update(r["id"] for r in ok)
    manifest_path.write_text(json.dumps({"ids": sorted(ids_now)}))
    print(f"manifest: {len(ids_now)} ids")


if __name__ == "__main__":
    main()
