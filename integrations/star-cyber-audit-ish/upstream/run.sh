#!/bin/sh
# Star Cyber Audit: iSH / a-Shell / Linux
set -eu
cd "$(dirname "$0")"
command -v python3 >/dev/null 2>&1 || { echo 'Python 3 is required: apk add python3 ca-certificates' >&2; exit 127; }
exec python3 analyze.py "$@"
