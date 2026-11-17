#!/usr/bin/env python3
"""Read-only QRReadings frontend audit. Never executes the provided JavaScript."""
import argparse
import hashlib
import json
import re
from pathlib import Path

RULES = (
    ('RD-01', 'seeded_demo_history', r'QRCODE:12345.*?localStorage\.setItem\(W,JSON\.stringify\(q\.value\)\)', 'medium'),
    ('RD-02', 'logs_complete_preview_response', r'console\.debug\("\[QRReadings\] previewServerReading response",a\.status,a\.data\)', 'medium'),
    ('RD-03', 'logs_reader_row', r'console\.debug\("\[QRReadings\] previewServerReading row data:",t\)', 'medium'),
    ('RD-04', 'coerces_document_id_to_number', r'doc_number:Number\(e\)', 'medium'),
    ('RD-05', 'list_data_assumed_array', r'const S=l\.data\|\|\[\];I\.value=S\.map\(', 'medium'),
    ('RD-06', 'error_result_may_still_be_mapped', r'l\.success\?be\(v\):N\(v\)\);const S=l\.data\|\|\[\]', 'review'),
    ('RD-07', 'every_note_labeled_refusal', r'سبب الرفض\s*:', 'low'),
    ('RD-08', 'empty_row_colspan_five', r'colspan:"5"', 'low'),
    ('RD-09', 'phone_in_grid', r'f\(a\.doc_reader_phone\)', 'privacy_review'),
    ('RD-10', 'preview_response_to_sessionstorage', r'sessionStorage\.setItem\("qr_preview_entry",JSON\.stringify\(d\)\)', 'privacy_review'),
    ('RD-11', 'export_filter_restricted', r'X\.value&&P\.value\.includes\("download_qrcode_readers"\)', 'ux_review'),
    ('RD-12', 'preview_button_client_privilege', r'P\.value\.includes\("return_doc_qrcode"\)', 'authorization_review'),
)
ENDPOINTS = ('local_form/pagination_qrcode_reader', 'local_form/download_qrcode_readers', 'local_form/return_doc_qrcode')

def scan(source):
    return [{'id': i, 'indicator': n, 'priority': p} for i, n, pattern, p in RULES if re.search(pattern, source, re.DOTALL)]

def classify_routes(source):
    return [e for e in ENDPOINTS if e in source]

def compare(qr_source, qr_control, local_company):
    """Compare local text evidence only; never communicate with endpoints."""
    return {
        'qr_readings_owns_api_calls': all(e in qr_source for e in ENDPOINTS),
        'control_delegates_to_composable': 'useLocalCompany-DfV5kpAj.js' in qr_control and 'local_form/paginate_qrcode_reader2' in local_company,
        'distinct_list_endpoints': 'local_form/pagination_qrcode_reader' in qr_source and 'local_form/paginate_qrcode_reader2' in local_company,
        'distinct_export_endpoints': '"local_form/download_qrcode_readers"' in qr_source and '"local_form/download_qrcode_readers2"' in local_company,
        'common_preview_endpoint': '"local_form/return_doc_qrcode"' in qr_source and '"local_form/return_doc_qrcode"' in local_company,
    }

def checked_bytes(path):
    if not path.is_file() or path.stat().st_size > 12_000_000:
        raise ValueError('Source file missing or too large')
    blob = path.read_bytes()
    head = blob[:1024].lstrip().lower()
    if b'\0' in head or head.startswith((b'<html', b'<!doctype html', b'<head')):
        raise ValueError('Not a JavaScript source; possibly HTML or WAF')
    return blob

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', type=Path)
    parser.add_argument('--control', type=Path)
    parser.add_argument('--composable', type=Path)
    args = parser.parse_args(argv)
    try:
        raw = checked_bytes(args.file)
        source = raw.decode('utf-8', 'replace')
        if '__name:"QRReadings"' not in source or not all(route in source for route in ENDPOINTS):
            raise ValueError('Not the expected QRReadings source version')
        result = {'file': args.file.name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
                  'direct_api_paths': classify_routes(source), 'indicators': scan(source),
                  'scope': 'static code evidence only; server authorization not tested'}
        if args.control and args.composable:
            other = checked_bytes(args.control).decode('utf-8', 'replace')
            dep = checked_bytes(args.composable).decode('utf-8', 'replace')
            result['cross_file_comparison'] = compare(source, other, dep)
        elif args.control or args.composable:
            raise ValueError('Provide both --control and --composable to compare')
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
