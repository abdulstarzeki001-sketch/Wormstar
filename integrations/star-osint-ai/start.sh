#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -f .env ]]; then
  echo 'Missing .env. Run ./install_kali.sh or .venv/bin/python scripts/create_admin.py'
  exit 1
fi
if [[ ! -x .venv/bin/python ]]; then
  echo 'Missing Python venv. Run ./install_kali.sh'
  exit 1
fi
export PYTHONPATH="$(pwd)"
exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8787 --workers 1
