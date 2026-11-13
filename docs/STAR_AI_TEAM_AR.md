# STAR AI TEAM — Automatic Routing with GitHub Repository Memory

## Production-safe architecture

This change extends the existing **Wormstar NEXUS** without replacing the homepage, current chat models, D1, Vectorize, or Sentinel.

- Core API: `POST /api/team/run`, authenticated with the existing Cloudflare Access boundary and `WORMSTAR_ACCESS_TOKEN` Bearer header.
- First-party UI: `/workspace` → **STAR AI TEAM** tab.
- Repository evidence: `findRepoEvidence` from the dedicated GitHub repository memory index. Source citations include exact file paths, pinned Git commit, and line range.
- Automatic routing: code → Qwen Coder + GPT-OSS 120B reviewer; incident → GPT-OSS 20B + 120B; report / complex reasoning → 120B + Llama 3.3; general → 20B + Llama 3.3. Fallback attempts are reported.
- Request limits, allowed modes, owner scope and permissions continue to be enforced on the Worker before model invocation.
- Model output is a **draft + independent review**, not an approved code change. `testsPassed:false`, `deploymentApproved:false`, and `requiresCI:true` are always returned on a reviewed result.
- No shell execution, GitHub push, automatic PR merge, scheduled deployment, or hidden secret transmission is added.

## GitHub memory readiness

The TEAM endpoint requires `GET /api/repo/status` to return a complete index and valid 40-character commit SHA. If incomplete it returns 409 `REPOSITORY_INDEX_INCOMPLETE` without invoking a text-generation model.

Repository indexing now checkpoints **after every successfully persisted file**, so retries can resume rather than reprocessing an entire failed batch. A mid-batch failure leaves `complete=0` and cannot be mistaken for full knowledge.

From the owner-authorized /workspace:
1. Open the AI tab and verify the owner key.
2. Open STAR AI TEAM and click **فحص حالة GitHub**.
3. If incomplete, explicitly click **مزامنة دفعة مصرح بها** to index up to six files. Repeat as needed, or allow scheduled Cron to continue. Do not treat source links alone as indexed evidence.
4. Enter a task about a file or module in the repository, and submit.
5. Review the model proposal, independent audit, cited file revisions and requested tests.

## CI before production deployment

`.github/workflows/deploy-cloudflare.yml` already requires the reusable `Wormstar Quality Gate` on `main`, runs `npm test` prior to Wrangler and performs a post-deploy Core smoke check. The new `tests/team-orchestrator.test.mjs` is included automatically by `node --test tests/*.test.mjs`.

Release criteria:
- PR tests / policy checks / security gate must succeed.
- Merge only after review and green checks.
- Merge triggers the same full quality gate again; Wrangler is run only after that gate succeeds.
- Confirm deployment in Cloudflare, and do an authenticated user smoke test on `/workspace`.

**Limitation:** This gates the repository's GitHub Actions deployment path, not manual Cloudflare Dashboard uploads or out-of-band Wrangler calls. Branch protection and deployment credentials should be administered separately to prevent bypasses.

## Required secrets and changes

No new API tokens or database schema migrations. Existing `AI`, `DB`, `REPO_VECTORS`, and `WORMSTAR_ACCESS_TOKEN` are reused. Do not copy owner tokens or private prompts into logs, actions outputs, or issues.

## Known operational caveats

- Upstream model quotas, long or costly inference, and incomplete GitHub indexing can make this feature unavailable. These failures should return a genuine error, never a fabricated success.
- LLM review is evidence-based commentary; regression tests on actual code are run only in CI after an explicit GitHub change.
- This flow only supports the project repository; it deliberately does not combine unrelated owner memories with project code.
