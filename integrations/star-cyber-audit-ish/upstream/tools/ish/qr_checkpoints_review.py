#!/usr/bin/env python3
"""Offline source review for the user-supplied QRCheckpoints Vue/Vite chunk.

Does not execute JS, contact a government endpoint, authenticate, or store
sensitive record values. Version-specific text indicators are not proven flaws.
"""
import argparse
import hashlib
import json
from pathlib import Path

RULES = (
    ("CP-01", "props_items_accepts_array_like_without_initial_type_check",
     ("props:{items:{}}", "i.items&&i.items.length?i.items.slice():[]"), "input_contract"),
    ("CP-02", "prop_watcher_replaces_with_array_copy",
     ("v(()=>i.items", "Array.isArray(e)&&(s.value=e.slice())"), "positive_observation"),
    ("CP-03", "history_state_read_doc_is_first_fallback",
     ("history&&history.state||{}", "e.read_doc&&Array.isArray(e.read_doc)"), "record_provenance"),
    ("CP-04", "read_doc_can_come_from_session_storage",
     ('sessionStorage.getItem("qr_read_doc")', "JSON.parse(o)"), "stale_data_review"),
    ("CP-05", "read_doc_can_come_from_url_query_json",
     ("d.query.read_doc", "decodeURIComponent(d.query.read_doc)"), "url_data_review"),
    ("CP-06", "present_but_invalid_session_prevents_url_fallback",
     ("if(o)try{", "catch{}else if(d.query.read_doc"), "error_fallback"),
    ("CP-07", "empty_history_array_blocks_later_fallback",
     ("Array.isArray(e.read_doc))s.value=e.read_doc",), "data_precedence"),
    ("CP-08", "map_visibility_OR_but_click_handler_AND",
     ("e.x_coordinate||e.y_coordinate", "!e.x_coordinate||!e.y_coordinate"), "ui_consistency"),
    ("CP-09", "google_maps_url_includes_unvalidated_coordinates",
     ("https://www.google.com/maps?q=", 'window.open(o,"_blank")'), "privacy_location"),
    ("CP-10", "utc_marked_dates_forced_utc_but_others_browser_local",
     ('new Intl.DateTimeFormat("ar-EG",_)', 'e.includes("Z")', '_.timeZone="UTC"'), "timezone_consistency"),
    ("CP-11", "malformed_date_reverts_to_raw_value",
     ("catch{return String(e)}",), "date_validation"),
    ("CP-12", "loading_flag_synchronous_without_fetch",
     ("l.value=!0;try{", "finally{l.value=!1}"), "ui_loading"),
    ("CP-13", "list_uses_array_index_as_vue_key",
     ("key:u", "C(s.value,"), "render_identity"),
)

def inspect(text):
    if '__name:"QRCheckpoints"' not in text:
        raise ValueError("Expected QRCheckpoints source")
    result = [
        {"id": ident, "indicator": name, "category": category}
        for ident, name, patterns, category in RULES
        if all(p in text for p in patterns)
    ]
    if 'sessionStorage.getItem("qr_read_doc")' in text and not any(
        key in text for key in ("doc_id", "document_id", "certificate_number")
    ):
        result.append({"id": "CP-14", "indicator": "no_document_id_binding_visible_in_component",
                       "category": "record_provenance"})
    return result

def compare_parent(checkpoints, parent):
    if '__name:"QRDocument"' not in parent:
        raise ValueError("Expected QRDocument parent bundle")
    return {
        "parent_writes_qr_read_doc": 'sessionStorage.setItem("qr_read_doc"' in parent,
        "child_reads_qr_read_doc": 'sessionStorage.getItem("qr_read_doc")' in checkpoints,
        "parent_imports_checkpoints_component": 'QRCheckpoints-Brs0uL0-.js' in parent,
        "child_performs_no_direct_http_requests": all(
            phrase not in checkpoints for phrase in ('fetch(', '.post(', '.get(')
        ),
    }

def checked_read(path):
    if not path.is_file() or not 0 < path.stat().st_size <= 15_000_000:
        raise ValueError("Source missing, empty, or exceeds 15 MB")
    raw = path.read_bytes()
    head = raw[:1024].lstrip().lower()
    if b"\x00" in head or head.startswith((b"<html", b"<!doctype", b"<head")):
        raise ValueError("HTML/WAF/binary content is not JS source")
    return raw

def fingerprint(raw):
    return {
        "bytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "git_blob_sha1": hashlib.sha1(
            b"blob " + str(len(raw)).encode() + b"\x00" + raw
        ).hexdigest(),
    }

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Local QRCheckpoints-Brs0uL0-.js")
    parser.add_argument("--parent", type=Path, help="Optional local QRDocument-BJwpoEJY.js")
    args = parser.parse_args(argv)
    try:
        raw = checked_read(args.source)
        code = raw.decode("utf-8", "replace")
        indicators = inspect(code)
        result = {
            "source": {"name": args.source.name, **fingerprint(raw)},
            "scope": "offline frontend-only source analysis; no backend checks",
            "direct_api_requests": [],
            "findings": indicators,
        }
        if args.parent:
            parent_raw = checked_read(args.parent)
            parent_code = parent_raw.decode("utf-8", "replace")
            result["parent"] = {
                "name": args.parent.name,
                "sha256": hashlib.sha256(parent_raw).hexdigest(),
                "relation": compare_parent(code, parent_code),
            }
    except (OSError, ValueError) as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
