# Wormstar Cloudflare operations: caching, security and monitoring

Last reviewed: 2026-10-27. Applies to Worker wormstar-ai-lab and the optional
external WormGPT API. **Production state verified:** Cloudflare Worker version
37 (`ba618134-5c38-4d65-8e38-6a998a7cb044`) deployed to 100% of traffic
on 2026-10-27. Previous working version 36 (`f1dd59b2-9edc-47a2-ac6d-ebff11b5bd78`)
remains available for rollback. TinyFish checked the protected dashboard,
`/api/health` JSON (`ok: true`) and `/icon.svg` (HTTP 200) after deployment.
The browser-based test could not directly read HTTP response headers.

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
- Cloudflare Access **is enabled** for precisely this Worker, including its
  `workers.dev` and preview addresses (Worker destination); it allows only
  the account owner's exact verified email through the existing Cloudflare
  identity provider, with an 8-hour session. It does not grant access to
  other Workers. An Everyone allow rule is not present.
- This Access layer applies in addition to the Worker bearer-token check.
  If API clients need unattended access, configure a scoped Access service
  token and a separate Service Auth policy; none has been created yet.
- Existing Access applications on this Cloudflare account belong to other
  services. Do not reuse their policies or risk locking out the owner.

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
  invocation_logs = false, redact_query_string = true, and traces disabled;
  `[observability.issues] enabled = true` groups production failures.
  Cloudflare's Worker settings API was updated and verified live on
  2026-10-27. The version 37 deployment retained bindings AI, DB and
  WORMSTAR_ACCESS_TOKEN, including the original secret without revealing it.
- Explicit model-backend failure events contain only an event name, fixed
  provider identifier and HTTP status. They deliberately omit user prompts,
  chat history, owner identity, IP, Authorization headers, tokens and
  upstream error messages.
- Worker -> Observability -> Logs, Metrics and Issues provides native
  failure diagnostics; Issues has been enabled for wormstar-ai-lab.
- A Cloudflare Notifications policy named **Wormstar / Workers real-time
  errors** (`d9307de36e4f43a2acb276721a07a7c1`) is **enabled**, sending
  `workers_observability_real_time_issue` notices to the account owner's
  already verified email. Its notification type is account-level, but a
  separate enabled Workers Issues automation (`97378f44-e14e-448c-bae8-4eaa7c77cd55`)
  is scoped to service `wormstar-ai-lab` and fires on the first issue
  occurrence, routing through that policy. Other account-level uses of
  the same notification type could still generate unrelated notices.
  Actual email delivery has not yet been tested.
- There is no separate Sentry account integration or DSN.
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

CI tests alone do not deploy to Cloudflare. Version 37 was uploaded by the
Cloudflare Versions API and separately deployed; its D1, AI and secret
bindings were checked before and after. For subsequent changes, validate
all bindings before deployment and keep a rollback version:

    cd cloudflare-worker
    npx wrangler deploy

Then check the deployed HTTPS Worker:
- GET /api/health -> 200, JSON, Cache-Control: private, no-store.
- POST /api/chat without owner token -> 401 and no-store.
- GET /icon.svg -> 200, Cache-Control: public, max-age=3600, s-maxage=3600.
- GET / -> 200, no-store, CSP, X-Frame-Options: DENY.
- With an authorized owner token, verify the existing Workers AI chat still
  works. Do not send real private data to an unverified external provider.

## Remaining external dependencies and known limits

- The health endpoint advertises the public model label `gpt-oss-120b`, but
  its reported actual Cloudflare model backend is `@cf/openai/gpt-oss-20b`.
  Do not claim a self-hosted 120B model or GPU inference; `gpuSelfHostConfigured`
  currently reports `false`.
- The external WormGPT API remains disabled pending verified provider
  credentials and model ID. OpenCode requires a separately provisioned
  private host; Cloudflare Pages/Worker alone does not run its server.
- Sentry requires an explicitly authorized DSN and privacy review and is
  intentionally not enabled. Worker native Issues and Cloudflare Logs are
  operating instead.
- No KV namespace or global one-hour edge cache rule was created. D1 already
  stores private memory; public asset cache response headers are deliberately
  narrow and have not been separately confirmed as edge cache HITs.
