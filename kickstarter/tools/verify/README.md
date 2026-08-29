# Kickstarter preview — visual verify rig

Full-page capture of the built page in headless Chrome (raw CDP, no puppeteer) plus a
layout-gap / seam / hairline scan. Run it after `build.py`, before pushing.

    # 1. serve the repo — check the port is FREE first: a port another session holds still
    #    answers 200 with THAT server's directory listing, and the page loads 0 images
    lsof -nP -iTCP:8937 -sTCP:LISTEN || (cd ~/battleoforigins && python3 -m http.server 8937 --bind 127.0.0.1 &)
    curl -sI http://127.0.0.1:8937/kickstarter/img/01.webp | head -1     # must be 200

    # 2. headless Chrome — fresh profile, muted (see memory headless-chrome-hygiene)
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9231 \
      --user-data-dir=/path/to/scratch/chrome-profile --no-first-run --mute-audio --hide-scrollbars \
      --window-size=1200,900 about:blank &

    # 3. capture + analyze: desktop 1200 css px @1x, phone 390 css px @3x
    mkdir -p out
    node kickstarter/tools/verify/shoot.mjs 9231 "http://127.0.0.1:8937/?nc=$RANDOM" out desk  1200 1 0
    node kickstarter/tools/verify/shoot.mjs 9231 "http://127.0.0.1:8937/?nc=$RANDOM" out phone 390  3 1
    python3 kickstarter/tools/verify/analyze.py out desk  960 1200 1
    python3 kickstarter/tools/verify/analyze.py out phone 960 390  3

    # 4. kill the Chrome and the server you started

shoot.mjs args: `<cdp-port> <url> <outdir> <label> <cssWidth> <dpr> <mobile 0|1>`.
It eager-loads every lazy strip, dumps `<label>-layout.json` (each img's top/height/naturalWidth)
and captures the whole document in 4000 px clips (`captureBeyondViewport`).
analyze.py args: `<outdir> <label> <columnCssWidth> <cssWidth> <dpr>`. It stitches the clips into
`<label>-full.png`, then prints: non-zero layout gaps between strips, images that failed to decode,
hairline rows (a near-uniform 1 px row that differs from BOTH neighbours), unpainted pixels, and a
seam table (per strip: |Δ| between the last row of the previous strip and its first row).

What "good" looks like: every image complete, `layout gaps: none`, seam |Δ| small everywhere except
PAGE boundaries (white → art, e.g. strips 16, 23, 24 in the v2 build), `hairlines: none` — with one
known false positive: the CARD CATEGORIES header band's bottom edge (~178 px into page 4), which is
art, not a seam. Crop `<label>-full.png` around the joins and look with your own eyes too.
The same two shoot lines against `https://battleoforigins.com/?nc=$RANDOM` verify the live deploy.

Requires node ≥ 22 (global WebSocket), Pillow, numpy.
