#!/usr/bin/env python3
"""STAR OSINT: source-traceable, local-first domain asset inventory.

'import' never opens network connections. 'collect' runs only fixed, passive
tool commands after an explicit authorized-scope check.
"""
import argparse
import csv
import hashlib
import html
import json
import re
import shutil
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

MAX_FILE_BYTES = 6_000_000
MAX_RECORDS_PER_FILE = 40_000
DOMAIN_LABEL = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def domain(value):
    if not isinstance(value, str):
        raise ValueError("domain must be a string")
    name = value.strip().rstrip(".").lower()
    if name.startswith("*.") or any(c in name for c in "/\\:@ \t\r\n"):
        raise ValueError("invalid hostname")
    try:
        name = name.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise ValueError("invalid hostname encoding") from exc
    labels = name.split(".")
    if len(name) > 253 or len(labels) < 2 or any(
        len(x) > 63 or not DOMAIN_LABEL.fullmatch(x) for x in labels
    ):
        raise ValueError("invalid hostname")
    return name


def in_scope(hostname, target):
    return hostname == target or hostname.endswith("." + target)


def authorize(target, scope_file):
    scope_path = Path(scope_file)
    if not scope_path.is_file() or scope_path.is_symlink():
        raise ValueError("authorized scope file missing")
    data = json.loads(scope_path.read_text(encoding="utf-8"))
    entries = data.get("authorized_domains")
    if not isinstance(entries, list) or not entries:
        raise ValueError("authorized_domains must be a nonempty list")
    return any(domain(entry) == target for entry in entries)


def bounded_lines(path):
    if not path.is_file() or path.is_symlink():
        return
    if path.stat().st_size > MAX_FILE_BYTES:
        raise ValueError("input is too large: " + path.name)
    with path.open("r", encoding="utf-8", errors="replace") as stream:
        for index, line in enumerate(stream):
            if index >= MAX_RECORDS_PER_FILE:
                raise ValueError("too many records: " + path.name)
            yield line.rstrip("\r\n")


def normalize_host(raw, target):
    try:
        hostname = domain(raw)
    except ValueError:
        return None
    return hostname if in_scope(hostname, target) else None


def observations(target, input_dir):
    """Yield (hostname, evidence source). Ignore emails, IPs and off-scope data."""
    names = (
        ("subfinder.txt", "subfinder"),
        ("amass.txt", "amass"),
        ("ct-names.txt", "certificate-transparency"),
    )
    for filename, source in names:
        for line in bounded_lines(input_dir / filename):
            name = normalize_host(line, target)
            if name:
                yield (name, source)
    for filename, source in (
        ("subfinder-evidence.jsonl", "subfinder"),
        ("harvester.jsonl", "theHarvester"),
    ):
        for line in bounded_lines(input_dir / filename):
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not isinstance(item, dict):
                continue
            if source == "theHarvester" and str(item.get("type", "")).lower() not in (
                "host", "hostname", "domain", "subdomain"
            ):
                continue
            value = item.get("host") if source == "subfinder" else item.get("value")
            if value is None and source == "theHarvester":
                value = item.get("host")
            if not isinstance(value, str):
                continue
            for candidate in value.splitlines():
                name = normalize_host(candidate, target)
                if name:
                    sub_sources = item.get("sources") if source == "subfinder" else None
                    if isinstance(sub_sources, list) and sub_sources:
                        for src in sub_sources[:25]:
                            if isinstance(src, str) and re.fullmatch(r"[a-zA-Z0-9_.-]{1,50}", src):
                                yield (name, "subfinder/" + src)
                    else:
                        yield (name, source)


def build_report(target, input_dir):
    evidence = sorted(set(observations(target, input_dir)))
    by_name = {}
    for hostname, source in evidence:
        by_name.setdefault(hostname, set()).add(source)
    now = utc_now()
    return {
        "schema": "star-osint-report/v1",
        "target": target,
        "generated_at_utc": now,
        "collection_type": "passive_import",
        "verified_live": False,
        "summary": {"assets": len(by_name), "source_observations": len(evidence)},
        "assets": [
            {"hostname": name, "sources": sorted(sources),
             "status": "passive_candidate", "observed_at_utc": now}
            for name, sources in sorted(by_name.items())
        ],
    }, evidence


def save_database(db_path, report, evidence):
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(str(db_path)) as connection:
        connection.execute("""CREATE TABLE IF NOT EXISTS runs (
            id INTEGER PRIMARY KEY, target TEXT NOT NULL, observed_at TEXT NOT NULL,
            sha256 TEXT NOT NULL)""")
        connection.execute("""CREATE TABLE IF NOT EXISTS observations (
            run_id INTEGER NOT NULL, hostname TEXT NOT NULL, source TEXT NOT NULL,
            PRIMARY KEY (run_id, hostname, source),
            FOREIGN KEY(run_id) REFERENCES runs(id))""")
        serialized = json.dumps(report, ensure_ascii=False, sort_keys=True).encode("utf-8")
        cur = connection.execute(
            "INSERT INTO runs(target, observed_at, sha256) VALUES(?,?,?)",
            (report["target"], report["generated_at_utc"], hashlib.sha256(serialized).hexdigest()),
        )
        connection.executemany(
            "INSERT INTO observations(run_id, hostname, source) VALUES(?,?,?)",
            ((cur.lastrowid, host, src) for host, src in evidence),
        )


def save_report(output_dir, report):
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    with (output_dir / "assets.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["hostname", "sources", "status", "observed_at_utc"])
        for item in report["assets"]:
            writer.writerow([item["hostname"], ", ".join(item["sources"]),
                             item["status"], item["observed_at_utc"]])
    cards = []
    for item in report["assets"]:
        hostname = html.escape(item["hostname"], quote=True)
        sources = html.escape(", ".join(item["sources"]), quote=True)
        cards.append(f"<tr><td dir='ltr'>{hostname}</td><td>{sources}</td><td>مرشح سلبي</td></tr>")
    page = """<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>STAR CYBER LAB — OSINT</title><style>
body{font-family:system-ui;background:#0b1222;color:#e6edf8;margin:2rem auto;max-width:1100px;padding:1rem}
h1{color:#8bdccd}table{width:100%;border-collapse:collapse}td,th{padding:12px;border-bottom:1px solid #31405a;text-align:right}
th{color:#a9bfd9}td{overflow-wrap:anywhere}p{color:#bbc9d9}
</style></head><body><h1>STAR CYBER LAB — OSINT</h1>
<p>النطاق: TARGET · الأصول المرشحة: COUNT · تاريخ الرصد: DATE</p>
<p>نتائج من مصادر عامة. لا تثبت تشغيل الخدمات أو ملكيتها أو وجود ثغرات.</p>
<table><thead><tr><th>المضيف</th><th>المصادر</th><th>الحالة</th></tr></thead><tbody>ROWS</tbody></table></body></html>"""
    page = (page.replace("TARGET", html.escape(report["target"], quote=True))
                .replace("COUNT", str(report["summary"]["assets"]))
                .replace("DATE", html.escape(report["generated_at_utc"], quote=True))
                .replace("ROWS", "\n".join(cards)))
    (output_dir / "report.html").write_text(page, encoding="utf-8")
    report_file = output_dir / "report.json"
    (output_dir / "SHA256SUMS.txt").write_text(
        hashlib.sha256(report_file.read_bytes()).hexdigest() + "  report.json\n", encoding="ascii"
    )


def import_run(target, input_dir, output_dir):
    if not input_dir.is_dir():
        raise ValueError("input directory not found")
    report, evidence = build_report(target, input_dir)
    save_report(output_dir, report)
    save_database(output_dir / "osint.sqlite3", report, evidence)
    return report


def collect(target, scope_file, output_dir):
    if not authorize(target, scope_file):
        raise ValueError("domain is not in explicitly authorized scope")
    raw = output_dir / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    fixed_commands = {
        "subfinder": ["subfinder", "-d", target, "-silent", "-o", str(raw / "subfinder.txt")],
        "amass": ["amass", "enum", "-passive", "-d", target, "-o", str(raw / "amass.txt")],
        "theHarvester": ["theHarvester", "-d", target, "-b", "crtsh",
                         "-f", str(raw / "harvester")],
    }
    results = []
    for name, argv in fixed_commands.items():
        if not shutil.which(argv[0]):
            results.append({"tool": name, "status": "not_installed"})
            continue
        try:
            result = subprocess.run(
                argv, cwd=str(raw), stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL, timeout=150, check=False
            )
            results.append({"tool": name, "status": "ok" if result.returncode == 0 else "failed"})
        except subprocess.TimeoutExpired:
            results.append({"tool": name, "status": "timeout"})
        except OSError:
            results.append({"tool": name, "status": "execution_error"})
    report = import_run(target, raw, output_dir)
    (output_dir / "tool-status.json").write_text(
        json.dumps(results, indent=2) + "\n", encoding="utf-8"
    )
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description="STAR CYBER LAB local-first OSINT engine")
    commands = parser.add_subparsers(dest="mode", required=True)
    for name in ("import", "collect"):
        sub = commands.add_parser(name)
        sub.add_argument("--target", required=True)
        sub.add_argument("--out", type=Path, default=Path("./reports/star-osint"))
        if name == "import":
            sub.add_argument("--input-dir", type=Path, required=True)
        else:
            sub.add_argument("--scope-file", type=Path, required=True)
            sub.add_argument("--ack-authorization", action="store_true")
    args = parser.parse_args(argv)
    try:
        target = domain(args.target)
        if args.mode == "collect":
            if not args.ack_authorization:
                parser.error("collect requires --ack-authorization and an authorized scope file")
            report = collect(target, args.scope_file, args.out.expanduser().resolve())
        else:
            report = import_run(target, args.input_dir.expanduser().resolve(),
                                args.out.expanduser().resolve())
    except (ValueError, OSError, json.JSONDecodeError, sqlite3.Error) as exc:
        parser.error(str(exc))
    print(json.dumps({"target": target, "assets": report["summary"]["assets"],
                      "report": str(args.out / "report.json")}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
