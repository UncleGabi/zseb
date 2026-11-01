#!/bin/sh
# Renders public/logo.svg into the PNG icons (macOS: needs Google Chrome; sips is built in).
set -e
cd "$(dirname "$0")/../public"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --window-size=512,512 --screenshot="$PWD/icon-512.png" "file://$PWD/logo.svg" 2>/dev/null
sips -Z 192 icon-512.png --out icon-192.png >/dev/null
sips -Z 180 icon-512.png --out apple-touch-icon.png >/dev/null
echo "icons written to public/"
