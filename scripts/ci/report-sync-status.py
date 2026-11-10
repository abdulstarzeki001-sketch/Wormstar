#!/usr/bin/env python3
"""Report sync outcomes without presenting a skipped job as a successful sync."""
import os
import re
from pathlib import Path


def status(checkout: str, mirror: str, pr: str, url: str) -> tuple[str, str]:
    if checkout != "success":
        return ("warning", "Upstream checkout did not complete; no synchronization was performed. "
                "The source may be private, inaccessible, or unavailable; check the checkout logs.")
    if mirror != "success":
        return ("warning", "The source mirror did not complete; no review update was created. "
                "Check the preceding workflow steps.")
    if pr != "success":
        return ("warning", "The review step did not complete; the review branch or PR may not exist. "
                "Check its logs and repository Actions permissions.")
    if url:
        if not re.fullmatch(r"https://github\.com/abdulstarzeki001-sketch/Wormstar/pull/[0-9]+", url):
            return ("warning", "The review step returned an unexpected PR URL; check its logs.")
        return ("notice", "Review proposed updates: " + url)
    return ("notice", "The sync completed; the review step reported no new PR.")


def main() -> None:
    level, message = status(os.getenv("UPSTREAM_CHECKOUT_OUTCOME", ""),
                            os.getenv("MIRROR_OUTCOME", ""),
                            os.getenv("PR_OUTCOME", ""), os.getenv("PR_URL", ""))
    print(f"::{level}::{message}")
    if summary := os.getenv("GITHUB_STEP_SUMMARY"):
        with Path(summary).open("a", encoding="utf-8") as output:
            output.write("### Star Cyber Audit upstream sync\n\n" + message + "\n")


if __name__ == "__main__":
    main()
