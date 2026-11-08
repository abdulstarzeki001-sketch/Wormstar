"""Synthetic offline regression tests. Never connects to any external service."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / 'tools' / 'ish' / 'qr_imported_review.py'
spec = importlib.util.spec_from_file_location('qr_imported_review', MODULE)
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)

class TestQrImportedReview(unittest.TestCase):
    def matched(self, text):
        return {i['id'] for i in checker.inspect(text)}

    def test_pixel_coordinates(self):
        sample='m&&(h=String(Math.round(m.x+m.width/2)),v=String(Math.round(m.y+m.height/2)));const B={url:b,x_coordinate:h,y_coordinate:v}'
        self.assertIn('QI-01', self.matched(sample))

    def test_gps_coordinates_not_pixel(self):
        sample='const B={url:b,x_coordinate:String(position.latitude),y_coordinate:String(position.longitude)}'
        self.assertNotIn('QI-01', self.matched(sample))

    def test_token_debug(self):
        self.assertIn('QI-02', self.matched('console.debug("[QRImported] auth token:",f.token)'))

    def test_token_is_not_logged_when_redacted(self):
        self.assertNotIn('QI-02', self.matched('console.debug("[QRImported] auth present",Boolean(f.token))'))

    def test_debug_post_retry(self):
        self.assertIn('QI-04', self.matched('catch(x){console.error("API error",x);try{fetch(S,{method:"POST",body:"{}"})}}'))

    def test_get_diagnostic_not_post_retry(self):
        self.assertNotIn('QI-04', self.matched('catch(x){console.error("API error",x);fetch(S,{method:"GET"})}'))

    def test_duplicate_branch(self):
        self.assertIn('QI-05', self.matched('if(t===j&&F-U<3e3){l.value={raw:t,x:h,y:v,duplicate:!0};return}'))

    def test_demo_data_not_equivalent_backend(self):
        self.assertNotIn('QI-12', self.matched('const code="local_form/read_doc_company"'))

    def test_different_importer_flows(self):
        result=checker.compare('m&&(h=String(Math.round(m.x+m.width/2)));A.post("local_form/read_doc_company"',
                               'navigator.geolocation', 'navigator.geolocation searchImportedGoods')
        self.assertTrue(all(result.values()))

    def test_reject_waf_html(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'QRImported.js'
            p.write_text('<html>HuaweiCloudWAF</html>')
            with self.assertRaises(ValueError):
                checker.checked_read(p)

    def test_all_rules_have_unique_ids(self):
        ids=[rule[0] for rule in checker.RULES]
        self.assertEqual(len(ids),len(set(ids)))

    def test_response_saved_in_local_record(self):
        sample = 'const r={id:Date.now(),type:"مستورد",response:x.data,x:h,y:v}'
        self.assertIn('QI-10', self.matched(sample))

if __name__=='__main__':
    unittest.main()
