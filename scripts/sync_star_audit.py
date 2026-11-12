#!/usr/bin/env python3
"""Stage an explicitly approved Star-Cyber-Audit-iSH export into Wormstar.

The scheduled GitHub workflow opens a review PR. It NEVER executes the upstream
repository, deploys it or publishes raw research/OneDrive snapshots. No third-
party dependency is used and all paths come from git ls-files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path, PurePosixPath

UPSTREAM_REPOSITORY = "abdulstarzeki001-sketch/Star-Cyber-Audit-iSH"
TARGET = Path("integrations/star-cyber-audit-ish/upstream")
INVENTORY = Path("integrations/star-cyber-audit-ish/SOURCE_INVENTORY.json")
EXPLICIT_FILES = {
    ".gitignore", "MANIFEST.txt", "README.md", "README_AR.md",
    "README_GITHUB_UPLOAD.md", "UBOOR_FLOW_NOTES_AR.md",
    "analyze.py", "run.sh", "site/worker.js", "site/sample-data.json",
}
ACTIVE_PREFIXES = ("docs/", "tests/", "tools/ish/")
MAX_SAFE_BYTES = 350_000
DENY_PATH_PREFIXES = ("research/", "reviews/", ".github/")
DENY_CONTENT = [
    re.compile(rb"-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----"),
    re.compile(rb"(?i)\bauthorization\s*:\s*bearer\s+[A-Za-z0-9._-]{20,}"),
    re.compile(rb"(?i)\bdef50200[a-f0-9]{64,}\b"),
    re.compile(rb"(?i)\b(?:sk-proj|github_pat|ghp_)[A-Za-z0-9_-]{24,}"),
    re.compile(rb"(?i)\b(?:api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*[\"'][A-Za-z0-9._/-]{20,}"),
]


def git(source: Path, *args: str) -> bytes:
    return subprocess.check_output(["git", "-C", str(source), *args])


def candidate(path: str) -> bool:
    if path in EXPLICIT_FILES:
        return True
    return path.startswith(ACTIVE_PREFIXES) and not path.startswith(DENY_PATH_PREFIXES)


def local_file(source: Path, path: str) -> Path | None:
    """Resolve only regular files under source, without traversing symlinks."""
    raw = PurePosixPath(path)
    if raw.is_absolute() or ".." in raw.parts or not raw.parts:
        return None
    current = source
    for part in raw.parts:
        current = current / part
        if current.is_symlink():
            return None
    try:
        resolved = current.resolve(strict=True)
    except (OSError, RuntimeError):
        return None
    if not resolved.is_relative_to(source) or not resolved.is_file():
        return None
    return resolved


def indexed_files(source: Path) -> list[tuple[str, str, str, int | None]]:
    """Read paths and blob hashes from the Git index without opening source files."""
    records = []
    for entry in git(source, "ls-files", "--stage", "-z").split(b"\x00"):
        if not entry:
            continue
        metadata, separator, name = entry.partition(b"\t")
        fields = metadata.decode("ascii").split()
        if not separator or len(fields) != 3 or fields[2] != "0":
            raise ValueError("Source has unresolved index entries")
        mode, sha, _stage = fields
        if not re.fullmatch(r"[a-f0-9]{40,64}", sha):
            raise ValueError("Invalid source blob identifier")
        records.append((name.decode("utf-8"), mode, sha))
    blobs = sorted({sha for _name, mode, sha in records if mode in {"100644", "100755"}})
    sizes = {}
    if blobs:
        result = subprocess.run(
            ["git", "-C", str(source), "cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
            input=("\n".join(blobs) + "\n").encode("ascii"), capture_output=True, check=True,
        )
        for line in result.stdout.decode("ascii").splitlines():
            fields = line.split()
            if len(fields) != 3 or fields[1] != "blob" or not fields[2].isdigit():
                raise ValueError("Unable to determine a Git blob size")
            sizes[fields[0]] = int(fields[2])
        if len(sizes) != len(blobs):
            raise ValueError("Missing source Git blob metadata")
    return sorted((name, mode, sha, sizes.get(sha)) for name, mode, sha in records)


def output_file(destination: Path, name: str) -> Path:
    """Create mirror directories without following links out of the mirror."""
    if destination.is_symlink():
        raise ValueError("Mirror destination must not be a symbolic link")
    relative = PurePosixPath(name)
    if relative.is_absolute() or ".." in relative.parts or not relative.parts:
        raise ValueError("Unsafe mirror path")
    current = destination
    for part in relative.parts[:-1]:
        current = current / part
        if current.is_symlink():
            raise ValueError("Mirror path contains a symbolic link")
        current.mkdir(parents=True, exist_ok=True)
    output = current / relative.parts[-1]
    if output.is_symlink():
        raise ValueError("Mirror file must not be a symbolic link")
    return output


def classify(source: Path, path: str) -> tuple[bool, str, bytes | None]:
    raw = PurePosixPath(path)
    if raw.is_absolute() or ".." in raw.parts or any(p == "" for p in raw.parts):
        return False, "unsafe_path", None
    if path.startswith(DENY_PATH_PREFIXES):
        return False, "restricted_research_or_external_archive", None
    if not candidate(path):
        return False, "metadata_only", None
    disk = local_file(source, path)
    if disk is None:
        return False, "unsafe_link_or_missing_file", None
    if disk.stat().st_size > MAX_SAFE_BYTES:
        return False, "size_limit", None
    data = disk.read_bytes()
    if b"\x00" in data:
        return False, "binary_content", None
    for regex in DENY_CONTENT:
        if regex.search(data):
            return False, "possible_sensitive_content", None
    try:
        data.decode("utf-8")
    except UnicodeDecodeError:
        return False, "not_utf8", None
    return True, "safe_source_snapshot", data


def sync(source: Path, destination: Path, manifest: Path) -> dict:
    source = source.resolve(strict=True)
    if not (source / ".git").exists():
        raise ValueError("Source must be a checked-out git repository")
    if destination.is_symlink() or manifest.is_symlink():
        raise ValueError("Mirror and inventory paths must not be symbolic links")
    mirror = destination.resolve()
    inventory = manifest.resolve()
    if mirror == source or mirror.is_relative_to(source) or source.is_relative_to(mirror):
        raise ValueError("Source and mirror paths must not overlap")
    if inventory.is_relative_to(source):
        raise ValueError("Inventory must not overwrite a source file")
    commit = git(source, "rev-parse", "HEAD").decode("ascii").strip()
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        raise ValueError("Invalid source commit")
    if git(source, "status", "--porcelain=v1", "-z", "--untracked-files=no"):
        raise ValueError("Source has uncommitted tracked changes; refusing an inaccurate snapshot")
    entries = indexed_files(source)
    if len(entries) > 3000:
        raise ValueError("Unexpected upstream file count; refuse automated copy")
    rows = []
    synced = set()
    for name, mode, sha, file_size in entries:
        allowed, status, data = classify(source, name) if mode in {"100644", "100755"} else (False, "non_regular_git_entry", None)
        row = {"path": name, "bytes": file_size, "source_git_blob": None,
               "classification": "copied_source" if allowed else "metadata_only",
               "reason": status}
        # Index identifiers do not require reading links or large restricted files.
        if mode in {"100644", "100755", "120000"}:
            row["source_git_blob"] = sha
        rows.append(row)
        if allowed:
            algorithm = "sha256" if len(sha) == 64 else "sha1"
            digest = hashlib.new(algorithm, b"blob " + str(len(data)).encode() + b"\x00" + data).hexdigest()
            if digest != sha:
                raise ValueError("Source file differs from its Git index; refusing an inaccurate snapshot")
            output = output_file(destination, name)
            output.parent.mkdir(parents=True, exist_ok=True)
            if not output.is_file() or output.read_bytes() != data:
                output.write_bytes(data)
            synced.add(output.relative_to(destination).as_posix())
    if destination.is_dir():
        for existing in sorted(destination.rglob("*"), reverse=True):
            if existing.is_file() and existing.relative_to(destination).as_posix() not in synced:
                existing.unlink()
            if existing.is_dir() and not any(existing.iterdir()):
                existing.rmdir()
    report = {
        "schema_version": 1,
        "source_repository": UPSTREAM_REPOSITORY,
        "source_commit": commit,
        "total_source_files": len(rows),
        "copied_files": sum(r["classification"] == "copied_source" for r in rows),
        "metadata_only_files": sum(r["classification"] == "metadata_only" for r in rows),
        "warning": "Only allowlisted text is copied; secret patterns are not exhaustive. File paths and blob hashes are included. Review before any public export.",
        "files": rows,
    }
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--destination", default=str(TARGET), type=Path)
    parser.add_argument("--inventory", default=str(INVENTORY), type=Path)
    arguments = parser.parse_args()
    result = sync(arguments.source, arguments.destination, arguments.inventory)
    print(json.dumps({k: result[k] for k in (
        "source_repository", "source_commit", "total_source_files",
        "copied_files", "metadata_only_files")}, ensure_ascii=False))
