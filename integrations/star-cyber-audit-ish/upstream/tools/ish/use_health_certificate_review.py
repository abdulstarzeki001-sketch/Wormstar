#!/usr/bin/env python3
"""Read-only useHealthCertificate static reviewer: no network or JS execution."""
import argparse
import hashlib
import json
from pathlib import Path

RULES = (
 ("HC-01","shared_singleton_state",("let T=null;function Oe(){if(T)return T;",),"session"),
 ("HC-02","full_request_and_response_logs",('console.log("[useHealthCertificate] request body sent to API:', 'console.debug("[HealthCertificate] raw response:'),"privacy"),
 ("HC-03","error_response_still_processed",("t.error||t.success===!1?(p(i),P.value=i):H(i)","w.value=Array.isArray(c)?c:[]"),"data_integrity"),
 ("HC-04","first_unknown_array_as_document_list",("for(const n of Object.keys(e))if(Array.isArray(e[n]))return e[n]",),"data_integrity"),
 ("HC-05","in_flight_district_lookup_returns_unfinished_cache",("if(M.has(Number(e)))return v.value.filter",),"race"),
 ("HC-06","hardcoded_18_province_fallback",("for(let i=1;i<=18;i++",),"performance"),
 ("HC-07","qr_reader_data_assumed_array",("const d=i.data||[],b=(d||[]).map",),"reliability"),
 ("HC-08","original_document_error_masking",("if(c&&(i.error||i.success===!1?p(c):H(c)),t&&t.data!==void 0&&t.data!==null)return t.data","catch{}return null"),"error_handling"),
 ("HC-09","preview_response_saved_in_browser",('sessionStorage.setItem("qr_preview_entry",JSON.stringify(t))',"raw:{doc_number:e,response:a}"),"privacy"),
 ("HC-10","doc_number_numeric_coercion",('if(h==="doc_number"){const G=Number(k)',),"identifier"),
 ("HC-11","clear_resets_rows_but_not_caches",("function ve(){w.value=[],f.Current_Page=1",),"session"),
 ("HC-12","unbounded_parallel_prefetch",("await Promise.all(n.map(a=>B(a)))","await Promise.all(r.map(a=>U(a)))"),"performance"),
 ("HC-13","strict_province_id_type_comparison",("t=>t.province_id===Number(e)",),"type_consistency"),
)
API = (
 ("POST","BorderPort_HS/pagination-healthcertificate"),
 ("POST","BorderPort_HS/health-certificates"),
 ("GET","BorderPort_HS/return_doc_hc/{hash}"),
 ("POST","BorderPort_HS/return_doc_hc_by_docnumber"),
 ("POST","BorderPort_HS/paginate_qrcode_reader"),
 ("POST","BorderPort_HS/download_health_qrcode_readers"),
 ("POST","BorderPort_HS/download_health_certificates_excel"),
 ("GET / POST fallback at 405","BorderPort_HS/get_provinces"),
 ("POST","BorderPort_HS/get_districts"),
 ("POST","BorderPort_HS/get_subdistricts"),
 ("GET / POST fallback at 405","BorderPort_HS/get_orgs"),
 ("POST","BorderPort_HS/path-document-file"),
)

def inspect(text):
    return [{"id":ident,"name":name,"category":category}
            for ident,name,needles,category in RULES
            if all(needle in text for needle in needles)]

def api_inventory(text):
    return [{"method":method,"path":path} for method,path in API
            if (path.replace("/{hash}","/") if path.endswith("/{hash}") else path) in text]

def checked_read(path):
    if not path.is_file() or path.stat().st_size > 12_000_000:
        raise ValueError("Source missing or larger than 12 MB")
    raw=path.read_bytes()
    head=raw[:1024].lstrip().lower()
    if not raw or b'\x00' in head or head.startswith((b'<html',b'<!doctype',b'<head')):
        raise ValueError("HTML/WAF/binary is not JavaScript")
    return raw

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file",type=Path,help="Local useHealthCertificate-*.js source")
    args=parser.parse_args(argv)
    try:
        raw=checked_read(args.file)
        source=raw.decode("utf-8","replace")
        if "let T=null;function Oe()" not in source or "BorderPort_HS/pagination-healthcertificate" not in source:
            raise ValueError("Not expected version of useHealthCertificate")
    except (ValueError,OSError) as error:
        parser.error(str(error))
    result={"source":{"name":args.file.name,"bytes":len(raw),
                      "sha256":hashlib.sha256(raw).hexdigest()},
            "scope":"offline static review; backend not tested",
            "api_paths":api_inventory(source),"indicators":inspect(source)}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
