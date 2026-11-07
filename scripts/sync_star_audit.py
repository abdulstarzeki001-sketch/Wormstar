#!/usr/bin/env python3
"""Safely stage public Star-Cyber-Audit-iSH source into Wormstar.

The scheduled GitHub workflow opens a review PR. It NEVER executes the upstream
repository, deploys it or publishes raw research/OneDrive snapshots. No third-
party dependency is used and all paths come from git ls-files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
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


def classify(source: Path, path: str) -> tuple[bool, str, bytes | None]:
    raw = PurePosixPath(path)
    if raw.is_absolute() or ".." in raw.parts or any(p == "" for p in raw.parts):
        return False, "unsafe_path", None
    if path.startswith(DENY_PATH_PREFIXES):
        return False, "restricted_research_or_external_archive", None
    if not candidate(path):
        return False, "metadata_only", None
    disk = source.joinpath(*raw.parts)
    if disk.is_symlink() or not disk.is_file() or not disk.resolve().is_relative_to(source.resolve()):
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
    commit = git(source, "rev-parse", "HEAD").decode("ascii").strip()
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        raise ValueError("Invalid source commit")
    names = sorted(set(p.decode("utf-8") for p in git(source, "ls-files", "-z").split(b"\x00") if p))
    if len(names) > 3000:
        raise ValueError("Unexpected upstream file count; refuse automated copy")
    rows = []
    synced = set()
    for name in names:
        allowed, status, data = classify(source, name)
        path = source.joinpath(*PurePosixPath(name).parts)
        file_size = path.stat().st_size if path.is_file() else None
        row = {"path": name, "bytes": file_size, "source_git_blob": None,
               "classification": "copied_source" if allowed else "metadata_only",
               "reason": status}
        # A blob hash verifies provenance without copying restricted contents.
        if path.is_file():
            row["source_git_blob"] = hashlib.sha1(
                b"blob " + str(file_size).encode() + b"\x00" + path.read_bytes()
            ).hexdigest()
        rows.append(row)
        if allowed:
            output = destination.joinpath(*PurePosixPath(name).parts)
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
        "warning": "Research, OneDrive exports, archived third-party JS, captured QR tokens and raw reports are not copied into the public app. Original user files must stay private.",
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
