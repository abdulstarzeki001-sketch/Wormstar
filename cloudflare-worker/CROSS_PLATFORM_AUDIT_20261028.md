# Wormstar NEO — Cross-platform audit and hardening
**Date:** 2026-10-28  
**Scope:** GitHub source and CI, Cloudflare Worker/Access/D1, Supabase tables/RLS/advisors.  
**Audit approach:** Read live service metadata, read-only SQL counts and policies, public unauthenticated browser check, source inspection and new regression tests. Never retrieve or print secret values.

## Confirmed production baseline (before this patch)

| Service | Verified state |
| --- | --- |
| Cloudflare Worker | \`wormstar-ai-lab\`, deployed version **45**, version ID \`46507964-4337-4b0c-9ba0-a4b79632786b\`, 100% traffic |
| Bindings | \`AI\` Workers AI, \`DB\` D1 \`d9d08aa3-184f-47aa-bc2b-a9f53c0bd2aa\`, \`WORMSTAR_ACCESS_TOKEN\` secret; values not inspected |
| Cloudflare Access | App \`Wormstar NEO — Owner Access\`, destination Worker \`155553ea981a448d955830735e743a8d\`, one exact-email allow policy, 8-hour session |
| Browser outside Access | Anonymous GET / redirected HTTP 302 to Cloudflare Access login. No private Wormstar dashboard or API data observed. This is not a signed-in functional test. |
| Observability | Issues and logs enabled, 10% application log sampling, request query strings redacted, invocation logs disabled, tracing disabled |
| D1 | \`knowledge=88\`, \`knowledge_revisions=0\`, \`chat_archives=1\`, \`ai_profile=1\`, \`ai_policy=1\`, \`wormstar_config_history=2\`, \`supabase_owner_binding=1\` |
| Supabase | 8 Wormstar tables have RLS enabled; owner-specific RLS policies use \`(select auth.uid())=owner_id\` for private data |
| Supabase row counts | memory_items=71, memory_versions=54, starter_library=47, ai_profiles=1, owner_policies=1, training_events=1, sync_events=3, starter_presets=1 |
| GitHub | \`main\` includes PR #20 Royal Blood Glass. PR #3 is still open, old and unmergeable; do not merge automatically. |

## Findings and fixes in this change

### F1 — API body limit bypass when Content-Length is missing (fixed)
\`/api/chat\` and \`/api/studio/*\` only compared the request's declared Content-Length and then parsed the entire JSON body. Streamed or headerless requests could exceed the documented byte limit before parsing.

**Fix:** \`readLimitedJson(request,maxBytes)\` reads a bounded stream of raw bytes and cancels oversized input, validates UTF-8, then JSON-parses only a within-limit body. Chat uses \`LAB_POLICY.limits.maxRequestBytes\` (65,000 bytes); Studio POST/PUT uses 125,000 bytes. 413 for oversized input, 400 for malformed JSON. Authorization remains before body consumption. Regression tests cover oversized ASCII, multi-byte Arabic, Studio, malformed JSON and unauthenticated requests.

### F2 — D1 memory capacity contradicted policy (fixed)
\`worker.js\` enforced **500** entries while \`cloudflare-worker/permissions.json\`, generated \`permissions-module.js\`, and the separate baseline \`policy/permissions.json\` claimed **120**. The README also claimed 120. The project already has 88 D1 knowledge entries.

**Fix:** Set the canonical manifest and baseline policy limit to 500; regenerate the ESM policy module; use the manifest limit in the Worker for note creation, restore and webpage import; update README. Duplicate content is now detected before the full-library check, so retrying an existing item remains idempotent when the library is full. Preserve deny-by-default capabilities and all existing data.

**Important:** The \`policy/permissions.json\` baseline intentionally lists fewer extended agent capabilities than \`cloudflare-worker/permissions.json\`. Do not overwrite one entire manifest with the other; only synchronize the shared limit.

### F3 — UTF-8 bearer comparison used JS character length (fixed)
\`allow()\` compared JavaScript UTF-16 string length before XOR-ing encoded bytes. The comparison now checks the actual UTF-8 byte lengths and compares all bytes. Regression test covers non-ASCII tokens. Existing tokens are not rotated.

### F4 — Supabase security advisors (reviewed; no unsafe change)
- **INFO** \`public.star_ai_vault\` has RLS enabled without a policy. Both \`anon\` and \`authenticated\` lack table SELECT privileges. This is an intentional deny-by-default configuration; adding a permissive policy would be a regression.
- **WARN** \`public.is_approved_user()\` is a SECURITY DEFINER function executable by authenticated users. Its SQL returns only whether \`auth.uid()\` exists in \`private.approved_users\`; its search_path is pinned. Existing RLS policies on other tables call **\`private.is_approved_user()\`**, not the public wrapper. A client might still call \`/rest/v1/rpc/is_approved_user\`; do not revoke EXECUTE or rewrite the function without verifying those clients.
- **WARN** leaked-password protection is disabled in Supabase Auth. This is an Auth project setting, not a SQL table policy. Enable through [Supabase Auth password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) after reviewing Auth plan/settings.
- Performance advisories include unused indexes and six missing primary keys in an unrelated \`cleanup_backup_20260928\` schema. Do not drop or mutate historical backup tables on the basis of generic lint results alone.

### F5 — Documentation drift (fixed)
Updated README statements on model routing, active Access, D1 capacity, opt-in chat archiving, browser Supabase session retention, main branch and chat-first landing. No unsupported claim that proprietary WormGPT model weights or external agent runtimes are deployed.

## Deferred checks / non-goals

1. **Owner-authenticated end-to-end test:** Anonymous browser checks cannot prove chat generation, AI Studio controls, Supabase Auth sign-in or phone rendering. Perform signed-in desktop/mobile acceptance without sharing credentials.
2. **Supabase Auth leaked-password protection:** Must be enabled in Auth configuration; connector does not expose an Auth settings update operation. This patch does not claim to have enabled it.
3. **External runtimes:** No confirmed OpenClaw Gateway, OpenCode service, owner GPU or proprietary WormGPT API credentials in the Worker bindings. Do not label them connected.
4. **Automated backups:** D1 has stored memory and manual export, but no verified scheduled off-platform backup. Design a backup workflow with owner-approved storage and retention before claiming disaster recovery.
5. **PR #3:** Old iOS viewport branch is unmergeable and proposes \`user-scalable=no\`. Keep it separate; merging could degrade accessibility and overwrite newer responsive work.
6. **Cloudflare request monitoring:** Observability is configured; this audit did not execute owner-authenticated AI calls or retrieve private production request bodies.
7. **Supabase legacy schema:** This project also hosts unrelated company/document tables. Avoid destructive cleanup or permission changes outside Wormstar.

## Verification gate for deployment

1. GitHub Actions: Wormstar Cloud Policy Tests and WormGPT Optional Provider Tests must pass on the new PR head.
2. Check the Worker module syntax and \`node tools/sync-policy.mjs --check\` via CI.
3. Stage a new Cloudflare Worker version with **all six first-party JS modules**, preserving existing \`secret_text\` bindings and AI/D1 bindings.
4. Verify staged version binding names and D1 database ID; deploy at 100% only if current production still matches the preflight version.
5. Post-deploy verify live version, Access destination, all bindings, D1 counts and Supabase RLS counts. Keep v45 as a rollback candidate.

## References

- [Cloudflare Workers Streams](https://developers.cloudflare.com/workers/runtime-apis/streams/)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Security Advisors](https://supabase.com/docs/guides/database/database-linter)
- [Supabase Password Protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [Owner archive design integration](./OWNER_APPX_ROYAL_THEME_INTEGRATION.md)
