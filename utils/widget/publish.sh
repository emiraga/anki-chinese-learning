#!/bin/bash
# Export vocab from Anki and publish it to the widget gist.
#
# Safe to run on a timer: exits quietly when Anki is closed, and skips the
# push when the exported content is byte-identical to what was last published.
#
# Setup (once):
#   gh gist create --desc "anki chinese widget" widget.json
#   echo <gist-id> > utils/widget/.gist_id

set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$DIR/widget.json"
HASH_FILE="$DIR/.last_hash"
GIST_ID_FILE="$DIR/.gist_id"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Anki closed is the normal case, not an error -- stay quiet so the launchd
# log does not fill up with noise.
if ! curl -s --max-time 3 127.0.0.1:8765 \
        -X POST -d '{"action":"version","version":6}' >/dev/null 2>&1; then
    exit 0
fi

if [ ! -f "$GIST_ID_FILE" ]; then
    log "ERROR: $GIST_ID_FILE missing. See setup instructions in this script."
    exit 1
fi
GIST_ID="$(tr -d '[:space:]' < "$GIST_ID_FILE")"

log "Anki reachable, exporting..."
if ! "$DIR/export_widget_json.py" --out "$OUT"; then
    log "ERROR: export failed"
    exit 1
fi

# The `generated` timestamp changes every run, so hash only the card data --
# otherwise every single run would look like a change and force a push.
NEW_HASH="$(python3 -c '
import json, hashlib, sys
with open(sys.argv[1], encoding="utf-8") as fh:
    cards = json.load(fh)["cards"]
blob = json.dumps(cards, ensure_ascii=False, sort_keys=True).encode("utf-8")
print(hashlib.sha256(blob).hexdigest())
' "$OUT")"

if [ "$NEW_HASH" = "$(cat "$HASH_FILE" 2>/dev/null)" ]; then
    log "No content change, skipping push."
    exit 0
fi

log "Content changed, pushing to gist $GIST_ID..."
if gh gist edit "$GIST_ID" -a "$OUT"; then
    echo "$NEW_HASH" > "$HASH_FILE"
    log "Published $(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["count"])' "$OUT") entries."
else
    log "ERROR: gist push failed"
    exit 1
fi
