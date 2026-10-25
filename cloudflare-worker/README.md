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

## Supabase persistent backup and versioned training — 2026-10-25

The existing Supabase project now has independent Wormstar tables, with no changes to unrelated application tables:
- `public.wormstar_ai_profiles`: owner-scoped instructions and constraints.
- `public.wormstar_memory_items`: uploaded code, notes and documents.
- `public.wormstar_memory_versions`: previous revisions retained after edits (deleted with their original item).
- `public.wormstar_training_events`: owner-scoped corrections and feedback.

All four tables have owner-isolated RLS policies. Schema: `supabase/migrations/20261025_wormstar_persistent_training_memory.sql`.

### Connect and use

1. Open the Cloudflare Wormstar AI Studio and unlock the lab.
2. Under Supabase persistent memory, sign in as a Supabase Auth user of the linked Supabase project. A Supabase Dashboard admin is not necessarily an Auth user. Account creation is offered if signups are enabled.
3. Press **Back up Cloudflare memory to Supabase** to sync existing D1 data. New changes and corrections attempt automatic mirroring while that browser session is linked.
4. Use **Restore knowledge from Supabase** to rebuild D1 knowledge without overwriting existing item IDs. Restoring the AI profile requires separate confirmation.
5. Keep offline JSON exports too. No cloud provider can guarantee data survives deliberate deletion, account closure, outages or billing disruptions.

Client authentication uses only the public Supabase publishable API key and the user's Supabase Auth JWT. No service-role or secret database keys are included in the deployed source. Supabase sessions live in browser sessionStorage and are cleared when signing out of Wormstar.

**Capacity:** D1 holds up to 120 notes of 60,000 characters. Uploaded files are capped at 80 KB each. Future AI prompts retrieve selected relevant excerpts; this is persistent retrieval, not neural-network weight training.

### Firecrawl page import

The **Import webpage via Firecrawl** action is available in the Studio. Activate it by saving a `FIRECRAWL_API_KEY` Cloudflare Worker secret in Settings → Variables and Secrets. When explicitly requested by the owner, Firecrawl imports a public HTTPS page as a reference in D1, and Supabase if connected.

### FastAPI Cloud integration status

No FastAPI Cloud service was provisioned or deployed. The existing cloud backend is Cloudflare Workers; a future FastAPI Cloud sidecar could process larger uploads/indexes once a target FastAPI Cloud app is selected and authorized. This is not necessary for current persistent text memory.

### GitHub source

The cloud application and database migration are versioned on the `feature/wormstar-private-cloud-lab` branch. Original Python/Ollama root files remain unchanged. Uploaded private training files and tokens are stored in hosting databases/session storage, not committed to GitHub.


## Custom mission and enforceable owner policy

The `wormstar-config/` directory contains nine editable templates for system instructions, rules, permissions, workflow, knowledge, JSONL demonstrations, corrections, automated checks and usage instructions.

**These files do not alter permissions merely by being uploaded.** For active rules, open the deployed app, unlock the AI Studio, and use the **Owner-enforced Policy / اتجاه الذكاء والصلاحيات التشغيلية** panel:

- **Mission:** owner-editable direction, inserted into the AI system prompt as a user preference.
- **Allowed modes:** disabled modes are rejected server-side by `POST /api/chat`.
- **Required terms:** optional one-of matching against the submitted question (literal phrase gate, not semantic topic classification).
- **Limits:** maximum input characters (200–12000), model output tokens (128–1800).
- **Memory use:** toggle whether saved D1 references can enter the model context.
- **Web import and memory deletion:** toggles checked on the corresponding server endpoints.
- **Workflow and style:** system-prompt instructions; model compliance is not guaranteed.
- **Try the rules:** the UI calls `POST /api/studio/policy/evaluate` with unsaved draft settings; it does not invoke the AI model.

The active policy is stored in the D1 `ai_policy` row and retrieved for every new AI request. Schema migration: `cloudflare-worker/migrations/0002_owner_policy.sql`. A server capability registry provides an additional baseline; the custom policy cannot enable shell execution, Python execution, active network scanning, or unrestricted remote code execution in the cloud companion.

All policy endpoints require the existing Wormstar access token. Custom mission is intentionally blank until the owner supplies a single concrete direction. Current defaults retain all existing analysis modes, 12,000 input characters and 1,500 output tokens, and existing memory/web import/delete features; the owner may narrow them in the UI.

Important: The separate legacy Python/Ollama entrypoints in the repository root have **not** been altered or brought under this Cloudflare policy.
