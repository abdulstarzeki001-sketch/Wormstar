#!/usr/bin/env python3
"""Combine sanitized JS, HAR, response reports without raw data."""
import argparse
import json
from collections import Counter
from pathlib import Path


def load_json(path):
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"Report not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def build(js_report, har_report, response_report):
    markers = Counter()
    for item in js_report.get("files", []):
        markers.update(item.get("marker_counts", {}))
    statuses = Counter(
        item.get("quantity_status", "unknown")
        for item in har_report.get("results", [])
    )
    return {
        "mode": "OFFLINE_READ_ONLY",
        "js_file_count": js_report.get("files_analyzed", 0),
        "js_selected_marker_counts": dict(markers),
        "har_entries_total": har_report.get("total_har_entries", 0),
        "har_relevant_requests": har_report.get("relevant_requests", 0),
        "har_duplicate_groups": len(har_report.get("possible_duplicate_groups", [])),
        "har_quantity_status_counts": dict(statuses),
        "response_document_id_present": response_report.get("document_id_present"),
        "response_weight_comparison": response_report.get("weight_comparison"),
        "disclaimer": (
            "Verify the provenance of each input report. A client-side marker, "
            "matching payload, or HTTP 200 does not prove server authorization "
            "or a database update."
        )
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--js", default="reports/js_static_report.json")
    parser.add_argument("--har", default="reports/har_forensic_report.json")
    parser.add_argument("--response", default="reports/response_report.json")
    parser.add_argument("--output", default="reports/cross_reference.json")
    args = parser.parse_args()
    report = build(load_json(args.js), load_json(args.har), load_json(args.response))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print("=== CROSS-REFERENCE REPORT ===")
    print("JS files:", report["js_file_count"])
    print("HAR relevant requests:", report["har_relevant_requests"])
    print("HAR duplicate groups:", report["har_duplicate_groups"])
    print("Weight status:", report["response_weight_comparison"])
    print("Saved:", output)
    print("Network requests: 0")


if __name__ == "__main__":
    main()
