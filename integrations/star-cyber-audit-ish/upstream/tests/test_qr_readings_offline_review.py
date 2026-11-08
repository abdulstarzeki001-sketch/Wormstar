"""Synthetic-only, offline test suite for the QRReadings source reviewer."""
import importlib.util
from pathlib import Path
import unittest

source = Path(__file__).resolve().parents[1] / 'tools' / 'ish' / 'qr_readings_offline_review.py'
spec = importlib.util.spec_from_file_location('qr_readings_offline_review', source)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class Tests(unittest.TestCase):
    def test_preview_response_log(self):
        src='console.debug("[QRReadings] previewServerReading response",a.status,a.data)'
        self.assertIn('RD-02', {x['id'] for x in audit.scan(src)})

    def test_no_full_response_logging_when_metadata_only(self):
        src='console.debug("request complete",a.status)'
        self.assertNotIn('RD-02', {x['id'] for x in audit.scan(src)})

    def test_no_numeric_coercion_for_string(self):
        self.assertNotIn('RD-04', {x['id'] for x in audit.scan('doc_number:String(e)')})

    def test_numeric_coercion(self):
        self.assertIn('RD-04', {x['id'] for x in audit.scan('doc_number:Number(e)')})

    def test_demo_rows(self):
        src='QRCODE:12345 and later localStorage.setItem(W,JSON.stringify(q.value))'
        self.assertIn('RD-01', {x['id'] for x in audit.scan(src)})

    def test_api_paths(self):
        text='local_form/return_doc_qrcode local_form/pagination_qrcode_reader'
        self.assertEqual(
            audit.classify_routes(text),
            ['local_form/pagination_qrcode_reader', 'local_form/return_doc_qrcode']
        )

    def test_compare_distinct_paths(self):
        qr='"local_form/pagination_qrcode_reader" "local_form/download_qrcode_readers" "local_form/return_doc_qrcode"'
        control='import "./useLocalCompany-DfV5kpAj.js"'
        dep='local_form/paginate_qrcode_reader2 "local_form/download_qrcode_readers2" "local_form/return_doc_qrcode"'
        result=audit.compare(qr, control, dep)
        self.assertTrue(result['distinct_list_endpoints'])
        self.assertTrue(result['distinct_export_endpoints'])
        self.assertTrue(result['common_preview_endpoint'])

    def test_checked_reject_html(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'fake.js'
            p.write_text('<html>HuaweiCloudWAF</html>')
            with self.assertRaises(ValueError):
                audit.checked_bytes(p)

if __name__=='__main__':
    unittest.main()
