#!/bin/sh
# Periodically refresh /downloads/* with the latest published PostGuard addon
# release artifacts. Runs in the background of the nginx container so the
# image never has to be rebuilt for an addon-only release.
#
# The first iteration runs concurrently with nginx start — until it finishes,
# requests are served from whatever was baked into the image at build time.
# scripts/sync-addons.mjs writes via a temp-file + rename, so live downloads
# never observe a partially-written file.
#
# Tunables (env):
#   SYNC_ADDONS_INTERVAL  seconds between refreshes (default 21600 = 6h)
#   SYNC_ADDONS_DISABLE   set to any non-empty value to skip the loop entirely
set -eu

DOWNLOADS_DIR="/usr/share/nginx/html/postguard/downloads"
SCRIPT="/opt/sync-addons/sync-addons.mjs"
INTERVAL="${SYNC_ADDONS_INTERVAL:-21600}"

if [ -n "${SYNC_ADDONS_DISABLE:-}" ]; then
    echo "[sync-addons] disabled via SYNC_ADDONS_DISABLE"
    exit 0
fi

if [ ! -d "${DOWNLOADS_DIR}" ]; then
    echo "[sync-addons] ${DOWNLOADS_DIR} does not exist; skipping" >&2
    exit 0
fi

(
    while true; do
        if ! DOWNLOADS_DIR="${DOWNLOADS_DIR}" node "${SCRIPT}"; then
            echo "[sync-addons] sync iteration failed; will retry after ${INTERVAL}s" >&2
        fi
        sleep "${INTERVAL}"
    done
) &

echo "[sync-addons] background refresh loop started (interval ${INTERVAL}s, dir ${DOWNLOADS_DIR})"
