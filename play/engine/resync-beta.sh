#!/bin/bash
# Re-snapshot the battle/raid engine from ../../beta/ into this directory.
# Run deliberately, then RETEST /play/ (quick battle + a raid fight) before committing.
set -e
cd "$(dirname "$0")"
FILES="cards.js battle-engine.js raid-engine.js raid-ui.js raid-shop.js raid-battle-bridge.js raid-arena.css raid-arena-template.html"
for f in $FILES; do cp "../../beta/$f" "$f"; done
SRC_COMMIT=$(cd ../.. && git log --oneline -1 -- beta/ | awk '{print $1}')
SRC_VERSION=$(grep -o "BBN_VERSION = 'v[0-9.]*'" ../../beta/index.html | grep -o "v[0-9.]*")
TODAY=$(date +%Y-%m-%d)
sed -i '' "s|- Source: \`beta/\` @ commit \`[a-f0-9]*\` (beta version v[0-9.]*), snapshotted [0-9-]*|- Source: \`beta/\` @ commit \`$SRC_COMMIT\` (beta version $SRC_VERSION), snapshotted $TODAY|" SNAPSHOT.md
echo "Resynced from beta @ $SRC_COMMIT ($SRC_VERSION). Now retest /play/ and bump its version."
