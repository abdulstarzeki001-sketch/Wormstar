#!/usr/bin/env python3
"""Static-only review of a user-supplied QRImported Vite asset; no JS execution."""
import argparse
import hashlib
import json
import re
from pathlib import Path

RULES = (
    ("QI-01", "camera_pixel_coordinates_sent_as_x_y", r'm&&\(h=String\(Math\.round\(m\.x\+m\.width/2\)\),v=String\(Math\.round\(m\.y\+m\.height/2\)\)\).*?x_coordinate:h,y_coordinate:v', "high-integration"),
    ("QI-02", "bearer_token_in_debug_console", r'console\.debug\("\[QRImported\] auth token:",f\.token\)', "high-privacy"),
    ("QI-03", "shared_axios_authorization_default_mutated", r'defaults\.headers\.common\.Authorization\s*=', "medium-session"),
    ("QI-04", "post_retried_in_error_debug_path", r'catch\(x\)\{console\.error\("API error".*?fetch\(S,\{method:"POST"', "high-reliability"),
    ("QI-05", "duplicate_scan_stops_frame_loop", r'if\(t===j&&F-U<3e3\)\{l\.value=\{raw:t,x:h,y:v,duplicate:!0\};return\}', "medium-reliability"),
    ("QI-06", "camera_cleanup_does_not_cancel_frame_loop", r'function V\(\)\{i&&\(i\.getTracks\(\).*?\}.*?J\(\(\)=>\{V\(\)\}\)', "medium-lifecycle"),
    ("QI-07", "retry_may_schedule_multiple_frames", r'function P\(\)\{l\.value=null,k\.value=!0,i\|\|M\(\),requestAnimationFrame\(u\)\}', "medium-lifecycle"),
    ("QI-08", "http_transport_success_implies_ui_success", r'A\.post\("local_form/read_doc_company",B,\{headers:.*?\}\}\);ee\("تم إرسال', "medium-response-contract"),
    ("QI-09", "url_prefix_validation_only", r'!t\.startsWith\("http"\)', "low-input"),
    ("QI-10", "full_api_response_persisted_locally", r'type:"مستورد".*?response:x\.data,x:h,y:v', "medium-privacy"),
    ("QI-11", "api_response_rendered_in_ui", r'رد السيرفر: "\+y\(c\(l\)\.response\)', "medium-privacy"),
    ("QI-12", "importer_uses_local_company_endpoint", r'A\.post\("local_form/read_doc_company",B', "review-routing"),
    ("QI-13", "missing_auth_routes_to_login_name", r'L\.push\(\{name:"Login"\}\)', "review-router"),
)

def inspect(source):
    return [{"id": code, "indicator": name, "priority": priority}
            for code, name, pattern, priority in RULES
            if re.search(pattern, source, re.DOTALL)]

def compare(imported, local=None, gate=None):
    """Compare only locally supplied sources, not endpoint responses."""
    return {
        "imported_sends_pixel_coordinates": "m&&(h=String(Math.round(m.x+m.width/2))" in imported,
        "imported_direct_local_post": 'A.post("local_form/read_doc_company"' in imported,
        "local_uses_geolocation": bool(local and "navigator.geolocation" in local),
        "exit_gate_uses_geolocation": bool(gate and "navigator.geolocation" in gate),
        "exit_gate_delegates_to_use_exit_gate": bool(gate and "searchImportedGoods" in gate),
    }

def checked_read(path):
    if not path.is_file() or path.stat().st_size > 12_000_000:
        raise ValueError("Source missing or exceeds 12 MB")
    data = path.read_bytes()
    head = data[:1024].lstrip().lower()
    if b'\0' in head or head.startswith((b'<html', b'<!doctype html', b'<head')):
        raise ValueError("HTML/WAF/binary is not a verified JavaScript source")
    return data

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Local QRImported-*.js")
    parser.add_argument("--qr-local", type=Path, help="Optional local QRLocal JS")
    parser.add_argument("--exit-importer", type=Path, help="Optional QrLocalImporter JS")
    args = parser.parse_args(argv)
    try:
        raw = checked_read(args.source)
        code = raw.decode("utf-8", "replace")
        if '__name:"QRImported"' not in code or 'local_form/read_doc_company' not in code:
            raise ValueError("Not the expected QRImported module")
        local = checked_read(args.qr_local).decode("utf-8", "replace") if args.qr_local else None
        gate = checked_read(args.exit_importer).decode("utf-8", "replace") if args.exit_importer else None
        result = {
            "source": {"name": args.source.name, "bytes": len(raw),
                       "sha256": hashlib.sha256(raw).hexdigest()},
            "scope": "offline static review only; no backend claims",
            "api_calls": ["POST local_form/read_doc_company"],
            "indicators": inspect(code),
            "cross_file_comparison": compare(code, local, gate),
        }
    except (OSError, ValueError) as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
