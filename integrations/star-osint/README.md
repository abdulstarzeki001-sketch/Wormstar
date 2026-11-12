# STAR CYBER LAB — OSINT integration (Kali Linux)

A local-first OSINT module for the Wormstar / STAR CYBER LAB ecosystem. It lives
at integrations/star-osint/ and does not modify the legacy Ollama assistant,
Cloudflare Core, Sentinel deployment or existing Star Cyber Audit iSH module.

## What is implemented

- Offline import of Subfinder, Amass, theHarvester and certificate-transparency
  output into normalized, scoped, deduplicated evidence.
- JSON, CSV, Arabic static HTML and SQLite output. SHA-256 checksum for report.json.
- Optional passive collection using fixed subprocess argument arrays, bounded
  execution, no shell, and an explicit authorization allowlist.
- Offline correlation of DNS (dnsx JSONL) and HTTP (httpx JSONL) with public IPs,
  CNAMEs and ASN metadata. Evidence is not a claim of ownership or vulnerability.
- Optional read-only, owner-authenticated FastAPI adapter for a *local* backend.
  The adapter provides no OSINT execution endpoint.
- Unit tests using synthetic data, without live requests or real credentials.

## Requirements

Python 3.10+ (stdlib only for import, analysis and reports). For optional
collection on Kali: installed subfinder, amass and theHarvester binaries.
For optional DNS/HTTP correlation: input JSONL from locally authorized operations.

## 1. Import existing OSINT files — offline / no authorization required

From the Wormstar repository root:

\`\`\`bash
python3 integrations/star-osint/engine.py import \
  --target example.com \
  --input-dir /path/to/STAR-OSINT-ADVANCED/passive \
  --out /tmp/star-osint-example
\`\`\`

The input directory can contain any subset of these files:

\`\`\`text
subfinder.txt
amass.txt
ct-names.txt
subfinder-evidence.jsonl
harvester.jsonl
\`\`\`

All hostnames are normalized and must fall inside the specified target's DNS
suffix. Private data and tokens should never be imported or committed.

Outputs (written locally, do NOT commit):

\`\`\`text
/tmp/star-osint-example/
├── report.json
├── assets.csv
├── report.html
├── osint.sqlite3
└── SHA256SUMS.txt
\`\`\`

Only passive candidates are reported. This does not scan or authenticate hosts.

## 2. Optional collection from public OSINT sources

Create a *local, private* scope file outside the repository:

\`\`\`bash
cat > ~/star-osint-scope.json <<'JSON'
{"authorized_domains": ["example.com"]}
JSON
\`\`\`

Substitute a domain that you actually own or are authorized to assess. Do not
include a public sector / government target without a scoped authorization.

\`\`\`bash
python3 integrations/star-osint/engine.py collect \
  --target example.com \
  --scope-file ~/star-osint-scope.json \
  --ack-authorization \
  --out ~/star-osint-reports/example
\`\`\`

The exact target must appear in the allowlist. No option exists to enable
brute-force, port scans, WAF bypass or arbitrary shell commands. The program
sends requests to passive data providers only. Tool availability, source API
limits and command versions may affect results. Read tool-status.json.

## 3. Offline infrastructure enrichment (no network)

For a permitted target, gather DNS and HTTP evidence separately with your
approved workflow and keep the results in JSONL files. Then:

\`\`\`bash
python3 integrations/star-osint/infra.py \
  --report ~/star-osint-reports/example/report.json \
  --dns-jsonl /path/to/dns-records.jsonl \
  --http-jsonl /path/to/http-results.jsonl \
  --out ~/star-osint-reports/example/infrastructure.json
\`\`\`

The correlation includes public IP addresses, CNAME edges, HTTP status and ASN
hints if present. It does not verify origin IP, server ownership or vulns. Any
URL used in an HTTP record is *read as text*, not fetched.

## 4. Link to local STAR CYBER LAB (FastAPI)

A separate local STAR CYBER LAB installation was historically at
\`~/Star-Cyber-Lab\`; this repo does not include that local backend. The bridge
below is provided for explicit integration there, not silently mounted in the
Cloudflare Worker.

Install or copy the \`integrations/star-osint\` directory into a trusted path,
then import the adapter with your real auth dependency:

\`\`\`python
# Illustrative excerpt inside an existing FastAPI app:
from pathlib import Path
import sys
sys.path.insert(0, "/home/star/Wormstar/integrations/star-osint")
from api_adapter import create_router

# Replace with YOUR EXISTING dependency which raises HTTPException(401/403)
# for every unauthenticated request. Do not use a permissive lambda here.
app.include_router(create_router(
    Path("/home/star/star-osint-reports/example"),
    existing_owner_auth_dependency,
))
\`\`\`

This exposes only two read-only authenticated endpoints:
- GET /api/v1/osint/report
- GET /api/v1/osint/infrastructure

No cloud secrets or local report data are uploaded automatically. This adapter
intentionally does not contain a new login system or provide remote execution.

## 5. Local checks

\`\`\`bash
python3 -m unittest discover -s integrations/star-osint/tests -p 'test_*.py' -v
python3 -m py_compile integrations/star-osint/engine.py \
  integrations/star-osint/infra.py integrations/star-osint/api_adapter.py
\`\`\`

Every CI test uses synthetic fixtures and does not scan third-party networks.
Deployment of a private terminal or running collector from Sentinel requires
a separately designed owner-authenticated approval workflow; it is *not*
enabled by this integration.
