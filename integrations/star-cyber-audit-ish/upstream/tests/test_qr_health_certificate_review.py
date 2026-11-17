"""Synthetic, no-network source-review tests (never run the target JS)."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

source = Path(__file__).resolve().parents[1] / "tools" / "ish" / "qr_health_certificate_review.py"
spec = importlib.util.spec_from_file_location("qr_health_certificate_review", source)
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class TestHealthReview(unittest.TestCase):
    def ids(self, code):
        return {x["id"] for x in checker.indicators(code)}

    def test_message_skip_pattern(self):
        self.assertIn("HC-01", self.ids('!(typeof a.message=="string"&&/تم|نجح|نجاح|تم ارسال|تمت/iu.test(a.message))'))

    def test_no_date_logic_in_strict_expiry(self):
        self.assertNotIn("HC-01", self.ids('if(response.success !== true) return;'))

    def test_newest_timestamp_selected(self):
        self.assertIn("HC-02", self.ids('a.license_approval_date&&w.push(a.license_approval_date);const E=Math.max(...n)'))

    def test_missing_dates_skips(self):
        self.assertIn("HC-03", self.ids('E=n.length?Math.max(...n):NaN;if(!isNaN(E))'))

    def test_clock_expiry_threshold(self):
        self.assertIn("HC-04", self.ids('C=2880*60*1e3;if(m>C)'))

    def test_health_log(self):
        self.assertIn("HC-05", self.ids('console.debug("[QRHealth] serverData=",a)'))

    def test_storage(self):
        self.assertIn("HC-06", self.ids('sessionStorage.setItem("hc_print",JSON.stringify(a))'))

    def test_double_loop_possible(self):
        self.assertIn("HC-11", self.ids('function J(){h.value=null,k.value=!0,d||P(),requestAnimationFrame(y)}'))

    def test_zero_coordinate_truthiness(self):
        self.assertIn("HC-12", self.ids('_.value.latitude&&isFinite(_.value.latitude)&&_.value.longitude'))

    def test_http_402(self):
        self.assertIn("HC-15", self.ids('a===402?(b('))

    def test_api_route_comparison(self):
        got=checker.compare('I.post("BorderPort_HS/read_doc_health",Z);navigator.geolocation.getCurrentPosition;2880*60*1e3;sessionStorage.setItem("hc_print")',
                            'local_form/read_doc_company', 'Math.round(m.x+m.width/2)')
        self.assertTrue(all(got.values()))

    def test_reject_html_disguised_as_js(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"fake.js"
            path.write_text('<html>HuaweiCloudWAF</html>', encoding='utf-8')
            with self.assertRaises(ValueError): checker.verified_source(path)

    def test_unrelated_source_has_no_flags(self):
        self.assertEqual(checker.indicators('const x=3; export {x}'), [])


if __name__ == "__main__":
    unittest.main()
