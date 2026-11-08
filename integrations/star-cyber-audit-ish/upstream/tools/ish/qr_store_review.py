#!/usr/bin/env python3
"""Read-only audit of an authorized local qrStore JavaScript snapshot.

The supplied JS is NEVER executed. This reviewer makes NO network requests,
does not decrypt QR codes, and cannot establish backend document validity.
"""
import argparse
import hashlib
import json
from pathlib import Path

RULES = (
    ("QS-01", "shared_origin_storage_key", ('const e="qr_readings"',), "namespace"),
    ("QS-02", "parsed_data_not_checked_as_array", ('t?JSON.parse(t):[]',), "data_integrity"),
    ("QS-03", "read_errors_silently_return_empty_list", ('catch{return[]}',), "data_loss"),
    ("QS-04", "write_errors_silently_ignored",
     ('localStorage.setItem(e,JSON.stringify(t))', 'catch{}'), "durability"),
    ("QS-05", "new_entries_are_prepended", ('a.unshift(t)',), "ordering"),
    ("QS-06", "read_modify_write_has_no_atomic_guard",
     ('const a=n();a.unshift(t),r(a)',), "concurrency_review"),
    ("QS-07", "add_does_not_validate_entry_or_array",
     ('function s(t){const a=n();a.unshift(t),r(a)}',), "data_integrity"),
    ("QS-08", "full_array_is_serialized_for_each_add",
     ('localStorage.setItem(e,JSON.stringify(t))', 'const a=n();a.unshift(t),r(a)'), "performance"),
    ("QS-09", "malformed_json_followed_by_add_can_replace_existing_value",
     ('catch{return[]}', 'const a=n();a.unshift(t),r(a)'), "data_loss"),
    ("QS-10", "module_only_exposes_add_and_list", ('export{s as a,n as l}',), "public_interface"),
)

def inspect(source):
    matches = [
        {"id": ident, "indicator": name, "category": category}
        for ident, name, fragments, category in RULES
        if all(f in source for f in fragments)
    ]
    if 'a.unshift(t)' in source and all(t not in source for t in ('slice(', 'splice(', '.filter(', 'MAX_ITEMS')):
        matches.append({"id": "QS-11", "indicator": "no_maximum_list_length_visible", "category": "retention"})
    if 'localStorage.getItem(e)' in source and all(t not in source for t in ('Date.now(', 'expiresAt', 'expires_at', 'savedAt', 'TTL')):
        matches.append({"id": "QS-12", "indicator": "no_expiration_or_ttl_visible", "category": "retention"})
    if 'const e="qr_readings"' in source and all(t not in source for t in ('userId', 'user_id', 'tenantId', 'accountId')):
        matches.append({"id": "QS-13", "indicator": "storage_key_not_scoped_per_account", "category": "privacy_review"})
    return matches

def compare(document, checkpoints, store):
    """Cross-file source evidence only. No network, credentials or real records."""
    return {
        "store_key_is_qr_readings": 'const e="qr_readings"' in store,
        "document_reads_qr_store": 'const x=CB(),P=b.query.id' in document,
        "document_can_fall_back_to_first_stored_record": 'a.value=AA||x[0]||null' in document,
        "document_writes_separate_checkpoint_session_key":
            'sessionStorage.setItem("qr_read_doc"' in document,
        "checkpoints_reads_separate_session_key":
            'sessionStorage.getItem("qr_read_doc")' in checkpoints,
        "no_evidence_of_direct_server_sync_in_store":
            all(token not in store for token in ('fetch(', '.post(', '.get(', 'XMLHttpRequest')),
    }

def checked_read(path, max_bytes=15_000_000):
    if not path.is_file() or not 0 < path.stat().st_size <= max_bytes:
        raise ValueError("File is missing, empty, or too large")
    blob = path.read_bytes()
    header = blob[:1024].lstrip().lower()
    if b"\x00" in header or header.startswith((b"<html", b"<!doctype", b"<head")):
        raise ValueError("Expected JavaScript, received HTML/WAF/binary input")
    return blob

def fingerprint(blob):
    return {
        "size_bytes": len(blob),
        "sha256": hashlib.sha256(blob).hexdigest(),
        "git_blob_sha1": hashlib.sha1(
            b"blob " + str(len(blob)).encode() + b"\x00" + blob
        ).hexdigest(),
    }

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Local qrStore-B8bgApfd.js")
    parser.add_argument("--document", type=Path, help="Optional local QRDocument-*.js")
    parser.add_argument("--checkpoints", type=Path, help="Optional local QRCheckpoints-*.js")
    args = parser.parse_args(argv)
    if bool(args.document) != bool(args.checkpoints):
        parser.error("Use --document and --checkpoints together for cross-file analysis")
    try:
        raw = checked_read(args.source, max_bytes=1_000_000)
        source = raw.decode("utf-8", errors="replace")
        if 'const e="qr_readings"' not in source or 'export{s as a,n as l}' not in source:
            raise ValueError("Not the expected qrStore version")
        output = {
            "source": {"name": args.source.name, **fingerprint(raw)},
            "scope": "offline frontend code review; no live records/backend authorization checks",
            "known_browser_storage_key": "qr_readings",
            "direct_api_requests": [],
            "indicators": inspect(source),
        }
        if args.document:
            doc = checked_read(args.document).decode("utf-8", "replace")
            cp = checked_read(args.checkpoints).decode("utf-8", "replace")
            if '__name:"QRDocument"' not in doc or '__name:"QRCheckpoints"' not in cp:
                raise ValueError("Expected matching QRDocument and QRCheckpoints bundles")
            output["cross_file_evidence"] = compare(doc, cp, source)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
