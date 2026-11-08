"""Synthetic offline tests for QRCheckpoints source review. No HTTP requests."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "tools" / "ish" / "qr_checkpoints_review.py"
spec = importlib.util.spec_from_file_location("qr_checkpoints_review", SCRIPT)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

PREFIX = 'const U={__name:"QRCheckpoints"};'

class TestQrCheckpointsReview(unittest.TestCase):
    def ids(self, text):
        return {finding["id"] for finding in audit.inspect(PREFIX + text)}

    def test_unique_thirteen_rules(self):
        ids = [rule[0] for rule in audit.RULES]
        self.assertEqual(13, len(ids))
        self.assertEqual(len(ids), len(set(ids)))

    def test_props_array_like_initialization(self):
        self.assertIn("CP-01", self.ids("props:{items:{}};i.items&&i.items.length?i.items.slice():[]"))

    def test_array_watcher(self):
        self.assertIn("CP-02", self.ids("v(()=>i.items,e=>{Array.isArray(e)&&(s.value=e.slice())})"))

    def test_history_state_precedence(self):
        self.assertIn("CP-03", self.ids("history&&history.state||{};e.read_doc&&Array.isArray(e.read_doc)"))

    def test_session_storage(self):
        self.assertIn("CP-04", self.ids('sessionStorage.getItem("qr_read_doc");JSON.parse(o)'))

    def test_url_query(self):
        self.assertIn("CP-05", self.ids("d.query.read_doc;decodeURIComponent(d.query.read_doc)"))

    def test_unusable_session_fallback(self):
        self.assertIn("CP-06", self.ids("if(o)try{JSON.parse(o)}catch{}else if(d.query.read_doc){}"))
        self.assertNotIn("CP-06", self.ids("try{JSON.parse(o)}catch{};if(d.query.read_doc){}"))

    def test_empty_history_array(self):
        self.assertIn("CP-07", self.ids("Array.isArray(e.read_doc))s.value=e.read_doc"))

    def test_map_display_click_mismatch(self):
        src = "return!!(e.x_coordinate||e.y_coordinate);if(!e.x_coordinate||!e.y_coordinate)return"
        self.assertIn("CP-08", self.ids(src))

    def test_no_map_mismatch_when_checks_agree(self):
        src = "return!!(e.x_coordinate&&e.y_coordinate);if(!e.x_coordinate||!e.y_coordinate)return"
        self.assertNotIn("CP-08", self.ids(src))

    def test_external_map_coordinates(self):
        self.assertIn("CP-09", self.ids('https://www.google.com/maps?q=;window.open(o,"_blank")'))

    def test_timezones(self):
        src = 'new Intl.DateTimeFormat("ar-EG",_);e.includes("Z");_.timeZone="UTC"'
        self.assertIn("CP-10", self.ids(src))

    def test_invalid_date_raw(self):
        self.assertIn("CP-11", self.ids("catch{return String(e)}"))

    def test_loading_immediate_reset(self):
        self.assertIn("CP-12", self.ids("l.value=!0;try{}finally{l.value=!1}"))

    def test_index_key(self):
        self.assertIn("CP-13", self.ids("key:u;C(s.value,(t,u)=>{})"))

    def test_no_document_id_binding(self):
        self.assertIn("CP-14", self.ids('sessionStorage.getItem("qr_read_doc")'))
        self.assertNotIn("CP-14", self.ids('sessionStorage.getItem("qr_read_doc");const doc_id=12'))

    def test_parent_connection(self):
        child = PREFIX + 'sessionStorage.getItem("qr_read_doc")'
        parent = '__name:"QRDocument";sessionStorage.setItem("qr_read_doc",JSON.stringify([]));import "./QRCheckpoints-Brs0uL0-.js"'
        comparison = audit.compare_parent(child, parent)
        self.assertTrue(all(comparison.values()))

    def test_parent_guard(self):
        with self.assertRaises(ValueError):
            audit.compare_parent(PREFIX, "const random=123")

    def test_git_blob_sha(self):
        raw = b"test"
        self.assertEqual(
            "30d74d258442c7c65512eafab474568dd706c430",
            audit.fingerprint(raw)["git_blob_sha1"],
        )

    def test_html_waf_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "checkpoint.js"
            path.write_text("<html>HuaweiCloudWAF</html>")
            with self.assertRaises(ValueError):
                audit.checked_read(path)

    def test_noncomponent_rejected(self):
        with self.assertRaises(ValueError):
            audit.inspect('const x=1')

    def test_safe_empty_component(self):
        self.assertEqual([], audit.inspect(PREFIX))

if __name__ == "__main__":
    unittest.main()
