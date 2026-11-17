"""Synthetic-only tests for QR Store source auditor (no network, no JS execution)."""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

TOOL = Path(__file__).resolve().parents[1] / "tools" / "ish" / "qr_store_review.py"
spec = importlib.util.spec_from_file_location("qr_store_review", TOOL)
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)

class TestQrStoreReview(unittest.TestCase):
    def ids(self, source):
        return {entry["id"] for entry in review.inspect(source)}

    def test_ten_unique_literal_rules(self):
        ids = [rule[0] for rule in review.RULES]
        self.assertEqual(10, len(ids))
        self.assertEqual(10, len(set(ids)))

    def test_storage_key(self):
        self.assertIn("QS-01", self.ids('const e="qr_readings"'))

    def test_non_array_parse(self):
        self.assertIn("QS-02", self.ids('return t?JSON.parse(t):[]'))

    def test_silent_read_errors(self):
        self.assertIn("QS-03", self.ids("catch{return[]}"))

    def test_silent_write_errors(self):
        self.assertIn("QS-04", self.ids('localStorage.setItem(e,JSON.stringify(t))catch{}'))

    def test_prepend(self):
        self.assertIn("QS-05", self.ids("a.unshift(t)"))

    def test_read_modify_write(self):
        self.assertIn("QS-06", self.ids("const a=n();a.unshift(t),r(a)"))

    def test_unchecked_add(self):
        self.assertIn("QS-07", self.ids("function s(t){const a=n();a.unshift(t),r(a)}"))

    def test_full_list_rewrite(self):
        text = "const a=n();a.unshift(t),r(a);localStorage.setItem(e,JSON.stringify(t))"
        self.assertIn("QS-08", self.ids(text))

    def test_malformed_json_followed_by_add(self):
        self.assertIn("QS-09", self.ids("catch{return[]} const a=n();a.unshift(t),r(a)"))

    def test_only_add_and_list_exports(self):
        self.assertIn("QS-10", self.ids("export{s as a,n as l}"))

    def test_missing_capacity_limit(self):
        self.assertIn("QS-11", self.ids("a.unshift(t)"))
        self.assertNotIn("QS-11", self.ids("a.unshift(t);a.splice(500)"))

    def test_missing_ttl(self):
        self.assertIn("QS-12", self.ids("localStorage.getItem(e)"))
        self.assertNotIn("QS-12", self.ids("localStorage.getItem(e);Date.now()"))

    def test_missing_account_namespace(self):
        self.assertIn("QS-13", self.ids('const e="qr_readings"'))
        self.assertNotIn("QS-13", self.ids('const e="qr_readings";const tenantId=current.tenantId'))

    def test_distinguish_session_and_local_storage(self):
        store = 'const e="qr_readings";localStorage.getItem(e)'
        doc = '__name:"QRDocument";const x=CB(),P=b.query.id;a.value=AA||x[0]||null;sessionStorage.setItem("qr_read_doc",JSON.stringify([]))'
        cp = '__name:"QRCheckpoints";sessionStorage.getItem("qr_read_doc")'
        self.assertTrue(all(review.compare(doc, cp, store).values()))

    def test_parent_cannot_sync_to_server_by_inference(self):
        store = 'const e="qr_readings";fetch("/test")'
        doc = '__name:"QRDocument";const x=CB(),P=b.query.id'
        cp = '__name:"QRCheckpoints"'
        self.assertFalse(review.compare(doc, cp, store)["no_evidence_of_direct_server_sync_in_store"])

    def test_reject_html_or_waf_response(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder) / "fake.js"
            p.write_text("<!doctype html><html>WAF</html>", encoding="utf-8")
            with self.assertRaises(ValueError):
                review.checked_read(p)

    def test_reject_missing_file(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                review.checked_read(Path(folder) / "missing.js")

    def test_hash_matches_git_blob_construction(self):
        raw = b"test"
        expected = hashlib.sha1(b"blob 4\x00test").hexdigest()
        self.assertEqual(expected, review.fingerprint(raw)["git_blob_sha1"])
        self.assertEqual(hashlib.sha256(raw).hexdigest(), review.fingerprint(raw)["sha256"])

    def test_clean_unrelated_source(self):
        self.assertEqual([], review.inspect("const x=1"))

if __name__ == "__main__":
    unittest.main()
