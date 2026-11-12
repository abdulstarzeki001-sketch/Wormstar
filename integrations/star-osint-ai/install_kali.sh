#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
sudo apt update
sudo apt install -y python3 python3-venv python3-pip whois curl ca-certificates
# Optional external tools, installed only if Kali repository carries them.
for pkg in theharvester amass; do
  if apt-cache show "$pkg" >/dev/null 2>&1; then
    sudo apt install -y "$pkg" || echo "Optional package failed: $pkg"
  fi
done
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
if [[ ! -f .env ]]; then
  .venv/bin/python scripts/create_admin.py
fi
echo 'Ready. Start with: ./start.sh'
