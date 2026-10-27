# Wormstar Cloudflare operations: caching, security and monitoring

Last reviewed: 2026-10-27. Applies to the existing Worker wormstar-ai-lab
and optional external WormGPT API engine. This is a source-code configuration
guide, not evidence that a new Worker version was deployed.

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
- Cloudflare Access can now protect a single Worker including workers.dev
  directly. Enable it under Workers & Pages -> wormstar-ai-lab -> Access
  after identifying the intended owner identity (e.g. exact email address
  and identity provider). Require that identity; do not use an Everyone
  allow rule. If API clients need unattended access, configure a scoped
  Cloudflare Access service token and preserve the Worker bearer check.
- Existing Access applications on this Cloudflare account belong to other
  services. Do not reuse their policies or risk locking out the owner.
- Access was not enabled because the intended owner identity and
  service-token policy have not been provided.

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
  API was also updated and read back successfully on 2026-10-27; the live
  settings preserved AI, DB and WORMSTAR_ACCESS_TOKEN bindings. This does
  not mean the newly merged application code was deployed.
- Explicit model-backend failure events contain only an event name, fixed
  provider identifier and HTTP status. They deliberately omit user prompts,
  chat history, owner identity, IP, Authorization headers, tokens and
  upstream error messages.
- After deployment, review Worker -> Observability -> Logs, Metrics and
  Errors for 5xx rate, backend failures and latency. Workers analytics
  already exists independently of Sentry.
- To create Cloudflare Notifications alerts, choose an approved recipient
  and thresholds first. No alert was created without a destination.
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
