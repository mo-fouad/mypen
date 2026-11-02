#!/usr/bin/env bash
# Builds MyPen.app from this checkout and installs it to /Applications, replacing the old one.
# Usage: ./install-mypen.sh
set -euo pipefail

cd "$(dirname "$0")"
# Homebrew's rustup is keg-only, so its cargo is not on PATH by default.
export PATH="/opt/homebrew/opt/rustup/bin:$PATH"
# MyPen has no use for OpenPencil Cloud, so build without it.
export VITE_OPENPENCIL_CLOUD=off

APP=desktop/target/release/bundle/macos/MyPen.app
DEST=/Applications/MyPen.app

echo "Building MyPen.app…"
bun run tauri build --bundles app

if pgrep -fq "$DEST/Contents/MacOS/"; then
  echo "Quitting the running MyPen…"
  osascript -e 'quit app "MyPen"' || true
  for _ in {1..20}; do pgrep -fq "$DEST/Contents/MacOS/" || break; sleep 0.5; done
fi

echo "Installing to ${DEST}…"
rm -rf "$DEST"
ditto "$APP" "$DEST"
codesign --verify "$DEST"

open "$DEST"
echo "MyPen installed and opened."
