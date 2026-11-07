#!/usr/bin/env python3
"""Star Cyber Audit: read-only public JavaScript static analyzer for iSH and Linux.

Only requests explicitly listed static JavaScript assets with GET.
No login, no WAF challenge solving, no POST, no execution of downloaded JavaScript.
"""
import argparse
import csv
import hashlib
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BASE = "https://customs-uboor.ur.gov.iq/assets/"
ASSETS = [
    "QRCheckpoints-Brs0uL0-.js",
    "QrControlScan-M6uGJnR1.js",
    "QrLocalImporter-DYzNB5Fh.js",
    "useLocalCompany-DfV5kpAj.js",
    "QRReadings-B-a3jcrk.js",
    "ExitGateView-D33Au6wp.js",
    "EntranceGateView-B9IBJo4k.js",
    "DisableDocument-AXBjrkYS.js",
    "RejectedLocalDocuments-CC07EpF_.js",
    "QRImported-C65Oqm1K.js",
    "QRHealthCertificate-Byvh35hk.js",
    "qrStore-B8bgApfd.js",
    "AchievementDocument-DEzIzJ3I.js",
    "useExitGate-BvHNutwH.js",
    "QRLocal-5TAaXbzM.js",
    "QRDocument-BJwpoEJY.js",
    "QrCodeReaderCustoms-a-UBVR7y.js",
    "ShipmentDoc-Dx885_fz.js",
    "CompanyOwnerView-CIdFF3LL.js",
    "index-gleMzSil.js",
]
MAX_SIZE = 12_000_000
MAX_FILES = 3000
SOURCE_SUFFIXES = {".js", ".mjs", ".cjs", ".html"}
SKIP_DIRS = {".git", "node_modules", ".venv", "__pycache__", "reports"}
PAT_API = re.compile(r"\b(?:local_form|support_org|BorderPort_HS|carrier_register)/[A-Za-z0-9_./{}-]+")
PAT_DMS_API = re.compile(r"(?<![A-Za-z0-9_])/api/verify/")
PAT_XHR_DMS_CALL = re.compile(r"""\.open\(\s*["\'](GET|POST|PUT|PATCH|DELETE)["\']\s*,\s*["\'](/api/verify/)""", re.I)
PAT_CALL = re.compile(r"\b(?:post|get|put|patch|delete)\s*\(\s*['\"]((?:local_form|support_org|BorderPort_HS|carrier_register)/[^'\"]+)", re.I)
PAT_IMPORT = re.compile(r"(?:\bfrom\s*|\bimport\s*\(|\bimport\s*)['\"](\./[^'\"]+)")
PAT_STORE = re.compile(r"\b(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem|clear)\s*\(\s*(?:['\"]([^'\"]{1,90})['\"]|([A-Za-z_$][\w$]{0,40}))")
PAT_PRIV = re.compile(r"(?:includes|has)\s*\(\s*['\"]([a-zA-Z0-9_]{3,80})['\"]")


def classify(data, filename=None):
    """Conservative classification; reject HTML/WAF/JSON before JS or file hints."""
    head = data[:1000].lstrip().lower()
    low = data[:10000].lower()
    looks_html = head.startswith(
        (b"<!doctype html", b"<html", b"<head", b"<?xml", b"<body")
    ) or b"<html" in head[:250]
    waf_markers = (b"huaweicloudwaf", b"wafatclconfirm",
                   b"please enable javascript and cookie")
    if looks_html and any(marker in low for marker in waf_markers):
        return "WAF_HTML_NOT_JS"
    if looks_html:
        return "HTML_NOT_JS"
    if not head:
        return "EMPTY_NOT_JS"
    if b"\x00" in data[:1024]:
        return "BINARY_NOT_JS"
    if head.startswith((b"access denied", b"forbidden", b"not found",
                        b"request blocked", b"error:", b"too many requests")):
        return "UNKNOWN_NOT_VERIFIED"
    if head.startswith((b"{", b"[")):
        return "JSON_NOT_JS"
    webpack_markers = (b"webpackjsonp", b"webpackchunk", b"__webpack_require__")
    js_markers = (b"export{", b"import{", b"function ", b"const ",
                  b"(()=>{", b"export ", b"import ")
    if any(marker in low for marker in webpack_markers) or any(
            marker in data for marker in js_markers):
        return "JS_SOURCE"
    # A .js/.mjs/.cjs suffix is a useful hint only after rejecting known non-JS.
    if filename and Path(filename).suffix.lower() in {".js", ".mjs", ".cjs"}:
        return "JS_SOURCE"
    return "UNKNOWN_NOT_VERIFIED"

def fetch_assets(names, reports):
    dest = ROOT / "downloads"
    dest.mkdir(parents=True, exist_ok=True)
    items = []
    for i, name in enumerate(names, 1):
        entry = {"file": name, "url": BASE + name, "status": "NETWORK_ERROR", "bytes": 0}
        print("[{}/{}] GET {}".format(i, len(names), name), flush=True)
        req = urllib.request.Request(entry["url"], headers={
            "User-Agent": "StarCyberAudit-PublicStatic/1.0",
            "Accept": "application/javascript, text/plain;q=0.7,*/*;q=0.5"
        }, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                payload = response.read(MAX_SIZE + 1)
                entry["code"] = response.status
                entry["content_type"] = response.headers.get("Content-Type", "")
                if len(payload) > MAX_SIZE:
                    entry["status"] = "SKIPPED_TOO_LARGE"
                else:
                    entry["status"] = classify(payload, filename=name)
                    entry["bytes"] = len(payload)
                    filename = name if entry["status"] == "JS_SOURCE" and response.status == 200 else name + ".rejected.html"
                    (dest / filename).write_bytes(payload)
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            entry["error_type"] = type(exc).__name__
        items.append(entry)
        print("  -> {} ({} bytes)".format(entry["status"], entry["bytes"]), flush=True)
        if i < len(names):
            time.sleep(0.7)
    (reports / "fetch_status.json").write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


def analyze_one(path, origin, relative_path=None):
    size = path.stat().st_size
    data = b"" if size > MAX_SIZE else path.read_bytes()
    status = "SKIPPED_TOO_LARGE" if size > MAX_SIZE else classify(data, filename=path.name)
    item = {
        "name": path.name, "relative_path": relative_path or path.name,
        "origin": origin, "classification": status,
        "bytes": size, "sha256": hashlib.sha256(data).hexdigest() if data else None,
        "api_paths": [], "api_calls": [], "imports": [], "storage": [],
        "privilege_literals": [], "flags": []
    }
    if status != "JS_SOURCE":
        return item
    source = data.decode("utf-8", "replace")
    low = source.lower()
    item["api_paths"] = sorted(set(PAT_API.findall(source)) | set(PAT_DMS_API.findall(source)))
    xhr_calls = {"{} {}".format(method.upper(), endpoint)
                 for method, endpoint in PAT_XHR_DMS_CALL.findall(source)}
    item["api_calls"] = sorted(set(PAT_CALL.findall(source)) | xhr_calls)
    item["imports"] = sorted(set(PAT_IMPORT.findall(source)))[:100]
    item["storage"] = sorted(set((m.group(1) or m.group(2)) for m in PAT_STORE.finditer(source)))
    item["privilege_literals"] = sorted(set(PAT_PRIV.findall(source)))[:100]
    flags = item["flags"]
    if "console.debug" in source and ("auth token" in low or re.search(r"console\.debug\([^)]*\.token", source)):
        flags.append("POSSIBLE_TOKEN_DEBUG_LOG: review console logging of authentication values")
    if "quickchart.io/qr" in low or "api.qrserver.com" in low:
        flags.append("THIRD_PARTY_QR_SERVICE: investigate transmission of QR/document data")
    if "qr_code||" in source and ("doc_id" in source or "doc_number" in source):
        flags.append("LOCAL_QR_FALLBACK: QR may contain an unsigned document identifier")
    if ("catch(" in source or "catch{" in source) and "fetch(" in source and re.search(r"\.post\s*\(", source):
        flags.append("REVIEW_POST_RETRY: inspect for unintended duplicate requests")
    if "localStorage.setItem" in source:
        flags.append("PERSISTENT_BROWSER_STORAGE: review sensitive data and cleanup")
    if "sessionStorage.setItem" in source:
        flags.append("TAB_SESSION_STORAGE: verify current document ID association")
    if "تم|نجح|نجاح|تم ارسال|تمت" in source:
        flags.append("MESSAGE_REGEX: textual success logic is not proof of validity")
    if 'timeZone="UTC"' in source or 'timeZone:"UTC"' in source:
        flags.append("TIMEZONE_FORMATTING: verify timezone conversions")
    return item


def write_csv(path, records):
    with path.open("w", newline="", encoding="utf-8-sig") as out:
        writer = csv.writer(out)
        writer.writerow(["name", "relative_path", "origin", "classification", "bytes", "sha256",
                         "api_count", "import_count", "storage_count", "review_flags"])
        for item in records:
            row = [item["name"], item.get("relative_path", item["name"]),
                   item["origin"], item["classification"], item["bytes"],
                   item["sha256"] or "", len(item["api_paths"]), len(item["imports"]),
                   len(item["storage"]), " | ".join(item["flags"])]
            writer.writerow(["'" + v if isinstance(v, str) and v.startswith(("=", "+", "-", "@")) else v for v in row])


def write_html(records, outfile):
    api = set(p for item in records for p in item["api_paths"])
    good = [item for item in records if item["classification"] == "JS_SOURCE"]
    flags = sum(len(item["flags"]) for item in good)
    def esc(v):
        return html.escape(str(v), quote=True)
    sections = []
    for item in records:
        status = esc(item["classification"])
        def chips(values):
            return " ".join("<code>{}</code>".format(esc(x)) for x in values[:100]) or "لا توجد"
        sections.append(
            "<details><summary>{} <small>{}</small></summary>".format(esc(item.get("relative_path", item["name"])), status) +
            "<p>المصدر: {} · {} bytes</p>".format(esc(item["origin"]), item["bytes"]) +
            "<p>SHA-256: <code>{}</code></p>".format(esc(item["sha256"] or "n/a")) +
            "<h3>API Paths</h3><div>{}</div>".format(chips(item["api_paths"])) +
            "<h3>Imports</h3><div>{}</div>".format(chips(item["imports"])) +
            "<h3>Storage</h3><div>{}</div>".format(chips(item["storage"])) +
            "<h3>Review indicators (not confirmed vulnerabilities)</h3><ul>{}</ul></details>".format(
                "".join("<li>{}</li>".format(esc(f)) for f in item["flags"]))
        )
    page = """<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Star Cyber Audit — تقرير محلي</title>
<style>
:root{font-family:system-ui;color-scheme:dark;background:#0b1120;color:#edf3ff}
body{max-width:1100px;margin:auto;padding:24px 15px}
h1{margin-bottom:2px} p{line-height:1.7;color:#aebbd1}
.stats{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}
.stats span{border:1px solid #344057;padding:15px;border-radius:14px;background:#151f31}
strong{font-size:27px;color:#95e0ca}details{background:#141f31;border:1px solid #344057;
border-radius:12px;margin:10px 0;padding:15px;overflow-wrap:anywhere}
summary{cursor:pointer;font-weight:700}summary small{float:left;font-weight:400;color:#9cc6e0}
code{direction:ltr;unicode-bidi:plaintext;display:inline-block;padding:4px 6px;margin:3px;
border-radius:5px;background:#273248;font-size:12px}h3{font-size:14px;margin-top:20px}
</style></head><body><h1>Star Cyber Audit</h1>
<p>تحليل ساكن تعليمي مستقل للملفات العامة. لا يثبت صلاحيات Backend أو صحة QR الرسمية.</p>
<div class="stats"><span><strong>GOOD</strong><br>ملفات JS</span><span><strong>API</strong><br>مسارات</span>
<span><strong>FLAGS</strong><br>مؤشرات مراجعة</span></div>SECTIONS
<p>يُنشأ التقرير محليًا. HTML تحدي WAF ليس JavaScript. لا ينفَّذ أي ملف مسترجع ولا يُرسل POST.</p>
</body></html>"""
    page = page.replace("GOOD", str(len(good))).replace("API", str(len(api))).replace("FLAGS", str(flags))
    page = page.replace("SECTIONS", "\n".join(sections))
    outfile.write_text(page, encoding="utf-8")



def iter_source_files(directory, max_files=MAX_FILES):
    """Walk locally and predictably, ignoring symlinks and common generated dirs."""
    seen = 0
    for parent, subdirs, filenames in os.walk(directory, followlinks=False):
        subdirs[:] = sorted(
            name for name in subdirs
            if name not in SKIP_DIRS and not (Path(parent) / name).is_symlink()
        )
        for filename in sorted(filenames):
            path = Path(parent) / filename
            if path.suffix.lower() not in SOURCE_SUFFIXES:
                continue
            if path.is_symlink() or not path.is_file():
                continue
            seen += 1
            if seen > max_files:
                raise ValueError("source file limit exceeded ({}): {}".format(
                    max_files, directory))
            yield path


def collect_records(directories):
    """Keep same-named files in different folders; prefer valid current downloads."""
    results = {}
    total = 0
    for directory, origin in directories:
        if not directory.is_dir():
            continue
        for path in iter_source_files(directory):
            total += 1
            if total > MAX_FILES:
                raise ValueError("total source file limit exceeded ({})".format(MAX_FILES))
            relative_path = path.relative_to(directory).as_posix()
            item = analyze_one(path, origin, relative_path=relative_path)
            previous = results.get(relative_path)
            if previous and (item["classification"] != "JS_SOURCE" or
                             (origin == "offline_snapshot" and
                              previous["origin"] == "downloaded_current")):
                continue
            results[relative_path] = item
    return list(results.values())

def main():
    parser = argparse.ArgumentParser(description="Read-only UBOOR public JavaScript static analyzer")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--fetch", action="store_true", help="GET four listed public assets")
    group.add_argument("--fetch-all", action="store_true", help="GET 20 listed public assets")
    group.add_argument("--local", metavar="DIRECTORY", help="analyze local JS/MJS/HTML only")
    options = parser.parse_args()
    reports = ROOT / "reports"
    reports.mkdir(exist_ok=True)
    if options.fetch or options.fetch_all:
        fetch_assets(ASSETS if options.fetch_all else ASSETS[:4], reports)
    if options.local:
        directory = Path(options.local).expanduser().resolve()
        if not directory.is_dir():
            parser.error("local directory is missing: " + str(directory))
        directories = [(directory, "local")]
    else:
        directories = [
            (ROOT / "offline_samples", "offline_snapshot"),
            (ROOT / "downloads", "downloaded_current"),
        ]
    try:
        records = collect_records(directories)
    except ValueError as exc:
        parser.error(str(exc))
    write_csv(reports / "inventory.csv", records)
    (reports / "analysis.json").write_text(json.dumps(
        {"generated_utc": datetime.now(timezone.utc).isoformat(),
         "static_read_only": True, "files": records}, ensure_ascii=False, indent=2), encoding="utf-8")
    with (reports / "api_paths.txt").open("w", encoding="utf-8") as out:
        for item in records:
            for endpoint in item["api_paths"]:
                out.write("{}\t{}\n".format(item.get("relative_path", item["name"]), endpoint))
    with (reports / "review_flags.txt").open("w", encoding="utf-8") as out:
        for item in records:
            for flag in item["flags"]:
                out.write("{}\t{}\n".format(item.get("relative_path", item["name"]), flag))
    write_html(records, reports / "report.html")
    print("Star Cyber Audit complete")
    print("JavaScript analyzed: {} / {} total files".format(
        sum(x["classification"] == "JS_SOURCE" for x in records), len(records)))
    print("مسارات API مختلفة: {}".format(len(set(
        e for item in records for e in item["api_paths"]))))
    print("Saved reports:", str(reports))
    return 0 if records else 2


if __name__ == "__main__":
    sys.exit(main())
