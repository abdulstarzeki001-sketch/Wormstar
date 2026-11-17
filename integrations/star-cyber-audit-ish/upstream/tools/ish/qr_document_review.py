#!/usr/bin/env python3
"""Offline QRDocument Vite JS reviewer: no network or untrusted code execution.

Checks source indicators relevant to preview, refusal, print and conditional upload.
Does not verify the official authenticity of documents or backend authorization.
"""
import argparse
import hashlib
import json
from pathlib import Path

RULES = (
    ("QD-01", "preview_from_router_state_or_local_readings", ("history.state?.preview||null", "const x=CB(),P=b.query.id", "x.find(oA=>String(oA.id)===P)"), "document_selection"),
    ("QD-02", "unknown_id_falls_back_to_first_reading", ("a.value=AA||x[0]||null",), "data_integrity"),
    ("QD-03", "session_preview_only_read_in_nonmatching_store_branch", ('if(!AA&&oA)', 'sessionStorage.getItem("qr_preview_entry")'), "data_integrity"),
    ("QD-04", "response_data_unwrapped_without_contract_validation", ("AA?.response?.data?AA.response=AA.response.data:AA?.data?AA.response=AA.data",), "response_contract"),
    ("QD-05", "display_qr_generated_from_cached_text", ("UB.toDataURL(E,{width:400,margin:1})", "a.value?.response?.qr_code"), "trust_boundary"),
    ("QD-06", "refusal_uses_state_changing_post", ('cf.post("local_form/refuse_doc_company",x',), "sensitive_action"),
    ("QD-07", "refusal_ui_gated_by_is_main_and_privilege", ('Y.value&&i.value.includes("refuse_doc_company")',), "authorization_review"),
    ("QD-08", "refusal_handler_checks_is_main_but_not_privilege_again", ('async function G(){if(!Y.value)', 'cf.post("local_form/refuse_doc_company",x'), "authorization_review"),
    ("QD-09", "refusal_http_success_shows_success_toast", ('await cf.post("local_form/refuse_doc_company",x', 'pB("تم إرسال طلب الرفض بنجاح")'), "response_contract"),
    ("QD-10", "refusal_coordinates_from_latest_reading", ('E[E.length-1]:null', 'x_coordinate:c.value||"0",y_coordinate:h.value||"0"'), "location_provenance"),
    ("QD-11", "rejection_reason_requires_two_characters_only", ('e.value.trim().length<2',), "validation_review"),
    ("QD-12", "checkpoint_data_saved_to_session_storage", ('sessionStorage.setItem("qr_read_doc",JSON.stringify(_.value||[]))',), "privacy_review"),
    ("QD-13", "autosend_uploads_local_document_screenshot", ('if(a.value&&a.value.auto_send)', 'cf.post("BorderPort_HS/path-document-file",E,X)', 'P.append("file",x,"local_document.png")'), "automatic_action"),
    ("QD-14", "autosend_capture_after_fixed_100ms", ('setTimeout(async()=>', '},100)'), "render_timing"),
    ("QD-15", "autosend_flag_removed_only_after_upload_success", ('await L(P),console.log("Upload successful.")', 'delete AA[oA].auto_send', 'delete a.value.auto_send'), "idempotency_review"),
    ("QD-16", "qr_render_failure_can_leave_blank_image", ('catch{return""}', 'UB.toDataURL(E,{width:400,margin:1})'), "render_failure"),
    ("QD-17", "print_uses_popup_html_and_browser_print", ('P.document.write(', 'P.onload=()=>{P.focus(),P.print()', 'window.print()'), "print_flow"),
    ("QD-18", "document_template_contains_official_branding_static", ('جمهورية العراق', 'وزارة المالية', 'الهيئــة العامــة للكمـــارك'), "visual_trust"),
    ("QD-19", "document_id_displayed_from_response", ('a.value.response.doc_id',), "document_data"),
    ("QD-20", "refusal_modal_requires_explicit_confirmation", ('__name:"RefuseDocModal"', '"تأكيد الرفض"', '"سبب الرفض"'), "user_intent"),
)

def inspect(text):
    matched = [{"id": number, "indicator": title, "category": category}
               for number, title, fragments, category in RULES
               if all(fragment in text for fragment in fragments)]
    component = text[text.find('__name:"QRDocument"'):] if '__name:"QRDocument"' in text else ""
    if component and 'window.print()' in component and not any(token in component for token in ('autoDownload','autoPrint')):
        matched.append({"id": "QD-21", "indicator": "component_does_not_consume_auto_print_download_flags", "category": "workflow_review"})
    return matched

def checked_read(path):
    if not path.is_file() or not 0 < path.stat().st_size <= 15_000_000:
        raise ValueError("Source missing, empty, or larger than 15 MB")
    raw = path.read_bytes()
    head = raw[:1024].lstrip().lower()
    if b'\x00' in head or head.startswith((b'<html', b'<!doctype', b'<head')):
        raise ValueError("HTML/WAF/binary is not a JS source")
    return raw

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='Local QRDocument-BJwpoEJY*.js')
    args = parser.parse_args(argv)
    try:
        raw = checked_read(args.source)
        text = raw.decode('utf-8', errors='replace')
        if '__name:"QRDocument"' not in text or 'local_form/refuse_doc_company' not in text:
            raise ValueError('Not the expected QRDocument module')
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    git_sha = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
    output = {
        "source": {"name": args.source.name, "bytes": len(raw),
                   "sha256": hashlib.sha256(raw).hexdigest(), "git_blob_sha1": git_sha},
        "scope": "offline frontend analysis only; no server validity or permission claims",
        "known_api_calls": [
            {"method": "POST", "path": "local_form/refuse_doc_company", "action": "reject document"},
            {"method": "POST", "path": "BorderPort_HS/path-document-file", "action": "conditional upload"},
        ],
        "indicators": inspect(text),
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
