"""Offline integration and unit checks; all fixtures are synthetic."""
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_module(relative):
    path = ROOT / relative
    spec = importlib.util.spec_from_file_location(
        path.stem.replace("-", "_"), path
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


forensics = load_module("scripts/har_forensic_lab.py")
weights = load_module("labs/validate_weight_lab.py")
response = load_module("scripts/uboor_response_audit.py")
js_audit = load_module("scripts/js_static_audit.py")
correlate = load_module("scripts/correlate_audit.py")
auth = load_module("labs/auth_header_lab.py")
legacy_har = load_module("scripts/uboor_har_analyzer.py")


class TestHAR(unittest.TestCase):
    def test_legacy_har_redacts_identifiers_in_path_method_and_status(self):
        har = {"log": {"entries": [{
            "request": {"method": "PRIVATE_METHOD", "url":
                        "https://example.invalid/api/local_form/company_item_reduce/PRIVATE_ID?x=PRIVATE_QUERY"},
            "response": {"status": "PRIVATE_STATUS"},
        }]}}
        report = legacy_har.analyze(har)
        self.assertEqual(report["matching_requests"], 1)
        self.assertNotIn("PRIVATE_", json.dumps(report))
        self.assertEqual(report["results"][0]["method"], "UNKNOWN")

    def test_forensics_redacts_untrusted_method_and_status(self):
        har = {"log": {"entries": [{"request": {"method": "PRIVATE_METHOD", "url":
            "https://example.invalid/api/local_form/company_item_reduce"},
            "response": {"status": "PRIVATE_STATUS"}}]}}
        self.assertNotIn("PRIVATE_", json.dumps(forensics.analyze_har(har)))

    def test_legacy_har_rejects_any_invalid_item_and_uses_exact_decimals(self):
        payload = {"item1": {"production_capacity": "1.9"},
                   "item2": {"production_capacity": "invalid"},
                   "vihcle_info": {"weight_quantity": "1.9"}}
        self.assertEqual(legacy_har.quantity_check(payload)["status"], "invalid_value")
        payload = {"item1": {"production_capacity": 0.1},
                   "item2": {"production_capacity": 0.2},
                   "vihcle_info": {"weight_quantity": 0.3}}
        self.assertEqual(legacy_har.quantity_check(payload)["status"], "matching")

    def test_training_duplicates_and_mismatch(self):
        data = json.loads((ROOT / "samples/har_training.har").read_text())
        report = forensics.analyze_har(data)
        self.assertEqual(report["relevant_requests"], 3)
        self.assertEqual(len(report["possible_duplicate_groups"]), 1)
        self.assertEqual(
            [x["quantity_status"] for x in report["results"]],
            ["matching", "matching", "mismatch"]
        )
        self.assertEqual(
            [x["duplicate_group"] for x in report["results"]],
            ["D1", "D1", None]
        )
        text = json.dumps(report)
        self.assertNotIn("FAKE-ITEM-A", text)
        self.assertNotIn("example.invalid", text)

    def test_original_sample_numeric_string(self):
        data = json.loads((ROOT / "samples/network.har").read_text())
        report = forensics.analyze_har(data)
        self.assertEqual(report["results"][0]["quantity_status"], "matching")

    def test_invalid_values(self):
        self.assertIsNone(forensics.as_positive_decimal("NaN"))
        self.assertIsNone(forensics.as_positive_decimal(True))
        self.assertIsNone(forensics.as_positive_decimal(-5))
        self.assertIsNone(forensics.as_positive_decimal("2e2"))
        self.assertEqual(str(forensics.as_positive_decimal("1.9")), "1.9")

    def test_missing_payload(self):
        self.assertEqual(forensics.read_payload({}), (None, "not_captured"))


class TestWeights(unittest.TestCase):
    def test_eight_synthetic_lab_tests(self):
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(
            weights.WeightSecurityTests
        )
        with open("/dev/null", "w") as output:
            result = unittest.TextTestRunner(stream=output).run(suite)
        self.assertEqual(result.testsRun, 8)
        self.assertTrue(result.wasSuccessful())

    def test_local_auth_simulation(self):
        self.assertEqual(
            auth.simulate_request("OWNER_FAKE", "GLOBAL_FAKE"),
            "Bearer GLOBAL_FAKE"
        )


class TestResponse(unittest.TestCase):
    def test_report_redacts_qr_path_host_kind_and_unknown_unit(self):
        payload = {"qr_code": "https://private-id.example/document/PRIVATE_ID?url=FAKE_TOKEN%7CPRIVATE_KIND",
                   "items": [{"unit": "PRIVATE_UNIT", "production_capacity": 1}], "weight_quantity": 1}
        text = json.dumps(response.analyze(None, {}, payload))
        for secret in ("private-id", "PRIVATE_ID", "FAKE_TOKEN", "PRIVATE_KIND", "PRIVATE_UNIT"):
            self.assertNotIn(secret, text)

    def test_demo(self):
        status, headers, body = response.load_response(
            ROOT / "samples/uboor_response_demo.json"
        )
        report = response.analyze(status, headers, body)
        self.assertEqual(report["weight_comparison"], "matching")
        self.assertTrue(report["document_id_present"])
        self.assertEqual(report["weight_quantity"], "1.9")
        self.assertNotIn("SYNTHETIC-001", json.dumps(report))
        self.assertNotIn("FAKE_TRAINING_TOKEN", json.dumps(report))

    def test_strict_decimal(self):
        self.assertEqual(str(response.positive_decimal("1.9")), "1.9")
        self.assertIsNone(response.positive_decimal("NaN"))
        self.assertIsNone(response.positive_decimal(True))


class TestStatic(unittest.TestCase):
    def test_js_demo(self):
        report = js_audit.analyze(ROOT / "samples/js")
        self.assertGreaterEqual(report["files_analyzed"], 1)
        counts = report["files"][0]["marker_counts"]
        self.assertGreater(counts.get("company_item_reduce", 0), 0)
        self.assertNotIn("OWNER_FAKE", json.dumps(report))

    def test_correlate(self):
        js = js_audit.analyze(ROOT / "samples/js")
        har = forensics.analyze_har(json.loads(
            (ROOT / "samples/har_training.har").read_text()
        ))
        stat, head, obj = response.load_response(
            ROOT / "samples/uboor_response_demo.json"
        )
        rsp = response.analyze(stat, head, obj)
        report = correlate.build(js, har, rsp)
        self.assertEqual(report["har_relevant_requests"], 3)
        self.assertEqual(report["har_duplicate_groups"], 1)
        self.assertEqual(report["response_weight_comparison"], "matching")


class TestCLIs(unittest.TestCase):
    def test_full_offline_pipeline(self):
        with tempfile.TemporaryDirectory() as tmp:
            report_dir = Path(tmp)
            commands = [
                [
                    sys.executable, "-S", str(ROOT / "scripts/har_forensic_lab.py"),
                    str(ROOT / "samples/har_training.har"),
                    "--output", str(report_dir / "har.json"),
                ],
                [
                    sys.executable, "-S", str(ROOT / "scripts/js_static_audit.py"),
                    "--directory", str(ROOT / "samples/js"),
                    "--output", str(report_dir / "js.json"),
                ],
                [
                    sys.executable, "-S", str(ROOT / "scripts/uboor_response_audit.py"),
                    str(ROOT / "samples/uboor_response_demo.json"),
                    "-o", str(report_dir / "response.json"),
                ],
                [
                    sys.executable, "-S", str(ROOT / "scripts/correlate_audit.py"),
                    "--har", str(report_dir / "har.json"),
                    "--js", str(report_dir / "js.json"),
                    "--response", str(report_dir / "response.json"),
                    "--output", str(report_dir / "combined.json"),
                ],
            ]
            for command in commands:
                result = subprocess.run(
                    command, cwd=ROOT, text=True,
                    capture_output=True, timeout=30,
                )
                self.assertEqual(
                    result.returncode, 0,
                    msg=f"{command[1]} failed:\n{result.stdout}\n{result.stderr}",
                )
            combined = json.loads(
                (report_dir / "combined.json").read_text()
            )
            self.assertEqual(combined["har_duplicate_groups"], 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
