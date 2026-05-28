#!/bin/bash
# Bump beta version across ALL 4 places that must move together:
#   1. index.html   const LOCAL_V    = 'vX.YY'   (cache-version-check)
#   2. index.html   const BBN_VERSION = 'vX.YY'  (display label)
#   3. cache-version.txt — the CDN-served version
#   4. index.html   <script src="X.js?v=vX.YY"> — per-JS cache-bust
#
# All four are required: skipping #1 or #2 causes a CDN/HTML mismatch
# (infinite reload loop, guarded). Skipping #4 means the HTML reloads
# but Chrome keeps serving stale JS from disk cache — the device-
# asymmetry bug class found 2026-05-28.
#
# Usage: ./bump-version.sh
set -e
DIR="$(dirname "$0")"
HTML="$DIR/index.html"
CACHE="$DIR/cache-version.txt"

CURRENT=$(grep -o "BBN_VERSION = 'v[0-9.]*'" "$HTML" | grep -o 'v[0-9.]*')
if [ -z "$CURRENT" ]; then echo "Version not found in $HTML"; exit 1; fi
MAJOR=$(echo "$CURRENT" | sed 's/v\([0-9]*\)\..*/\1/')
MINOR=$(echo "$CURRENT" | sed 's/v[0-9]*\.\(.*\)/\1/' | sed 's/^0*//')
MINOR=$((MINOR + 1))
NEW="v${MAJOR}.$(printf '%02d' $MINOR)"

# 1 + 2: BBN_VERSION and LOCAL_V in index.html
sed -i '' "s/BBN_VERSION = '${CURRENT}'/BBN_VERSION = '${NEW}'/" "$HTML"
sed -i '' "s/LOCAL_V = '${CURRENT}'/LOCAL_V = '${NEW}'/" "$HTML"

# 3: cache-version.txt
echo "$NEW" > "$CACHE"

# 4: ?v=vX.YY on every <script src="X.js?v=...">
sed -i '' "s/\\.js?v=${CURRENT}\"/\\.js?v=${NEW}\"/g" "$HTML"

echo "Bumped $CURRENT → $NEW (index.html, cache-version.txt, script ?v=)"
