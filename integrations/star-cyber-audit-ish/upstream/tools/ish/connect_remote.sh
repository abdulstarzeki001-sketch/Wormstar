#!/bin/sh
# Optional Remote Desktop Commander experiment for iSH (Alpine x86).
# No public SSH ports, no system daemon, no background keep-alive.
# Use --check first; run --connect only after reviewing the access notice.
set -eu

MODE="${1:---check}"
case "$MODE" in
  --check|--connect|--help) ;;
  *) echo "Usage: sh tools/ish/connect_remote.sh [--check|--connect|--help]" >&2; exit 2 ;;
esac
if [ "$MODE" = "--help" ]; then
  echo "Check iSH Node compatibility, or optionally pair Remote Desktop Commander."
  echo " --check: inspect runtime only (no package installation or network calls)"
  echo " --connect: run one foreground OAuth-paired session; Ctrl+C to disconnect"
  exit 0
fi

echo "Remote Desktop Commander / iSH capability check"
echo "Platform: $(uname -s 2>/dev/null || echo unknown) / $(uname -m 2>/dev/null || echo unknown)"
echo "Current user: $(id -un 2>/dev/null || echo unknown)"
echo "No SSH listener or public network port will be created by this script."

if ! command -v node >/dev/null 2>&1 || ! command -v npx >/dev/null 2>&1; then
  echo "Node.js/npm missing. Optional install (iSH): apk add nodejs npm"
  echo "Do not install or run a remote agent until you decide to authorize it."
  [ "$MODE" = "--check" ] && exit 0
  exit 3
fi

NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--jitless"
export NODE_OPTIONS
if ! version="$(node --version 2>/dev/null)"; then
  echo "Node.js cannot run with --jitless in this iSH environment."
  [ "$MODE" = "--check" ] && exit 0
  exit 4
fi
echo "Node.js version: $version"
major="${version#v}"
major="${major%%.*}"
minor="${version#v*.}"
minor="${minor%%.*}"
case "$major:$minor" in
  *[!0-9:]*|:*|*:) echo "Could not parse Node.js version."; exit 4 ;;
esac
if [ "$major" -lt 22 ] || { [ "$major" -eq 22 ] && [ "$minor" -lt 12 ]; }; then
  echo "Node.js >= 22.12 is recommended for current Desktop Commander Remote."
  echo "Your iSH package may not support this version; use a desktop Linux/Windows agent if so."
  [ "$MODE" = "--check" ] && exit 0
  exit 4
fi
if [ "$MODE" = "--check" ]; then
  echo "Runtime check passed. Remote package compatibility on iSH is NOT yet verified."
  echo "Pair manually with: sh tools/ish/connect_remote.sh --connect"
  exit 0
fi

echo ""
echo "WARNING: Desktop Commander Remote can execute commands and read/write files"
echo "with the permissions of this iSH user. This is NOT limited to the audit project."
echo "Never share the device-pairing code or OAuth credentials in public messages."
echo "The connection is foreground-only and may stop when iOS suspends iSH."
printf "Type CONNECT to start pairing this device: "
IFS= read -r approval || exit 5
[ "$approval" = CONNECT ] || { echo "Cancelled."; exit 5; }
echo "Starting one foreground session. Check the OAuth URL and code printed below."
echo "Stop with Ctrl+C. Verify device access at https://mcp.desktopcommander.app/"
exec npx --yes @wonderwhy-er/desktop-commander@latest remote --no-persist-session
