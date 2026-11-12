"""Private source export stays disabled until both owner controls are set."""
import importlib.util
import os
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("sync_prereqs", ROOT / "scripts/ci/check-sync-prereqs.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SyncPrerequisitesTests(unittest.TestCase):
    def test_explicit_public_export_opt_in_is_required(self):
        self.assertIn("disabled", module.validate("", "fake-read-token"))
        self.assertIn("disabled", module.validate("false", "fake-read-token"))

    def test_read_only_token_is_required_and_never_echoed(self):
        self.assertIn("read token", module.validate("true", ""))
        self.assertIsNone(module.validate("true", "fake-read-token"))
        env = {**os.environ, "SYNC_PUBLIC_EXPORT_APPROVED": "true", "SYNC_READ_TOKEN": "fake-private-token-value"}
        result = subprocess.run([sys.executable, str(ROOT / "scripts/ci/check-sync-prereqs.py")],
                                env=env, capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 0)
        self.assertNotIn(env["SYNC_READ_TOKEN"], result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
