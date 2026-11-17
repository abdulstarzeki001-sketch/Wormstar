"""Synthetic, offline-only checks. Never requests government endpoints."""
import importlib.util
import unittest
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / 'tools' / 'ish' / 'use_local_company_review.py'
spec = importlib.util.spec_from_file_location('local_company_review', SRC)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class TestUseLocalCompanyReview(unittest.TestCase):
    def test_demo_seed_detected(self):
        self.assertIn('LC-01', {r['id'] for r in audit.indicators('localStorage.setItem(i,JSON.stringify(A.value))')})

    def test_preview_numeric_coercion_detected(self):
        self.assertIn('LC-02', {r['id'] for r in audit.indicators('g={doc_number:Number(r)}')})

    def test_geo_zero_truthiness_detected(self):
        self.assertIn('LC-05', {r['id'] for r in audit.indicators('s.latitude&&s.longitude&&isFinite(s.latitude)')})

    def test_precise_api_inventory(self):
        got = audit.api_paths('P.post("local_form/paginate_qrcode_reader2",{}) P.post("log_event/get_logevent",{})')
        self.assertEqual(got, ['local_form/paginate_qrcode_reader2', 'log_event/get_logevent'])

    def test_unapplied_document_requirement_detected(self):
        source = "return!w&&q&&Array.isArray(h)&&h.length>0&&(w=!0),Array.isArray(n)"
        self.assertIn('LC-09', {r['id'] for r in audit.indicators(source)})

    def test_clean_source_no_flags(self):
        self.assertEqual(audit.indicators('const a = 1; export{a};'), [])

    def test_escaped_download_hash_not_flagged(self):
        source = 'local_form/download_file?url=enc_url&hash_id=enc_hash'
        self.assertNotIn('LC-07', {r['id'] for r in audit.indicators(source)})

if __name__ == '__main__':
    unittest.main()
