#!/usr/bin/env python3
"""Offline, read-only inspection of a supplied health certificate print JS chunk.

Does not execute JavaScript, connect to UBOOR, generate documents, or upload data.
Indicators describe frontend code patterns, not evidence of official validity.
"""
import argparse
import hashlib
import json
from pathlib import Path

RULES = (
    ("HP-01", "print_page_trusts_hc_print_json", ('sessionStorage.getItem("hc_print")', 'l.value=JSON.parse(u)'), "document_data"),
    ("HP-02", "hc_detail_and_hc_print_merged", ('sessionStorage.getItem("hc_detail")', '...e||{},...s', 'Object.assign(l,i)'), "document_consistency"),
    ("HP-03", "qr_image_generated_from_supplied_value", ('I(()=>l.qr_code', 'X.toDataURL(s,{width:300,margin:1})'), "qr_representation"),
    ("HP-04", "validity_defaults_to_three_days", ('s==null||s===""?"شهادة صحية بيطرية نافذة لمدة ثلاثة أيام"',), "validity_display"),
    ("HP-05", "veterinarian_falls_back_to_current_user", ('tt(d.user)||""',), "identity_attribution"),
    ("HP-06", "auto_send_triggers_upload_on_mount", ('F(async()=>{l.auto_send&&', 'uploadPathDocumentFile(i)'), "automatic_action"),
    ("HP-07", "screenshot_uses_fixed_500ms_delay", ('setTimeout(async()=>', '},500)'), "timing"),
    ("HP-08", "formdata_uploads_qr_url_and_image", ('i.append("url",l.qr_code||"")', 'i.append("file",e,"certificate.png")'), "upload_contents"),
    ("HP-09", "auto_send_flag_cleared_after_upload", ('await b.uploadPathDocumentFile(i)', 'A.auto_send&&(delete A.auto_send'), "repeat_upload_review"),
    ("HP-10", "checkpoints_fetched_by_document_number", ('fetchCertificateReaders({searchdata:[{doc_number:l.certificate_number}],per_page:50})',), "checkpoints"),
    ("HP-11", "embedded_checkpoint_arrays_preferred", ('l.read_doc||l.reads||l.checkpoints||l.readings||l.doc_reads||[]',), "checkpoints"),
    ("HP-12", "checkpoint_coordinates_link_to_google", ('https://www.google.com/maps?q=', 'window.open(p,"_blank")'), "location_privacy"),
    ("HP-13", "zero_coordinates_rejected_by_truthiness", ('n.x_coordinate&&n.y_coordinate',), "location_validation"),
    ("HP-14", "animal_table_padding_negative_if_more_than_five", ('S(5-h.value.length',), "render_stability"),
    ("HP-15", "animal_quantity_display_uses_truthiness", ('a(i.quantity||i.qty)',), "numeric_display"),
    ("HP-16", "official_looking_template_is_static_image_and_text", ('D="/images/health-certificate.jpg"', '"وزارة الزراعة"', '"دائرة البيطرة"'), "visual_trust"),
    ("HP-17", "manual_print_uses_browser_print", ('function J(){window.print()}',), "print_flow"),
)

def inspect(source):
    return [{"id": code, "indicator": name, "category": category}
            for code, name, fragments, category in RULES
            if all(fragment in source for fragment in fragments)]

def compare_scanner(print_source, scan_source):
    """Compare strings in user-provided files; no authoritative validity claim."""
    return {
        "print_has_default_three_day_label": 'شهادة صحية بيطرية نافذة لمدة ثلاثة أيام' in print_source,
        "reader_contains_48hour_heuristic": '2880*60*1e3' in scan_source,
        "reader_uses_health_read_endpoint": 'BorderPort_HS/read_doc_health' in scan_source,
        "print_uses_hc_print": 'sessionStorage.getItem("hc_print")' in print_source,
        "reader_writes_hc_print": 'sessionStorage.setItem("hc_print"' in scan_source,
    }

def checked_read(path):
    if not path.is_file() or path.stat().st_size > 15_000_000:
        raise ValueError("Source missing or exceeds 15 MB")
    raw = path.read_bytes()
    head = raw[:1024].lstrip().lower()
    if not raw or b"\x00" in head or head.startswith((b"<html", b"<!doctype", b"<head")):
        raise ValueError("HTML/WAF/binary content is not the expected JavaScript")
    return raw

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Local PrintHealthCertificateView-*.js")
    parser.add_argument("--scanner", type=Path, help="Optional QRHealthCertificate-*.js for comparison")
    args = parser.parse_args(argv)
    try:
        raw = checked_read(args.source)
        source = raw.decode("utf-8", "replace")
        if '__name:"PrintHealthCertificateView"' not in source or '__name:"HealthCertificatePrint"' not in source:
            raise ValueError("Expected PrintHealthCertificateView bundle")
        result = {
            "source": {"name": args.source.name, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()},
            "scope": "offline frontend static review; not official document verification",
            "indicators": inspect(source),
            "server_calls_visible": ["fetchCertificateReaders (on click)", "uploadPathDocumentFile (when auto_send)"],
        }
        if args.scanner:
            reader_raw = checked_read(args.scanner)
            reader = reader_raw.decode("utf-8", "replace")
            if '__name:"QRHealthCertificate"' not in reader:
                raise ValueError("Expected matching QRHealthCertificate scanner")
            result["scanner_comparison"] = {
                "sha256": hashlib.sha256(reader_raw).hexdigest(),
                "checks": compare_scanner(source, reader),
            }
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
