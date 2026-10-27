# WormGPT source provenance and safe optional integration

Reviewed 2026-10-28 for Wormstar NEO. **No proprietary WormGPT weights were downloaded or deployed.**

## Verified source status

- `WormGPT-Official/WormGPT-Core` and `WormGPT-Official/WormGPT-Weights` both returned HTTP 404 from the GitHub repository API. They could be private, renamed or nonexistent. Do **not** install either as a submodule, claim they are official, or set up an automated trust relationship without independent authorization and source verification.
- `https://github.com/WormGPTv2/wormgpt` exists publicly. It describes itself as an **independent, Node.js >=22 coding agent CLI**, not model weights, and is unrelated to the name/version of any paid WormGPT API service. Its advertised terminal/bash tools must not run in the Cloudflare Worker or privileged production environment.
- Several unrelated providers market the name WormGPT. The provider URL and model ID must be confirmed with the intended account owner and a real API contract. A hostname or promotional version number alone does not establish ownership, operational availability or model weights.
- The **optional existing Wormstar API adapter** is currently fixed at `https://api.wormgpt.live/v1/chat/completions`. The owner MUST independently establish that this is the correct contractual API provider and model ID **before placing secrets into Worker settings**. Do not assume `/v1/generate` or `WormGPT-v5.1` exist.

## Immediate credential incident

A GitHub personal access token (PAT) was included in a chat-provided sample clone URL. If valid, revoke it in GitHub Settings > Developer settings > Personal access tokens; rotate affected deployment credentials and audit recent GitHub account access if necessary. Do not reuse or commit that token. Do not put secrets in Git remote URLs, terminal history, issue comments, code, logs or generated tests.

## Safe integration steps for the real owner

1. Verify a trusted provider identity, service agreement, exact HTTPS API path, response schema, billing and actual model ID through their authenticated dashboard. Review their data retention terms and privacy policy for submitted prompts.
2. Issue a new *provider-specific* API key with minimum permissions. Keep the GitHub PAT, Cloudflare API token and external model credentials as separate secrets. Never put provider credentials into browser JavaScript.
3. Only after verifying the provider endpoint used by `wormgpt-provider.js`, set `WORMGPT_API_KEY` as a Cloudflare Worker secret and `WORMGPT_MODEL_ID` as a validated Worker setting/secret (no password values in git). Restart or deploy only after reviewing the resulting binding and API response.
4. The `wormgpt-v51` engine value is a **legacy internal routing identifier**, not a claim that v5.1 is installed. The UI now labels it `WormGPT API · external` instead. This route requires explicit selection and authenticated access.
5. Validate through an explicitly chosen harmless test prompt, make sure a nonempty text reply arrives, check provider HTTP status, latency, model identifier, Cloudflare Access and privacy/no-cache headers. Do not forward saved personal notes to an untrusted provider.
6. Keep production on Workers AI `@cf/openai/gpt-oss-20b` / configured allowed Cloudflare backends if the external service is not verified. Do not switch automatically to an untrusted external provider.

## Coding-agent CLI is separate from model weights

The public `WormGPTv2/wormgpt` project can be **evaluated** in an isolated, non-privileged Node >=22 environment, with pinned commit/tag and an audited dependency lockfile, only if the owner wants that specific project. Do not automatically clone it into `src/wormgpt`, install as root, or run arbitrary commands on the Wormstar production host. The Cloudflare Worker is not a persistent Linux/Docker/GPU service.

For any externally hosted agent use a separate narrowly scoped host identity, allowlisted repository, explicit task approval, resource limits, disabled arbitrary remote shell access by default, and outbound network restrictions.

## Cloudflare storage and telemetry

- D1 and Supabase already store knowledge. R2 is object storage and does **not** provide GPU inference or model execution. Provision it only for approved binary artifacts/files, with lifecycle/retention rules and a separate cost review.
- KV and CDN caching must not store per-user prompts, secrets, memory or provider responses. Cache only immutable public assets with the existing safe headers.
- Cloudflare Workers native Logs/Issues and email notifications are enabled; Sentry is optional and requires a separate DSN and privacy review.
- An external paid GPU, OpenClaw or CLI server is NOT active merely because source/config files exist.

## Security regression tests

`cd cloudflare-worker && npm test` verifies that the optional external provider rejects malformed credentials, does not send requests when unconfigured, pins HTTPS, rejects redirects/HTML/oversized replies, and never forwards arbitrary user-supplied endpoint URLs. No production API credentials or live personal messages are used by tests.
