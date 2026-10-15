#!/bin/bash
# Builds the Trade Journal Mac app (Apple Silicon) that connects to your hosted site.
# Usage:  ./build.sh https://your-journal.vercel.app [github-user/repo]
#         (the repo is only used to check for new app versions)
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install it from https://nodejs.org (LTS) or run: brew install node"
  exit 1
fi

URL=""; REPO=""
if [ -n "$1" ]; then
  URL="${1%/}"
  case "$URL" in http*) ;; *) URL="https://$URL" ;; esac
  echo "App will connect to: $URL"
else
  echo "No URL given: the app will ask for it on first launch."
fi
if [ -n "$2" ]; then REPO="$2"; echo "Update checks will use: github.com/$REPO"; fi
printf '{ "url": "%s", "repo": "%s" }\n' "$URL" "$REPO" > app-config.json

echo "Installing dependencies (first run takes a minute)..."
npm install
echo "Building DMG..."
npm run dist
echo ""
echo "Done:"
ls dist/*.dmg
open dist
