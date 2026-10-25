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
