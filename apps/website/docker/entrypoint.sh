#!/bin/sh
set -e

HTDOCS="/usr/share/nginx/html/postguard"

echo "Substituting SPA environment variables..."
echo "  VITE_FILEHOST_URL=${VITE_FILEHOST_URL}"

find "${HTDOCS}" -name '*.js' -not -name 'config.js' -type f -exec sed -i \
    -e "s|__VITE_FILEHOST_URL_PLACEHOLDER__|${VITE_FILEHOST_URL}|g" \
    {} +

echo "SPA environment variable substitution complete."

# Block indexing on non-production environments
if [ "${ROBOTS_NOINDEX}" = "true" ]; then
    echo "ROBOTS_NOINDEX is set — injecting noindex meta tag into all HTML files"
    find "${HTDOCS}" -name '*.html' -type f -exec sed -i \
        's|</head>|<meta name="robots" content="noindex, nofollow" /></head>|' \
        {} +
    echo "noindex injection complete."
fi
