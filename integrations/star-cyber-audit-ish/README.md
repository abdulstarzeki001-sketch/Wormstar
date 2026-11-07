# Wormstar Unified Lab — Star Cyber Audit iSH

**Integration state:** a same-origin, read-only static JavaScript audit dashboard at
`https://wormstar-sentinel-preview.abdulstarzeki001.workers.dev/audit/`,
plus the original offline-capable Python analyzer for iSH, a-Shell and Linux.

## Provenance

This is a source copy of the user's original GitHub project
[`Star-Cyber-Audit-iSH`](https://github.com/abdulstarzeki001-sketch/Star-Cyber-Audit-iSH).
We keep both original projects intact; the second deployment under
`abo330899.workers.dev` remains independent and has not been modified.

Copied files:

| Original | Unified repo | Source blob |
| --- | --- | --- |
| `site/worker.js` | `wormstar-ui/audit-worker.js` | `8af477a14b008c88d208627debbf668c12b34c69` |
| `analyze.py` | `integrations/star-cyber-audit-ish/analyze.py` | `f5291526bd61483e5bc2b1da6d767fe72f50d328` |
| `run.sh` | `integrations/star-cyber-audit-ish/run.sh` | `702935c4887366f94072e443a7733240d01c2794` |
| `site/sample-data.json` | `integrations/star-cyber-audit-ish/sample-data.json` | `a627751e5f3779ede1a55bb317ba26c5b7422a96` |

Offline unit tests were also copied from the source under `tests/`.

## Single Cloudflare front door

`wormstar-ui/worker.js` imports `audit-worker.js` and routes:

- `GET /audit/` and `GET /audit/index.html`: audit dashboard with a link back to Wormstar.
- `GET /audit/api/sample`: bundled historical *sanitized* sample.
- `GET /audit/health`: original read-only status.

The original read-only dashboard performs its **only network fetch** against its
sample endpoint. The URL is rewritten to the same-origin `/audit/api/sample`.
The original dashboard's CSP and no-framing policy are retained.
It cannot access the private `CORE` Service Binding, AI tokens, D1, RAG, or privileged APIs.

This is an actual local module import, not a fragile cross-account iframe or a
cross-account Workers Service Binding. The two Cloudflare accounts do not have
to share credentials or permissions.

## iPhone iSH and Linux

```sh
cd integrations/star-cyber-audit-ish
# Local files only, no network requests:
sh run.sh --local /path/to/your-js-and-html
# If you're already in the repo directory with offline snapshots:
sh run.sh --local ./my-files
```

The analyzer creates its report artifacts under `reports/`.
Open `reports/analysis.json` on the unified `/audit/` dashboard using
**Import analysis.json**. The file is read by your browser; it is *not uploaded*.
For AI interpretation, manually choose a short, reviewed text report/code file
in Wormstar AI Assistant, then explicitly press Send. The assistant uses owner
authentication and its normal request limits; the audit dashboard never
automatically forwards reports to AI.

The source analyzer also has an optional `--fetch` mode that GETs a fixed,
allowlisted set of public JavaScript assets. Do not run it against systems you do
not own or have permission to assess, and do not confuse WAF HTML responses
with JavaScript source.

## مزامنة معلومات المستودع ومصدر المختبر

- النسخة المستوردة تضم **18 ملفًا تشغيليًا وتوثيقيًا آمنًا** تحت [upstream/](./upstream/) ولا تستبدل نسخة التشغيل المدمجة.
- الفهرس [SOURCE_INVENTORY.json](./SOURCE_INVENTORY.json) يغطي **94 ملفًا** من المصدر، ويعرض المسار والحجم وبصمة Git وتصنيف النقل لكل ملف.
- المزامنة اليومية في [.github/workflows/sync-star-audit.yml](../../.github/workflows/sync-star-audit.yml) عند الساعة **05:17 بتوقيت بغداد** (02:17 UTC)، أو تشغيل يدوي عبر workflow_dispatch.
- الملفات الخام، لقطات OneDrive، الأكواد الأجنبية المؤرشفة، والتقارير التي قد تحتوي بيانات حساسة: **معلوماتها فقط** في الفهرس، وليست داخل الموقع العام.
- لا تُنفذ شيفرات المستودع الأصلي أثناء المزامنة؛ يجري فحص سكربت النقل باختبارات مستقلة، ثم تُرفع الفروقات إلى فرع مراجعة مخصص.
- تم دمج النسخة الأولية عبر [Pull Request #39](https://github.com/abdulstarzeki001-sketch/Wormstar/pull/39).
- إعدادات GitHub الحالية لا تسمح لـGitHub Actions بإنشاء طلبات Pull Request. المزامنة ستحدّث فرع المراجعة، لكن لإنشاء PR تلقائيًا يلزم تفعيل Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests.

## Tests and maintenance

```sh
cd wormstar-ui
npm test

# From repository root (Python standard library):
python3 -m unittest discover -s integrations/star-cyber-audit-ish/tests -p 'test_*.py'
```

The Sentinel CI verifies the original dashboard's same-origin routes, sample
response, and that the audit module never calls the private Core binding.
The Python audit regression tests check local static analysis using synthetic
fixtures without accessing any government or third-party system.

Changes to the original audit repository **do not silently overwrite** the unified
snapshot. To update, review the upstream source and fixtures, vendor a new
known-good snapshot, inspect changes, then run both test suites.

### Trust and usage limits

- This is an educational, unofficial static-analysis lab, not an official
  government or QR verification service.
- Findings are code-review heuristics, **not confirmed server vulnerabilities**.
- Do not commit cookie logs, private captures, real QR tokens, customer personal
  data, binary screenshots or third-party proprietary assets.
- The original dashboard uses a historical sample. A user-supplied JSON report
  is read locally in the browser and never sent to Cloudflare automatically.
