"""No-network synthetic regression checks for QrControlScan audit."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

TARGET = Path(__file__).resolve().parents[1] / "tools/ish/qr_control_scan_review.py"
spec = importlib.util.spec_from_file_location("qr_control_scan_review", TARGET)
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)

UI = 'const x={__name:"QrControlScan"}; import a from"./useLocalCompany-DfV5kpAj.js"; '
DEP = 'const o=[{id:"doc_type"},{id:"time_stamp"},{id:"doc_id"}],m=["doc_id","time_stamp","doc_reader_org_name"]; P.post("local_form/paginate_qrcode_reader2",x); P.post("local_form/return_doc_qrcode",x);'

class TestQrControlScanReview(unittest.TestCase):
    def test_detect_colspan_mismatch(self):
        got = review.inspect(UI + 't("td",{colspan:"5"});')
        self.assertIn("CS-01", {f["id"] for f in got})

    def test_no_flag_when_correct_colspan(self):
        got = review.inspect(UI + 't("td",{colspan:"7"});')
        self.assertNotIn("CS-01", {f["id"] for f in got})

    def test_preview_privilege_detected(self):
        got = review.inspect(UI + 'g.value.includes("return_doc_qrcode")')
        self.assertIn("CS-06", {f["id"] for f in got})

    def test_export_selection_detected(self):
        got = review.inspect(UI + 'K.value&&g.value.includes("download_qrcode_readers2")')
        self.assertIn("CS-05", {f["id"] for f in got})

    def test_privacy_fields_detected(self):
        got = review.inspect(UI + 'l(s.doc_reader_phone),l(s.time_stamp)')
        self.assertEqual({"CS-02", "CS-03"}, {f["id"] for f in got})

    def test_dependency_export_field_mismatch(self):
        got = review.inspect(UI, DEP)
        self.assertIn("CS-11", {f["id"] for f in got})

    def test_dependency_preview_coercion_detected(self):
        got = review.inspect(UI, DEP + 'doc_number:Number(r)')
        self.assertIn("CS-07", {f["id"] for f in got})

    def test_unrelated_dependency_rejected(self):
        with self.assertRaises(ValueError):
            review.inspect(UI, 'const x=1;')

    def test_html_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'index.js'
            path.write_text('<html>HuaweiCloudWAF</html>', encoding='utf-8')
            with self.assertRaises(ValueError):
                review.checked_source(path)

    def test_unrelated_ui_rejected(self):
        with self.assertRaises(ValueError):
            review.inspect('const unused=1')

if __name__ == "__main__":
    unittest.main()
