#!/usr/bin/env bash
# Start a real, separately hosted OpenCode coding agent. Never run as root.
set -euo pipefail
: "${OPENCODE_SERVER_PASSWORD:?Set a long private OpenCode HTTP server password}"
: "${OPENCODE_WORKSPACE:?Set the absolute path to an authorized repository clone}"
if [[ "${#OPENCODE_SERVER_PASSWORD}" -lt 20 ]]; then
  echo "OPENCODE_SERVER_PASSWORD must be at least 20 characters" >&2
  exit 1
fi
if [[ ! -d "${OPENCODE_WORKSPACE}/.git" ]]; then
  echo "OPENCODE_WORKSPACE must point to an existing Git repository clone" >&2
  exit 1
fi
if ! command -v opencode >/dev/null 2>&1; then
  echo "Install the verified OpenCode release from https://github.com/anomalyco/opencode" >&2
  exit 1
fi
cd "${OPENCODE_WORKSPACE}"
echo "OpenCode serving on localhost only; expose through protected Cloudflare Tunnel."
exec opencode serve --hostname 127.0.0.1 --port 4096
