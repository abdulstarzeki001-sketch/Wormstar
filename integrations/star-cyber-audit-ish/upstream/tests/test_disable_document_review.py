"""Offline regression tests; synthetic strings only, no government API requests."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

TOOL = Path(__file__).resolve().parents[1] / "tools" / "ish" / "disable_document_review.py"
spec = importlib.util.spec_from_file_location("disable_document_review", TOOL)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class TestDisableDocumentReview(unittest.TestCase):
    def detected(self, text):
        return {item["id"] for item in audit.indicators(text)}

    def test_rule_count_and_uniqueness(self):
        ids = [rule[0] for rule in audit.RULES]
        self.assertEqual(17, len(ids))
        self.assertEqual(17, len(set(ids)))

    def test_scanning_triggers_mutation(self):
        self.assertIn("DD-01", self.detected('await $.post("local_form/reset_company_qrcode",T,{})'))

    def test_success_card_rejects_missing_signals(self):
        self.assertNotIn("DD-02", self.detected('"تم التعطيل بنجاح"'))

    def test_success_card_optimistic(self):
        src = 'o.value={raw:t,x:i,y:g};D(o).error?"failure":"تم التعطيل بنجاح"'
        self.assertIn("DD-02", self.detected(src))

    def test_expired_without_error(self):
        self.assertIn("DD-03", self.detected('o.value={raw:L,x:i,y:g,response:a,expired:!0}'))

    def test_error_only_success_check(self):
        src = 'o.value={...o.value,response:a},a.error); "تم التعطيل بنجاح"'
        self.assertIn("DD-04", self.detected(src))

    def test_token_logging(self):
        self.assertIn("DD-05", self.detected('console.debug("[QRLocal] auth token:",y.token)'))
        self.assertNotIn("DD-05", self.detected('console.debug("[QRLocal] token available:",Boolean(y.token))'))

    def test_post_retry_in_error_handler(self):
        src = 'catch(c){console.error("API error",c);try{fetch(h,{method:"POST",body:"{}"})}}'
        self.assertIn("DD-07", self.detected(src))
        self.assertNotIn("DD-07", self.detected('catch(c){console.error("API error",c);fetch(h,{method:"GET"})}'))

    def test_missing_slash_debug_url(self):
        self.assertIn("DD-08", self.detected('.replace(/\\/$/,"")+"local_form/reset_company_qrcode"'))
        self.assertNotIn("DD-08", self.detected('.replace(/\\/$/,"")+"/local_form/reset_company_qrcode"'))

    def test_long_lived_geolocation_cache(self):
        self.assertIn("DD-09", self.detected('maximumAge:1/0'))

    def test_zero_coordinate_truthiness(self):
        self.assertIn("DD-10", self.detected('b.value.latitude&&isFinite(b.value.latitude)&&b.value.longitude'))

    def test_empty_gps_in_post(self):
        self.assertIn("DD-11", self.detected('let i="",g="";const y=G(),T={url:M,x_coordinate:i,y_coordinate:g}'))

    def test_expiry_heuristic(self):
        src = '/تم|نجح|نجاح|تم ارسال|تمت/iu.test(a.message);const S=2880*60*1e3'
        self.assertIn("DD-12", self.detected(src))

    def test_duplicate_stops_loop(self):
        self.assertIn("DD-13", self.detected('if(t===L&&O-z<3e3){o.value={raw:t,x:i,y:g,duplicate:!0};return}'))

    def test_frame_retry(self):
        self.assertIn("DD-15", self.detected('function X(){o.value=null,R.value=!0,u||H(),requestAnimationFrame(p)}'))

    def test_health_flow_comparison(self):
        disable = 'local_form/reset_company_qrcode 2880*60*1e3 BarcodeDetector({formats:["qr_code"]}) fetch(h,{method:"POST"'
        health = 'BorderPort_HS/read_doc_health 2880*60*1e3 BarcodeDetector({formats:["qr_code"]})'
        self.assertTrue(all(audit.compare_health(disable, health).values()))

    def test_html_waf_not_accepted(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "DisableDocument.js"
            path.write_text("<!doctype html><html>HuaweiCloudWAF</html>", encoding="utf-8")
            with self.assertRaises(ValueError):
                audit.checked_read(path)

    def test_unrelated_source_no_findings(self):
        self.assertEqual([], audit.indicators("const x=1;"))

if __name__ == "__main__":
    unittest.main()
