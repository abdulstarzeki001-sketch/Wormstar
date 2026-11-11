#!/usr/bin/env python3
"""Read-only HAR forensics for a specific shipment-reduction endpoint.

No network access; only saved HAR files are parsed.
The output excludes raw request bodies, URLs, cookies, Authorization, QR, identifiers.
"""
import argparse
import hashlib
import hmac
import json
import re
import secrets
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.parse import urlsplit

TARGET = "/api/local_form/company_item_reduce"
DECIMAL_TEXT = re.compile(r"(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)\Z")


def as_positive_decimal(value):
    if type(value) not in (int, float, str, Decimal):
        return None
    text = str(value).strip()
    if type(value) is str and not DECIMAL_TEXT.fullmatch(text):
        return None
    try:
        result = Decimal(text)
    except (InvalidOperation, ValueError):
        return None
    return result if result.is_finite() and result > 0 else None


def check_quantities(payload):
    if not isinstance(payload, dict):
        return "not_available"
    items = [
        v for k, v in payload.items()
        if isinstance(k, str) and re.fullmatch(r"item[0-9]+", k)
    ]
    vehicle = payload.get("vihcle_info")  # Literal spelling in client JS
    if not items or not isinstance(vehicle, dict):
        return "not_available"
    quantities = []
    for item in items:
        if not isinstance(item, dict):
            return "invalid_value"
        q = as_positive_decimal(item.get("production_capacity"))
        if q is None:
            return "invalid_value"
        quantities.append(q)
    w = as_positive_decimal(vehicle.get("weight_quantity"))
    if w is None:
        return "invalid_value"
    return "matching" if sum(quantities, Decimal("0")) == w else "mismatch"


def read_payload(request):
    post_data = request.get("postData") or {}
    raw = post_data.get("text")
    if not isinstance(raw, str) or not raw.strip():
        return None, "not_captured"
    try:
        payload = json.loads(raw)
    except (ValueError, TypeError):
        return None, "not_json"
    if not isinstance(payload, dict):
        return None, "not_object"
    return payload, "json"


def analyze_har(har):
    entries = har.get("log", {}).get("entries", [])
    if not isinstance(entries, list):
        raise ValueError("HAR log.entries must be a list")
    key = secrets.token_bytes(32)  # One-run-only, not saved
    fingerprints = defaultdict(list)
    results = []
    for position, entry in enumerate(entries, 1):
        if not isinstance(entry, dict):
            continue
        request = entry.get("request") or {}
        response = entry.get("response") or {}
        if not isinstance(request, dict) or not isinstance(response, dict):
            continue
        endpoint = urlsplit(request.get("url") or "").path.rstrip("/")
        if endpoint != TARGET:
            continue
        method = str(request.get("method") or "UNKNOWN").upper()
        payload, body_state = read_payload(request)
        rec = {
            "entry": position,
            "method": method,
            "http_status": response.get("status") if isinstance(response.get("status"), int) else None,
            "body_state": body_state,
            "quantity_status": check_quantities(payload),
            "duplicate_group": None,
        }
        results.append(rec)
        if payload is not None:
            canonical = json.dumps(
                {"method": method, "payload": payload},
                ensure_ascii=False, sort_keys=True, separators=(",", ":"),
            ).encode("utf-8")
            fp = hmac.new(key, canonical, hashlib.sha256).digest()
            fingerprints[fp].append(rec)

    duplicate_groups = []
    for group in fingerprints.values():
        if len(group) < 2:
            continue
        name = f"D{len(duplicate_groups) + 1}"
        for item in group:
            item["duplicate_group"] = name
        duplicate_groups.append({
            "group": name,
            "entries": [item["entry"] for item in group],
            "count": len(group),
        })
    return {
        "analysis_mode": "OFFLINE_READ_ONLY",
        "total_har_entries": len(entries),
        "relevant_requests": len(results),
        "possible_duplicate_groups": duplicate_groups,
        "results": results,
        "limitations": [
            "Repeated HTTP requests do not prove repeated database operations.",
            "Matching client-supplied weights do not prove server-side validation.",
            "HTTP 200 does not prove authorization or a database change.",
            "Input HAR may contain secrets: do not publish it.",
        ],
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("har", help="Saved HAR file")
    parser.add_argument("--output", default="reports/har_forensic_report.json")
    args = parser.parse_args(argv)
    path = Path(args.har)
    if not path.is_file():
        parser.error(f"HAR file not found: {path}")
    har = json.loads(path.read_text(encoding="utf-8-sig"))
    report = analyze_har(har)
    out = Path(args.output)
    if out.resolve() == path.resolve():
        parser.error("Output must not overwrite input HAR")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print("=== UBOOR HAR FORENSICS ===")
    print("HAR entries:", report["total_har_entries"])
    print("Relevant requests:", report["relevant_requests"])
    print("Possible duplicate groups:", len(report["possible_duplicate_groups"]))
    for record in report["results"]:
        print(f"#{record['entry']}: {record['method']} HTTP {record['http_status']} | "
              f"quantity={record['quantity_status']} | duplicate={record['duplicate_group']}")
    for group in report["possible_duplicate_groups"]:
        print(f"{group['group']}: entries {group['entries']}")
    print("Saved:", out)
    print("Network requests: 0")


if __name__ == "__main__":
    main()
