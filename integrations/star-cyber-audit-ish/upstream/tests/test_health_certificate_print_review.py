"""Synthetic-only tests; never call any government endpoint or execute source JS."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "tools" / "ish" / "health_certificate_print_review.py"
spec = importlib.util.spec_from_file_location("health_certificate_print_review", SOURCE)
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)

class PrintHealthReviewTests(unittest.TestCase):
    def ids(self, source):
        return {item["id"] for item in review.inspect(source)}

    def test_unique_rules(self):
        ids = [item[0] for item in review.RULES]
        self.assertEqual(17, len(ids))
        self.assertEqual(len(ids), len(set(ids)))

    def test_hc_print_read(self):
        s = 'sessionStorage.getItem("hc_print");l.value=JSON.parse(u)'
        self.assertIn("HP-01", self.ids(s))

    def test_not_flagged_if_json_is_validated_before_use(self):
        s = 'sessionStorage.getItem("hc_print");const item=schema.parse(JSON.parse(u))'
        self.assertNotIn("HP-01", self.ids(s))

    def test_details_merged_with_print_data(self):
        s = 'sessionStorage.getItem("hc_detail");const i={...e||{},...s};Object.assign(l,i)'
        self.assertIn("HP-02", self.ids(s))

    def test_qr_generated_from_source_value(self):
        s = 'I(()=>l.qr_code,async s=>{w.value=await X.toDataURL(s,{width:300,margin:1})})'
        self.assertIn("HP-03", self.ids(s))

    def test_default_validity(self):
        s = 's==null||s===""?"شهادة صحية بيطرية نافذة لمدة ثلاثة أيام"'
        self.assertIn("HP-04", self.ids(s))

    def test_veterinarian_fallback(self):
        self.assertIn("HP-05", self.ids('l.veterinarian_name||tt(d.user)||""'))

    def test_autosend_is_flagged(self):
        self.assertIn("HP-06", self.ids('F(async()=>{l.auto_send&&(await Z(),uploadPathDocumentFile(i))}'))

    def test_manual_print_does_not_trigger_autosend_rule(self):
        self.assertNotIn("HP-06", self.ids('function J(){window.print()}'))

    def test_fixed_screenshot_delay(self):
        self.assertIn("HP-07", self.ids('setTimeout(async()=>{capture()},500)'))

    def test_upload_contents(self):
        s = 'i.append("url",l.qr_code||"");i.append("file",e,"certificate.png")'
        self.assertIn("HP-08", self.ids(s))

    def test_auto_send_cleared_after_upload(self):
        s = 'await b.uploadPathDocumentFile(i);A.auto_send&&(delete A.auto_send)'
        self.assertIn("HP-09", self.ids(s))

    def test_history_queries_document_number(self):
        s = 'fetchCertificateReaders({searchdata:[{doc_number:l.certificate_number}],per_page:50})'
        self.assertIn("HP-10", self.ids(s))

    def test_embedded_history_fields(self):
        self.assertIn("HP-11", self.ids('l.read_doc||l.reads||l.checkpoints||l.readings||l.doc_reads||[]'))

    def test_external_location_link(self):
        s = 'https://www.google.com/maps?q=...;window.open(p,"_blank")'
        self.assertIn("HP-12", self.ids(s))

    def test_coordinate_zero_gate(self):
        self.assertIn("HP-13", self.ids('return!!(n.x_coordinate&&n.y_coordinate)'))

    def test_animal_table_padding(self):
        self.assertIn("HP-14", self.ids('S(5-h.value.length,f)'))
        self.assertNotIn("HP-14", self.ids('S(Math.max(0,5-h.value.length),f)'))

    def test_animal_quantity_zero_fallback(self):
        self.assertIn("HP-15", self.ids('a(i.quantity||i.qty)'))
        self.assertNotIn("HP-15", self.ids('a(i.quantity??i.qty)'))

    def test_static_header_is_not_a_cryptographic_signature(self):
        s = 'D="/images/health-certificate.jpg";"وزارة الزراعة";"دائرة البيطرة"'
        self.assertIn("HP-16", self.ids(s))

    def test_manual_browser_print(self):
        self.assertIn("HP-17", self.ids('function J(){window.print()}'))

    def test_scanner_discrepancy(self):
        print_source = 'شهادة صحية بيطرية نافذة لمدة ثلاثة أيام sessionStorage.getItem("hc_print")'
        scan_source = '2880*60*1e3 BorderPort_HS/read_doc_health sessionStorage.setItem("hc_print",JSON.stringify(a))'
        self.assertTrue(all(review.compare_scanner(print_source, scan_source).values()))

    def test_html_waf_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "print.js"
            path.write_text('<html>HuaweiCloudWAF</html>', encoding="utf-8")
            with self.assertRaises(ValueError):
                review.checked_read(path)

    def test_clean_source(self):
        self.assertEqual([], review.inspect('const unrelated=1;'))

if __name__ == "__main__":
    unittest.main()
