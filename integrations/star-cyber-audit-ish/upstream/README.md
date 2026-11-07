# Star Cyber Audit — iSH + Cloudflare

An **independent, read-only JavaScript static-auditing toolkit** for iSH (Alpine on iPhone), a-Shell, and Linux, with an Arabic web dashboard. It was created to inspect publicly available or locally owned JS sources, classify anti-bot HTML, and produce structured reports without executing target code.

[Open the live dashboard](https://star-cyber-audit-ish.abo330899.workers.dev/) · [Health check](https://star-cyber-audit-ish.abo330899.workers.dev/health)

> **Unofficial educational research.** Not affiliated with Iraqi UBOOR or a government authority. Indicators are not confirmed vulnerabilities. The dashboard does not authenticate to, probe, or proxy the government site.

## Quick start — iSH (iPhone)

```sh
apk add python3 ca-certificates
mkdir -p /mnt/star-audit
mount -t ios . /mnt/star-audit
cd /mnt/star-audit
sh run.sh
```

Choose the folder containing `run.sh` when the iOS Files picker opens. The executable analyzes local snapshots when present; source control deliberately excludes third-party snapshot files.

## Options

```sh
sh run.sh --local ./my-files  # Recursively scan local JS/MJS/CJS/HTML without executing them
sh run.sh --local ./research  # Scan archived sources locally; no network calls
sh run.sh --fetch             # GET four allowlisted static assets
sh run.sh --fetch-all         # GET twenty allowlisted static assets, lightly paced
```

No POST, login, token, document verification, or WAF bypass functionality is included. An HTML WAF challenge is recorded separately and never passed off as JavaScript.

## Reports

Locally generated `reports/` files:
- `analysis.json` — machine-readable file metadata, routes, imports, storage indicators and review flags
- `inventory.csv` — filename, classification, size and SHA-256
- `api_paths.txt` — file-to-API references, **not network calls**
- `review_flags.txt` — static heuristics for human inspection
- `report.html` — offline report
- `fetch_status.json` — summary of optional GET requests

The [web dashboard](https://star-cyber-audit-ish.abo330899.workers.dev/) loads a **sanitized historical sample** by default. Import `reports/analysis.json` through the browser to explore your own data locally; it is not uploaded to Cloudflare.

## Architecture

| Component | File | Purpose |
| --- | --- | --- |
| iSH runner | `run.sh` | POSIX shell launcher |
| Static analyzer | `analyze.py` | Python standard library only |
| Historical overview | `UBOOR_FLOW_NOTES_AR.md` | Known front-end flows, limitations |
| Public dashboard | `site/worker.js` | Standalone Cloudflare Worker |
| Sanitized sample | `site/sample-data.json` | No originals, tokens, or private records |

Cloudflare deployment **is live** on `star-cyber-audit-ish.abo330899.workers.dev`. A GitHub repository connection was created in Cloudflare Builds; automated trigger/CI deployment has **not** been enabled and is not implied by the one-time API deployment. The exact production Worker source is versioned in `site/worker.js`.

## Security and licensing boundaries

Do not commit locally captured HTTP requests, personal data, session cookies, access tokens, third-party JavaScript archives, or non-redacted reports. `.gitignore` excludes `offline_samples`, `downloads`, and `reports`. Sample metadata is historical and does not establish current backend behavior or document validity.

See [Arabic documentation](README_AR.md) and [GitHub notes](README_GITHUB_UPLOAD.md).

### Scanner maintenance

The analyzer recursively enumerates local JS/MJS/CJS/HTML, keeps relative paths to
avoid collisions, includes DMS `/api/verify/` references, and rejects HTML/WAF/JSON
before using file-extension hints. GitHub Actions tests local fixtures plus archived
source snapshots; it does **not** query external government systems in CI.
