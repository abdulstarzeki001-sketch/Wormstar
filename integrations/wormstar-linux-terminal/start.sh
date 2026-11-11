#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

command -v docker >/dev/null || { echo 'Docker is required.' >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo 'Docker is not available to this user.' >&2; exit 1; }
[[ "$(id -u)" != 0 && "$(id -g)" != 0 ]] || { echo 'Run as a non-root user.' >&2; exit 1; }
[[ -x .venv/bin/uvicorn ]] || { echo 'Create .venv and install requirements.txt first; see README_AR.md.' >&2; exit 1; }
[[ ! -L workspace ]] || { echo 'workspace must not be a symbolic link.' >&2; exit 1; }
mkdir -p workspace

container=wormstar-linux-terminal-sandbox
if docker container inspect "$container" >/dev/null 2>&1; then
  python3 sandbox.py --allow-stopped || { echo 'Existing container is not the verified sandbox; refusing to reuse it.' >&2; exit 1; }
  if [[ "$(docker inspect -f '{{.State.Running}}' "$container")" != true ]]; then
    docker start "$container" >/dev/null
  fi
else
  docker run -d --name "$container" --label org.wormstar.terminal-sandbox=v1 \
    --network none --memory 512m --memory-swap 512m --cpus 1 --pids-limit 64 \
    --cap-drop ALL --security-opt no-new-privileges --read-only \
    --tmpfs /tmp:rw,nosuid,nodev,size=64m,mode=1777 \
    --user "$(id -u):$(id -g)" -e HOME=/tmp -e PYTHONDONTWRITEBYTECODE=1 \
    --mount "type=bind,src=$(pwd -P)/workspace,dst=/workspace" \
    -w /workspace python:3.12-slim sleep infinity >/dev/null
fi
python3 sandbox.py || { echo 'Sandbox verification failed.' >&2; exit 1; }

export TERMINAL_ACCESS_TOKEN="${TERMINAL_ACCESS_TOKEN:-$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')}"
[[ "$TERMINAL_ACCESS_TOKEN" =~ ^[A-Za-z0-9_-]{24,256}$ ]] || { echo 'Invalid terminal token.' >&2; exit 1; }
echo 'Local terminal: http://127.0.0.1:8000'
echo 'Terminal session token (keep private):'
printf '%s\n' "$TERMINAL_ACCESS_TOKEN"
exec .venv/bin/uvicorn app:app --host 127.0.0.1 --port 8000 --no-access-log
