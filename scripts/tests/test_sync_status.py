"""A failed or skipped sync must not be reported as no changes."""
import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("sync_status", ROOT / "scripts/ci/report-sync-status.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SyncStatusTests(unittest.TestCase):
    def test_failed_checkout_never_claims_no_changes(self):
        level, text = module.status("failure", "skipped", "skipped", "")
        self.assertEqual(level, "warning")
        self.assertIn("no synchronization was performed", text)
        self.assertNotIn("no new PR", text)

    def test_failed_mirror_and_review_are_not_successful_syncs(self):
        self.assertIn("mirror did not complete", module.status("success", "failure", "skipped", "")[1])
        self.assertIn("may not exist", module.status("success", "success", "failure", "")[1])
        self.assertEqual(module.status("success", "success", "skipped", "")[0], "warning")

    def test_completed_review_and_no_change(self):
        url = "https://github.com/abdulstarzeki001-sketch/Wormstar/pull/123"
        self.assertIn(url, module.status("success", "success", "success", url)[1])
        self.assertIn("no new PR", module.status("success", "success", "success", "")[1])
        self.assertEqual(module.status("success", "success", "success", "https://evil.invalid/pull/1")[0], "warning")


if __name__ == "__main__":
    unittest.main()
