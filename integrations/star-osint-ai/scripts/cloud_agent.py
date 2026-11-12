#!/usr/bin/env python3
"""Outbound-only STAR OSINT agent for an owner-controlled Kali host.

This process polls an authenticated Cloudflare D1 queue over HTTPS.
It never opens a listening port, runs arbitrary commands, or accepts URLs.
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import httpx
from dotenv import load_dotenv
from app.collectors import COLLECTORS, canonical_domain, run_scan
from app.db import SCHEMA, connect, utcnow
from app.ai import analyze_local

CONFIG = Path.home() / ".config" / "wormstar" / "osint-agent.env"
DEFAULT_CORE = "https://wormstar-ai-lab.abdulstarzeki001.workers.dev"
PUBLIC_CORE_HOST = "wormstar-ai-lab.abdulstarzeki001.workers.dev"


def core_origin(value: str) -> str:
    """Pin the owner's Cloudflare Core endpoint, never an arbitrary URL."""
    parts = urlsplit(value)
    if (parts.scheme != "https" or parts.hostname != PUBLIC_CORE_HOST or
            parts.port is not None or parts.username or parts.password or
            parts.query or parts.fragment or parts.path not in ("", "/")):
        raise ValueError("OSINT_CORE_ORIGIN must be the pinned owner HTTPS Core origin")
    return f"https://{PUBLIC_CORE_HOST}"


def domain_permitted(value: str, allowlist: str) -> bool:
    try:
        domain = canonical_domain(value)
    except (ValueError, TypeError):
        return False
    if domain != value or not allowlist.strip():
        return False
    for item in allowlist.lower().split(","):
        entry = item.strip()
        if not entry:
            continue
        if entry == domain:
            return True
        if entry.startswith("*."):
            try:
                base = canonical_domain(entry[2:])
            except ValueError:
                continue
            if base == entry[2:] and domain.endswith("." + base) and domain != base:
                return True
    return False


def run_local(job: dict, allowlist: str) -> dict:
    """Only the five hard-coded passive collectors can be executed."""
    domain = job.get("domain")
    requested = job.get("collectors")
    if not isinstance(domain, str) or not domain_permitted(domain, allowlist):
        return {"status": "failed", "error": "Domain not in Kali allowlist",
                "result": {"status": "failed", "count": 0, "findings": [], "sources": []}}
    if (not isinstance(requested, list) or not 1 <= len(requested) <= 5 or
            len(set(requested)) != len(requested) or
            any(not isinstance(x, str) or x not in COLLECTORS for x in requested)):
        return {"status": "failed", "error": "Invalid collector selection",
                "result": {"status": "failed", "count": 0, "findings": [], "sources": []}}

    # Create missing tables, but do not mark other running FastAPI scans as failed.
    with connect() as db:
        db.executescript(SCHEMA)
        db.execute(
            """INSERT OR IGNORE INTO projects(domain,label,authorized,created_at)
               VALUES (?,?,1,?)""",
            (domain, "Wormstar remote OSINT · " + domain, utcnow()))
        project = db.execute("SELECT id FROM projects WHERE domain=?", (domain,)).fetchone()
        cursor = db.execute(
            """INSERT INTO scans(project_id,status,created_at,options_json)
               VALUES (?,'queued',?,?)""",
            (project["id"], utcnow(), json.dumps(requested)))
        scan_id = cursor.lastrowid

    run_scan(scan_id, domain, requested)

    summary = None
    if job.get("analyze") is True:
        with connect() as db:
            db.execute(
                """INSERT OR IGNORE INTO reports(scan_id,status,created_at,updated_at)
                   VALUES (?,'queued',?,?)""",
                (scan_id, utcnow(), utcnow()))
        analyze_local(scan_id)  # Only calls local Ollama 127.0.0.1:11434.

    with connect() as db:
        scan = db.execute("SELECT status,error FROM scans WHERE id=?", (scan_id,)).fetchone()
        rows = db.execute(
            """SELECT kind,value,source,confidence FROM findings
               WHERE scan_id=? ORDER BY id LIMIT 100""", (scan_id,)).fetchall()
        count = db.execute(
            "SELECT COUNT(*) FROM findings WHERE scan_id=?", (scan_id,)).fetchone()[0]
        sources = db.execute(
            "SELECT source,status,findings FROM scan_sources WHERE scan_id=? ORDER BY id",
            (scan_id,)).fetchall()
        if job.get("analyze") is True:
            report = db.execute(
                "SELECT status,summary_json FROM reports WHERE scan_id=?", (scan_id,)).fetchone()
            if report and report["status"] == "done":
                summary = json.loads(report["summary_json"])
    return {
        "status": scan["status"],
        "error": str(scan["error"] or "")[:160],
        "result": {
            "status": scan["status"], "local_scan_id": scan_id,
            "count": count, "findings": [dict(x) for x in rows],
            "sources": [dict(x) for x in sources], "summary": summary,
        }
    }


def poll_once(client: httpx.Client, origin: str, allowlist: str) -> bool:
    response = client.post(origin + "/api/osint/agent/claim")
    if response.status_code == 204:
        return False
    response.raise_for_status()
    job = response.json()["job"]
    claim_id = job["claim_id"]
    job_id = job["id"]
    try:
        outcome = run_local(job, allowlist)
    except Exception as exc:
        outcome = {
            "status": "failed",
            "error": type(exc).__name__[:90],
            "result": {"status": "failed", "count": 0, "findings": [], "sources": []}
        }
    outcome["claim_id"] = claim_id

    # A network interruption after execution must not cause local re-execution.
    for attempt in range(3):
        try:
            sent = client.post(
                origin + "/api/osint/agent/" + job_id + "/complete", json=outcome)
            sent.raise_for_status()
            print("Job completed:", job_id, outcome["status"], flush=True)
            return True
        except (httpx.RequestError, httpx.HTTPStatusError):
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="STAR OSINT outbound-only Kali agent")
    parser.add_argument("--once", action="store_true", help="Poll one time and exit")
    args = parser.parse_args()
    load_dotenv(CONFIG)
    token = os.getenv("OSINT_AGENT_TOKEN", "")
    allowlist = os.getenv("OSINT_ALLOWED_DOMAINS", "")
    if len(token) < 32:
        raise SystemExit("Missing OSINT_AGENT_TOKEN (32+ chars) in " + str(CONFIG))
    if not allowlist.strip():
        raise SystemExit("OSINT_ALLOWED_DOMAINS required: use exact authorized domains")
    origin = core_origin(os.getenv("OSINT_CORE_ORIGIN", DEFAULT_CORE))
    print("Connected to pinned Wormstar Core. Passive OSINT only.", flush=True)
    with httpx.Client(timeout=httpx.Timeout(25, connect=8), follow_redirects=False,
                      trust_env=False, headers={"Authorization": "Bearer " + token}) as client:
        while True:
            try:
                received = poll_once(client, origin, allowlist)
                if args.once:
                    return 0
                if not received:
                    time.sleep(8)
            except (httpx.RequestError, httpx.HTTPStatusError) as exc:
                # Do not print tokens or request headers.
                print("Core unavailable:", type(exc).__name__, flush=True)
                if args.once:
                    return 1
                time.sleep(15)
    return 0


if __name__ == "__main__":
    sys.exit(main())
