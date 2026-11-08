"""Offline integrity and linkage checks for user-supplied DMS employee assets.

Never executes the archived JavaScript or contacts a governmental endpoint.
"""
import hashlib
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BATCH = ROOT / "research" / "raw-uploads" / "2026-11-08" / "dms-employee-batch"
MAP = BATCH / "CHAIN_MAP.json"


def source_data():
    return json.loads(MAP.read_text(encoding="utf-8"))


def bundle_name(name):
    # Browser wants hashed asset names without attachment-specific suffixes.
    return re.sub(r"\((?:\d{8}-\d{6}|\d+)\)(?=\.)", "", name)


class TestDmsEmployeeArchive(unittest.TestCase):
    def test_all_eight_assets_present_with_git_blob_hash(self):
        data = source_data()
        files = data["source_files"]
        self.assertEqual(len(files), 8)
        names = [item["name"] for item in files]
        self.assertEqual(len(names), len(set(names)))
        for item in files:
            with self.subTest(file=item["name"]):
                path = BATCH / item["name"]
                self.assertTrue(path.is_file(), f"Missing: {path}")
                payload = path.read_bytes()
                expected = hashlib.sha1(
                    b"blob " + str(len(payload)).encode("ascii") + b"\0" + payload
                ).hexdigest()
                self.assertEqual(expected, item["blob_sha"])
                self.assertEqual(len(payload), item["archived_bytes"])
                self.assertLessEqual(abs(item["source_bytes"] - len(payload)), 4)

    def test_html_entrypoints_are_present(self):
        data = source_data()
        shell = (BATCH / "dashboard(1).devtools").read_text(encoding="utf-8")
        self.assertIn('<div id="app"></div>', shell)
        for item in data["source_files"]:
            if item["type"] in ("webpack_js", "css"):
                suffix = "js" if item["type"] == "webpack_js" else "css"
                deployed = bundle_name(item["name"])
                self.assertIn(f"/{suffix}/{deployed}", shell)

    def test_no_absolute_urls_to_user_private_data(self):
        shell = (BATCH / "dashboard(1).devtools").read_text(encoding="utf-8")
        self.assertNotIn("def50200", shell)
        self.assertNotRegex(shell, r"(?:\+?9647\d{9}|07\d{9})")
        self.assertNotRegex(shell, r"Authorization\s*:\s*Bearer")

    def test_related_dms_chunks_present(self):
        data = source_data()
        for item in data["links"]:
            target = item["to"]
            if target.startswith("research/"):
                self.assertTrue((ROOT / target).is_file(), target)

    def test_windows_xlaunch_is_not_a_deployed_asset(self):
        data = source_data()
        xlaunch = next(f for f in data["source_files"] if f["name"].endswith(".xlaunch"))
        self.assertIn("DisableAC=True", xlaunch["warning"])
        self.assertTrue((BATCH / xlaunch["name"]).is_file())
        self.assertNotIn("config(1).xlaunch", (BATCH / "dashboard(1).devtools").read_text())


if __name__ == "__main__":
    unittest.main()
