# Wormstar AI Lab — Cloudflare Workers

A Cloudflare-hosted browser interface for the Wormstar cybersecurity learning and analysis lab, separate from the original Python/Ollama CLI.

## Deployment

- Cloudflare Worker: `wormstar-ai-lab`
- Route: `https://wormstar-ai-lab.abdulstarzeki001.workers.dev/`
- API: `GET /api/health`, `POST /api/auth`, `POST /api/chat`
- Model: Cloudflare Workers AI `@cf/meta/llama-3.1-8b-instruct-fast`
- Scope: Arabic security assistant, code/log/IOC analysis, CTF tutoring, reporting. Text analysis only.
- No original CLI/remote shell commands are exposed.

## Required first-use configuration

**The web UI will remain locked until you create a Worker secret.**

Cloudflare Dashboard -> Workers & Pages -> `wormstar-ai-lab` -> Settings -> Variables and Secrets -> Add secret.

- Name: `WORMSTAR_ACCESS_TOKEN`
- Value: a unique strong passphrase/token of your choice; do not commit it to GitHub.

Alternatively from a trusted machine with Wrangler authenticated to the intended Cloudflare account:

```bash
cd cloudflare-worker
npx wrangler secret put WORMSTAR_ACCESS_TOKEN
```

The prompt allows you to securely enter the new value. Anyone with that value can use the text-analysis API. Cloudflare Access can be enabled separately for stronger identity-based protection.

## Local deployment

```bash
cd cloudflare-worker
npx wrangler deploy
```

The `wrangler.toml` file declares the Workers AI binding `AI`; the access token secret is configured separately.

## Availability and limits

Workers.dev is a persistent URL while the Cloudflare account and deployment remain active; continuous uptime, AI access, and billing depend on plan quotas and service availability. Cloudflare Workers does **not** run a persistent local Ollama instance and should not be treated as a traditional always-on Linux server.

## Notes

This is a separate Cloudflare Worker source of truth in `cloudflare-worker/worker.js`. Files in `cloud-app/` use an AppDeploy-specific SDK and should not be copied directly into Cloudflare Workers. User-requested external integrations are not yet connected inside the Worker. The original Wormstar project files remain unchanged.

## AI Studio and persistent learning memory (D1)

The interface contains an AI Studio for editing its assistant name, instruction preferences, and owner-defined constraints; users can save text/code snippets and upload UTF-8 source files as persistent knowledge. Knowledge is stored in Cloudflare D1 `wormstar_ai_memory` and applied to future prompts by relevant text matching and excerpt retrieval.

- D1 binding name: `DB`. The `wrangler.toml` configuration includes the database identifier.
- Tables: `ai_profile` for editable AI preferences and `knowledge` for uploaded code/text/notes.
- Allowed file types include text, Markdown, source code, CSV, JSON, and logs. Frontend caps individual files at 80 KB; server caps individual content at 60,000 characters and the library at 120 entries.
- Every studio API request requires the existing `WORMSTAR_ACCESS_TOKEN` credential; no automatic remote shell execution.
- AI model parameters stay unchanged; saving knowledge changes retrieved context, not the underlying neural-network weights.
- Saved profile and references persist across browser sessions; chat remains in-memory and may be exported separately.
- Dashboard: open your Worker under Workers & Pages and confirm Workers AI, D1 and WORMSTAR_ACCESS_TOKEN are bound.

**Note:** Previously documented first-run secret instructions remain valid if you have not set the access token. The site cannot unlock until the token binding is configured.
