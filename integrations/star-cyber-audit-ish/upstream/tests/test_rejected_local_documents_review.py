"""Synthetic, offline-only regression tests of RejectedLocalDocuments indicators."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE=Path(__file__).resolve().parents[1]/"tools"/"ish"/"rejected_local_documents_review.py"
spec=importlib.util.spec_from_file_location("rejected_local_documents_review",MODULE)
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class TestRejectedLocalDocumentsReview(unittest.TestCase):
    def ids(self,s):
        return {x["id"] for x in audit.inspect(s)}

    def test_unique_rules(self):
        ids=[x[0] for x in audit.RULES]
        self.assertEqual(16,len(ids))
        self.assertEqual(len(ids),len(set(ids)))

    def test_shared_store_list(self):
        self.assertIn("RL-01",self.ids("F.fetchRejectedLocalReaders(s)"))

    def test_unsafe_array_assumption(self):
        self.assertIn("RL-02",self.ids("n=t.data||[];w.value=n.map("))

    def test_array_check_removes_flag(self):
        self.assertNotIn("RL-02",self.ids("n=t.data||[];w.value=n.map(; Array.isArray(n)"))

    def test_stale_rows_error_path(self):
        self.assertIn("RL-03",self.ids('catch(t){console.error("[RejectedLocalDocuments] loadPage failed",t)'))

    def test_preview_local_privilege_gate_indicator(self):
        s='"aria-label":"معاينة الوثيقة";ee.post("local_form/return_doc_qrcode"'
        self.assertIn("RL-04",self.ids(s))
        self.assertNotIn("RL-04",self.ids(s+"user_privileges"))

    def test_doc_number_numeric_coercion(self):
        self.assertIn("RL-05",self.ids("doc_number:Number(t)"))
        self.assertNotIn("RL-05",self.ids("doc_number:String(t)"))

    def test_company_type_zero_dropped(self):
        self.assertIn("RL-06",self.ids("...n?{company_type:n}:{}"))

    def test_preview_local_persistence(self):
        s='raw:{doc_number:t,response:a};sessionStorage.setItem("qr_preview_entry",JSON.stringify(l));se(l)'
        self.assertIn("RL-07",self.ids(s))

    def test_auto_print_download_flags(self):
        self.assertIn("RL-08",self.ids("autoPrint:!0,autoDownload:!0"))

    def test_external_map_location(self):
        s='https://www.google.com/maps?q= a.x_coordinate a.y_coordinate'
        self.assertIn("RL-09",self.ids(s))

    def test_truthiness_coordinate_gate(self):
        self.assertIn("RL-10",self.ids("a.x_coordinate&&a.y_coordinate?"))

    def test_reader_phone(self):
        self.assertIn("RL-11",self.ids("u(a.phone)"))

    def test_fallback_rejection_reason(self):
        self.assertIn("RL-12",self.ids("r.rejection_reason??r.reason??r.notes"))

    def test_empty_row_mismatch(self):
        self.assertIn("RL-13",self.ids('colspan:"8" "سبب الرفض" "معاينة"'))
        self.assertNotIn("RL-13",self.ids('colspan:"9" "سبب الرفض" "معاينة"'))

    def test_preview_missing_success_flag(self):
        self.assertIn("RL-14",self.ids('r.data&&r.data.data?r.data.data:r.data raw:{doc_number:t,response:a}'))

    def test_inflight_list_pattern(self):
        src="async function h(s={}) F.fetchRejectedLocalReaders(s) w.value=n.map("
        self.assertIn("RL-15",self.ids(src))
        self.assertNotIn("RL-15",self.ids(src+"AbortController"))

    def test_console_only_preview_failure(self):
        self.assertIn("RL-16",self.ids('console.error("[RejectedLocalDocuments] previewServerReading error",t)'))

    def test_html_waf_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"source.js"
            path.write_text("<html>HuaweiCloudWAF</html>")
            with self.assertRaises(ValueError):
                audit.checked_read(path)

    def test_clean_source(self):
        self.assertEqual([],audit.inspect("const ready=true;"))

if __name__=="__main__":
    unittest.main()
