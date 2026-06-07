#!/usr/bin/env bash
# Bird UX — launch YOUR real Chrome with CDP enabled on a dedicated profile.
#
# Why a dedicated profile: Chrome >=136 refuses --remote-debugging-port on the
# default profile. This uses a separate profile dir that PERSISTS, so you log in
# to Google ONCE and it's remembered for future Bird runs. It is real Chrome, so
# Google does NOT show the "this browser may not be secure" block.
#
# Run:   ! bash tests-ux/launch-chrome-cdp.sh
# Then:  log in as wdraike@gmail.com if prompted, leave the window open.
#        Tell Claude "ready" and Bird connects over CDP (port 9222).
set -e
PROFILE="$HOME/.chrome-bird-profile"
PORT=9222
URL="https://script.google.com/macros/s/AKfycbxWLGID2AytbnJzdGzjXRHeUUlLyMH-bFPcyO4zTeFj/dev"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

mkdir -p "$PROFILE"
echo "Launching Chrome with CDP on port $PORT (profile: $PROFILE)…"
echo "Log in to wdraike@gmail.com if asked, then leave this window open."
exec "$CHROME" \
  --remote-debugging-port=$PORT \
  --user-data-dir="$PROFILE" \
  --no-first-run \
  --no-default-browser-check \
  "$URL"
