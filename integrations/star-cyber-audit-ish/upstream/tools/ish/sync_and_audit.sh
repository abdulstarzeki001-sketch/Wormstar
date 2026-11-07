#!/bin/sh
# Star Cyber Audit: safe iSH / Alpine / Linux sync + offline audit.
# Does not run downloaded JavaScript or contact audited sites.
set -eu

REPO_URL="https://github.com/abdulstarzeki001-sketch/Star-Cyber-Audit-iSH.git"
# Prefer the checkout containing this script, avoiding accidental duplicate clones.
# STAR_AUDIT_DIR can explicitly select an alternate checkout.
SCRIPT_DIR="$(CDPATH= cd "$(dirname "$0")" && pwd -P)"
SCRIPT_PROJECT="$(CDPATH= cd "$SCRIPT_DIR/../.." && pwd -P)"
if [ -n "${STAR_AUDIT_DIR:-}" ]; then
    PROJECT_DIR="$STAR_AUDIT_DIR"
elif [ -d "$SCRIPT_PROJECT/.git" ]; then
    PROJECT_DIR="$SCRIPT_PROJECT"
else
    PROJECT_DIR="${HOME:-.}/Star-Cyber-Audit-iSH"
fi

# No side effects; useful for checking the selected checkout on a phone.
if [ "${1:-}" = "--where" ]; then
    printf '%s\n' "$PROJECT_DIR"
    exit 0
fi

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
command -v git >/dev/null 2>&1 || fail "git is missing. In iSH run: apk add git"
command -v python3 >/dev/null 2>&1 || fail "python3 is missing. In iSH run: apk add python3"
command -v sh >/dev/null 2>&1 || fail "POSIX sh is required"

if [ -d "$PROJECT_DIR/.git" ]; then
    cd "$PROJECT_DIR"
    ORIGIN="$(git remote get-url origin 2>/dev/null || true)"
    case "$ORIGIN" in
      "$REPO_URL"|"https://github.com/abdulstarzeki001-sketch/Star-Cyber-Audit-iSH"|"git@github.com:abdulstarzeki001-sketch/Star-Cyber-Audit-iSH.git") ;;
      *) fail "Wrong git origin: $ORIGIN (refusing to update an unrelated repository)" ;;
    esac
    BRANCH="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
    [ "$BRANCH" = main ] || fail "Expected branch main, found: ${BRANCH:-detached HEAD}"
    [ -z "$(git status --porcelain)" ] || fail "Local changes detected: commit or back them up before syncing"
    git pull --ff-only origin main
elif [ -e "$PROJECT_DIR" ]; then
    fail "Directory already exists and is not a git repository: $PROJECT_DIR"
else
    git clone --depth 1 --branch main "$REPO_URL" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

printf '\n=== Version ===\n'
git log -1 --format='%h %s'
printf '\n=== Offline tests ===\n'
python3 -m unittest discover -s tests -v
printf '\n=== Static analysis (local files only) ===\n'
sh run.sh --local ./research
printf '\n=== Summary ===\n'
python3 - <<'PY'
import json
from pathlib import Path
p = Path("reports/analysis.json")
results = json.loads(p.read_text(encoding="utf-8"))["files"]
apis = {route for f in results for route in f.get("api_paths", [])}
flags = sum(len(f.get("flags", [])) for f in results)
js_count = sum(f.get("classification") == "JS_SOURCE" for f in results)
print("Total source records:", len(results))
print("JavaScript sources:", js_count)
print("Distinct API references:", len(apis))
print("Review indicators (not confirmed vulnerabilities):", flags)
print("Local HTML report:", (Path.cwd() / "reports/report.html"))
PY
printf '\nFinished. Outputs remain on this device; no upload to a third party.\n'
