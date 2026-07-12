# Sprite REVIEW list (Phase B, 2026-07-12)

149/200 ids shipped as stage sprites (`{id}-front.webp` + `{id}-back.webp`,
manifest.json). The 51 below are NOT in the manifest — the stage shows the
framed card-art token for them (always readable, nothing breaks). They're the
queue for a Midjourney `--cref` pass or design-team art LATER (per KICKOFF —
do not gold-plate now).

## Excluded — source art is a full card render (frame/name/ability text baked in)
No cutout can ever work; rembg grabs the text plates. Needs clean source art first.
20, 25, 27, 28, 30, 33, 51, 52, 53, 55, 57, 58, 60, 61, 83, 84, 85, 87, 89,
90, 93, 97, 98, 104, 105, 107, 108, 113, 114, 415

## Excluded — dark spirit on dark background (segmenter can't separate, or
sprite would vanish against the stage's night sky)
14, 21, 22, 23, 26, 49, 56, 74, 78, 79, 81, 92, 103, 336, 401, 402, 404,
419, 427, 453, 463

## Shipped but flagged — BACK sprite unconvincing (strong front-facing face
survives the flip trick; fine at stage distance, design pass later)
1 (Kodako), 13, 17, 42, 62, 64, 66, 94, 112, 312, 313, 314, 424, 430, 438,
447, 455, 456

## Shipped but flagged — sprite includes scene props from the card art
(reads as intentional at stage size; revisit only if Wyatt objects)
36 (goblin crowd), 46 (chest), 59 (sled), 106 (treasure), 110 (mountain-scape
IS the character), 309 (pumpkins), 352 (moon), 440 (moon face is the character)

## Pipeline notes for the future pass
- `tools/build-sprites.py` — u2net default; `MODEL_OVERRIDES` per id
  (35 uses isnet-general-use), `ERASE_BOXES` for fused background props.
- Re-adding an id: fix/replace `cards/{id}.webp` (clean full-bleed art),
  run `python3 tools/build-sprites.py <id>` — manifest merges automatically.
