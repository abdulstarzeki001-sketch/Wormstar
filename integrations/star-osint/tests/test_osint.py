"""Offline regression tests for STAR OSINT: no external network or binaries."""
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import engine
import infra


class ScopeTests(unittest.TestCase):
    def test_valid_and_normalized(self):
        self.assertEqual(engine.domain("WWW.Example.COM."), "www.example.com")
        self.assertTrue(engine.in_scope("api.example.com", "example.com"))
        self.assertFalse(engine.in_scope("api.example.com.evil.test", "example.com"))

    def test_invalid_names(self):
        for value in ("*.example.com", "https://example.com", "example..com",
                      "example.com/../../secret", "bad host.com", "localhost"):
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    engine.domain(value)

    def test_authorization_requires_exact_explicit_domain(self):
        with tempfile.TemporaryDirectory() as root:
            scope = Path(root) / "scope.json"
            scope.write_text(json.dumps({"authorized_domains": ["example.com"]}))
            self.assertTrue(engine.authorize("example.com", scope))
            self.assertFalse(engine.authorize("other.com", scope))
            self.assertFalse(engine.authorize("sub.example.com", scope))

    def test_no_collect_if_not_in_scope(self):
        with tempfile.TemporaryDirectory() as root:
            scope = Path(root) / "scope.json"
            scope.write_text(json.dumps({"authorized_domains": ["example.com"]}))
            with patch.object(engine.subprocess, "run") as runner:
                with self.assertRaisesRegex(ValueError, "authorized"):
                    engine.collect("other.com", scope, Path(root) / "output")
                runner.assert_not_called()


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.input = Path(self.tmp.name) / "passive"
        self.input.mkdir()
        self.output = Path(self.tmp.name) / "results"

    def populate(self):
        (self.input / "subfinder.txt").write_text(
            "api.example.com\napi.example.com\nnotexample.com\n*.example.com\n"
        )
        (self.input / "amass.txt").write_text("api.example.com\nwww.example.com\n")
        (self.input / "ct-names.txt").write_text(
            "www.example.com\nbad.example.com.attacker.test\n"
        )
        (self.input / "subfinder-evidence.jsonl").write_text(
            json.dumps({"host": "api.example.com", "sources": ["crtsh", "wayback"]}) + "\n"
        )
        (self.input / "harvester.jsonl").write_text(
            json.dumps({"type": "email", "value": "admin@example.com"}) + "\n" +
            json.dumps({"type": "host", "value": "mail.example.com"}) + "\n"
        )

    def test_import_creates_reports_and_sqlite(self):
        self.populate()
        result = engine.import_run("example.com", self.input, self.output)
        self.assertEqual(result["summary"]["assets"], 3)
        self.assertEqual([v["hostname"] for v in result["assets"]],
                         ["api.example.com", "mail.example.com", "www.example.com"])
        self.assertTrue((self.output / "report.json").exists())
        self.assertTrue((self.output / "assets.csv").exists())
        self.assertTrue((self.output / "report.html").exists())
        self.assertTrue((self.output / "SHA256SUMS.txt").exists())
        self.assertFalse(result["verified_live"])
        with sqlite3.connect(self.output / "osint.sqlite3") as db:
            self.assertEqual(db.execute("select count(*) from runs").fetchone()[0], 1)
            self.assertEqual(db.execute("select count(*) from observations").fetchone()[0],
                             result["summary"]["source_observations"])

    def test_missing_input(self):
        with self.assertRaisesRegex(ValueError, "not found"):
            engine.import_run("example.com", self.input / "missing", self.output)

    def test_oversized_input_rejected(self):
        (self.input / "amass.txt").write_bytes(b"a" * (engine.MAX_FILE_BYTES + 1))
        with self.assertRaisesRegex(ValueError, "too large"):
            engine.build_report("example.com", self.input)

    def test_collect_does_not_run_missing_tools(self):
        with tempfile.TemporaryDirectory() as tmp:
            scope = Path(tmp) / "scope.json"
            scope.write_text('{"authorized_domains":["example.com"]}')
            with patch.object(engine.shutil, "which", return_value=None):
                with patch.object(engine.subprocess, "run") as runner:
                    result = engine.collect("example.com", scope, Path(tmp) / "output")
                    runner.assert_not_called()
                    self.assertEqual(result["summary"]["assets"], 0)
                    statuses = json.loads((Path(tmp) / "output" / "tool-status.json").read_text())
                    self.assertEqual(len(statuses), 3)
                    self.assertTrue(all(s["status"] == "not_installed" for s in statuses))


class InfrastructureTests(ImportTests):
    def test_evidence_correlation_with_scope_and_public_addresses(self):
        self.populate()
        engine.import_run("example.com", self.input, self.output)
        dns = self.input / "dns.jsonl"
        dns.write_text(
            json.dumps({"host": "api.example.com", "a": ["8.8.8.8", "127.0.0.1"],
                        "cname": ["proxy.provider.net"]}) + "\n" +
            json.dumps({"host": "out.example.com.evil.test", "a": ["1.1.1.1"]}) + "\n"
        )
        http = self.input / "http.jsonl"
        http.write_text(
            json.dumps({"input": "api.example.com", "status_code": 200,
                        "title": "Hello", "cdn_name": "cloudflare",
                        "asn": {"as_number": 13335, "as_name": "Example CDN"}}) + "\n"
        )
        report = infra.correlate(self.output / "report.json", dns, http)
        host = next(i for i in report["assets"] if i["hostname"] == "api.example.com")
        self.assertEqual(host["ip_addresses"], ["8.8.8.8"])
        self.assertEqual(host["cnames"], ["proxy.provider.net"])
        self.assertEqual(host["http_observations"][0]["status_code"], 200)
        self.assertEqual(len(report["edges"]), 2)

    def test_invalid_schema_rejected(self):
        file = self.input / "bad.json"
        file.write_text('{"schema": "unknown", "target":"example.com"}')
        with self.assertRaisesRegex(ValueError, "schema"):
            infra.correlate(file)


if __name__ == "__main__":
    unittest.main()
