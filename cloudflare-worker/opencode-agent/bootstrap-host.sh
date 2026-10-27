#!/usr/bin/env bash
# Install the reviewed OpenCode v2 CLI on an existing, isolated Linux host.
# Run as the dedicated wormstar-agent user; this script never starts a public server.
set -euo pipefail

OPENCODE_WORKSPACE="${OPENCODE_WORKSPACE:-/srv/wormstar-agent/workspace}"
OPENCODE_INSTALL_PREFIX="${OPENCODE_INSTALL_PREFIX:-/srv/wormstar-agent}"
readonly OPENCODE_CLI_VERSION="2.1.4"

if (( EUID == 0 )); then
  echo "Refusing to install OpenCode as root. Use the dedicated wormstar-agent account." >&2
  exit 1
fi

for executable in node npm git; do
  if ! command -v "$executable" >/dev/null 2>&1; then
    echo "Missing prerequisite: $executable" >&2
    exit 1
  fi
done

if ! node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)'; then
  echo "Node.js 22 or newer is required by this bootstrap." >&2
  exit 1
fi

if [[ ! -d "$OPENCODE_WORKSPACE/.git" ]]; then
  echo "Missing Git clone at $OPENCODE_WORKSPACE. Clone Wormstar first." >&2
  exit 1
fi

if [[ ! -d "$OPENCODE_INSTALL_PREFIX" || ! -w "$OPENCODE_INSTALL_PREFIX" ]]; then
  echo "Install prefix must already exist and be writable: $OPENCODE_INSTALL_PREFIX" >&2
  exit 1
fi

echo "Installing official @opencode/cli@$OPENCODE_CLI_VERSION into $OPENCODE_INSTALL_PREFIX"
npm install --global --prefix "$OPENCODE_INSTALL_PREFIX" --no-audit --no-fund "@opencode/cli@$OPENCODE_CLI_VERSION"

binary="$OPENCODE_INSTALL_PREFIX/bin/opencode"
if [[ ! -x "$binary" ]]; then
  echo "OpenCode binary not found after install: $binary" >&2
  exit 1
fi

echo "Installed OpenCode version: $("$binary" --version)"
echo "Next: configure the root-owned host environment and protected systemd service."
echo "No Cloudflare secrets, tunnel or model credentials were created by this script."
