#!/usr/bin/env bash
# Fetches pinned original OpenClaw and optionally launches the official installer
# on the user's own Docker host. Committing a script does not start any server.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
command -v git >/dev/null || { echo 'Missing git'; exit 1; }
echo "[1/5] Fetching official pinned OpenClaw git submodule."
git submodule update --init OpenClaw
test -f "$ROOT/OpenClaw/docker-compose.yml" || { echo 'Incomplete OpenClaw checkout'; exit 1; }
command -v docker >/dev/null || { echo 'Docker Engine required'; exit 1; }
docker compose version >/dev/null || { echo 'Docker Compose 2.24.4+ required'; exit 1; }
command -v python3 >/dev/null || { echo 'Python 3 required for port binding validation'; exit 1; }
HOST_COMPOSE="$ROOT/OpenClaw/docker-compose.extra.yml"
SECURE_COMPOSE="$ROOT/integrations/openclaw/docker-compose.extra.yml"
if [[ -e "$HOST_COMPOSE" ]] && ! cmp -s "$HOST_COMPOSE" "$SECURE_COMPOSE"; then
  echo 'Existing Docker override differs. Review it before running OpenClaw.'
  exit 1
fi
cp "$SECURE_COMPOSE" "$HOST_COMPOSE"
echo "[2/5] Verifying ports are bound to loopback only."
(cd "$ROOT/OpenClaw" && docker compose -f docker-compose.yml -f docker-compose.extra.yml config --format json) |
python3 -c '
import json,sys
ports=json.load(sys.stdin)["services"]["openclaw-gateway"]["ports"]
if not ports or any(p.get("host_ip")!="127.0.0.1" for p in ports):
 raise SystemExit("Unsafe Docker port publishing detected")
print("Gateway ports loopback-only")
'
echo "[3/5] Deployment preflight passed."
if [[ "${1:-}" != "--install" ]]; then
  echo "Run: bash integrations/openclaw/setup.sh --install"
  exit 0
fi
echo 'This uses Docker images and possibly billable compute. Model credentials will be configured via official onboarding.'
read -r -p 'Run the official pinned OpenClaw installer? Type INSTALL: ' answer
[[ "$answer" == "INSTALL" ]] || { echo 'Cancelled'; exit 1; }
echo "[4/5] Starting the OFFICIAL OpenClaw Docker onboarding."
(cd "$ROOT/OpenClaw" && bash scripts/docker/setup.sh)
echo "[5/5] Complete. Next: bash integrations/openclaw/enable-wormstar-api.sh"
