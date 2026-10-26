# OpenClaw integration for Wormstar NEO

**Status:** Cloudflare Worker bridge and iPhone control center are integrated in the code. A separate always-on OpenClaw Gateway is REQUIRED. No Gateway, channel, plugin, or device has been installed by this GitHub change.

## Architecture

Wormstar Safari / iPhone UI → owner-authenticated Cloudflare Worker → Cloudflare Access-protected HTTPS tunnel → owner-managed OpenClaw Gateway → authorized agent tools and model provider.

The Worker exposes only a restricted chat call and status probe, not OpenClaw operator RPC, filesystem, shell, plugin installation or cron configuration. A Gateway API bearer token is equivalent to operator privileges, so use a dedicated locked-down Gateway, not your unrestricted personal one.

## 1. Prepare the persistent host

Install OpenClaw on a computer or server you control. Current OpenClaw requires a supported Node version (see official docs; Node 26 recommended). From that host:

    node --version
    npx openclaw@latest

Complete onboarding with an authorized model provider, verify an actual completion, and install the Gateway as a background service. The existing Cloudflare Workers AI binding in Wormstar does NOT automatically supply an upstream OpenClaw provider key.

Official: https://docs.openclaw.ai/start/getting-started

## 2. Harden the Gateway

Copy only the settings you understand from openclaw/config.template.json5 into your existing OpenClaw configuration; do not replace existing provider/account configuration wholesale.

- Keep gateway.mode=local and gateway.bind=loopback; do not expose port 18789 to the public internet.
- Set gateway.auth.mode=token. Generate a random long OPENCLAW_GATEWAY_TOKEN on the Gateway host.
- Explicitly enable gateway.http.endpoints.chatCompletions.enabled=true. OpenClaw disables it by default.
- Use tools.profile=minimal and tools.exec.mode=deny. Keep browser, shell, file write, gateway admin, nodes and cron restricted until approved individually.
- Expose the local Gateway via a private Cloudflare Tunnel hostname protected by Access service-token authentication for **all** paths. Restrict origin and firewall egress as appropriate.
- Run openclaw security audit --deep and openclaw gateway status after configuration.

Gateway docs: https://docs.openclaw.ai/gateway/openai-http-api
Security docs: https://docs.openclaw.ai/help/faq/security-and-access-control
Tool policy docs: https://docs.openclaw.ai/gateway/config-tools/tool-policy

## 3. Set Cloudflare Worker secrets

On the Cloudflare dashboard of wormstar-ai-lab, set the following Secrets, not public Variables, not GitHub, and not Supabase:

| Cloudflare Worker secret | Meaning |
|---|---|
| OPENCLAW_GATEWAY_URL | Root HTTPS origin for private Access-protected Tunnel, e.g. https://openclaw.example.com/ |
| OPENCLAW_GATEWAY_TOKEN | Random Gateway token from the OpenClaw host |
| OPENCLAW_ACCESS_CLIENT_ID | Cloudflare Access service token client ID |
| OPENCLAW_ACCESS_CLIENT_SECRET | Matching Cloudflare Access client secret |

The Worker forwards only the Gateway bearer token and optional Access service credentials server-side. Never send these secrets to the browser. If deploying via the Cloudflare multipart API, preserve existing secret_text bindings using metadata entries of type inherit.

## 4. Use in Wormstar

- Log in with the original Wormstar access token.
- Navigate to Control → OpenClaw Agent and press Check connection.
- This calls authenticated GET /api/openclaw/status and then Gateway GET /v1/models. Only a response listing openclaw/default is considered connected.
- When connected, the OpenClaw chat engine becomes selectable in Wormstar's existing chat model selector.
- POST /api/chat with engine=openclaw-agent forwards sanitized chat turns via Gateway POST /v1/chat/completions, model=openclaw/default, user=wormstar:owner:<mode>.
- Existing server policy still filters modes, memory and input length. The Gateway imposes its own independent permissions on tool execution.
- A Gateway failure is returned as a real error; the UI does not silently switch to GPT-OSS and pretend OpenClaw executed a task.

## 5. OpenClaw capabilities and activation

| Capability | Wormstar integration | Required Gateway setup |
|---|---|---|
| Agent chat | Implemented authenticated bridge | Persistent Gateway + model provider |
| Sessions | Stable session ID by Wormstar analysis mode | Gateway session storage |
| Skills / plugins | Feature inventory in control center | Audit and install manually on host |
| Channels (Telegram, WhatsApp, Slack, Discord, etc.) | Feature inventory | Each channel plugin, credentials, pairing and sender allowlists |
| Cron, heartbeat, webhooks | Feature inventory | Specific approved schedules and restricted actions |
| Browser and coding tools | Disabled in conservative template | Explicit opt-in, sandbox, approvals and audit |
| Images, audio, documents, video | Feature inventory | Channel/media provider and approved data handling |
| Mobile / desktop nodes | Feature inventory | Client install, device pairing, OS permission consent |
| Persistent memory | Wormstar D1 remains separate | Configure any OpenClaw memory plugins independently |

Feature list is in openclaw/capabilities.json. Feature inventory is NOT evidence that official plugins or channels are connected. OpenClaw configuration may evolve, so verify current official documentation for your installed version.

## 6. Tests and operational scope

Run cd cloudflare-worker && npm test. The OpenClaw regression suite tests missing configuration, auth, payload filtering and mocked Gateway responses. These deterministic tests do not prove a running physical Gateway. Cloudflare D1 references and Supabase owner data are unchanged by the bridge. The original Ollama/Python CLI is untouched.

Source and license: https://github.com/openclaw/openclaw (MIT).

## Ready-to-run persistent OpenClaw host

A production-oriented **standalone Docker Compose Gateway** is now under [`openclaw/host/`](./host/README.md). It includes an official OpenClaw container, persistent state volume, optional secure Cloudflare Tunnel, a one-time bootstrap helper, local real-Gateway verification, security policy hardening and GitHub Actions syntax checks. This host is separate from Wormstar's current Cloudflare Worker; it keeps GPT-OSS and D1 operational even while the remote Gateway is unavailable.

**Connection status is still DISCONNECTED:** the owner's current Cloudflare account rejects Containers (Workers Paid required), contains no configured `OPENCLAW_*` Worker secrets, and has no running VPS/Droplet or connected desktop. GitHub files and passing CI checks do not start an OpenClaw daemon. Provision a paid Cloudflare container (for the official experimental [moltworker](https://github.com/cloudflare/moltworker) setup), or run [the host package](./host/README.md) on an owner-controlled Docker server, then configure Cloudflare Access and the four Worker secrets. Only a live authenticated Gateway probe can mark it connected.
