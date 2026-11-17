#!/usr/bin/env python3
"""Offline static review of CompanyOwnerView with optional main and QRLocal JS.

No JavaScript execution, network calls, credentials, or live government tests.
Matches are frontend source indicators, not proven backend vulnerabilities.
"""
import argparse
import hashlib
import json
from pathlib import Path

VIEW_RULES = (
    ("CO-01", "four_vue_components", ('__name:"CompanyOwnerItems"', '__name:"VSearchHashCode"', '__name:"AppUrLogin"', '__name:"CompanyOwnerView"'), "structure"),
    ("CO-02", "route_contains_company_phone_and_code", ("_.query.phone", "_.query.code"), "url_privacy"),
    ("CO-03", "auth_check_unawaited_before_branch", ('u.checkUserAuthentication().finally(', 'if(!u.isAuthenticatedOwner)'), "async_lifecycle"),
    ("CO-04", "verification_redirect_in_finally", ('companyVerifyLoginWithCode(n.value).finally(', "m.replace({query:{phone:d.value.UsPhoneNo}})"), "async_lifecycle"),
    ("CO-05", "phone_written_into_route_query", ("m.replace({query:{phone:d.value.UsPhoneNo}})",), "url_privacy"),
    ("CO-06", "external_ur_redirect_with_phone", ("https://ur.gov.iq/verify-auth?client_id=261", "pNo="), "external_redirect"),
    ("CO-07", "external_auth_url_assembled_without_url_params_api", ("serviceName=", "pNo=", "window.location.href="), "url_encoding"),
    ("CO-08", "company_hash_logged", ('console.debug("hash to regenerate:",c)',), "sensitive_logging"),
    ("CO-09", "user_hash_search", ('u.searchCompanyOwner(m.value.trim())',), "lookup"),
    ("CO-10", "regeneration_uses_hash_from_store_or_input", ('n.value?.company_hash_code||m.value.trim()', 'u.returnCompanyDoc(c)'), "document_mutation"),
    ("CO-11", "location_excludes_numeric_zero", ("s.latitude&&s.longitude&&isFinite(s.latitude)&&isFinite(s.longitude)",), "geolocation"),
    ("CO-12", "coordinates_logged", ('console.log("Geolocation Updated - X:"',), "location_privacy"),
    ("CO-13", "shipment_body_uses_vihcle_info_literal", ("vihcle_info:{...o}",), "api_schema"),
    ("CO-14", "quantity_compared_to_production_capacity_in_ui", ("if(t>s.production_capacity)",), "client_validation"),
    ("CO-15", "quantity_from_dom_number_cast", ("Number(P.target.value)",), "client_validation"),
    ("CO-16", "item_numbered_keys_dynamic", ("item", "hash_id:T.hash_id,production_capacity:T.production_capacity"), "api_schema"),
    ("CO-17", "shipment_required_fields_only_client_side", ("!o.driver_name||!o.licence_number||!o.vehicle_number||!o.weight_quantity",), "client_validation"),
    ("CO-18", "company_type_controls_checkpoint_required", ('n.value==="داخل الإقليم"', 'n.value==="محاذية الإقليم"', 'n.value==="خارج الإقليم و بنسبة 5%"'), "client_validation"),
    ("CO-19", "shipment_reduction_action_called", ("await _.companyItemsReduce(h)",), "mutating_action"),
    ("CO-20", "document_preview_in_temporary_modal", ('title:"الوثيقة المؤقتة"', "doc:B.value"), "presentation"),
    ("CO-21", "owner_phone_displayed", ("company_phone_number", "UsPhoneNo"), "personal_data"),
    ("CO-22", "shipment_total_calculated_locally", ("o.weight_quantity=q.value",), "client_calculation"),
)
MAIN_RULES = (
    ("CM-01", "phone_login", ('tt.post("local_form/company_verify_login"',), "POST /api/local_form/company_verify_login"),
    ("CM-02", "code_verification", ('tt.post("local_form/company_verification"',), "POST /api/local_form/company_verification"),
    ("CM-03", "company_lookup", ('tt.post("local_form/search_iraqi_company"',), "POST /api/local_form/search_iraqi_company"),
    ("CM-04", "owner_company_items", ('local_form/get_company_items/',), "GET /api/local_form/get_company_items/{hash}"),
    ("CM-05", "company_items_reduce", ('tt.put("local_form/company_item_reduce"',), "PUT /api/local_form/company_item_reduce"),
    ("CM-06", "company_doc_regeneration", ('local_form/return_company_doc/', 'tt.post(n,null'), "POST /api/local_form/return_company_doc/{hash}"),
    ("CM-07", "owner_session_restored_from_local_storage", ('localStorage.getItem("company_owner_token")', 'localStorage.getItem("is_authenticated_owner")'), "session_review"),
    ("CM-08", "verification_stores_owner_token", ('localStorage.setItem("company_owner_token",this.companyOwnerToken)',), "session_review"),
)
QR_RULES = (
    ("CL-01", "qr_local_uses_device_geolocation", ("navigator.geolocation.getCurrentPosition(", "w.value.latitude"), "geo_source"),
    ("CL-02", "qr_local_zero_coordinate_truthiness", ("w.value.latitude&&isFinite(w.value.latitude)&&w.value.longitude&&isFinite(w.value.longitude)",), "location_validation"),
    ("CL-03", "qr_local_post_read_doc_company", ('E.post("local_form/read_doc_company",$',), "API"),
    ("CL-04", "qr_local_logs_bearer", ('console.debug("[QRLocal] auth token:",y.token)',), "credential_logging"),
    ("CL-05", "qr_local_debug_second_post", ('fetch(h,{method:"POST"', "debug fetch status"), "repeat_mutation_review"),
    ("CL-06", "local_expiry_48h_heuristic", ("2880*60*1e3",), "validity_review"),
    ("CL-07", "text_success_skips_local_expiry_check", ("/تم|نجح|نجاح|تم ارسال|تمت/iu.test(a.message)",), "validity_review"),
    ("CL-08", "top_level_is_main_copied_to_doc", ("a.is_main=l.data.is_main",), "response_contract"),
    ("CL-09", "is_main_drives_autosend", ("auto_send:!!a.is_main",), "conditional_upload"),
    ("CL-10", "result_saved_before_navigation", ("fe(s)", 'name:"QRDocument"'), "data_flow"),
)

def match(source, rules):
    return [{"id": code, "indicator": label, "detail": detail}
            for code, label, fragments, detail in rules
            if all(f in source for f in fragments)]

def inspect(view, main=None, scanner=None):
    if '__name:"CompanyOwnerView"' not in view:
        raise ValueError("Expected CompanyOwnerView component")
    answer = {"company": match(view, VIEW_RULES)}
    if main is not None:
        if "companyItemsReduce(t)" not in main:
            raise ValueError("Expected owner store methods in main bundle")
        answer["store"] = match(main, MAIN_RULES)
    if scanner is not None:
        if '__name:"QRLocal"' not in scanner:
            raise ValueError("Expected QRLocal component")
        answer["qr_local"] = match(scanner, QR_RULES)
        answer["links"] = {
            "company_shipments_use_reduce_action": "await _.companyItemsReduce(h)" in view,
            "qr_local_scanner_sets_autosend_from_is_main": "auto_send:!!a.is_main" in scanner,
            "different_company_shipment_vs_qr_scan_apis": True,
        }
    return answer

def read_source(path, limit=15_000_000):
    if not path.is_file() or not 0 < path.stat().st_size <= limit:
        raise ValueError("File absent, empty, or exceeds size limit")
    raw = path.read_bytes()
    if b"\x00" in raw[:1024] or raw[:1024].lstrip().lower().startswith((b"<html", b"<!doctype", b"<head")):
        raise ValueError("File is HTML/WAF/binary, not JavaScript")
    return raw

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--main", type=Path, help="local index-gleMzSil bundle")
    parser.add_argument("--qr-local", type=Path, help="local QRLocal bundle")
    args = parser.parse_args(argv)
    try:
        src = read_source(args.source)
        main_raw = read_source(args.main) if args.main else None
        qr_raw = read_source(args.qr_local) if args.qr_local else None
        results = inspect(src.decode("utf-8", "replace"),
                          main_raw.decode("utf-8", "replace") if main_raw else None,
                          qr_raw.decode("utf-8", "replace") if qr_raw else None)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    output = {"source": {"filename": args.source.name, "bytes": len(src),
                         "sha256": hashlib.sha256(src).hexdigest()},
              "scope": "static read-only; no government API calls or backend verification",
              **results}
    if main_raw:
        output["main_sha256"] = hashlib.sha256(main_raw).hexdigest()
    if qr_raw:
        output["qr_local_sha256"] = hashlib.sha256(qr_raw).hexdigest()
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
