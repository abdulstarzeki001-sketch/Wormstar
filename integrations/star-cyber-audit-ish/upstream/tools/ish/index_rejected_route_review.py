#!/usr/bin/env python3
"""Offline, read-only review of UBOOR index-gleMzSil Vite bundle.

Only inspects relevant source windows; never executes supplied JavaScript,
contacts a server, or tests authentication or permissions. No source contents
or secrets are included in the JSON report.
"""
import argparse
import hashlib
import json
from pathlib import Path


def between(source, before, after, limit=50_000):
    start = source.find(before)
    if start < 0:
        return ""
    end = source.find(after, start + len(before))
    return source[start:(min(end, start + limit) if end >= 0 else start + limit)]


def analyze(source):
    owner = between(source, "async fetchRejectedLocalReaders(t={}){", "},logoutOwner(){")
    routes = between(source, 'path:"/dashboard"', 'Qr=AB({', 25_000)
    guard = between(source, 'Qr.beforeEach(async(', ');const nu=qm(', 3_000)
    axios = between(source, 'tt=pn.create(', ');const bq=qm(', 5_000)
    auth = between(source, 'async logout(){', '}}}),Nq=', 5_000)
    checkout = between(source, 'loadAuth(){', '}}}),Nq=', 2_000)

    rules = (
        ("IR-01", "rejected_list_api_identified", 'tt.post("local_form/pagination_rejected_qrcode_reader",s)' in owner),
        ("IR-02", "page_per_page_and_sorting_in_request", 'page:e,per_page:n,sort_by:"id",sort_dir:"desc"' in owner),
        ("IR-03", "searchdata_and_field_search_supported", 'Array.isArray(t.searchdata)' in owner and 'for(const o of t.searchFields)' in owner),
        ("IR-04", "date_range_filters_supported", 's.start_date=t.start_date' in owner and 's.end_date=t.end_date' in owner),
        ("IR-05", "error_payload_returned_after_warning", 'i.error||i.success===!1?ze(o):At(o)' in owner and 'r.hide(),i' in owner),
        ("IR-06", "dashboard_parent_requires_auth", 'path:"/dashboard"' in routes and 'meta:{requiresAuth:!0' in routes),
        ("IR-07", "rejected_child_route_registered", 'path:"qr/local-rejected",name:"RejectedLocalDocuments"' in routes),
        ("IR-08", "router_guard_checks_authentication", 't.meta?.requiresAuth&&!r' in guard),
        ("IR-09", "no_privilege_check_in_router_guard", bool(guard) and 'user_privileges' not in guard and 'user_permissions' not in guard),
        ("IR-10", "axios_base_url_known", 'baseURL:"https://customs-uboor.ur.gov.iq/api/"' in axios),
        ("IR-11", "api_request_uses_current_auth_token", 'nu().token' in axios and 't.headers.Authorization=' in axios),
        ("IR-12", "api_403_status_has_ui_message", 's===403&&ze(' in axios),
        ("IR-13", "logout_does_not_clear_default_auth_header", bool(auth) and 'localStorage.removeItem("auth")' in auth and 'delete tt.defaults.headers.common.Authorization' not in auth and 'tt.defaults.headers.common.Authorization=void 0' not in auth),
        ("IR-14", "auth_storage_reloaded_without_local_parse_guard", 'JSON.parse(t)' in checkout and 'localStorage.getItem("auth")' in checkout),
        ("IR-15", "health_print_chunk_name_identified", 'name:"HealthCertificatePrint"' in routes and 'PrintHealthCertificateView-Q9yNncqz.js' in routes),
    )
    return {
        "matches": [{"id": code, "indicator": desc} for code, desc, ok in rules if ok],
        "api": [{"method": "POST", "path": "/api/local_form/pagination_rejected_qrcode_reader"}]
        if rules[0][2] and rules[9][2] else [],
        "route": "/dashboard/qr/local-rejected" if rules[5][2] and rules[6][2] else None,
        "health_certificate_print_asset": "PrintHealthCertificateView-Q9yNncqz.js" if rules[14][2] else None,
        "limits": "frontend-only evidence; server permission checks not tested",
    }


def checked_read(path):
    if not path.is_file() or path.stat().st_size > 15_000_000:
        raise ValueError("Source missing or exceeds 15MB")
    content = path.read_bytes()
    head = content[:1024].lstrip().lower()
    if not content or b"\x00" in head or head.startswith((b"<html", b"<!doctype", b"<head")):
        raise ValueError("HTML/WAF/binary content is not the JS asset")
    return content


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Local copy of index-gleMzSil*.js")
    args = parser.parse_args(argv)
    try:
        raw = checked_read(args.source)
        source = raw.decode("utf-8", errors="replace")
        if "fetchRejectedLocalReaders" not in source or "Qr.beforeEach(async(" not in source:
            raise ValueError("Unexpected main bundle")
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    result = analyze(source)
    result["source"] = {"name": args.source.name, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
