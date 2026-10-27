# Wormstar Pro — no external WormGPT key

Deployed as an **alternative**, not an installation of proprietary WormGPT v5.1.

## What it is

- `wormstar-pro` selects the existing Cloudflare Workers AI binding already used by Wormstar NEO.
- Preferred inference: `@cf/openai/gpt-oss-120b`.
- On provider/model failure: `@cf/openai/gpt-oss-20b`, followed by `@cf/meta/llama-3.1-8b-instruct-fast`.
- No `WORMGPT_API_KEY`, `WORMGPT_MODEL_ID`, standalone GPU or new hosting subscription is required for this route. Existing Cloudflare plan quotas/usage charges can still apply.
- Uses existing bearer authorization, Cloudflare Access, owner policy, D1 memory/RAG and opt-in chat archive; it does not change model weights or disable security checks.
- The API response exposes `engineRequested:'wormstar-pro'`, `modelHost:'cloudflare-workers-ai'`, `modelUsed`, `fallbackUsed` and `modelsTried` so the actual inference model is verifiable.
- The old `wormgpt-v51` engine is still an unrelated **external API route** and remains disabled without verified provider credentials and model ID. No invented model weights, fake API key or submodule.
- The Cloudflare AI REST invocation of `@cf/openai/gpt-oss-120b` generated `READY` with HTTP 200 in a one-time verification on 2026-10-28. That verifies this backend can respond, **not** successful local GPU self-hosting.
- The mode is available from the model selector as **Wormstar Pro · قوي عبر Cloudflare (بدون مفتاح WormGPT)**. Previously saved model choice is retained.
- No passwords, private knowledge, model outputs or user conversations are placed in public edge caches.

## Verification

`cd cloudflare-worker && npm test`. CI tests mock Workers AI and cover routing, fallbacks, model identities, and lack of external credentials. For real production verification, sign in through Cloudflare Access, open the app, choose Wormstar Pro, and send a harmless prompt; confirm `modelUsed` and `fallbackUsed` from response metadata.

**Security:** If a GitHub PAT was pasted in an earlier chat/command, revoke it, audit its access and create a new least-privilege token outside of source control. Do not reuse the exposed token.
