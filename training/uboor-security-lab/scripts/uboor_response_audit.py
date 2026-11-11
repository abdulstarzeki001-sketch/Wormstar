#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Offline read-only analysis of UBOOR shipping HTTP responses.

Accepts a saved JSON response body or a raw HTTP/1.1 response with headers.
No outgoing requests, tokens, IDs, or personal information in the report.
Only Python standard-library modules are used.
"""
import argparse
import base64
import json
import re
import sys
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


def positive_decimal(value):
    """Strictly accept positive decimal numbers, including numeric strings."""
    if type(value) not in (int, float, str, Decimal):
        return None
    if isinstance(value, str):
        text = value.strip()
        if not re.fullmatch(r"(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)", text):
            return None
    else:
        text = str(value)
    try:
        val = Decimal(text)
    except (InvalidOperation, ValueError):
        return None
    return val if val.is_finite() and val > 0 else None


def load_response(path):
    raw = Path(path).read_text(encoding="utf-8-sig").strip()
    status = None
    headers = {}
    if raw.startswith("HTTP/"):
        separator = re.search(r"\r?\n\r?\n", raw)
        if not separator:
            raise ValueError("HTTP response lacks a blank line before JSON body")
        head = raw[:separator.start()]
        body = raw[separator.end():]
        lines = head.splitlines()
        match = re.match(r"HTTP/\d(?:\.\d)?\s+(\d{3})", lines[0])
        if match:
            status = int(match.group(1))
        for line in lines[1:]:
            if ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()
        raw = body.strip()
    try:
        document = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Invalid/incomplete JSON at line {e.lineno}, column {e.colno}. "
            "Save the complete response, including its closing brace."
        ) from e
    if not isinstance(document, dict):
        raise ValueError("JSON response must be an object")
    return status, headers, document


def inspect_qr(url):
    output = {
        "present": bool(url),
        "fernet_shape": "not_checked",
        "cryptographic_authenticity_verified": False,
    }
    if not isinstance(url, str) or not url:
        return output
    try:
        parsed = urlsplit(url)
    except ValueError:
        output["fernet_shape"] = "invalid_url"
        return output
    # Hostnames, path segments, and arbitrary type labels can contain IDs.
    output["hostname"] = "[REDACTED]" if parsed.hostname else None
    output["path"] = "[REDACTED]" if parsed.path else ""
    values = parse_qs(parsed.query).get("url", [])
    if not values:
        output["fernet_shape"] = "no_url_parameter"
        return output
    token_and_kind = values[0]
    if "|" not in token_and_kind:
        output["fernet_shape"] = "no_type_separator"
        return output
    token, kind = token_and_kind.rsplit("|", 1)
    output["document_kind"] = kind if kind in {"Export_product", "Import_product"} else "other"
    try:
        if not re.fullmatch(r"[A-Za-z0-9_-]+={0,2}", token):
            raise ValueError("Invalid base64url alphabet")
        binary = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4))
        if len(binary) < 73 or binary[0] != 0x80 or (len(binary) - 57) % 16 != 0:
            # Shape: version(1)+timestamp(8)+IV(16)+ciphertext(16*n)+HMAC(32)
            raise ValueError("Not a structurally valid Fernet envelope")
        timestamp = int.from_bytes(binary[1:9], "big")
        issued = datetime.fromtimestamp(timestamp, tz=timezone.utc)
        output["fernet_shape"] = "compatible"
        output["embedded_timestamp_utc"] = issued.isoformat()
    except (ValueError, OverflowError, OSError):
        output["fernet_shape"] = "not_fernet_like"
    return output


def analyze(status, headers, payload):
    items = payload.get("items")
    items = items if isinstance(items, list) else []
    quantities = [positive_decimal(item.get("production_capacity")) if isinstance(item, dict) else None for item in items]
    weight = positive_decimal(payload.get("weight_quantity"))
    if not items or weight is None or any(q is None for q in quantities):
        comparison = "not_available_or_invalid"
        summed = None
    else:
        summed = sum(quantities, Decimal("0"))
        comparison = "matching" if summed == weight else "mismatch"

    response_time = None
    if headers.get("date"):
        try:
            response_time = parsedate_to_datetime(headers["date"]).astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError):
            pass

    msg = payload.get("message")
    report = {
        "analysis_mode": "OFFLINE_READ_ONLY",
        "http_status": status,
        "http_response_date_utc": response_time,
        "document_id_present": bool(payload.get("doc_id")),
        "items_count": len(items),
        "item_quantities_valid": bool(items) and all(q is not None for q in quantities),
        "item_total": str(summed) if summed is not None else None,
        "weight_quantity": str(weight) if weight is not None else None,
        "weight_input_type": type(payload.get("weight_quantity")).__name__,
        "weight_comparison": comparison,
        # Only known unit labels are safe to copy from an untrusted response.
        "unit_labels": sorted({item["unit"] for item in items if isinstance(item, dict)
                               and isinstance(item.get("unit"), str)
                               and item["unit"] in {"kg", "g", "t", "ton", "tonne", "كغ", "كغم", "طن", "كيلوغرام"}}),
        "server_message_mentions_success": isinstance(msg, str) and "بنجاح" in msg,
        "qr": inspect_qr(payload.get("qr_code")),
        "limitations": [
            "Response alone does not reveal the original HTTP request or authorization context.",
            "HTTP 200 or a success message is not independent proof of a database update.",
            "Fernet structure/timestamp does not authenticate or decrypt the token.",
            "Do not infer permission to create a shipment from a document or QR code.",
        ],
        "redaction": "No document IDs, personal data, authorization, cookies, or QR token values included",
    }
    return report


def main():
    parser = argparse.ArgumentParser(description="Read-only UBOOR HTTP response auditor")
    parser.add_argument("response_file", help="Saved JSON body or raw HTTP response")
    parser.add_argument("-o", "--output", default="uboor_response_report.json", help="Sanitized JSON report")
    args = parser.parse_args()
    try:
        status, headers, body = load_response(args.response_file)
        report = analyze(status, headers, body)
    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    Path(args.output).write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("=== UBOOR RESPONSE AUDIT (OFFLINE) ===")
    print("HTTP:", report["http_status"] if report["http_status"] is not None else "(body only)")
    print("Document ID present:", report["document_id_present"])
    print("Items:", report["items_count"])
    print("Item total:", report["item_total"])
    print("Weight:", report["weight_quantity"])
    print("Weight comparison:", report["weight_comparison"])
    print("QR Fernet shape:", report["qr"]["fernet_shape"])
    print("Sanitized report:", args.output)
    print("Network requests: 0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
