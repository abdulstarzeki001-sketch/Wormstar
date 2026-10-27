# Wormstar NEO × OpenCode Coding Agent

**Upstream:** https://github.com/anomalyco/opencode, default branch `dev`, MIT license. This adapter integrates with the upstream coding agent rather than copying or silently forking its large source tree.

## Architecture

- **iPhone / Wormstar PWA** → Cloudflare Worker owner-authenticated endpoints → Cloudflare Access-protected OpenCode server on a separate Linux host.
- New owner APIs: `GET /api/opencode/status`, `GET/POST /api/studio/opencode/session`, `POST /api/studio/opencode/prompt`.
- Server actions are strictly allowlisted. The Wormstar Cloudflare Worker does **not** expose raw OpenCode filesystem, terminal, installation, MCP management, shell or plugin administration routes. OpenCode's own host permissions determine agent abilities.
- No host is provisioned or connected simply by committing these files. UI and status must state **not connected** until independently verified.

## Host setup — OpenCode v2 (not legacy v1)

1. Provision a dedicated Linux host with Docker, persistent volumes and limited access. It must have outbound access to the model backend you intend to use.
2. **Install the official OpenCode v2** package from anomalyco/opencode: `npm install -g @opencode/cli`, or the reviewed official v2 release binary. Pin the approved version in production. Do not install the older `opencode-ai` v1 package by mistake: this bridge targets the v2 `/api/session` protocol.
3. Start its HTTP server with a strong `OPENCODE_SERVER_PASSWORD` and listener bound to localhost only. Verify the version's supported `opencode serve` flags.
4. Publish it only through a Cloudflare Tunnel with a Cloudflare Access **service-token-only** policy; do not expose port 4096 to the public internet.
5. Run `bash cloudflare-worker/opencode-agent/verify-v2.sh` on the host to check both `/api/session` and `/api/session/active` with Basic Auth. Configure a working model provider on the OpenCode host; Cloudflare Workers AI model bindings in Wormstar are not automatically exposed to OpenCode.
6. Set the Cloudflare Worker secrets `OPENCODE_BASE_URL`, `OPENCODE_SERVER_PASSWORD`, `OPENCODE_ACCESS_CLIENT_ID`, `OPENCODE_ACCESS_CLIENT_SECRET`. Never put them in GitHub or browser JavaScript.
7. Verify the protected `/api/session` endpoint from Cloudflare, then test the Wormstar owner-authenticated status route and session creation. No separate service is provisioned simply by committing these files.

## Production controls

OpenCode can edit files, run commands and create agent sessions **on its host** according to its own permissions. Start with a sandboxed workspace clone, non-root user, no Docker socket mounting, no production keys and review every write/test before merging.

OpenCode's current protocol in upstream `packages/protocol/src/groups/session.ts` uses:
- `GET /api/session` to list sessions
- `POST /api/session` with `{title}` to create a session
- `POST /api/session/:sessionID/prompt` with `{text}` to submit input

The source is a moving `dev` branch; pin a release/commit before deploying. Confirm API compatibility and OpenCode workspace/model configuration on host.

## Why not copy the full upstream repo?

The OpenCode application requires a Bun/Node runtime, filesystem, process execution, package dependencies, persistence, and authorized tools. A Cloudflare Worker cannot be a direct replacement for a persistent coding agent server; reimplementing it inside the Worker would falsely imply full functionality.

## Enhanced OpenCode v2 agent operations

- `GET /api/session/active`: active sessions.
- `GET /api/session/:sessionID/diff?context=3`: a bounded preview of code changes.
- `POST /api/session/:sessionID/interrupt`: interrupt the current task without erasing prior file changes.
- Wormstar proxies these through owner-authenticated `/api/studio/opencode/progress` and `/api/studio/opencode/interrupt`, with independent server permissions.
- iPhone controls show the task state, file diffs, owner-triggered stop and optional 12-second polling. Raw shell/config/plugins endpoints remain inaccessible through the bridge.
- Three read-only specialized subagents are committed at the repository root: `.opencode/agents/wormstar-reviewer.md`, `wormstar-security.md` and `wormstar-test-engineer.md`. OpenCode v2 discovers them when running inside a cloned Wormstar workspace.

Official references: https://github.com/anomalyco/opencode · https://opencode.ai/v2/docs · https://opencode.ai/v2/docs/agents · https://opencode.ai/v2/docs/api

**OpenCode host still needs provisioning and four Cloudflare secrets**. Its model provider credentials are configured separately from Wormstar Workers AI.

## Ready-to-run host preparation and CI verification

- [HOST_SETUP.md](HOST_SETUP.md): dedicated Linux host, official pinned v2 CLI, systemd, Cloudflare Tunnel/Access and required secrets.
- [bootstrap-host.sh](bootstrap-host.sh): install the reviewed `@opencode/cli@2.1.4` package on the **host** as a non-root user; it does not expose or start a server.
- `.github/workflows/opencode-v2-protocol-smoke.yml`: GitHub Actions isolated local server smoke test. It does not verify production connectivity or execute model prompts.

Do not mark the live agent as connected until the host, Access policy and all four Cloudflare Worker secrets are configured and verified.
