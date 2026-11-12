#!/usr/bin/env bash
# Import local STAR OSINT AI into an isolated Wormstar integration.
# This script stages source only. It never commits or pushes automatically.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: Run this inside a cloned Wormstar Git repository." >&2
  exit 1
}
SRC="$HOME/star-osint-v2/star-osint-ai"
if [ "$#" -gt 0 ]; then
  SRC="$1"
fi
DEST="$ROOT/integrations/star-osint-ai"

if [ ! -f "$SRC/app/main.py" ] || [ ! -f "$SRC/requirements.txt" ]; then
  echo "ERROR: Cannot locate STAR OSINT AI sources at: $SRC" >&2
  exit 1
fi
if [ ! -f "$ROOT/AGENTS.md" ] || [ ! -d "$ROOT/cloudflare-worker" ]; then
  echo "ERROR: This does not appear to be the Wormstar repository." >&2
  exit 1
fi
if ! command -v rsync >/dev/null 2>&1; then
  echo "ERROR: Install rsync first: sudo apt install -y rsync" >&2
  exit 1
fi

mkdir -p "$DEST"
rsync -a \
  --exclude='.git/' \
  --exclude='.venv/' \
  --exclude='venv/' \
  --exclude='__pycache__/' \
  --exclude='.pytest_cache/' \
  --exclude='.mypy_cache/' \
  --exclude='.ruff_cache/' \
  --include='.env.example' \
  --exclude='.env' \
  --exclude='.env.*' \
  --include='data/' \
  --include='data/.gitkeep' \
  --exclude='data/***' \
  --include='reports/' \
  --include='reports/.gitkeep' \
  --exclude='reports/***' \
  --exclude='*.db' \
  --exclude='*.sqlite' \
  --exclude='*.sqlite3' \
  --exclude='*.pem' \
  --exclude='*.key' \
  --exclude='*.log' \
  --exclude='*.zip' \
  --exclude='*.tar*' \
  "$SRC/" "$DEST/"

cat > "$DEST/.gitignore" <<'EOF'
.env
.env.*
!.env.example
.venv/
venv/
__pycache__/
.pytest_cache/
.mypy_cache/
.ruff_cache/
*.py[cod]
*.db
*.sqlite
*.sqlite3
*.pem
*.key
*.log
*.zip
*.tar*
data/*
!data/.gitkeep
reports/*
!reports/.gitkeep
EOF

mkdir -p "$DEST/data" "$DEST/reports"
touch "$DEST/data/.gitkeep" "$DEST/reports/.gitkeep"

cd "$ROOT"
git add -- integrations/star-osint-ai
git diff --cached --check

# Validate staged filenames. Keep any private runtime state off GitHub.
BAD="$(git diff --cached --name-only -- integrations/star-osint-ai \
  | grep -E '(^|/)(\.env|[^/]+\.(db|sqlite|sqlite3|pem|key|log|zip|tar|gz))$|^integrations/star-osint-ai/(data|reports)/[^.]' \
  | grep -vE '/(data|reports)/\.gitkeep$' || true)"
if [ -n "$BAD" ]; then
  echo "ERROR: Sensitive/generated files were staged:" >&2
  printf '%s\n' "$BAD" >&2
  git restore --staged -- integrations/star-osint-ai
  exit 1
fi

echo
echo "STAR OSINT source staged safely at integrations/star-osint-ai/"
git diff --cached --stat -- integrations/star-osint-ai
echo
echo "Review the staged changes, then run:"
echo '  git diff --cached --check'
echo '  git commit -m "feat(osint): integrate local STAR OSINT AI v2"'
echo '  git push -u origin feature/star-osint-ai-v2-20261112'
