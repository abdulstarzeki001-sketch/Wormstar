#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UBOOR HAR offline analyzer, read-only.
No HTTP requests. Does not replay submissions.
Usage:
    python uboor_har_analyzer.py network.har
    python uboor_har_analyzer.py                  # auto-detect .har files
Output: UBOOR_analysis_sanitized.json
"""
import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlsplit

TARGET = "company_item_reduce"
SAFE_KEYS = {
    "item_name", "item", "item1", "item2", "item3",
    "hash_id", "production_capacity", "weight_quantity", "unit",
    "vihcle_info", "vehicle_info",
    "driver_name", "licence_number", "checkpoint_name_control",
    "company_name", "vehicle_number", "registration_governorate",
    "cargo_typedetails", "destination_governorate",
    "x_coordinate", "y_coordinate",
}
VISIBLE_NUMERIC = {"production_capacity", "weight_quantity"}
RESPONSE_FIELDS = {
    "doc_id", "qr_code", "items", "message", "weight_quantity",
    "company_name", "driver_name", "current_date", "time_str"
}

def numeric_value(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) if abs(value) < 1e15 else None
    if isinstance(value, str):
        if re.fullmatch(r"\s*(?:\d+(?:\.\d+)?|\.\d+)\s*", value):
            try:
                n = float(value)
                return n if n < 1e15 else None
            except ValueError:
                return None
    return None

def display_quantity(value):
    n = numeric_value(value)
    return n if n is not None else "[REDACTED_OR_INVALID]"

def safe_key(key):
    if key in SAFE_KEYS or re.fullmatch(r"item\d{1,3}", str(key)):
        return key
    return "[OTHER_FIELD]"

def sanitize(obj, key="", depth=0):
    if depth > 12:
        return "[MAX_DEPTH]"
    if isinstance(obj, dict):
        result = {}
        for i, (k, v) in enumerate(obj.items()):
            label = safe_key(str(k))
            if label == "[OTHER_FIELD]":
                label = f"[OTHER_FIELD_{i+1}]"
            result[label] = sanitize(v, str(k), depth + 1)
        return result
    if isinstance(obj, list):
        return [sanitize(v, key, depth + 1) for v in obj[:100]]
    if key in VISIBLE_NUMERIC:
        return display_quantity(obj)
    return "[REDACTED]"

def parse_postdata(req):
    post = req.get("postData") or {}
    raw = post.get("text")
    if isinstance(raw, str):
        try:
            return json.loads(raw), "json"
        except (ValueError, TypeError):
            pass
    params = post.get("params")
    if isinstance(params, list):
        obj = {}
        for p in params:
            if isinstance(p, dict) and isinstance(p.get("name"), str):
                obj[p["name"]] = p.get("value", "[FILE_OR_UNKNOWN]")
        return obj, "form_parameters"
    return None, "not_available_or_not_json"

def response_field_names(resp):
    content = resp.get("content") or {}
    body = content.get("text")
    if not isinstance(body, str):
        return []
    try:
        parsed = json.loads(body)
    except ValueError:
        return []
    if isinstance(parsed, dict):
        return sorted(k for k in parsed if k in RESPONSE_FIELDS)
    return []

def quantity_check(payload):
    """Only a consistency check of quantities claimed by the client.
       Cannot prove server-side validations or actual DB changes.
    """
    if not isinstance(payload, dict):
        return {"status": "not_applicable"}
    vals = []
    for k, v in payload.items():
        if re.fullmatch(r"item\d+", str(k)) and isinstance(v, dict):
            n = numeric_value(v.get("production_capacity"))
            if n is not None:
                vals.append(n)
    info = payload.get("vihcle_info")
    if not isinstance(info, dict):
        info = payload.get("vehicle_info", {})
    total = numeric_value(info.get("weight_quantity")) if isinstance(info, dict) else None
    if not vals or total is None:
        return {"status": "insufficient_data"}
    diff = abs(sum(vals) - total)
    return {
        "status": "matching" if diff <= 1e-6 else "mismatch",
        "item_count_with_quantity": len(vals),
        "sum_item_quantities": round(sum(vals), 6),
        "claimed_weight_quantity": total,
        "absolute_difference": round(diff, 6),
        "note": "This checks client-submitted fields only, not server validation.",
    }

def analyze(har):
    entries = (har.get("log") or {}).get("entries") if isinstance(har, dict) else None
    if not isinstance(entries, list):
        raise ValueError("Not a HAR file: expected log.entries list")
    results = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        req = entry.get("request") or {}
        resp = entry.get("response") or {}
        raw_url = req.get("url", "")
        if not isinstance(raw_url, str):
            continue
        path = urlsplit(raw_url).path
        if TARGET.lower() not in path.lower():
            continue
        payload, payload_format = parse_postdata(req)
        results.append({
            "method": str(req.get("method", "UNKNOWN"))[:12],
            "endpoint_path_only": path,  # no query or tokens
            "http_status": resp.get("status"),
            "payload_format": payload_format,
            "sanitized_payload": sanitize(payload) if payload is not None else None,
            "quantity_consistency": quantity_check(payload),
            "response_field_names_only": response_field_names(resp),
            "remarks": (
                "HTTP 200/response success alone does not prove actual "
                "database changes or correct authorization."
            )
        })
    return {
        "analyzed_entries": len(entries),
        "matching_requests": len(results),
        "results": results,
        "read_only": True,
        "redaction": "Authorization, cookies, query strings, identities and IDs are excluded.",
    }

def pick_file(arg):
    if arg:
        path = Path(arg).expanduser()
        if not path.is_file():
            raise FileNotFoundError("Input file not found. Check the path you entered.")
        return path
    files = sorted(Path.cwd().glob("*.har"))
    if len(files) == 1:
        return files[0]
    if not files:
        raise FileNotFoundError("No .har files in this folder. Pass a HAR file path.")
    raise ValueError("More than one .har file found. Pass the file name explicitly.")

def main():
    parser = argparse.ArgumentParser(
        description="Read-only offline analysis of UBOOR company_item_reduce requests in HAR."
    )
    parser.add_argument("har", nargs="?", help="HAR path (optional if exactly one .har in folder)")
    parser.add_argument("--out", default="UBOOR_analysis_sanitized.json",
                        help="Sanitized output filename")
    args = parser.parse_args()
    try:
        path = pick_file(args.har)
        with path.open("r", encoding="utf-8-sig") as f:
            har = json.load(f)
        result = analyze(har)
        output = Path(args.out)
        if output.resolve() == path.resolve():
            raise ValueError("Output file must not overwrite input HAR")
        output.write_text(
            json.dumps(result, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        print("=== UBOOR HAR OFFLINE CHECK ===")
        print("HAR entries:", result["analyzed_entries"])
        print("Matched requests:", result["matching_requests"])
        for i, r in enumerate(result["results"], 1):
            print(f"\n#{i} {r['method']} {r['endpoint_path_only']}")
            print("HTTP status:", r["http_status"])
            print("Payload:", r["payload_format"])
            print("Quantity comparison:", r["quantity_consistency"]["status"])
            print("Returned field names:", ", ".join(r["response_field_names_only"]) or "Not available")
        if not result["matching_requests"]:
            print(
                "\nNo matching requests found. Old browser Network sessions cannot be "
                "recovered unless you saved the original HAR."
            )
        print("\nSaved sanitized report:", output)
        print("Do NOT share the raw HAR. Review sanitized report before sharing.")
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print("ERROR:", exc, file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
