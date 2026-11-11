#!/usr/bin/env python3
"""Fail closed before exporting content from a private repo to a public branch."""
import os
import sys


def validate(export_approved: str, read_token: str) -> str | None:
    if export_approved.strip().lower() != "true":
        return ("Public export is disabled. A public review branch can expose selected "
                "private source files, paths and hashes; enable it only after owner approval.")
    if not read_token.strip():
        return ("Private-source read token is not configured. Add the read-only "
                "STAR_AUDIT_READ_TOKEN Actions secret; do not print or commit it.")
    return None


def main() -> int:
    error = validate(os.getenv("SYNC_PUBLIC_EXPORT_APPROVED", ""), os.getenv("SYNC_READ_TOKEN", ""))
    if error:
        print("::error::" + error, file=sys.stderr)
        return 1
    print("Private-source sync prerequisites are configured.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
