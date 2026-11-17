#!/usr/bin/env python3
"""Offline source-pattern review for a supplied useLocalCompany Vite JS asset.

Does not execute JavaScript or contact UBOOR. Rules are conservative indicators,
not proof of vulnerabilities. Works with the Python standard library on iSH.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

RULES = (
    ("LC-01", "demo_qr_records_seed_local_storage", r'localStorage\.setItem\(i,JSON\.stringify\(A\.value\)\)', "medium"),
    ("LC-02", "doc_number_numeric_coercion", r'doc_number\s*:\s*Number\(r\)', "medium"),
    ("LC-03", "qr_row_debug_logging", r'console\.debug\(\s*["\']\[useQrControl\] previewServerReading row data:', "medium"),
    ("LC-04", "preview_response_stored_in_browser", r'raw\s*:\s*\{\s*doc_number\s*:\s*r\s*,\s*response\s*:\s*U\s*\}', "medium"),
    ("LC-05", "geo_uses_truthiness", r's\.latitude\s*&&\s*s\.longitude\s*&&\s*isFinite', "low"),
    ("LC-06", "preview_document_type_zero_omitted", r'\.\.\.c\s*\?\s*\{\s*company_type\s*:\s*c\s*\}\s*:\s*\{\}', "review"),
    ("LC-07", "download_hash_id_unescaped", r'download_file\?url=\$\{encodeURIComponent\(o\)\}&hash_id=\$\{m\}', "review"),
    ("LC-08", "server_list_assumed_array", r'const\s+M\s*=\s*y\.data\s*\|\|\s*\[\];\s*S\.value\s*=\s*M\.map\(', "review"),
    ("LC-09", "document_presence_check_unused", r'return!w&&q&&Array\.isArray\(h\)&&h\.length>0&&\(w=!0\),Array\.isArray\(n\)', "review"),
)
PAT_API = re.compile(r'(?:local_form|log_event)/[A-Za-z0-9_/?.{}$-]+')

def indicators(source):
    return [
        {"id": code, "name": name, "priority": priority}
        for code, name, regex, priority in RULES
        if re.search(regex, source, re.DOTALL)
    ]

def api_paths(source):
    return sorted(set(PAT_API.findall(source)))

def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 1:
        print('Usage: python3 tools/ish/use_local_company_review.py /path/to/useLocalCompany-*.js', file=sys.stderr)
        return 2
    path = Path(argv[0]).expanduser()
    if not path.is_file() or path.stat().st_size > 12_000_000:
        print('Expected existing source file under 12 MB', file=sys.stderr)
        return 2
    raw = path.read_bytes()
    if b'\x00' in raw[:1024] or raw.lstrip().lower().startswith((b'<html', b'<!doctype')):
        print('File is not a verified JavaScript source', file=sys.stderr)
        return 2
    source = raw.decode('utf-8', 'replace')
    if 'paginate_qrcode_reader2' not in source or 'iraqi_company_create' not in source:
        print('File is not the expected useLocalCompany module', file=sys.stderr)
        return 2
    print(json.dumps({
        'file': path.name,
        'bytes': len(raw),
        'sha256': hashlib.sha256(raw).hexdigest(),
        'api_paths': api_paths(source),
        'indicators': indicators(source),
        'scope': 'read-only static frontend analysis; no backend claims',
    }, ensure_ascii=False, indent=2))
    return 0

if __name__ == '__main__':
    sys.exit(main())
