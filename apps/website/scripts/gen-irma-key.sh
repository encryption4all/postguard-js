#!/bin/sh
# Generate the throwaway RSA key the local irma-server signs session JWTs with.
#
# Both compose files bind-mount docker/irma/jwt_privkey.pem and pass it to
# `irma server --jwt-privkey-file`. The file is gitignored (it is a key), so a
# fresh clone does not have one — and Docker silently creates an empty
# *directory* at a missing bind-mount source, so irma-server starts against a
# directory and the Yivi disclosure flow dies with no obvious cause.
#
# Idempotent: keeps an existing key so restarts don't invalidate live sessions.
set -eu

dir="$(CDPATH= cd -- "$(dirname -- "$0")/../docker/irma" 2>/dev/null && pwd || true)"
if [ -z "$dir" ]; then
  dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)/docker/irma"
  mkdir -p "$dir"
fi
key="$dir/jwt_privkey.pem"

if [ -s "$key" ]; then
  echo "irma jwt key already present: $key"
  exit 0
fi

if [ -d "$key" ]; then
  echo "error: $key is a directory — Docker created it for a missing bind mount." >&2
  echo "Remove it (docker compose down first), then re-run this script." >&2
  exit 1
fi

openssl genrsa -out "$key" 2048 2>/dev/null
chmod 600 "$key"
echo "generated a throwaway irma jwt key: $key"
