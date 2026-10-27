#!/usr/bin/env bash
# Read-only OpenCode v2 API preflight, to run on the separate authorized Linux host.
set -euo pipefail
: "${OPENCODE_SERVER_PASSWORD:?Set your OpenCode HTTP Basic Auth password}"
command -v curl >/dev/null || { echo 'curl is required' >&2; exit 1; }
OPENCODE_BIN="${OPENCODE_BIN:-opencode}"
command -v "$OPENCODE_BIN" >/dev/null || { echo 'OpenCode v2 executable not installed' >&2; exit 1; }
echo "Installed OpenCode version: $("$OPENCODE_BIN" --version)"
check() {
  local route="$1"
  local code
  code=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 12 --basic --user "opencode:${OPENCODE_SERVER_PASSWORD}" "http://127.0.0.1:4096${route}")
  if [[ "$code" != '200' ]]; then echo "FAIL: ${route} returned HTTP ${code}" >&2; exit 1; fi
  echo "PASS: ${route} (HTTP 200)"
}
check '/api/session?limit=1'
check '/api/session/active'
echo 'OpenCode v2 API preflight passed; configure a private Cloudflare Tunnel and Access policy next.'
