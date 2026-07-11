# Engine snapshot — DO NOT HAND-EDIT FILES IN THIS DIRECTORY

These files are verbatim copies of the proven Boo! battle + raid engine from `/beta/`.
Battle rules and card stats are the source of truth there; `/play/` wraps them, never edits them.

- Source: `beta/` @ commit `4bd740e` (beta version v2.76), snapshotted 2026-07-10
- Files: cards.js, battle-engine.js, raid-engine.js, raid-ui.js, raid-shop.js,
  raid-battle-bridge.js, raid-arena.css, raid-arena-template.html
- NOT copied (dead code in beta, loaded by nothing): raid-battle-adapter.js,
  raid-state-machine.js, raid-sync.js

To pull in newer beta fixes deliberately: run `./resync-beta.sh` from this directory,
retest /play/ battles + raids, then bump /play/'s version and commit.

Integration notes (how /play/ talks to this engine — all hooks live in /play/js/, not here):
- Boot a battle: set `S.redPicks` / `S.bluePicks` (3 card ids), call `startBattle()`,
  then `startBlueAI()` for a vs-AI game.
- Arena DOM must sit inside `<div id="raid-screen">` (raid-arena.css scopes everything under it);
  the skeleton is raid-arena-template.html pasted into /play/index.html.
- Globals the engine expects the page to define BEFORE battle-engine.js:
  `switchTab()` and `showToast()` stubs; Firebase `db` (only needed for ?livepvp= boot).
- Engine art/sfx paths are page-relative and resolve from /play/ same as /beta/:
  `../testroom/art/*`, `../boo/*.mp3`, `../boobattles/*.png` (same repo, same origin).
