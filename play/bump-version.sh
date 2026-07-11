#!/bin/bash
# Bump /play/ version across ALL 4 places that must move together
# (same discipline as beta/bump-version.sh — skipping any one causes
# the stale-JS / reload-loop bug classes found on beta):
#   1. index.html   const LOCAL_V      = 'vX.YY'   (cache-version check)
#   2. index.html   const BOO2_VERSION = 'vX.YY'   (display + runtime cache-bust)
#   3. cache-version.txt                            (the CDN-served version)
#   4. index.html   every ?v=vX.YY                  (scripts, css, manifest, icons)
# Also refreshes the visible version in the menu footer.
set -e
DIR="$(dirname "$0")"
HTML="$DIR/index.html"
CACHE="$DIR/cache-version.txt"

CURRENT=$(grep -o "BOO2_VERSION = 'v[0-9.]*'" "$HTML" | grep -o 'v[0-9.]*')
if [ -z "$CURRENT" ]; then echo "Version not found in $HTML"; exit 1; fi
MAJOR=$(echo "$CURRENT" | sed 's/v\([0-9]*\)\..*/\1/')
MINOR=$(echo "$CURRENT" | sed 's/v[0-9]*\.\(.*\)/\1/' | sed 's/^0*//')
MINOR=$((MINOR + 1))
NEW="v${MAJOR}.$(printf '%02d' $MINOR)"

sed -i '' "s/BOO2_VERSION = '${CURRENT}'/BOO2_VERSION = '${NEW}'/" "$HTML"
sed -i '' "s/LOCAL_V = '${CURRENT}'/LOCAL_V = '${NEW}'/" "$HTML"
echo "$NEW" > "$CACHE"
sed -i '' "s/?v=${CURRENT}/?v=${NEW}/g" "$HTML"
sed -i '' "s/· ${CURRENT} ·/· ${NEW} ·/" "$HTML"

echo "Bumped $CURRENT → $NEW (index.html, cache-version.txt, all ?v= links)"
