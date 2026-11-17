#!/usr/bin/env python3
"""Read-only static reviewer for user-provided DisableDocument Vite JavaScript.

Does not execute the supplied JS or make requests. String-pattern indicators
are frontend evidence, not proof of backend vulnerabilities.
"""
import argparse
import hashlib
import json
from pathlib import Path

RULES = (
    ("DD-01", "mutation_triggered_on_scan", ('await $.post("local_form/reset_company_qrcode",T',), "high-ux"),
    ("DD-02", "success_card_based_on_error_flag_only", ('D(o).error?', '"تم التعطيل بنجاح"', 'o.value={raw:t,x:i,y:g}'), "high-integrity"),
    ("DD-03", "expired_state_missing_error_flag", ('o.value={raw:L,x:i,y:g,response:a,expired:!0}',), "high-integrity"),
    ("DD-04", "success_false_not_checked", ('o.value={...o.value,response:a},a.error)', '"تم التعطيل بنجاح"'), "high-integrity"),
    ("DD-05", "full_bearer_token_console_log", ('console.debug("[QRLocal] auth token:",y.token)',), "high-privacy"),
    ("DD-06", "shared_axios_default_authorization_mutated", ('.defaults.headers.common.Authorization=',), "medium-session"),
    ("DD-07", "diagnostic_second_post_inside_error_handler", ('catch(c){console.error("API error",c)', 'fetch(h,{method:"POST"'), "high-reliability"),
    ("DD-08", "debug_url_missing_separator", ('.replace(/\\/$/,"")+"local_form/reset_company_qrcode"',), "medium-reliability"),
    ("DD-09", "gps_cache_has_infinite_maximum_age", ('maximumAge:1/0',), "medium-location"),
    ("DD-10", "zero_coordinates_discarded_as_false", ('b.value.latitude&&isFinite(b.value.latitude)&&b.value.longitude',), "low-location"),
    ("DD-11", "empty_coordinates_can_be_posted", ('let i="",g=""', 'T={url:M,x_coordinate:i,y_coordinate:g}'), "medium-location"),
    ("DD-12", "48hour_client_heuristic_with_message_skip", ('/تم|نجح|نجاح|تم ارسال|تمت/iu.test(a.message)', '2880*60*1e3'), "review-expiry"),
    ("DD-13", "duplicate_scan_stops_frame_loop", ('if(t===L&&O-z<3e3){o.value={raw:t,x:i,y:g,duplicate:!0};return}',), "medium-lifecycle"),
    ("DD-14", "unmount_stops_camera_only", ('re(()=>{K()})', 'function K(){u&&(u.getTracks()'), "medium-lifecycle"),
    ("DD-15", "retry_can_schedule_parallel_frame_loops", ('function X(){o.value=null,R.value=!0,u||H(),requestAnimationFrame(p)}',), "medium-lifecycle"),
    ("DD-16", "url_prefix_only_checks_http", ('!t.startsWith("http")',), "low-validation"),
    ("DD-17", "server_response_logged_to_console", ('console.debug("[QRLocal] serverData=",a)',), "medium-privacy"),
)

ENDPOINTS = (("POST", "local_form/reset_company_qrcode"),)
HEALTH_ENDPOINT = "BorderPort_HS/read_doc_health"

def indicators(source):
    return [
        {"id": ident, "indicator": title, "priority": priority}
        for ident, title, needles, priority in RULES
        if all(needle in source for needle in needles)
    ]

def compare_health(disable_source, health_source):
    """Cross-file signals only; no live service assumptions."""
    return {
        "distinct_api_endpoints":
            "local_form/reset_company_qrcode" in disable_source and HEALTH_ENDPOINT in health_source,
        "common_48hour_window": all("2880*60*1e3" in text for text in (disable_source, health_source)),
        "common_barcode_detector": all('BarcodeDetector({formats:["qr_code"]})' in text
                                       for text in (disable_source, health_source)),
        "disable_diagnostic_second_post": 'fetch(h,{method:"POST"' in disable_source,
        "health_does_not_have_disable_post": "local_form/reset_company_qrcode" not in health_source,
    }

def checked_read(path):
    if not path.is_file() or path.stat().st_size > 12_000_000:
        raise ValueError("Source does not exist or exceeds 12 MB")
    raw = path.read_bytes()
    head = raw[:1024].lstrip().lower()
    if not raw or b"\x00" in head or head.startswith((b"<html", b"<!doctype", b"<head")):
        raise ValueError("Non-JS or HTML/WAF response")
    return raw

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Local DisableDocument-*.js file")
    parser.add_argument("--health", type=Path, help="Optional matching QRHealthCertificate-*.js file")
    args = parser.parse_args(argv)
    try:
        raw = checked_read(args.source)
        source = raw.decode("utf-8", errors="replace")
        if '__name:"DisableDocument"' not in source or "local_form/reset_company_qrcode" not in source:
            raise ValueError("Unexpected source; expected DisableDocument module")
        result = {
            "source": {"name": args.source.name, "bytes": len(raw),
                       "sha256": hashlib.sha256(raw).hexdigest()},
            "scope": "offline frontend static review; backend not verified",
            "api": [{"method": method, "path": path} for method, path in ENDPOINTS],
            "indicators": indicators(source),
        }
        if args.health:
            hraw = checked_read(args.health)
            hsource = hraw.decode("utf-8", "replace")
            if '__name:"QRHealthCertificate"' not in hsource:
                raise ValueError("Expected a QRHealthCertificate source for comparison")
            result["health_comparison"] = {
                "sha256": hashlib.sha256(hraw).hexdigest(),
                "checks": compare_health(source, hsource),
            }
    except (ValueError, OSError) as exc:
        parser.error(str(exc))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
