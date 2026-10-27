# Wormstar Cloudflare operations: caching, security and monitoring

Last reviewed: 2026-10-27. Applies to the live Worker wormstar-ai-lab
and optional external WormGPT API engine. Cloudflare Worker version 37
(ba618134-5c38-4d65-8e38-6a998a7cb044) was deployed to 100% production
traffic on 2026-10-27 after staging and binding verification. The preceding
version f1dd59b2-9edc-47a2-ac6d-ebff11b5bd78 remains a rollback option.

## Caching: intentionally separate public assets and private APIs

- GET /apple-touch-icon.png, /icon.png, /favicon.png, /icon.svg,
  /favicon.svg, /manifest.webmanifest serve fixed public assets with
  Cache-Control: public, max-age=3600, s-maxage=3600 (one hour).
- GET / and /index.html (login/application shell) and all JSON API
  responses, including /api/chat, /api/studio/*, /api/health,
  unauthorized errors, and any WormGPT completions, are private, no-store.
  They also send CDN-Cache-Control: no-store and
  Cloudflare-CDN-Cache-Control: no-store to discourage shared caching.
- No global "Cache Everything" or "Edge Cache TTL: 1 hour" rule is safe for
  this Worker. Such a rule can override origin no-store and leak private
  data. A future cache rule must only match exact public asset paths and
  exclude /api/*, /, and /index.html.
- HTTP response headers alone do not prove a Cloudflare edge cache rule
  has been created or that the Worker response is served from the edge.
  Workers Cache and zone Cache Rules require their own explicit setup.
  No Cloudflare zone is currently connected to this account. Do not enable
  Worker-wide caching in front of the authenticated default entrypoint.

References:
- https://developers.cloudflare.com/workers/cache/
- https://developers.cloudflare.com/cache/troubleshooting/investigating-uncached-responses/
- https://developers.cloudflare.com/workers/runtime-apis/cache/

## Workers KV

No KV namespace was created: the existing use cases are private chat, user
memory, and account settings (stored in D1), not public reusable content.
Caching responses under a constant key such as cached_response could expose
one conversation to another user. KV is eventually consistent and is not
a reliable rate-limit counter or access-control system.

If a future feature needs a public, deterministic, non-sensitive metadata
cache, create a separate namespace and use only allowlisted keys with TTL,
never chat content, auth headers, prompts, documents, or API tokens:

    cd cloudflare-worker
    npx wrangler kv namespace create PUBLIC_METADATA_CACHE

Then add its returned binding ID to wrangler.toml and write a narrowly scoped
GET-only handler. The older wrangler kv:namespace create command is not the
current syntax. KV creation/binding is not required for the current project.

Reference: https://developers.cloudflare.com/kv/get-started/

## HTTPS and Cloudflare Access

- The https://wormstar-ai-lab.abdulstarzeki001.workers.dev/ Worker URL
  already uses Cloudflare HTTPS. No domain purchase or certificate upload is
  required for this URL.
- The Worker already checks the WORMSTAR_ACCESS_TOKEN bearer secret on
  protected API routes. This code change keeps that check in place.
- Cloudflare Access IS ENABLED for the Worker destination (including
  workers.dev and its previews), with an Allow policy restricted to the
  verified owner email, the existing Cloudflare identity provider, and an
  8-hour session. This applies only to wormstar-ai-lab, not the account's
  other Workers. Do not add an Everyone rule. If API clients need unattended
  access, configure a scoped Access service token and preserve the Worker
  bearer check.
- Existing Access applications on the account belong to other services.
  Their policies were not altered. Access was verified through an
  authenticated TinyFish browser session after deploying version 37.

Reference: https://developers.cloudflare.com/workers/configuration/cloudflare-access/

## Secrets

Store WORMSTAR_ACCESS_TOKEN, WORMGPT_API_KEY, WORMGPT_MODEL_ID and any
future Sentry DSN using the Cloudflare dashboard's Secrets controls or:

    cd cloudflare-worker
    npx wrangler secret put WORMGPT_API_KEY
    npx wrangler secret put WORMGPT_MODEL_ID

Do not store tokens in .env files committed to Git, log them, include them
in URLs, or put them in KV. The external WormGPT engine remains disabled
until both provider secrets are configured and verified.

## Observability and alerts

- wrangler.toml enables Workers Logs with 10% sampling,
  invocation_logs = false, redact_query_string = true, and traces disabled
  to reduce collection of request metadata. The Cloudflare Worker settings
  API was updated and read back successfully on 2026-10-27. Version 37 is
  NOW DEPLOYED and was rechecked for AI, DB, and WORMSTAR_ACCESS_TOKEN
  bindings. The owner secret was inherited using keep_bindings and its
  value was never read.
- Explicit model-backend failure events contain only an event name, fixed
  provider identifier and HTTP status. They deliberately omit user prompts,
  chat history, owner identity, IP, Authorization headers, tokens and
  upstream error messages.
- Review Worker -> Observability -> Logs, Metrics and Errors for 5xx rate,
  backend failures and latency. Workers analytics exists independently of
  Sentry. On 2026-10-27 the Cloudflare Notifications policy
  `Wormstar / Workers real-time errors` was created and enabled, with
  delivery to the verified owner email. IMPORTANT: this policy's
  `workers_observability_real_time_issue` policy is an account-level
  notification destination, but an ENABLED Workers Issues automation
  (ID `97378f44-e14e-448c-bae8-4eaa7c77cd55`) scopes triggering
  to service `wormstar-ai-lab` on the first occurrence. The worker's
  `observability.issues.enabled` was independently verified true on the
  live account; wrangler.toml now explicitly preserves this after future
  Wrangler deploys. Delivery has not been tested. Do not claim Sentry is
  enabled or that a custom HTTP 5xx percentage threshold exists.
- Sentry was not installed because no approved DSN, data-handling policy
  or privacy scrubber was provided. If added later, strip prompts, messages,
  Authorization, cookies and attached knowledge from captured events.
- If logs are not needed, disable them or reduce sampling. Review retention
  and access permissions for all telemetry.

References:
- https://developers.cloudflare.com/workers/observability/logs/workers-logs/
- https://developers.cloudflare.com/workers/wrangler/configuration/

## Validation and deployment

Offline checks run in GitHub Actions and can be run from a trusted checkout:

    cd cloudflare-worker
    npm test

A successful GitHub test does not deploy to Cloudflare. Deploy only after
reviewing the changes and confirming the existing D1, Workers AI and owner
secret bindings are preserved:

    cd cloudflare-worker
    npx wrangler deploy

Then check the deployed HTTPS Worker:
- GET /api/health -> 200, JSON, Cache-Control: private, no-store.
- POST /api/chat without owner token -> 401 and no-store.
- GET /icon.svg -> 200, Cache-Control: public, max-age=3600, s-maxage=3600.
- GET / -> 200, no-store, CSP, X-Frame-Options: DENY.
- With an authorized owner token, verify the existing Workers AI chat still
  works. Do not send real private data to an unverified external provider.

## Live acceptance check, 2026-10-27

- Cloudflare confirmed deployment `ceaec94f-57ef-47b2-a1da-8289d13ed07e`
  runs version 37 at 100%; the prior production version can be redeployed
  using the documented Worker Deployments API if rollback is required.
- Authenticated TinyFish browser smoke test: dashboard opened correctly;
  GET `/api/health` returned valid JSON with `ok: true`; `/icon.svg`
  loaded successfully (HTTP 200). No login loop or blank UI.
- Raw HTTP cache and security headers were NOT inspected through the browser
  network layer, so their live values are not independently verified by the
  smoke test; the source sets them and regression tests cover that policy.
- Actual health reported Workers AI as `@cf/openai/gpt-oss-20b`.
  `gpuSelfHostConfigured: false` and `wormgptConfigured: false`: neither
  a full self-hosted GPT-OSS 120B engine nor a WormGPT provider is running.
- Sentry requires an approved DSN and privacy review; OpenCode/OpenClaw
  external servers require verified infrastructure and service credentials.
