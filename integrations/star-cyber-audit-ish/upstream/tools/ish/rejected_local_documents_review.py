#!/usr/bin/env python3
"""Read-only static inspection of a supplied RejectedLocalDocuments JS bundle.
No JavaScript execution, authentication or network access. Frontend indicators
are not proof of backend access or exploitable vulnerabilities.
"""
import argparse
import hashlib
import json
from pathlib import Path

RULES=(
 ("RL-01","list_uses_shared_store",("F.fetchRejectedLocalReaders(s)",),"architecture"),
 ("RL-02","list_assumes_array",("n=t.data||[];w.value=n.map(",),"reliability"),
 ("RL-03","load_failure_keeps_old_rows",('catch(t){console.error("[RejectedLocalDocuments] loadPage failed",t)',),"stale_data"),
 ("RL-04","preview_button_has_no_local_privilege_gate",('"aria-label":"معاينة الوثيقة"','ee.post("local_form/return_doc_qrcode"'),"authorization_review"),
 ("RL-05","doc_number_number_coercion",("doc_number:Number(t)",),"identifier_integrity"),
 ("RL-06","zero_company_type_dropped",("...n?{company_type:n}:{}",),"data_integrity"),
 ("RL-07","full_response_saved_to_browser",('raw:{doc_number:t,response:a}', 'sessionStorage.setItem("qr_preview_entry",JSON.stringify(l))', 'se(l)'),"privacy"),
 ("RL-08","preview_state_requests_auto_print_and_download",('autoPrint:!0,autoDownload:!0',),"ux_review"),
 ("RL-09","external_map_link_includes_coordinates",('https://www.google.com/maps?q=', 'a.x_coordinate', 'a.y_coordinate'),"privacy_location"),
 ("RL-10","coordinates_checked_by_truthiness",('a.x_coordinate&&a.y_coordinate?',),"data_integrity"),
 ("RL-11","reader_phone_displayed",('u(a.phone)',),"privacy"),
 ("RL-12","generic_notes_may_be_labeled_rejection_reason",('r.rejection_reason??r.reason??r.notes',),"semantics"),
 ("RL-13","empty_row_colspan_eight_but_nine_headers",('colspan:"8"', '"سبب الرفض"', '"معاينة"'),"ui"),
 ("RL-14","preview_response_not_checked_for_success",('r.data&&r.data.data?r.data.data:r.data','raw:{doc_number:t,response:a}'),"response_contract"),
 ("RL-15","async_list_has_no_local_request_sequence_check",("async function h(s={})", "F.fetchRejectedLocalReaders(s)", "w.value=n.map("),"race_review"),
 ("RL-16","preview_errors_only_written_to_console",('console.error("[RejectedLocalDocuments] previewServerReading error",t)',),"usability"),
)

def inspect(source):
    matches=[{"id":id,"indicator":name,"category":kind}
             for id,name,needles,kind in RULES if all(t in source for t in needles)]
    if "user_privileges" in source:
        matches=[x for x in matches if x["id"]!="RL-04"]
    if "AbortController" in source or "requestSequence" in source:
        matches=[x for x in matches if x["id"]!="RL-15"]
    if "Array.isArray(n)" in source:
        matches=[x for x in matches if x["id"]!="RL-02"]
    return matches

def checked_read(path):
    if not path.is_file() or path.stat().st_size>12_000_000:
        raise ValueError("Source missing or larger than 12MB")
    data=path.read_bytes()
    head=data[:1024].lstrip().lower()
    if not data or b"\0" in head or head.startswith((b"<html",b"<!doctype",b"<head")):
        raise ValueError("HTML/WAF/binary is not a JavaScript source")
    return data

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file",type=Path,help="Local RejectedLocalDocuments-*.js file")
    args=parser.parse_args(argv)
    try:
        raw=checked_read(args.file)
        source=raw.decode("utf-8","replace")
        if '__name:"RejectedLocalDocuments"' not in source or "fetchRejectedLocalReaders" not in source:
            raise ValueError("Not the reviewed RejectedLocalDocuments module")
    except (ValueError,OSError) as exc:
        parser.error(str(exc))
    print(json.dumps({
        "source":{"name":args.file.name,"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest()},
        "scope":"offline static frontend analysis; backend not tested",
        "known_direct_api":[{"method":"POST","path":"local_form/return_doc_qrcode"}],
        "rejected_list_api":"unknown: delegated to fetchRejectedLocalReaders in index-gleMzSil.js",
        "indicators":inspect(source)
    },ensure_ascii=False,indent=2))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
