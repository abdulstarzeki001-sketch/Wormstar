"""Offline tests: deterministic public-file snapshot and sensitive-content exclusions."""
import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "scripts" / "sync_star_audit.py"
spec = importlib.util.spec_from_file_location("safe_upstream", MODULE)
sync_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync_module)


class SyncStarAuditTests(unittest.TestCase):
    def setup_repo(self, base):
        source = base / "source"
        source.mkdir()
        subprocess.run(["git", "init", "-q", str(source)], check=True)
        files = {
            "README.md": "# Original iSH lab\n",
            "analyze.py": "print('static only')\n",
            "tools/ish/help.sh": "#!/bin/sh\necho 'test'\n",
            "docs/private.md": "Authorization: Bearer " + "x" * 40 + "\n",
            "research/raw-uploads/2026/private.js": "const QR='def50200" + "f" * 80 + "';\n",
            "reviews/2026/report.md": "Unreviewed external report\n",
            "private.txt": "some private content that is not allowlisted\n",
        }
        for name, data in files.items():
            p = source / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(data, encoding="utf-8")
        subprocess.run(["git", "-C", str(source), "add", "."], check=True)
        subprocess.run(["git", "-C", str(source), "-c", "user.name=Tester",
                        "-c", "user.email=test@example.invalid", "commit", "-qm", "snapshot"], check=True)
        return source

    def test_keeps_safe_tools_and_inventory_but_not_sensitive_material(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            source = self.setup_repo(base)
            dest = base / "copy"
            inventory = base / "inventory.json"
            info = sync_module.sync(source, dest, inventory)
            self.assertEqual(info["total_source_files"], 7)
            self.assertEqual(info["copied_files"], 3)
            self.assertTrue((dest / "README.md").is_file())
            self.assertTrue((dest / "tools/ish/help.sh").is_file())
            for restricted in ["docs/private.md", "reviews/2026/report.md",
                               "research/raw-uploads/2026/private.js", "private.txt"]:
                self.assertFalse((dest / restricted).exists())
            rows = json.loads(inventory.read_text())["files"]
            self.assertEqual(len(rows), 7)
            self.assertTrue(all(r["source_git_blob"] for r in rows))
            original = inventory.read_bytes()
            sync_module.sync(source, dest, inventory)
            self.assertEqual(inventory.read_bytes(), original, "Repeated sync must be deterministic")

    def test_removes_only_stale_mirrored_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            source = self.setup_repo(base)
            dest = base / "mirror"
            inventory = base / "SOURCE_INVENTORY.json"
            sync_module.sync(source, dest, inventory)
            (source / "README.md").unlink()
            subprocess.run(["git", "-C", str(source), "rm", "-q", "README.md"], check=True)
            subprocess.run(["git", "-C", str(source), "-c", "user.name=Tester",
                            "-c", "user.email=test@example.invalid", "commit", "-qm", "delete"], check=True)
            sync_module.sync(source, dest, inventory)
            self.assertFalse((dest / "README.md").exists())
            self.assertTrue((dest / "analyze.py").exists())


if __name__ == "__main__":
    unittest.main()
