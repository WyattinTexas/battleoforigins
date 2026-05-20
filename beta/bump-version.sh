#!/bin/bash
# Bump BBN_VERSION in index.html (minor version increment)
# Usage: ./bump-version.sh
FILE="$(dirname "$0")/index.html"
CURRENT=$(grep -o "BBN_VERSION = 'v[0-9.]*'" "$FILE" | grep -o 'v[0-9.]*')
if [ -z "$CURRENT" ]; then echo "Version not found"; exit 1; fi
# Parse version: v0.XX -> increment XX
MAJOR=$(echo "$CURRENT" | sed 's/v\([0-9]*\)\..*/\1/')
MINOR=$(echo "$CURRENT" | sed 's/v[0-9]*\.\(.*\)/\1/' | sed 's/^0*//')
MINOR=$((MINOR + 1))
NEW="v${MAJOR}.$(printf '%02d' $MINOR)"
sed -i '' "s/BBN_VERSION = '${CURRENT}'/BBN_VERSION = '${NEW}'/" "$FILE"
echo "Bumped $CURRENT → $NEW"
