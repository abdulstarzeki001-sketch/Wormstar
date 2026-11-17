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

## QrLocalImporter deep review (8 November 2026)

Read the [Arabic evidence-based review](reviews/2026-11-08/QrLocalImporter_deep_review_AR.md), then run the new read-only iSH analyzer against **your own local source file**:

```sh
python3 tools/ish/qr_importer_review.py /path/to/QrLocalImporter-DYzNB5Fh.js
python3 -m unittest discover -s tests -p 'test_qr_importer_review.py' -v
```

The repository stores the SHA-256 and review findings, **not a new copy of the uploaded third-party script**. The review does not contact UBOOR APIs or establish backend vulnerabilities.

## useLocalCompany deep review (8 November 2026)

The [Arabic review](reviews/2026-11-08/useLocalCompany_deep_review_AR.md) documents the
company/item forms, client-side QR readings, server reading lists, document previews,
attachment downloads, and log-event API calls.

Run the additional **offline-only** checker on a local copy of the user-supplied source:

```sh
python3 tools/ish/use_local_company_review.py /path/to/useLocalCompany-DfV5kpAj.js
python3 -m unittest discover -s tests -p 'test_use_local_company_review.py' -v
```

Evidence: 16,940 bytes; SHA-256 `2a94cadad67e987ef5fcbce9d443f134bbce8293dea69d6e37220c195afa76f4`.
The repo does **not** add the third-party source file for this review. Nine source
indicators are **not** claims of nine exploitable vulnerabilities. No backend API is called.

## QrControlScan source review (8 November 2026)

[Arabic deep source review](reviews/2026-11-08/QrControlScan_deep_review_AR.md) joins the
QrControlScan Vue view to the previously reviewed useLocalCompany composable.
The UI itself does **not** issue direct government API calls. Its dependency
handles list, preview and export API actions. The report separates frontend
evidence and unknown backend authorization.

Run the local, offline checker against the two locally available files:

```sh
python3 tools/ish/qr_control_scan_review.py /path/to/QrControlScan-M6uGJnR1.js \
  --dependency /path/to/useLocalCompany-DfV5kpAj.js
python3 -m unittest discover -s tests -p 'test_qr_control_scan_review.py' -v
```

Evidence SHA-256: `0848ead8a6082769241885b6e5de6fd26aa783cbfce832f46448780378bbd78c`
(8,315 bytes). This update adds no copy of the third-party JS source, account
secrets, HTTP traffic, or document records.

## QRReadings deep comparison (8 November 2026)

The [Arabic deep comparison](reviews/2026-11-08/QRReadings_deep_comparison_AR.md)
covers the QRReadings view, `QrControlScan`, and `useLocalCompany`:
distinct list/export endpoints; a shared document-preview API; client-side demo
rows, session storage, console logging, and authorization UI. The work is
**read-only** and does not establish backend access or document validity.

Use the offline checker on locally held sources:

```sh
python3 tools/ish/qr_readings_offline_review.py /path/to/QRReadings-B-a3jcrk.js \
  --control /path/to/QrControlScan-M6uGJnR1.js \
  --composable /path/to/useLocalCompany-DfV5kpAj.js
python3 -m unittest discover -s tests -p 'test_qr_readings_offline_review.py' -v
```

Source snapshot: 14,489 bytes; SHA-256
`31c9ac2eadc4a256d0d321317431bcd7655e6eabb06a3d848c4b676e631f7cb9`.
This addition does not publish a new copy of third-party JS, session tokens,
user records, or government API responses.

## QRImported static deep review (8 November 2026)

[Read the Arabic report](reviews/2026-11-08/QRImported_deep_comparison_AR.md)
comparing this import-reader frontend with QRLocal and QrLocalImporter. The most
significant difference is **camera-image pixel coordinates** being placed in
`x_coordinate/y_coordinate` rather than browser GPS latitude and longitude.
Other static indicators cover bearer-token debug logging, duplicate POST
diagnostics, session defaults, RAF lifecycle, and local response persistence.

Run the offline static checker on **locally obtained source files**:

```sh
python3 tools/ish/qr_imported_review.py /path/to/QRImported-C65Oqm1K.js \
  --qr-local /path/to/QRLocal-5TAaXbzM.js \
  --exit-importer /path/to/QrLocalImporter-DYzNB5Fh.js
python3 -m unittest discover -s tests -p 'test_qr_imported_review.py' -v
```

The two comparison flags are optional. Snapshot SHA-256:
`d2756b08358ced044c8f9982d4da8b19ba9a38996fc7c4f682e0d67148d59eee`
(8,913 bytes). This repository update contains no new copy of third-party
government JavaScript, login token, document record, or live backend request.
Thirteen matched frontend patterns do **not** establish thirteen vulnerabilities.

## QRHealthCertificate deep review (8 November 2026)

The [Arabic evidence-based audit](reviews/2026-11-08/QRHealthCertificate_deep_review_AR.md)
examines the health-certificate camera reader and its
`POST BorderPort_HS/read_doc_health` flow. Its **client-side 48-hour
heuristic is conditional**: a substring match in the response message can
skip the check; otherwise the UI chooses the newest parseable date from
several unrelated fields, including license approval. This is **not a claim**
that the government backend permits an expired document.

Use the stdlib-only offline review tool on a locally held copy:

```sh
python3 tools/ish/qr_health_certificate_review.py /path/to/QRHealthCertificate-Byvh35hk.js \
  --qr-local /path/to/QRLocal-5TAaXbzM.js \
  --qr-imported /path/to/QRImported-C65Oqm1K.js
python3 -m unittest discover -s tests -p 'test_qr_health_certificate_review.py' -v
```

Comparisons are optional. Snapshot: 10,900 bytes, SHA-256:
`78b26ef2ba7f02c92745bc9bc5e61731d4972a390ba3c866d62ae8e000788936`.
There are 16 version-specific source indicators (not proven vulnerabilities).
No third-party script, secrets, personal records, or live UBOOR API responses
were added as part of this report.

## useHealthCertificate deep static review (8 November 2026)

The [Arabic audit](reviews/2026-11-08/useHealthCertificate_deep_review_AR.md)
analyzes the certificate management composable: 12 relative BorderPort_HS
API routes, shared singleton state, province/district/subdistrict lookup caches,
reader lists, document previews, downloads and uploads. Its 13 version-specific
patterns are **frontend review indicators**, not confirmed server vulnerabilities.
Unlike the QRHealthCertificate scanner, this module has **no** local 48-hour
expiry test or camera reader.

```sh
python3 tools/ish/use_health_certificate_review.py /path/to/useHealthCertificate-DVL2cDcP.js
python3 -m unittest discover -s tests -p 'test_use_health_certificate_review.py' -v
```

Source snapshot SHA-256:
`36acf66c8a1ad736f6da9bca1d8a9dced9f1bf377451c8913dcf4ddc15eff479`
(17,870 bytes). The update adds **no new copy** of third-party JS,
secrets, personal documents or authenticated API response data.

## DisableDocument static audit (8 November 2026)

The [Arabic evidence-based deep review](reviews/2026-11-08/DisableDocument_deep_review_AR.md)
covers the QR camera's `POST local_form/reset_company_qrcode` flow. Key issues
include an **optimistic success card** shown before the server confirms a reset,
an `expired:true` state not respected by the success condition, a diagnostic
second POST in the error handler, shared token debug logging, and location
freshness. No government backend was contacted or changed.

A second provided `QRHealthCertificate-Byvh35hk 2.js` file was **byte-identical**
to the earlier health scanner file (SHA-256:
`78b26ef2ba7f02c92745bc9bc5e61731d4972a390ba3c866d62ae8e000788936`).

```sh
python3 tools/ish/disable_document_review.py /path/to/DisableDocument-AXBjrkYS.js \
  --health "/path/to/QRHealthCertificate-Byvh35hk 2.js"
python3 -m unittest discover -s tests -p 'test_disable_document_review.py' -v
```

DisableDocument evidence: 11,505 bytes; SHA-256
`e8f574544e0f910f8ec66446810627a13352065d7b6ae2a3b1a89c0439f60e01`.
Seventeen version-specific frontend patterns are review flags, **not**
confirmed exploitable vulnerabilities. The public repository update does not
include a new copy of third-party source, session credentials, or government
document data.

## RejectedLocalDocuments static review (8 November 2026)

The [Arabic evidence-based audit](reviews/2026-11-08/RejectedLocalDocuments_deep_review_AR.md)
reviews the rejected-local-document list, search filters, location links, preview
records and browser persistence. The list uses `fetchRejectedLocalReaders` from
the shared `index-gleMzSil.js` bundle, so the **list's actual API endpoint is
not identifiable from this view alone**. The only direct API call in the view
is `POST local_form/return_doc_qrcode`.

The findings include document ID number coercion, saved response data, a preview
button without a **component-local** privilege check, old rows surviving errors,
and 8-column empty-state markup for a 9-column table. None proves that backend
authorization can be bypassed or a government record modified.

```sh
python3 tools/ish/rejected_local_documents_review.py \
  "/path/to/RejectedLocalDocuments-CC07EpF_.js"
python3 -m unittest discover -s tests \
  -p 'test_rejected_local_documents_review.py' -v
```

Source: 11,186 bytes; SHA-256:
`b98b04782e1ee00c7e338bd111e22a45479db6e5171e5a67e808a3458a9c7a25`.
This adds only an offline checker, synthetic regression tests and a written
report—no copy of third-party source JS, private credentials or real documents.

## Main UBOOR bundle: rejected QR route and auth (8 November 2026)

The [Arabic source-based deep review](reviews/2026-11-08/index_gleMzSil_rejected_route_deep_review_AR.md)
analyzes the supplied 1,416,085-byte `index-gleMzSil` main JS bundle and
**resolves** the previously unknown rejected-local list API:

```text
POST https://customs-uboor.ur.gov.iq/api/local_form/pagination_rejected_qrcode_reader
/dashboard/qr/local-rejected -> RejectedLocalDocuments -> fetchRejectedLocalReaders
```

The `/dashboard` parent requires frontend authentication; the visible router
guard does not itself check a route-specific privilege. This is **not** evidence
that the backend accepts unauthorized requests. The review also documents a
logical-failure payload still returned after an error toast and a possible
stale Axios default Authorization header after logout. It also identifies the
correct health-certificate print chunk:
`PrintHealthCertificateView-Q9yNncqz.js`.

Run the offline checker against a **locally held copy**:

```sh
python3 tools/ish/index_rejected_route_review.py "/path/to/index-gleMzSil(1)(1).js"
python3 -m unittest discover -s tests -p 'test_index_rejected_route_review.py' -v
```

Source SHA-256:
`83d3f35e2cf05cc56fca81a3531b98381d291dc1e903957be7b6e433466b7ac3`.
The 15 indicators include factual source findings and review conditions,
**not** confirmed exploits. No new copy of the government JS, credentials or
user document records was added to this public repository.

## Health certificate print data-flow audit (8 November 2026)

The [Arabic source-based report](reviews/2026-11-08/PrintHealthCertificateView_deep_review_AR.md)
maps `QRHealthCertificate` -> `sessionStorage["hc_print"]` ->
`PrintHealthCertificateView` -> `HealthCertificatePrint`. Key review items:
a local print page without document-authenticity verification, cross-record
fallback from `hc_detail`, a three-day default validity label versus the
reader's conditional 48-hour check, a veterinarian-name fallback to the
current user, and a **conditional** screenshot upload when `auto_send` is
present. Checkpoint maps, animal-table layout and ordinary browser printing
are documented as separate frontend behaviors.

Run the offline source reviewer with an optional matching scanner:

```sh
python3 tools/ish/health_certificate_print_review.py \
  "/path/to/PrintHealthCertificateView-Q9yNncqz.js" \
  --scanner "/path/to/QRHealthCertificate-Byvh35hk.js"
python3 -m unittest discover -s tests \
  -p 'test_health_certificate_print_review.py' -v
```

Source: 15,501 bytes; SHA-256
`6feebf08f92578b7d4121a929de756e17f0d0b48a8ddb001a539a165006f9361`.
The 17 matched signals are **not** proven exploitable vulnerabilities, and
locally rendered ministry text or a QR image does not verify official issuance.
No new copy of third-party source, personal data, credentials or documents
has been committed as part of the audit.

## QRDocument preview, rejection and print audit (8 November 2026)

The [Arabic deep review](reviews/2026-11-08/QRDocument_deep_review_AR.md)
documents the QRDocument UI and RefuseDocModal, the source precedence
(`history.state.preview`, `qrStore`, and `qr_preview_entry`), browser
printing, and QR rendering. The component can fall back to the **first saved
reading if a requested ID is not found**, risking a wrong-document preview.

Two distinct POSTs are visible: `local_form/refuse_doc_company` (after the
explicit rejection dialog, with frontend `is_main`/privilege gating) and
`BorderPort_HS/path-document-file` (only when local `auto_send` is true).
These are **not** proof of backend authorization issues. The component does not
consume `autoPrint`/`autoDownload` route flags. Its conditional screenshot
upload uses a 100 ms delay versus the health print page's 500 ms.

The uploaded file (607,716 bytes, SHA-256
`23f8c5d87b6a91511af2a96f57075e8502861bd2f6d92d914a14222db4199400`)
is byte-identical to the already archived source, Git blob
`47fe6096a16379cfa8e079e15f46b07d6007e0af`. **No second copy** was
committed.

```sh
python3 tools/ish/qr_document_review.py '/path/to/QRDocument-BJwpoEJY(2).js'
python3 -m unittest discover -s tests -p 'test_qr_document_review.py' -v
```

The checker returns 21 version-specific source indicators, not 21 proven
vulnerabilities. Its 25 synthetic tests never call UBOOR APIs or execute JS.

## QRCheckpoints source and provenance review (8 November 2026)

The [Arabic deep review](reviews/2026-11-08/QRCheckpoints_deep_review_AR.md)
documents the QRCheckpoints Vue component, which **does not issue API requests**
or alter any document. Its display list is supplied via `props.items` or
fallbacks through `history.state.read_doc`, `sessionStorage["qr_read_doc"]`
and a JSON `read_doc` route-query value. The parent `QRDocument` normally
passes its computed `response.read_doc` through `items` and also writes
`qr_read_doc` to sessionStorage. An unbound fallback can potentially show
out-of-context checkpoints, while an empty history array suppresses later
fallbacks. The map visibility predicate uses an OR of coordinates, but its
click handler requires both, and its UTC display depends on timestamp syntax.

Run the **offline** reviewer, optionally comparing a local copy of QRDocument:

```sh
python3 tools/ish/qr_checkpoints_review.py \
  "/path/to/QRCheckpoints-Brs0uL0-.js" \
  --parent "/path/to/QRDocument-BJwpoEJY.js"
python3 -m unittest discover -s tests \
  -p 'test_qr_checkpoints_review.py' -v
```

Source: 2,797 bytes; SHA-256
`b2f6e7519df369ff58345adedcc4fb1cc2d83416f409cffe0cd93a8869aae53b`.
There are 14 version-specific observations, **not 14 backend vulnerabilities**.
No government source code, personal coordinates, document records or sessions
are uploaded in this addition to the public repository.

## qrStore browser storage audit (8 November 2026)

The [Arabic qrStore deep review](reviews/2026-11-08/qrStore_deep_review_AR.md)
links the 248-byte module's `localStorage["qr_readings"]` add/list behavior
to the previously reviewed `QRDocument` and `QRCheckpoints` flows.
The store prepends new records but does not validate `JSON.parse` as an
array, silently ignores storage errors, has no retention limit or user
namespace, and rewrites the full list on every addition. A later
`QRDocument` fallback to the first local entry when an ID is unmatched
could display a different document. These are **browser-side review findings
and design risks**, not confirmed government backend vulnerabilities.

Use the offline stdlib-only checker with optional local comparison sources:

```sh
python3 tools/ish/qr_store_review.py "/path/to/qrStore-B8bgApfd(1).js" \
  --document "/path/to/QRDocument-BJwpoEJY.js" \
  --checkpoints "/path/to/QRCheckpoints-Brs0uL0-.js"
python3 -m unittest discover -s tests -p 'test_qr_store_review.py' -v
```

Both comparison flags are optional **together**. Source SHA-256:
`122527b8507637168eeb4365f879f160f02620d1dc997c74e3da1880a1573e77`.
The uploaded source is byte-identical to the archived Git blob
`8ccefa1736a3d7da3a800075c9a7a51e6acc6c30`, so no additional
third-party JavaScript, real QR records, credentials or user data were
committed. There are 13 source indicators and 20 synthetic tests.

## CompanyOwnerView and QRLocal integration audit (8 November 2026)

The source-based [CompanyOwnerView Arabic review](reviews/2026-11-08/CompanyOwnerView_deep_review_AR.md)
documents the owner verification and company search/stock reduction flows.
The user-supplied CompanyOwnerView chunk (24,517 bytes; SHA-256
`78af159ff95bf493a5050b4fb0fe6e4068ee49576100829ce1783644f92d2b2d`)
contains four Vue components. Correlation with the earlier
`index-gleMzSil` bundle resolves the relevant **frontend-declared** APIs:

```text
POST /api/local_form/company_verify_login
POST /api/local_form/company_verification
POST /api/local_form/search_iraqi_company
GET  /api/local_form/get_company_items/{hash}
PUT  /api/local_form/company_item_reduce
POST /api/local_form/return_company_doc/{hash}
```

Review points include an unawaited owner session check and redirect in
a verification `finally` branch; phone in URLs and company hash in
debug logs; client-side quantity and geolocation checks; and the literal
`vihcle_info` payload key (the server's API contract is not confirmed).

The [QRLocal version comparison](reviews/2026-11-08/QRLocal_revalidation_AR.md)
shows that `QRLocal-5TAaXbzM(3).js` is byte-identical to the archived
source (10,014 bytes, SHA-256
`1e3ea9982971b4e4e08bb2ebee1520fe6a5056bc8590de4288fec80456fa9626`).
The local QR scanner uses GPS, POSTs to `read_doc_company`, and can set
`auto_send` from `is_main` before navigation to QRDocument. It does
**not** call the company shipment reduction endpoint.

Offline analysis and **35 synthetic tests**:

```sh
python3 tools/ish/company_owner_review.py \
  "/path/to/CompanyOwnerView-CIdFF3LL.js" \
  --main "/path/to/index-gleMzSil(1)(1).js" \
  --qr-local "/path/to/QRLocal-5TAaXbzM(3).js"
python3 -m unittest discover -s tests -p 'test_company_owner_review.py' -v
```

The tool can be run without the two optional flags; with both, its rule
inventory spans 22 view indicators, 8 main-store indicators, and 10 QRLocal
indicators. These are not 40 confirmed vulnerabilities. The new public
commits include only analysis/checker/tests, no copies of third-party JS,
credentials, private documents or genuine person/location records.

## Permanent project reference — QR / UBOOR / UR / DMS

The [recovered Arabic project memory](docs/project-memory/QR_UBOOR_UR_RECOVERED_PROJECT_MEMORY_2026-11-08_AR.md)
is the **durable, versioned reference** for earlier chats and source-based
audit work on QR document flows, customs UBOOR, the UR/DMS verification
frontend, and offline Star-Cyber-Audit-iSH tools (through 8 November 2026).
The record separates what was actually checked or committed from proposed
labs, assumptions, and server-side behavior not available in source code.

Future audits should consult this reference alongside the individual
`reviews/2026-11-07/` and `reviews/2026-11-08/` reports rather than
treating the browser's QR rendering or localStorage data as evidence of
official document validity. Do not add live QR tokens, credentials, driver
details, or authentic government documents to this public repository.
