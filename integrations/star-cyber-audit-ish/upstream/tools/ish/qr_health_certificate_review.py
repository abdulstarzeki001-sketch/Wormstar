#!/usr/bin/env python3
"""Offline read-only review of a supplied QRHealthCertificate Vite JS chunk.

Version-specific source-pattern indicators. Does not execute JS, contact external
systems, or establish server-side flaws. Uses Python's standard library only.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

RULES = (
    ("HC-01", "success_message_skips_expiration_check", r'!\(typeof a\.message=="string"&&/تم\|نجح\|نجاح\|تم ارسال\|تمت/iu\.test\(a\.message\)\)', "high-review"),
    ("HC-02", "latest_heterogeneous_date_used", r'license_approval_date&&w\.push\(a\.license_approval_date\).*?Math\.max\(\.\.\.n\)', "high-review"),
    ("HC-03", "missing_valid_date_skips_expiration", r'E=n\.length\?Math\.max\(\.\.\.n\):NaN;if\(!isNaN\(E\)\)', "high-review"),
    ("HC-04", "48h_client_expiration_heuristic", r'C=2880\*60\*1e3;if\(m>C\)', "review"),
    ("HC-05", "server_response_debug_logged", r'console\.debug\("\[QRHealth\] serverData=",a\)', "privacy-review"),
    ("HC-06", "full_response_saved_to_sessionstorage", r'sessionStorage\.setItem\("hc_print",JSON\.stringify\(a\)\)', "privacy-review"),
    ("HC-07", "response_saved_to_qr_store", r'type:"شهادة صحية".*?response:a,x:u,y:g', "privacy-review"),
    ("HC-08", "shared_auth_header_mutation", r'defaults\.headers\.common\.Authorization=', "session-review"),
    ("HC-09", "duplicate_scan_stops_loop", r'if\(t===S&&U-j<3e3\)\{h\.value=\{raw:t,x:u,y:g,duplicate:!0\};return\}', "reliability-review"),
    ("HC-10", "camera_cleanup_without_frame_cancel", r'function G\(\)\{d&&\(d\.getTracks\(\).*?\}.*?ae\(\(\)=>\{G\(\)\}\)', "lifecycle-review"),
    ("HC-11", "retry_can_schedule_multiple_frame_loops", r'function J\(\)\{h\.value=null,k\.value=!0,d\|\|P\(\),requestAnimationFrame\(y\)\}', "lifecycle-review"),
    ("HC-12", "zero_coordinate_rejected_by_truthy_test", r'_\.value\.latitude&&isFinite\(_\.value\.latitude\)&&_\.value\.longitude', "low-review"),
    ("HC-13", "blank_coordinates_can_reach_post", r'Z=\{url:A,x_coordinate:u,y_coordinate:g\}.*?I\.post\("BorderPort_HS/read_doc_health",Z', "contract-review"),
    ("HC-14", "sessionstorage_failure_not_a_navigation_guard", r'sessionStorage\.getItem\("hc_print"\)\|\|b\("فشل حفظ بيانات الطباعة في المتصفح"\)', "reliability-review"),
    ("HC-15", "http_402_treated_as_expired", r'a===402\?\(b\(', "contract-review"),
    ("HC-16", "date_parse_precedes_day_first_fallback", r'Date\.parse\(C\).*?C\.match\(/\^\(\\d\{1,2\}\)', "date-review"),
)


def indicators(source: str) -> list[dict[str, str]]:
    return [
        {"id": id_, "indicator": name, "category": priority}
        for id_, name, regex, priority in RULES
        if re.search(regex, source, re.DOTALL)
    ]


def compare(source: str, qr_local: str | None = None, qr_imported: str | None = None) -> dict[str, bool | None]:
    return {
        "health_uses_health_api": 'I.post("BorderPort_HS/read_doc_health"' in source,
        "health_uses_browser_gps": "navigator.geolocation.getCurrentPosition" in source,
        "health_has_local_48h_heuristic": '2880*60*1e3' in source,
        "health_uses_hc_print_sessionstorage": 'sessionStorage.setItem("hc_print"' in source,
        "local_uses_local_form_api": 'local_form/read_doc_company' in qr_local if qr_local is not None else None,
        "imported_uses_camera_pixels": 'Math.round(m.x+m.width/2)' in qr_imported if qr_imported is not None else None,
    }


def verified_source(path: Path) -> bytes:
    if not path.is_file() or path.stat().st_size > 12_000_000:
        raise ValueError("Source missing or larger than 12 MB")
    blob = path.read_bytes()
    head = blob[:1024].lstrip().lower()
    if not blob or b"\0" in head or head.startswith((b"<html", b"<!doctype html", b"<head")):
        raise ValueError("Empty, binary, or HTML/WAF source rejected")
    return blob


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Local QRHealthCertificate-*.js")
    parser.add_argument("--qr-local", type=Path, help="Optional local QRLocal source")
    parser.add_argument("--qr-imported", type=Path, help="Optional local QRImported source")
    args = parser.parse_args(argv)
    try:
        raw = verified_source(args.source)
        source = raw.decode("utf-8", "replace")
        if '__name:"QRHealthCertificate"' not in source or 'BorderPort_HS/read_doc_health' not in source:
            raise ValueError("Not expected QRHealthCertificate module")
        local = verified_source(args.qr_local).decode("utf-8", "replace") if args.qr_local else None
        imported = verified_source(args.qr_imported).decode("utf-8", "replace") if args.qr_imported else None
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    result = {
        "source": {"name": args.source.name, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()},
        "scope": "offline static frontend review; no live or server-side verification",
        "api_paths": ["POST BorderPort_HS/read_doc_health"],
        "indicators": indicators(source),
        "comparison": compare(source, local, imported),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
