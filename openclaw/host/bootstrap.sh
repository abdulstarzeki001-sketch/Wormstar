#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
command -v docker >/dev/null || { echo "Docker is required"; exit 2; }
docker compose version >/dev/null || { echo "Docker Compose v2 required"; exit 2; }
command -v openssl >/dev/null || { echo "openssl required"; exit 2; }
command -v python3 >/dev/null || { echo "python3 required"; exit 2; }
umask 077
if [[ ! -f .env ]]; then
  gateway_token="$(openssl rand -hex 32)"
  printf 'OPENCLAW_IMAGE=ghcr.io/openclaw/openclaw:latest\nOPENCLAW_GATEWAY_TOKEN=%s\nOPENAI_API_KEY=\nCLOUDFLARE_TUNNEL_TOKEN=\n' "$gateway_token" > .env
  echo "Private .env and random Gateway token created. Add your API key in .env, then rerun bootstrap."
  exit 2
fi
python3 - <<'PY'
from pathlib import Path
import sys
data={}
for raw in Path(".env").read_text().splitlines():
  line=raw.strip()
  if not line or line.startswith("#"): continue
  if "=" not in line: sys.exit("Invalid .env format")
  key,value=line.split("=",1)
  if not key.isidentifier(): sys.exit("Invalid env key")
  data[key]=value.strip()
if len(data.get("OPENCLAW_GATEWAY_TOKEN",""))<32:sys.exit("Gateway token must be 32+ chars")
if len(data.get("OPENAI_API_KEY",""))<16:sys.exit("Missing real model provider API key")
print("Environment validated; no secrets displayed.")
PY
docker compose pull openclaw-gateway
echo "Installing owner-only OpenClaw gateway..."
docker compose run -T --rm --no-deps --entrypoint node openclaw-gateway \
  dist/index.js onboard --non-interactive --accept-risk --skip-health \
  --mode local --auth-choice openai-api-key --secret-input-mode ref \
  --gateway-auth token --gateway-token-ref-env OPENCLAW_GATEWAY_TOKEN \
  --skip-channels --no-install-daemon
for setting in \
  "gateway.http.endpoints.chatCompletions.enabled true" \
  "gateway.mode local" \
  "gateway.bind lan" \
  "tools.profile minimal" \
  "tools.exec.mode deny"; do
  read -r key value <<< "$setting"
  docker compose run -T --rm --no-deps --entrypoint node openclaw-gateway \
    dist/index.js config set "$key" "$value"
done
docker compose run -T --rm --no-deps --entrypoint node openclaw-gateway \
  dist/index.js config set tools.deny '["group:runtime","group:fs","browser","gateway","cron","nodes","write","edit","apply_patch"]' --strict-json
docker compose run -T --rm --no-deps --entrypoint node openclaw-gateway \
  dist/index.js config validate
docker compose up -d openclaw-gateway
echo "Gateway started on 127.0.0.1:18789. Run bash verify.sh."
echo "Cloudflare Tunnel/Access hostname and Wormstar Worker secrets require owner setup."
