#!/usr/bin/env python3
"""Offline, read-only source inspection for QrControlScan Vite component.

Does not execute JavaScript, send requests, or attempt to authenticate to UBOOR.
The rules are version-specific frontend indicators, not confirmed vulnerabilities.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

UI_RULES = (
    ("CS-01", "empty_table_colspan_is_five", r'colspan:"5"', "low"),
    ("CS-02", "reader_phone_rendered", r'l\(s\.doc_reader_phone\)', "privacy_review"),
    ("CS-03", "timestamp_rendered_as_raw_text", r'l\(s\.time_stamp\)', "low"),
    ("CS-04", "all_notes_labeled_rejection_reason", r'سبب الرفض\s*:', "review"),
    ("CS-05", "export_requires_eligible_search_field_and_privilege", r'K\.value&&g\.value\.includes\("download_qrcode_readers2"\)', "ux_review"),
    ("CS-06", "preview_button_gated_by_frontend_privilege", r'g\.value\.includes\("return_doc_qrcode"\)', "authorization_review"),
)
DEP_RULES = (
    ("CS-07", "preview_doc_id_coerced_to_number", r'doc_number:Number\(r\)', "data_integrity"),
    ("CS-08", "server_data_used_without_array_guard", r'M=y\.data\|\|\[\];S\.value=M\.map\(', "reliability"),
    ("CS-09", "local_demo_qr_rows_seeded_in_storage", r'localStorage\.setItem\(i,JSON\.stringify\(A\.value\)\)', "review"),
    ("CS-10", "preview_response_saved_in_storage", r'raw:\{doc_number:r,response:U\}', "privacy_review"),
)

def matches(source, rules):
    """Return metadata only: no sensitive snippets are extracted or copied."""
    return [
        {"id": code, "indicator": name, "priority": priority}
        for code, name, pattern, priority in rules
        if re.search(pattern, source)
    ]

def selectable_export_mismatch(source):
    """Specific contradiction in the source composable's selection definitions."""
    expected = 'm=["doc_id","time_stamp","doc_reader_org_name"]'
    selectable = 'o=[{id:"doc_type"'
    return expected in source and selectable in source and '{id:"doc_reader_org_name"' not in source

def inspect(ui_text, dependency_text=None):
    if '__name:"QrControlScan"' not in ui_text or 'useLocalCompany-DfV5kpAj.js' not in ui_text:
        raise ValueError("Expected QrControlScan component with useLocalCompany import")
    findings = matches(ui_text, UI_RULES)
    if dependency_text is not None:
        if 'paginate_qrcode_reader2' not in dependency_text or 'return_doc_qrcode' not in dependency_text:
            raise ValueError("Unexpected dependency source")
        findings += matches(dependency_text, DEP_RULES)
        if selectable_export_mismatch(dependency_text):
            findings.append({
                "id": "CS-11", "indicator": "export_field_not_selectable",
                "priority": "ux_review",
            })
    return findings

def checked_source(path, max_bytes=12_000_000):
    if not path.is_file() or path.stat().st_size > max_bytes:
        raise ValueError("Source file missing or too large")
    raw = path.read_bytes()
    head = raw[:1024].lstrip().lower()
    if b'\x00' in head or head.startswith((b'<!doctype html', b'<html', b'<head')):
        raise ValueError("Source is not verified JavaScript")
    return raw, raw.decode("utf-8", errors="replace")

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='A local QrControlScan-*.js source file')
    parser.add_argument('--dependency', type=Path, help='Optional matching useLocalCompany-*.js')
    args = parser.parse_args(argv)
    try:
        raw, ui_text = checked_source(args.source)
        dependency_text = None
        depmeta = None
        if args.dependency:
            depraw, dependency_text = checked_source(args.dependency)
            depmeta = {"file": args.dependency.name, "sha256": hashlib.sha256(depraw).hexdigest()}
        result = {
            "source": {"file": args.source.name, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()},
            "dependency": depmeta,
            "scope": "static frontend source review only; no live backend verification",
            "direct_api_calls_in_ui": 0,
            "findings": inspect(ui_text, dependency_text),
        }
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
