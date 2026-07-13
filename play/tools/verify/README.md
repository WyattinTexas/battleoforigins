# /play/ verify rigs (built during the v2 revamp, 2026-07-12)

Headless-Chrome drivers for every surface of the v2 build. Run from this
directory; screenshots land in `./shots/` (mkdir first). All launch Chrome
with `--mute-audio` and seed localStorage past the welcome flow.

Serve the repo first: `cd ~/battleoforigins && python3 -m http.server 8787`
Every script takes `BASE=https://battleoforigins.com/play/` to run against
live instead, and `OUT=<dir>` for screenshots.

- `verify-stage.mjs` — battle stage at 390×844 / 844×390 / 1440×900, open + mid-roll shots + state probe
- `interact-test.mjs` — full battle regression: roll click, forced KO swap, game over + victory pose, rematch, two-tap exit, rival (token/sprite), boss fight (baseId art). ⚠ the game-over posts a REAL result row (random uid) — scrub boo2/players + daily scores after live runs
- `verify-menu.mjs` — box-art menu at 3 viewports
- `verify-store.mjs` — shop: daily slots/prices/countdown + Vault locked/open. Vault-open needs `RTG=220` AND a planted cloud row (headless boots firebase-mode; localStorage plants don't work): PATCH boo2/players/u_storetest_vault {rating:220,...}, scrub after
- `store-buy-test.mjs` — daily-slot purchase: two-tap → flip → ceremony → CONTINUE → OWNED
- `verify-standings.mjs` — avatars/titles/insights + the no-losses assert
- `verify-paypal-client.mjs` — full Mint loop with window.open stubbed + a simulated box grant (REST stars bump + msgQueue row) → celebration; scrubs its uid
- `verify-paypal-live.mjs` — live checkout-URL shape + ?paypal=return lands on the store

Gotchas the rigs encode (violate at your peril):
- wait for boot's `showScreen('menu')` (`.pc-name-text !== '…'`) before switching screens, or boot stomps your screen
- never probe engine DOM via getElementById — the engine patches it to return a hidden `_battle_dummy` for missing ids; use querySelector
- puppeteer-core loads from /opt/homebrew/lib/node_modules via createRequire
