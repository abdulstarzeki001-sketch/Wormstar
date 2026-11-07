"""Offline regression tests for archived Webpack, DMS and nested sources.

Never connects to UBOOR/DMS. All samples are synthetic and kept in temp dirs.
"""
import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("star_audit", ROOT / "analyze.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

DMS_FIXTURE = (
    '"use strict";(self["webpackChunkDMS"]=self["webpackChunkDMS"]||[]).push('
    '[[6439],{6439:function(e,t,r){'
    'var x=new XMLHttpRequest;'
    'x.open("GET","/api/verify/"+encodeURIComponent(c),!0);'
    'x.onload=function(){var d=JSON.parse(x.responseText);this.doc=d.document||null};'
    '}}]);'
)


class TestRegressionAudit(unittest.TestCase):
    def test_webpack_minified_classification(self):
        for chunk in (1997, 978, 2752, 6439):
            sample = DMS_FIXTURE.replace("6439", str(chunk))
            self.assertEqual(audit.classify(sample.encode()), "JS_SOURCE")
            self.assertEqual(
                audit.classify(sample.encode(), filename=f"{chunk}.js"), "JS_SOURCE"
            )

    def test_dms_api_and_xhr_method(self):
        with tempfile.TemporaryDirectory() as td:
            target = Path(td) / "6439.3d46893d.js"
            target.write_text(DMS_FIXTURE, encoding="utf-8")
            result = audit.analyze_one(target, "local")
            self.assertEqual(result["classification"], "JS_SOURCE")
            self.assertIn("/api/verify/", result["api_paths"])
            self.assertIn("GET /api/verify/", result["api_calls"])

    def test_html_waf_precedes_js_extension(self):
        html = b'<!doctype html><html><script>const a = 2</script></html>'
        waf = b'<html><title>HuaweiCloudWAF</title><script>function go(){}</script></html>'
        self.assertEqual(audit.classify(html, filename="index.js"), "HTML_NOT_JS")
        self.assertEqual(audit.classify(waf, filename="index.js"), "WAF_HTML_NOT_JS")

    def test_json_precedes_js_extension(self):
        self.assertEqual(
            audit.classify(b'{"status":"error"}', filename="index.js"),
            "JSON_NOT_JS"
        )

    def test_plaintext_block_page_not_js(self):
        for status in (b"Access Denied", b"Forbidden", b"Request blocked"):
            self.assertEqual(audit.classify(status, filename="index.js"),
                             "UNKNOWN_NOT_VERIFIED")

    def test_null_binary_not_js(self):
        self.assertEqual(audit.classify(b"\x00\xff\x00JS", filename="index.js"),
                         "BINARY_NOT_JS")

    def test_nested_files_and_duplicate_basename(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            for sub in ("uboor", "dms"):
                folder = root / sub
                folder.mkdir()
                (folder / "same.js").write_text(
                    "const x='local_form/read_doc_company';", encoding="utf-8"
                )
            records = audit.collect_records([(root, "local")])
            self.assertEqual(len(records), 2)
            self.assertEqual(
                {r["relative_path"] for r in records},
                {"uboor/same.js", "dms/same.js"}
            )

    def test_skip_generated_directories(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            for sub in ("node_modules", ".git", "reports"):
                folder = root / sub
                folder.mkdir()
                (folder / "irrelevant.js").write_text("const unused = 1;")
            (root / "target.js").write_text("const target = 1;")
            result = [p.name for p in audit.iter_source_files(root)]
            self.assertEqual(result, ["target.js"])

    def test_symlink_file_is_skipped(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "real.js").write_text("const target = 1;")
            try:
                (root / "shortcut.js").symlink_to(root / "real.js")
            except (OSError, NotImplementedError):
                self.skipTest("symlinks unavailable")
            records = list(audit.iter_source_files(root))
            self.assertEqual([p.name for p in records], ["real.js"])

    def test_scan_file_limit(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "a.js").write_text("const a=1;")
            (root / "b.js").write_text("const b=1;")
            with self.assertRaises(ValueError):
                list(audit.iter_source_files(root, max_files=1))

    def test_csv_formula_neutralized(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "inventory.csv"
            suspicious = "=HYPERLINK(\"https://example.test\", \"click\")"
            item = {
                "name": suspicious, "relative_path": suspicious, "origin": "local",
                "classification": "JS_SOURCE", "bytes": 10, "sha256": None,
                "api_paths": [], "imports": [], "storage": [], "flags": []
            }
            audit.write_csv(path, [item])
            with path.open(encoding="utf-8-sig", newline="") as f:
                rows = list(csv.DictReader(f))
            self.assertTrue(rows[0]["name"].startswith("'="))
            self.assertTrue(rows[0]["relative_path"].startswith("'="))

    def test_html_report_escapes_filename(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "report.html"
            payload = "<img src=x onerror=alert(1)>"
            item = {
                "name": payload, "relative_path": payload, "origin": "local",
                "classification": "JS_SOURCE", "bytes": 10, "sha256": None,
                "api_paths": [], "imports": [], "storage": [], "flags": []
            }
            audit.write_html([item], path)
            rendered = path.read_text(encoding="utf-8")
            self.assertIn("&lt;img", rendered)
            self.assertNotIn(payload, rendered)


if __name__ == "__main__":
    unittest.main()
