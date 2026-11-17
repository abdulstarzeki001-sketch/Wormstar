#!/usr/bin/env python3
"""Read-only, offline checks for a specific archived QrLocalImporter Vite chunk.

No target JavaScript is executed; no network requests are made.
Matches are version-sensitive indicators, not proof of exploitability.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

RULES = (
    ("QR-001", "duplicate_frame_loop_stops", r'if\([^)]*<3e3\)\{.*?duplicate:!0\};return\}', "high"),
    ("QR-002", "camera_stop_does_not_stop_raf", r'function P\(\)\{.*?getTracks\(\).*?\}.*?O\(\(\)=>\{P\(\)\}\)', "review"),
    ("QR-003", "retry_can_schedule_parallel_loops", r'l\|\|B\(\),requestAnimationFrame\(d\)', "review"),
    ("QR-004", "zero_coordinate_rejected", r'm\.value\.latitude&&isFinite\(m\.value\.latitude\)&&m\.value\.longitude', "high"),
    ("QR-005", "stale_coordinate_possible", r'n&&u&&\(E\.value\.x_coordinate=n,E\.value\.y_coordinate=u\)', "review"),
    ("QR-006", "url_prefix_is_only_http", r'!t\.startsWith\("http"\)', "review"),
)

def inspect_source(text):
    """Return version-specific indicators without retaining any source snippets."""
    return [
        {"id": code, "indicator": name, "confidence": confidence}
        for code, name, regex, confidence in RULES
        if re.search(regex, text, re.DOTALL)
    ]

def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 1:
        print("Usage: python3 tools/ish/qr_importer_review.py /path/to/QrLocalImporter-*.js", file=sys.stderr)
        return 2
    path = Path(argv[0]).expanduser()
    if not path.is_file():
        print("Not a file", file=sys.stderr)
        return 2
    raw = path.read_bytes()
    if len(raw) > 12_000_000 or b"\x00" in raw[:1024]:
        print("Unsupported file", file=sys.stderr)
        return 2
    text = raw.decode("utf-8", "replace")
    if "QrLocalImporter" not in text or "searchImportedGoods" not in text:
        print("Not the expected QrLocalImporter module", file=sys.stderr)
        return 2
    result = {
        "file": path.name,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "scope": "static source review; no server-side claims",
        "indicators": inspect_source(text),
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    sys.exit(main())
