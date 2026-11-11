#!/usr/bin/env bash
set -euo pipefail

WORMSTAR_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
LAB_ROOT="$WORMSTAR_ROOT/training/uboor-security-lab"

if [[ ! -f "$LAB_ROOT/run_all.sh" ]]; then
  printf 'UBOOR lab not found in %s\n' "$LAB_ROOT" >&2
  exit 1
fi

echo "Wormstar / UBOOR offline lab"
bash "$LAB_ROOT/run_all.sh"
