# Wormstar AI Lab — Cloudflare Workers

A Cloudflare-hosted browser interface for the Wormstar cybersecurity learning and analysis lab, separate from the original Python/Ollama CLI.

## Deployment

- Cloudflare Worker: `wormstar-ai-lab`
- Route: `https://wormstar-ai-lab.abdulstarzeki001.workers.dev/`
- API: `GET /api/health`, `POST /api/auth`, `POST /api/chat`
- Model: Cloudflare Workers AI `@cf/meta/llama-3.1-8b-instruct-fast`
- Scope: Arabic security assistant, code/log/IOC analysis, CTF tutoring, reporting. Text analysis only.
- No original CLI/remote shell commands are exposed.

## Private access token

The deployed Worker currently reports a `WORMSTAR_ACCESS_TOKEN` secret binding. For a fresh deployment or credential rotation, set the secret before signing in.

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

This is a separate Cloudflare Worker source of truth in `cloudflare-worker/worker.js`. Files in `cloud-app/` use an AppDeploy-specific SDK and should not be copied directly into Cloudflare Workers. The Worker includes owner-controlled Firecrawl import (requires its separate API key) and a browser-authenticated Supabase backup flow. Neither exposes the original CLI. The original Wormstar project files remain unchanged.

## AI Studio and persistent learning memory (D1)

The interface contains an AI Studio for editing its assistant name, instruction preferences, and owner-defined constraints; users can save text/code snippets and upload UTF-8 source files as persistent knowledge. Knowledge is stored in Cloudflare D1 `wormstar_ai_memory` and applied to future prompts by relevant text matching and excerpt retrieval.

- D1 binding name: `DB`. The `wrangler.toml` configuration includes the database identifier.
- Tables: `ai_profile` for editable AI preferences and `knowledge` for uploaded code/text/notes.
- Allowed file types include text, Markdown, source code, CSV, JSON, and logs. Frontend caps individual files at 80 KB; server caps individual content at 60,000 characters and the library at 120 entries.
- Every studio API request requires the existing `WORMSTAR_ACCESS_TOKEN` credential; no automatic remote shell execution.
- AI model parameters stay unchanged; saving knowledge changes retrieved context, not the underlying neural-network weights.
- Saved profile and references persist across browser sessions; chat remains in-memory and may be exported separately.
- Dashboard: open your Worker under Workers & Pages and confirm Workers AI, D1 and WORMSTAR_ACCESS_TOKEN are bound.

**Note:** The presence of a secret binding was verified; its value was not retrieved or displayed. Use your own access token when signing in.

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

## Server-enforced permissions and Supabase policy backup

The **Cloudflare Worker enforces permissions on the server**. The immutable deployment manifest is `cloudflare-worker/permissions.json`, generated as `permissions-module.js` for direct Cloudflare module uploads. `worker.js` imports the generated module. The manifest is **deny by default** and keeps shell, Python, user-code execution, active network scanning, credential harvesting, and self-modifying deployments disabled. The original Python/Ollama CLI is unchanged.

To edit technical capabilities, review `permissions.json`, then run:

```bash
cd cloudflare-worker
node scripts/generate-permissions.mjs
node scripts/verify-permissions.mjs
npx wrangler deploy
```

In the **AI Studio → اتجاه الذكاء والصلاحيات التشغيلية**, the owner can edit a **narrower runtime policy** stored in D1 `ai_policy`: mission, answer style, allowed modes, required scope phrases, input/output limits, memory retrieval, webpage import, and knowledge deletion. Changes are validated and enforced by Cloudflare. The runtime policy **cannot grant capabilities denied by the deployment manifest**. Test drafts with the built-in policy evaluator before saving.

A separate Supabase table `public.wormstar_owner_policies` now stores an owner-scoped backup of this runtime policy. Its RLS policies require the signed-in Supabase Auth user's `auth.uid()` to match `owner_id`; anonymous access grants were revoked. Database changes are recorded in:
- `supabase/migrations/20261025_wormstar_owner_policy_backup.sql`
- `supabase/migrations/20261025_wormstar_owner_policy_revoke_anon.sql`

After signing in to Supabase **inside Wormstar AI Studio**, choose **نسخ ذاكرة Cloudflare إلى Supabase** to back up the current runtime policy alongside the profile and knowledge. Future edits to the runtime policy attempt automatic mirroring while signed in. Use **استعادة قيود التشغيل من Supabase** to restore a backup after an explicit confirmation; the server validates it and does not allow the restore to bypass `permissions.json`. The offline JSON export now includes the runtime policy.

**Operational boundaries:** Supabase policy backup requires an active Supabase Auth session and is not an unconditional server-side replication process. The authoritative live runtime policy remains in Cloudflare D1. Firecrawl webpage import remains unavailable until a `FIRECRAWL_API_KEY` secret is configured. No remote shell is exposed.

## Specialized cybersecurity policy pack

The canonical policy files live under `policy/`:

- `system_prompt.md` is the deployed system instruction text for the restricted cybersecurity analysis lab.
- `permissions.json` is the server-enforced capability allowlist and operational limits (default deny).
- `rules.yaml` and `workflow.md` document task routing, scope, and analysis sequence.
- `knowledge.md` and `corrections.md` describe how to curate and correct references.
- `training.jsonl` provides 12 demonstration examples. Importing these examples does not fine-tune the model.
- `tests.json` describes expected API policy behavior.

Deploying the policy:

```sh
cd cloudflare-worker
node tools/sync-policy.mjs
npm test
npx wrangler deploy
```

GitHub Actions also includes `.github/workflows/wormstar-policy-tests.yml` for future commits. Changes to policy source files must be synced into `worker.js` and redeployed to take effect. The live Worker may include additional compiled modules required by its current version; when deploying directly with Cloudflare API, include all imports.

The Worker checks owner authentication, explicitly allowed API capabilities, valid analysis modes, and request size; unsupported lab operations return an error rather than executing. This does not constitute a guarantee about every free-form sentence generated by a language model. A user-uploaded JSON/YAML file by itself does not grant the service new tools, permissions, or deployed capabilities.

## Futuristic Mission Control UI — 2026-10-25

The existing Cloudflare Worker now serves a redesigned **Wormstar Mission Control** interface from a separate version-controlled ESM module `cloudflare-worker/future-ui.js`.
The module contains responsive CSS and a progressive client-side navigation shell. `worker.js` injects it into the original HTML without replacing the API, authentication, D1 queries, policy enforcement, Supabase backup, or Firecrawl import.

### Main routes (hash-based, same Cloudflare Worker URL)

| Route | Page |
| --- | --- |
| `#/overview` | Dashboard, memory and mode status, mission summary, launch cards |
| `#/assistant` | AI conversation |
| `#/code`, `#/logs`, `#/ioc`, `#/ctf`, `#/report` | Specialized analysis modes |
| `#/studio/policy` | Owner mission, allowed modes, server-side policy controls, tests |
| `#/studio/profile` | AI name, instructions, writing style, user constraints |
| `#/studio/knowledge` | Upload source/text, save corrections, Firecrawl document import |
| `#/studio/library` | Search/edit/delete the saved memory library |
| `#/studio/cloud` | Supabase identity and backup / restore actions |

The launcher is a true SPA navigation layer on top of existing UI controls, so pages do **not** become new unauthenticated API endpoints. On initial successful lab login, the dashboard is the default; the site preserves a valid `#/...` route for refresh/back/forward navigation. Any protected API still requires the `WORMSTAR_ACCESS_TOKEN` Bearer credential. Saved chat contents remain session-scoped.

### Navigation and accessibility

- Desktop: collapsible module-style rail, studio sub-navigation, page breadcrumbs and status indicators.
- Mobile: slide-out menu and four-entry fixed bottom dock.
- Global command palette: `Ctrl+K` on Windows/Linux or `⌘K` on macOS, then filter, arrow up/down, Enter, Escape.
- `prefers-reduced-motion: reduce`, focus-visible rings, text-based state, user-confirmed destructive actions, no external font/CSS dependencies.
- The private mobile dock only appears after the existing lab login check succeeds.

### Build and deployment

- Worker entrypoint: `cloudflare-worker/worker.js`.
- Hardened server permission module: `cloudflare-worker/permissions-module.js` generated from `cloudflare-worker/permissions.json`.
- Visual shell module: `cloudflare-worker/future-ui.js`.
- `wrangler.toml` bundles local imported ESM files during `npx wrangler deploy`. If uploading directly to the Cloudflare multipart API, include **all four** modules (`worker.js`, `permissions-module.js`, `future-ui.js`, `app-icon.js`) under their exact filenames.
- Cloudflare D1 binding `DB`, AI binding `AI`, and existing `WORMSTAR_ACCESS_TOKEN` secret must be preserved across deployments.
- The frontend is intentionally isolated from remote code execution: styling, navigation, and routing do not elevate any tool permission.

Public-page layout and latest deployment have been checked. Authenticated policy editing, Supabase sign-in and privileged data operations should be regression-tested with the account owner on the live site, rather than assuming that a successful public load tests those private flows.

## Wormstar NEO iPhone Home Screen / PWA

The iPhone icon is now **an actual server-served PNG**, not a mockup in a chat. The Worker serves:

- `/apple-touch-icon.png`: real branded 96 x 96 PNG (generated from the original cyber shield design), served with image/png.
- `/icon.svg`: scalable premium shield for standard browser icon and PWA.
- `/manifest.webmanifest`: standalone app metadata with start URL, title, icon and theme color.
- `/`: new cinematic zero-trust gateway visible **before** login, not only a dashboard that shows after unlocking the lab.

The page head advertises `rel="apple-touch-icon"`, `rel="manifest"`, iOS standalone metadata and a versioned cache-busting icon URL. The Content Security Policy allows only same-origin icon images and same-origin manifest. Protected APIs remain behind the existing Bearer token.

### iPhone installation

1. Open **Safari** on iPhone (not an in-app browser) and visit `https://wormstar-ai-lab.abdulstarzeki001.workers.dev/`.
2. Reload if the site is cached. Tap **Share** → **Add to Home Screen**; use the name **Wormstar NEO**.
3. If an old shortcut was already installed, remove that Home Screen shortcut first, then repeat these steps. iOS may cache old icons and does not automatically replace an existing Web Clip icon when the website changes.
4. Open the new icon. It launches the standalone home-screen web app; secure data remains protected by the login key.

### Regression tests

Run `cd cloudflare-worker && npm test`. Node's test suite now validates PNG headers and zlib-compressed pixels, SVG icon format, iOS/PWA links, route wiring, redesigned unauthenticated gateway, and the original security API contracts. GitHub Actions runs the test suite for the feature branch and pull requests.

The application is a PWA/Home Screen web app, **not an App Store native iOS application**, and it does not bypass Cloudflare authentication or guarantee offline AI inference.

## Wormstar NEO owner-locked persistent memory — 2026-10

- Operational profile, active permissions, and references are stored in Cloudflare D1. The AI retrieves relevant excerpts; references do not alter model weights.
- Supabase wormstar_starter_presets stores a reusable Cyber Architect profile/policy. The owner-neutral wormstar_starter_library has ten extra advanced modules, versioned in cloudflare-worker/knowledge/neo_advanced_library.json.
- Private Supabase wormstar_* tables have owner-scoped RLS and remain empty for a user until that user signs in with Supabase Auth and chooses backup. A Supabase Dashboard account is not automatically a Supabase Auth user.
- The Worker-only D1 supabase_owner_binding table stores just a verified Supabase Auth UUID, email, and initial binding timestamp. POST /api/studio/supabase-owner verifies the supplied access token with Supabase Auth before setting an unclaimed identity. An already-bound worker rejects another Auth account to avoid mixing memory across identities. The route requires Wormstar bearer authorization.
- Optional Keep Supabase connected persists the browser session in localStorage and refreshes it on reopening. This is not a guarantee of perpetual authorization: sessions can be revoked, expire, or disappear when Safari website data is cleared. Disable on shared devices.
- Lab logout does not delete a separately remembered Supabase login. Use Disconnect Supabase to end that session. Disconnecting does NOT transfer the permanently owner-locked memory to another Auth identity; documented admin transfer would be needed.
- Importing missing starter references now mirrors them to Supabase if the user is authenticated. Still take periodic full JSON backups. No password, service_role key or refresh token is saved in D1 or GitHub.
- Regression tests: cloudflare-worker/tests/owner-memory-binding.test.mjs. D1 migration: cloudflare-worker/migrations/20261025_supabase_owner_binding.sql.

## Private chat history (owner opt-in)

Wormstar chat memory is **separate from the AI reference knowledge library**. User conversations are not automatically converted into knowledge or model training samples.

- In the chat composer, open **☁ سجل المحادثات السحابي** to explicitly save, restore or delete a per-mode transcript from **Cloudflare D1**.
- The **automatic backup** checkbox is off by default on a new device. Once opted in on that device, it saves after a successful model reply. Only the preference toggle is stored in browser localStorage; conversation text is not stored there.
- The private `/api/studio/chat-archive?mode=...` endpoint supports GET and DELETE; `PUT /api/studio/chat-archive` stores a transcript. All require the Wormstar owner access token and explicit server permission capabilities: `memory.chats.read`, `memory.chats.write`, `memory.chats.delete`.
- Saved transcripts are bounded to the last 18 messages / 26,000 characters per analysis mode, and each mode has a revision counter. If another browser updates a record first, the Worker rejects stale updates with HTTP 409 rather than silently overwriting them.
- Cloudflare D1 holds chat archive content; this is **not end-to-end encrypted**. Avoid entering credentials, secrets or personal details in chats, and delete unwanted cloud transcripts with the in-app control.
- **جلسة جديدة** clears local visible messages for that mode but deliberately does not erase its previous cloud backup. A distinct confirmation is required to delete the archive.
- Chat requests use timeout-based network failure handling: unsuccessful sends restore the unsent prompt and remove the speculative user bubble instead of creating duplicate history.
- D1 migration: `cloudflare-worker/migrations/20261026_chat_archives.sql`, executed before deploying routes. Regression tests: `cloudflare-worker/tests/chat-archive.test.mjs`.

Other application knowledge in D1, Supabase Auth, and the original Python/Ollama CLI are unchanged by this archive feature.
