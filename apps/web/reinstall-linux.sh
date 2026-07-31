#!/usr/bin/env bash
# Rebuild Agent Office and install the fresh .deb locally.
# Usage: ./reinstall-linux.sh   (run from apps/web/)
set -euo pipefail
cd "$(dirname "$0")"

# Scoped to deb only: the full build also creates a signed AppImage updater
# artifact (createUpdaterArtifacts in tauri.conf.json), which requires
# TAURI_SIGNING_PRIVATE_KEY — that key only exists as a GitHub Actions
# secret, not on this machine. Local test installs don't need it.
pnpm tauri build --bundles deb

DEB=$(find src-tauri/target/release/bundle/deb -maxdepth 1 -name '*.deb' -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2-)
if [ -z "$DEB" ]; then
  echo "No .deb found after build" >&2
  exit 1
fi

echo "Installing: $DEB"
sudo dpkg -i "$DEB"

echo "Installed binary mtime:"
stat -c '%y %n' /usr/bin/app
