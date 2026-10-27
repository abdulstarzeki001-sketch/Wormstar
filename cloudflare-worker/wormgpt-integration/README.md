# Optional WormGPT API bridge for Wormstar

## Provenance and scope

The suggested source repository https://github.com/WormGPT-Official/WormGPT-Core
returned GitHub 404 on 2026-10-27. Do not clone it, invent its Python
modules, install unreviewed Git submodules, or embed GitHub tokens in clone URLs.

The website at https://wormgpt.live/llms.txt advertises an OpenAI-compatible
API base https://api.wormgpt.live/v1 and lists v5.1 among its models. Its
public site also lists newer versions. The exact v5.1 API model identifier
was not verified. Different services using the name WormGPT make conflicting
claims of official status. Verify the provider, terms, pricing, privacy, and
model identifier independently before sending any project data.

## Cloudflare Worker

This integration is opt-in, off by default, and makes no external call
unless the owner selects the wormgpt-v51 engine in the chat UI. The existing
Workers AI default, policies, owner bearer authentication, and storage remain
unchanged.

After validating a legitimate provider account and the model ID, set two
Cloudflare Worker secrets (never commit the values):

    cd cloudflare-worker
    npx wrangler secret put WORMGPT_API_KEY
    npx wrangler secret put WORMGPT_MODEL_ID
    npx wrangler deploy

WORMGPT_MODEL_ID must be the actual v5.1 identifier supplied by your provider,
not a guessed name. Do not add it to wrangler.toml as an unsupported default.

The Worker pins the outbound URL to
https://api.wormgpt.live/v1/chat/completions, requests a non-streaming
OpenAI-style completion, and uses a 25-second timeout. Confirm the endpoint
and response shape with the provider before enabling production traffic.
It does not proxy model tools or shell execution. Provider errors do not
silently fall back to another model.

Privacy: selecting this engine sends the current message, limited
conversation history, owner instructions and any explicitly/retrieval-attached
knowledge excerpts to the external provider. Do not select it for confidential
material without a privacy/security review. No Cloudflare caching is enabled
for model responses.

## Local Python assistant

The existing wormgpt.py continues to use local Ollama by default. To
explicitly select the external provider:

    export WORMSTAR_MODEL_PROVIDER=wormgpt-api
    export WORMGPT_API_KEY='obtain-from-your-own-provider-account'
    export WORMGPT_MODEL_ID='exact-verified-v5.1-model-id'
    python3 wormgpt.py

Keep secrets in your local secret manager or environment, never in source or
shell history. There are no new Python dependencies; the adapter uses stdlib.
Run offline tests with:

    python3 -m unittest discover -s tests -p 'test_wormgpt_provider.py'
    cd cloudflare-worker && npm test

## Activation criteria

- [ ] Independently verify provider identity and model ID.
- [ ] Confirm authenticated API response shape and acceptable data handling.
- [ ] Configure the two Cloudflare Worker secrets.
- [ ] Deploy the reviewed Worker and verify the owner-selected engine.
- [ ] Keep existing Cloudflare Workers AI as the default.
