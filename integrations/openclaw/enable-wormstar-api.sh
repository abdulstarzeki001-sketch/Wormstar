#!/usr/bin/env bash
# Enables OpenAI-compatible endpoint after official onboarding; does not expose it publicly.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT/OpenClaw"
test -f .env || { echo 'Finish official onboarding first'; exit 1; }
test -f docker-compose.extra.yml || { echo 'Secure Compose override missing'; exit 1; }
docker compose -f docker-compose.yml -f docker-compose.extra.yml config --quiet
echo 'Gateway shared bearer token confers broad operator privileges.'
read -r -p 'Enable local authenticated /v1/chat/completions? Type ENABLE: ' answer
[[ "$answer" == "ENABLE" ]] || { echo 'Cancelled'; exit 1; }
docker compose -f docker-compose.yml -f docker-compose.extra.yml stop openclaw-gateway
docker compose -f docker-compose.yml -f docker-compose.extra.yml \
  run --rm --no-deps --entrypoint node openclaw-gateway \
  dist/index.js config set gateway.http.endpoints.chatCompletions.enabled true --strict-json
docker compose -f docker-compose.yml -f docker-compose.extra.yml \
  run --rm --no-deps --entrypoint node openclaw-gateway \
  dist/index.js config validate
docker compose -f docker-compose.yml -f docker-compose.extra.yml up -d openclaw-gateway
echo 'OpenClaw started locally. Configure a private authenticated HTTPS ingress before connecting Wormstar.'
echo 'Check /v1/models locally with the Gateway bearer token; never paste that token into the chat.'
