#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")"
echo 'STAR OSINT AI v2.0 — Local diagnostics'
fail=0
if [[ -x .venv/bin/python ]]; then
  .venv/bin/python --version
else
  echo '[FAIL] .venv missing. Run ./install_kali.sh'; fail=1
fi
if [[ -f .env ]]; then
  echo '[OK] .env exists (credentials not displayed)'
else
  echo '[FAIL] .env missing. Run ./install_kali.sh'; fail=1
fi
if [[ -d data ]]; then echo '[OK] data directory available'; else echo '[FAIL] data directory missing'; fail=1; fi
for tool in whois theHarvester amass ollama; do
  if command -v "$tool" >/dev/null 2>&1; then echo "[OK] $tool installed"; else echo "[INFO] $tool not installed (may be optional)"; fi
done
if command -v curl >/dev/null 2>&1; then
  if curl --noproxy '*' -fsS --max-time 3 http://127.0.0.1:11434/api/tags > /dev/null; then
    echo '[OK] Ollama reachable on 127.0.0.1:11434'
  else
    echo '[INFO] Ollama not reachable. Start `ollama serve` and pull configured model.'
  fi
fi
if [[ -x .venv/bin/python && -f .env ]]; then
  .venv/bin/python - <<'PY'
from app.config import model_name,db_path
print('Model:',model_name())
print('Database:',db_path())
PY
fi
exit "$fail"
