# battleoforigins.com root = the Kickstarter preview

The site root (`/index.html`) shows the Kickstarter story column from the designer's PDF and nothing else.

- Source PDF: `kickstarter/src/kickstarter-preview.pdf` (gitignored, 81 MB — keep a copy; it's the master)
- Strips: `kickstarter/img/NN.jpg` + `NN.webp` (2040px wide, ~2000px tall, flattened on white)
- Rebuild after a new PDF: `python3 kickstarter/tools/build.py [path/to/new.pdf]` then commit + push.
  The script regenerates every strip, `og.jpg` (link card), `strips.json` and `/index.html`.
- Knobs at the top of `build.py`: `DPI`, `STRIP_H`, `JPEG_Q`, `WEBP_Q`, column width in the HTML template (`max-width: 960px`).

The game itself still lives at `/play/`, `/online/`, `/tournament/` etc. — untouched.
