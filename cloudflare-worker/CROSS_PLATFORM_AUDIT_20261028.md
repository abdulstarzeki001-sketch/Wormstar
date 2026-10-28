# Wormstar NEO — GitHub / Cloudflare / Supabase integrity review
Date: 2026-10-28. First-party codebase, cloud resources and database were inspected directly.
This is a **point-in-time audit**; no account credentials, private prompts, or database content were exported.

## Verified healthy

- Cloudflare Worker `wormstar-ai-lab` version 45 (`46507964-4337-4b0c-9ba0-a4b79632786b`) was active at 100% traffic before this audit.
- Production Worker bindings: `AI`, `DB` (D1), `WORMSTAR_ACCESS_TOKEN` (secret text).
- Cloudflare Access application `Wormstar NEO — Owner Access` is self-hosted, 8-hour sessions, one allow policy restricted to a specific email. The anonymous browser was redirected to Cloudflare Access (302), and no private application content was accessible.
- Cloudflare observability is enabled; logs sample at 10%, invocation logging disabled, query strings redacted; Issues enabled and traces disabled.
- D1 counts before this audit: `knowledge=88`, `knowledge_revisions=0`, `chat_archives=1`, `ai_profile=1`, `ai_policy=1`, `wormstar_config_history=2`, `supabase_owner_binding=1`.
- Supabase Wormstar tables: `memory_items=71`, `memory_versions=54`, `starter_library=47`, `profiles=1`, `owner_policies=1`, `training_events=1`, `sync_events=3`, `starter_presets=1`. All eight have RLS enabled. Owner tables use `auth.uid()=owner_id` SELECT/INSERT/UPDATE predicates as applicable; UPDATE policies include WITH CHECK.
- Cloudflare protects API endpoints with a bearer token in addition to the outer Access policy. Private HTML and JSON headers are marked no-store.

## Fixed in this review

**Bounded streamed JSON reads**: Both `POST /api/chat` and all JSON `POST/PUT /api/studio/*` formerly rejected oversized requests using the declared `Content-Length` only. Requests with absent or forged size headers could be fully buffered by `request.json()` before failing other validation. The new `readBoundedJson` utility counts actual incoming bytes and cancels the request stream when limits are exceeded, preserving the existing 413 and 400 errors. It retains the existing authenticated-user gate, policy limits, response schemas and data operations. Regression tests cover undeclared or understated length and malformed JSON.

## Observed follow-ups (NOT changed without cross-app review)

1. **Supabase security advisor — `public.is_approved_user()`**: executable by `authenticated` with SECURITY DEFINER. Separate `private.is_approved_user()` is used in RLS for *other* business tables. Before revoking or altering the public function, identify external RPC callers (possibly other apps sharing this Supabase project). See [Supabase advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
2. **Supabase Auth**: leaked password protection is disabled. Enable it using [Supabase Auth password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) after reviewing account policy. This is not changed by SQL and is not reported as enabled.
3. **`public.star_ai_vault`**: RLS enabled, with no policies and no `anon`/`authenticated` SELECT grants; accessible by `service_role`. This appears intentionally closed, **not** an invitation to add public policies. [Advisor information](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
4. **GitHub PR #3**: outdated, unmerged and nonmergeable mobile-viewport PR. Its old `user-scalable=no` proposal conflicts with modern accessible input zoom; do not merge mechanically. Current production already includes touch-safe 16px inputs and 760px drawer fixes.
5. **Authenticated browser & physical device**: Access-protected UI cannot be visually acceptance-tested without a real owner session. An unauthenticated Cloudflare Access login check is **not** evidence of chat or memory working end to end.
6. **Models/agents**: AI binding and model routing are confirmed; owner-authenticated live model output has not been tested in this audit. OpenClaw, OpenCode, private GPU and proprietary WormGPT require separately configured upstream endpoints/secrets; their mere UI presence does not prove connections.
7. **Policy documentation drift — corrected in follow-up**: `cloudflare-worker/permissions.json` is the generated-module source of truth. The legacy `policy/permissions.json` intentionally has fewer capabilities. Both policy files and the generated module now declare the actual **500-entry** limit, and the Worker reads it directly. Do not replace one complete manifest with the other or loosen server grants.
8. **Version history**: D1 `knowledge_revisions=0` at audit time; no migration or backfill is claimed. Record creation and per-item revision history are distinct.
9. **Observability**: Supabase advisors also report unused indexes and missing primary keys in historical backup tables. Do not drop indexes or mutate legacy backup schemas without measuring production queries and verifying ownership.
10. **Upload bundle**: Third-party UI files were not installed as executable code. Wormstar v45 incorporates first-party HTML/CSS adaptations without importing unknown service workers or fingerprinting.

## Release validation steps

1. Run `cd cloudflare-worker && npm test` and require all GitHub Actions checks to complete successfully.
2. Check anonymous `/api/chat` and `/api/studio/knowledge` are not accessible.
3. Confirm forged/absent Content-Length cannot bypass real byte limits.
4. Stage Cloudflare Worker with all six existing modules, current `AI`/`DB` bindings and `keep_bindings:['secret_text']`.
5. Verify staged version/secret bindings before deploying it, preserve the previous version for rollback.
6. After deployment inspect D1 row counts, Supabase RLS, owner Access policy and error logs.
7. Obtain owner-session mobile/desktop browser QA separately for chat, archives, UX and Supabase sync.

**Explicit non-actions:** No data deleted, no RLS disabled, no account secret exposed or rotated, no unrelated finance tables altered, no unverified runtime connected.

## Follow-up hardening applied on top of the bounded-JSON fix

- Owner Bearer token comparison now compares complete UTF-8 byte arrays, not UTF-16 string lengths; tests use header-compatible non-ASCII Latin-1 tokens.
- New memory entries, restores and webpage imports enforce `LAB_POLICY.limits.maxKnowledgeEntries=500`. Duplicate note creation is checked before the full-library guard, making repeated requests idempotent at capacity.
- README now reflects actual Workers AI fallback routing, Cloudflare Access, chat archiving and Supabase session retention.
- Additional tests cover multi-byte Arabic request payloads, duplicate-at-cap behavior, policy API advertised capacity and token byte comparison. The original bounded-JSON tests remain in place.
- Deferred settings and owner acceptance are tracked in [issue #23](https://github.com/abdulstarzeki001-sketch/Wormstar/issues/23).

This follow-up deliberately retained the already-merged `readBoundedJson` implementation rather than replacing it with a second request-body parser.
