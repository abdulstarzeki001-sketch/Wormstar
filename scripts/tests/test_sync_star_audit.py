"""Offline tests: deterministic public-file snapshot and sensitive-content exclusions."""
import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

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

    def test_untrusted_symlinks_and_large_files_are_never_opened(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            source = self.setup_repo(base)
            outside = base / "outside.txt"
            outside.write_text("PRIVATE_OUTSIDE_CONTENT")
            link = source / "docs" / "external.md"
            try:
                link.symlink_to(outside)
            except (OSError, NotImplementedError):
                self.skipTest("symlinks unavailable")
            large = source / "docs" / "large.md"
            large.write_bytes(b"x" * (sync_module.MAX_SAFE_BYTES + 1))
            subprocess.run(["git", "-C", str(source), "add", "docs/external.md", "docs/large.md"], check=True)
            subprocess.run(["git", "-C", str(source), "-c", "user.name=Tester", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixtures"], check=True)
            original_read = Path.read_bytes
            def guarded_read(path):
                if path in (link, large, outside):
                    raise AssertionError("Untrusted link or large file was read")
                return original_read(path)
            with patch.object(Path, "read_bytes", guarded_read):
                info = sync_module.sync(source, base / "mirror", base / "inventory.json")
            rows = {row["path"]: row for row in info["files"]}
            self.assertEqual(rows["docs/external.md"]["reason"], "non_regular_git_entry")
            self.assertIsNone(rows["docs/external.md"]["bytes"])
            self.assertEqual(rows["docs/large.md"]["reason"], "size_limit")
            self.assertEqual(rows["docs/large.md"]["bytes"], sync_module.MAX_SAFE_BYTES + 1)
            self.assertTrue(rows["docs/large.md"]["source_git_blob"])

    def test_dirty_source_is_rejected_before_creating_a_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            source = self.setup_repo(base)
            (source / "README.md").write_text("changed after commit")
            with self.assertRaisesRegex(ValueError, "uncommitted"):
                sync_module.sync(source, base / "mirror", base / "inventory.json")
            self.assertFalse((base / "inventory.json").exists())

    def test_index_hidden_modification_cannot_be_published(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            source = self.setup_repo(base)
            subprocess.run(["git", "-C", str(source), "update-index", "--assume-unchanged", "README.md"], check=True)
            (source / "README.md").write_text("modified after the snapshot")
            with self.assertRaisesRegex(ValueError, "differs from its Git index"):
                sync_module.sync(source, base / "mirror", base / "inventory.json")
            self.assertFalse((base / "inventory.json").exists())

    def test_overlapping_source_or_inventory_paths_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            source = self.setup_repo(base)
            original = (source / "README.md").read_text()
            for destination in (source, source / "subdir", base):
                with self.assertRaisesRegex(ValueError, "must not overlap"):
                    sync_module.sync(source, destination, base / "inventory.json")
            with self.assertRaisesRegex(ValueError, "must not overwrite"):
                sync_module.sync(source, base / "mirror", source / "README.md")
            self.assertEqual((source / "README.md").read_text(), original)

    def test_mirror_directory_symlink_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            source = self.setup_repo(base)
            (source / "docs" / "safe.md").write_text("safe fixture")
            subprocess.run(["git", "-C", str(source), "add", "docs/safe.md"], check=True)
            subprocess.run(["git", "-C", str(source), "-c", "user.name=Tester", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture"], check=True)
            destination, outside = base / "mirror", base / "outside"
            destination.mkdir(); outside.mkdir()
            try:
                (destination / "docs").symlink_to(outside, target_is_directory=True)
            except (OSError, NotImplementedError):
                self.skipTest("symlinks unavailable")
            with self.assertRaisesRegex(ValueError, "symbolic link"):
                sync_module.sync(source, destination, base / "inventory.json")
            self.assertFalse((outside / "safe.md").exists())


if __name__ == "__main__":
    unittest.main()
