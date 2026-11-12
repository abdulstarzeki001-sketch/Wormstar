#!/usr/bin/env python3
"""Offline infrastructure correlation for STAR OSINT outputs; never makes requests."""
import argparse
import ipaddress
import json
from pathlib import Path
from urllib.parse import urlsplit

from engine import bounded_lines, domain, in_scope, utc_now


def safe_hostname(value, target):
    try:
        result = domain(value)
        return result if in_scope(result, target) else None
    except ValueError:
        return None


def public_ip(value):
    if not isinstance(value, str):
        return None
    try:
        parsed = ipaddress.ip_address(value)
        return str(parsed) if parsed.is_global else None
    except ValueError:
        return None


def string_values(value):
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [v for v in value if isinstance(v, str)][:100]
    return []


def read_jsonl(path):
    if not path:
        return
    for line in bounded_lines(path):
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(item, dict):
            yield item


def correlate(report_path, dns_path=None, http_path=None):
    report = json.loads(Path(report_path).read_text(encoding="utf-8"))
    if report.get("schema") != "star-osint-report/v1":
        raise ValueError("unsupported report schema")
    target = domain(report["target"])
    allowed = {v["hostname"] for v in report["assets"]}
    host_details = {name: {"ips": set(), "cnames": set(), "http": []}
                    for name in allowed}
    edges = set()
    for item in read_jsonl(dns_path):
        hostname = safe_hostname(item.get("host") or item.get("input"), target)
        if hostname not in allowed:
            continue
        for raw in string_values(item.get("a")) + string_values(item.get("aaaa")):
            ip = public_ip(raw)
            if ip:
                host_details[hostname]["ips"].add(ip)
                edges.add((hostname, ip, "resolves_to"))
        for raw in string_values(item.get("cname")):
            try:
                alias = domain(raw)
            except ValueError:
                continue
            host_details[hostname]["cnames"].add(alias)
            edges.add((hostname, alias, "cname_to"))
    for item in read_jsonl(http_path):
        raw = item.get("input")
        if not raw and isinstance(item.get("url"), str):
            raw = urlsplit(item["url"]).hostname
        hostname = safe_hostname(raw, target)
        if hostname not in allowed:
            continue
        status = item.get("status_code")
        if not isinstance(status, int) or not 100 <= status <= 599:
            continue
        entry = {"status_code": status}
        for key in ("title", "webserver", "cdn_name"):
            value = item.get(key)
            if isinstance(value, str):
                entry[key] = value[:180]
        asn = item.get("asn")
        if isinstance(asn, dict):
            entry["asn"] = {
                key: str(asn[key])[:90] for key in ("as_number", "as_name", "as_country")
                if isinstance(asn.get(key), (str, int))
            }
        elif isinstance(asn, str):
            entry["asn"] = asn[:90]
        if len(host_details[hostname]["http"]) < 10:
            host_details[hostname]["http"].append(entry)
    output = {"schema": "star-osint-infrastructure/v1", "target": target,
              "generated_at_utc": utc_now(),
              "data_note": "DNS and HTTP observations may represent intermediaries/CDNs; no ownership or vulnerability claim.",
              "assets": [
                  {"hostname": name, "ip_addresses": sorted(values["ips"]),
                   "cnames": sorted(values["cnames"]),
                   "http_observations": values["http"]}
                  for name, values in sorted(host_details.items())
              ],
              "edges": [
                  {"from": a, "to": b, "type": kind} for a, b, kind in sorted(edges)
              ]}
    return output


def main():
    parser = argparse.ArgumentParser(description="Merge offline DNS/HTTP evidence into OSINT infrastructure graph")
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--dns-jsonl", type=Path)
    parser.add_argument("--http-jsonl", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = correlate(args.report, args.dns_jsonl, args.http_jsonl)
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        parser.error(str(exc))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"target": result["target"], "edges": len(result["edges"])},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
