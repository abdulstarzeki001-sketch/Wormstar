#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -f .env ]]; then echo "Copy .env.example to .env and configure it first."; exit 1; fi
set -a
# shellcheck disable=SC1091
source .env
set +a
: "${GPU_API_TOKEN:?GPU_API_TOKEN missing}"
: "${MODEL_VARIANT:?MODEL_VARIANT missing}"
if [[ "${GPU_API_TOKEN}" == REPLACE_* ]]; then echo "GPU_API_TOKEN not configured"; exit 1; fi
echo "Checking private local vLLM API..."
curl --fail --show-error --silent --max-time 20 \
  -H "Authorization: Bearer ${GPU_API_TOKEN}" \
  http://127.0.0.1:8000/v1/models
echo
echo "Requesting inference from ORIGINAL locally loaded checkpoint..."
curl --fail --show-error --silent --max-time 120 \
  -H "Authorization: Bearer ${GPU_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$(printf '{\"model\":\"%s\",\"messages\":[{\"role\":\"user\",\"content\":\"Confirm the original GPT-OSS checkpoint is running.\"}],\"max_tokens\":256}' \"$MODEL_VARIANT\")" \
  http://127.0.0.1:8000/v1/chat/completions
echo
