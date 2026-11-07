import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("star_audit", ROOT / "analyze.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class TestAudit(unittest.TestCase):
    def test_waf_is_not_javascript(self):
        html = b'<html><meta content="HuaweiCloudWAF"><script>function x(){}</script></html>'
        self.assertEqual(audit.classify(html), "WAF_HTML_NOT_JS")

    def test_js_routes_and_flags(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "fixture.js"
            p.write_text(
                "import './module.js'; const endpoint='local_form/read_doc_company'; "
                "console.debug('auth token:',user.token);",
                encoding="utf-8"
            )
            result = audit.analyze_one(p, "test")
            self.assertEqual(result["classification"], "JS_SOURCE")
            self.assertIn("local_form/read_doc_company", result["api_paths"])
            self.assertTrue(any("TOKEN_DEBUG" in f for f in result["flags"]))

    def test_html_not_js(self):
        self.assertEqual(audit.classify(b"<!doctype html><html></html>"), "HTML_NOT_JS")


    def test_webpack_minified_dms_verify(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "6439.3d46893d.js"
            path.write_text(
                '(window.webpackJsonp=window.webpackJsonp||[]).push([[6439],'
                '{6439:function(e){var x=new XMLHttpRequest;'
                'x.open("GET","/api/verify/"+encodeURIComponent(c),!0);}}]);',
                encoding="utf-8",
            )
            result = audit.analyze_one(path, "test")
            self.assertEqual(result["classification"], "JS_SOURCE")
            self.assertIn("/api/verify/", result["api_paths"])
            self.assertIn("GET /api/verify/", result["api_calls"])

    def test_minified_js_extension_fallback(self):
        self.assertEqual(
            audit.classify(b'(x=>x(0))()', filename="2752.719f919a.js"),
            "JS_SOURCE",
        )
        self.assertEqual(
            audit.classify(b'!function(){return 3}()', filename="978.a8d79244.js"),
            "JS_SOURCE",
        )

    def test_reject_non_js_even_if_named_js(self):
        self.assertEqual(
            audit.classify(b'<!doctype html><html></html>', filename="main.js"),
            "HTML_NOT_JS",
        )
        self.assertEqual(
            audit.classify(b'{"ok":true}', filename="main.js"),
            "JSON_NOT_JS",
        )
        self.assertEqual(
            audit.classify(bytes([0, 65, 66]), filename="main.js"),
            "BINARY_NOT_JS",
        )

    def test_waf_marker_in_js_does_not_hide_js(self):
        self.assertEqual(
            audit.classify(b'const msg="HuaweiCloudWAF";', filename="main.js"),
            "JS_SOURCE",
        )

    def test_recursive_scan_preserves_duplicate_basenames(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for subdir in ("one", "two"):
                (root / subdir).mkdir()
                (root / subdir / "component.js").write_text(
                    "const endpoint='local_form/read_doc_company';",
                    encoding="utf-8",
                )
            records = audit.collect_records([(root, "local")])
            self.assertEqual(len(records), 2)
            self.assertEqual(
                {item["relative_path"] for item in records},
                {"one/component.js", "two/component.js"},
            )

    def test_prefer_downloaded_js_for_matching_relative_path(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            offline, downloads = root / "offline", root / "downloads"
            offline.mkdir()
            downloads.mkdir()
            (offline / "same.js").write_text('const version="offline";', encoding="utf-8")
            (downloads / "same.js").write_text('const version="download";', encoding="utf-8")
            records = audit.collect_records([
                (offline, "offline_snapshot"),
                (downloads, "downloaded_current"),
            ])
            self.assertEqual(len(records), 1)
            self.assertEqual(records[0]["origin"], "downloaded_current")

    def test_source_limit_and_skipped_generated_dirs(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / ".git").mkdir()
            (root / ".git" / "ignored.js").write_text("const skip=1;")
            (root / "first.js").write_text("const first=1;")
            (root / "second.js").write_text("const second=1;")
            names = {path.name for path in audit.iter_source_files(root)}
            self.assertEqual(names, {"first.js", "second.js"})
            with self.assertRaises(ValueError):
                list(audit.iter_source_files(root, max_files=1))

    def test_symlink_is_not_followed(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            outside = root / "outside.txt"
            outside.write_text("const secret=1;")
            link = root / "escape.js"
            try:
                link.symlink_to(outside)
            except (OSError, NotImplementedError):
                self.skipTest("symlink unavailable")
            self.assertEqual(list(audit.iter_source_files(root)), [])



if __name__ == "__main__":
    unittest.main()
