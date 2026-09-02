# battleoforigins.com root = the Kickstarter preview

The site root (`/index.html`) shows the Kickstarter story column from the designer's PDF and nothing else.

- Source PDF: `kickstarter/src/kickstarter-preview.pdf` (gitignored, ~80 MB — keep a copy; it's the master). v3 since 2026-09-01 (the designer's `kickstarter PREVIEW 3.pdf`): back to 6 pages — BOO! TIERS returns (now with Battle of Origins-branded deck box + playmat mockups) and WHY BACK NOW / THE TEAM closes the page again; older masters kept beside it as `kickstarter-preview-v1-0821.pdf` and `kickstarter-preview-v2-0829.pdf`.
- Strips: `kickstarter/img/NN.jpg` + `NN.webp` (2040px wide, ~2000px tall, flattened on white)
- Rebuild after a new PDF: `python3 kickstarter/tools/build.py [path/to/new.pdf]` then commit + push.
  The script regenerates every strip, `og.jpg` (link card), `strips.json` and `/index.html`.
- Knobs at the top of `build.py`: `DPI`, `STRIP_H`, `JPEG_Q`, `WEBP_Q`, and the column width in the HTML template
  (`write_index`): `max-width: clamp(500px, 82vh, 960px)` — as wide as the screen's height allows so the whole opening
  (GET READY FOR, the logo, the TRADING CARD GAME banner: 1.21x as tall as the column is wide) fits a laptop's first
  screen; 960px = the cap (the old fixed width), 500px = the floor for short windows; phones/tablets stay edge to edge.
  `build.py` owns `/index.html` — change the rule there, then `python3 kickstarter/tools/build.py --html-only`
  (rewrites `index.html` from `strips.json`, no strip is re-encoded), then commit + push.

The game itself still lives at `/play/`, `/online/`, `/tournament/` etc. — untouched.
