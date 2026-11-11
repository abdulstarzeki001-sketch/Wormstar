#!/usr/bin/env python3
"""Static inspection of local JavaScript. Prints counts, never secret values."""
import argparse
import hashlib
import json
from pathlib import Path

MARKERS = (
    "company_item_reduce", "return_company_doc", "read_doc_company",
    "companyOwnerToken", "localStorage", "sessionStorage",
    "interceptors.request", "Authorization", "Bearer",
    "console.debug", "qr_readings", "quickchart.io/qr",
    "production_capacity", "weight_quantity"
)


def analyze(directory):
    root = Path(directory).resolve()
    if not root.is_dir():
        raise ValueError(f"Directory not found: {directory}")
    files, duplicates = [], {}
    for path in sorted(root.rglob("*.js")):
        if not path.is_file() or path.is_symlink():
            continue
        data = path.read_bytes()
        sha = hashlib.sha256(data).hexdigest()
        text = data.decode("utf-8", errors="replace")
        duplicates.setdefault(sha, []).append(path.relative_to(root).as_posix())
        files.append({
            "file": path.relative_to(root).as_posix(),
            "bytes": len(data),
            "sha256": sha,
            "marker_counts": {m: text.count(m) for m in MARKERS if text.count(m)},
        })
    return {
        "mode": "OFFLINE_READ_ONLY",
        "files_analyzed": len(files),
        "unique_hashes": len(duplicates),
        "duplicate_file_groups": [
            names for names in duplicates.values() if len(names) > 1
        ],
        "files": files,
        "notes": [
            "A string occurrence is not a proven vulnerability.",
            "Source is not sent anywhere; no token or personal data values are emitted.",
            "Server-side authorization cannot be inferred from client JavaScript.",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", default="samples/js")
    parser.add_argument("--output", default="reports/js_static_report.json")
    args = parser.parse_args()
    report = analyze(args.directory)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print("=== JS STATIC AUDIT ===")
    print("Files:", report["files_analyzed"])
    print("Unique hashes:", report["unique_hashes"])
    print("Duplicate groups:", len(report["duplicate_file_groups"]))
    print("Saved:", output)
    print("Network requests: 0")


if __name__ == "__main__":
    main()
