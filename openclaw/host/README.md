# Wormstar NEO — OpenClaw gateway host

This directory runs the **actual OpenClaw gateway process** on a persistent Linux or Mac host using the official OpenClaw container image. It is separate from the Cloudflare Wormstar UI Worker, which only verifies the connection and forwards owner-authorized agent chats.

**Current deployment:** this repository is prepared but **no live OpenClaw gateway has been provisioned**. The connected Cloudflare account currently rejects Container API access because Workers Paid is not enabled; DigitalOcean shows no existing Droplet. Do not interpret a GitHub commit, a running Wormstar Worker, or a passing unit test as a live OpenClaw server.

## Prerequisites

- Owner-controlled always-on machine or VPS with Docker Engine/Desktop and Docker Compose v2, Linux preferred; persistent disk and enough memory for OpenClaw and its optional skills
- An actual authorized model provider credential, stored as a secret in the **host's** private `.env`. An OpenAI chat subscription is not an API key. Wormstar's Workers AI `AI` binding is not automatically a model provider credential for OpenClaw
- A private Cloudflare Tunnel hostname, with a **Cloudflare Access Service Auth policy covering every gateway URL path**. Never give the browser or an untrusted caller the operator-level gateway token

## Start the real gateway

On the host, clone the Wormstar repository and run:

```bash
cd openclaw/host
bash bootstrap.sh
```

The first run generates a random 64-character Gateway token inside a private `.env`, then intentionally exits. Edit `.env` **on the host** to set the model provider key, then run:

```bash
bash bootstrap.sh
bash verify.sh
```

It installs the official image, onboards the provider, enables `gateway.http.endpoints.chatCompletions.enabled`, explicitly denies code execution and filesystem-changing tools, validates the configuration, and starts the background gateway. The gateway state, paired devices, configuration and any supported session persistence are stored in a named Docker volume `wormstar-openclaw_openclaw_state`; Docker restart policy is `unless-stopped`.

For production, pin `OPENCLAW_IMAGE` to a reviewed stable official tag/digest instead of floating `latest`. No containers expose port 18789 to the internet: Docker binds **127.0.0.1 only**. You can test it locally with `bash verify.sh`.

## Expose gateway through a private tunnel

1. Create a Cloudflare Tunnel in your authorized Zero Trust account, and configure its public hostname with **service** `http://openclaw-gateway:18789` (the Compose network DNS name).
2. Create a Cloudflare Access application for that hostname and protect **all paths**, including `/v1/models` and `/v1/chat/completions`; require an Access **service token** in its policies. The gateway's bearer token remains required as a second layer.
3. Put the Tunnel token in your private host `.env` as `CLOUDFLARE_TUNNEL_TOKEN`, then start it:

```bash
docker compose --profile tunnel up -d
```

4. In the **existing** Cloudflare Worker `wormstar-ai-lab`, add these four **Secrets** (not public vars; never in GitHub):

| Worker secret | Description |
| --- | --- |
| `OPENCLAW_GATEWAY_URL` | HTTPS tunnel **root** origin, ending in `/` |
| `OPENCLAW_GATEWAY_TOKEN` | Same long Gateway token generated in host `.env` |
| `OPENCLAW_ACCESS_CLIENT_ID` | Access Service Token ID |
| `OPENCLAW_ACCESS_CLIENT_SECRET` | Matching Access Service Token secret |

No Cloudflare Worker source-code change is needed for the bridge: the current Wormstar Worker already supports protected `GET /api/openclaw/status` and `POST /api/chat` with `engine: "openclaw-agent"`, and verifies the real Gateway `GET /v1/models` response before enabling the OpenClaw option.

Once the four secrets are available to the deployed Worker, open Wormstar → **Control → OpenClaw** → **Check connection**. Status must show **connected** only when the remote gateway actually returns `openclaw/default`. If it reports offline, inspect `docker compose logs --tail 100 openclaw-gateway`, `bash verify.sh`, Cloudflare Access service-token permissions, and the tunnel routing. Never paste secrets into a chat or commit them.

## Runtime limits and security

A chat-completions Gateway token grants operator-level access. This instance is deliberately a restricted agent with `tools.profile=minimal`, `tools.exec.mode=deny`, and explicit denies for shell, browser, node and filesystem changes. Do not disable these boundaries without an audited reason and appropriate sandbox.

Only chat/status are proxied through Wormstar. Installing skills, connecting Telegram/WhatsApp, pairing remote devices, configuring cron or enabling filesystem/browser actions requires separate owner approval and installation on the real Gateway. GPT-OSS in Wormstar remains available through Cloudflare Workers AI even when OpenClaw is down; the app must not claim an OpenClaw response was produced by another model.

**Alternative: Cloudflare-native container deployment.** The official experimental [Cloudflare moltworker](https://github.com/cloudflare/moltworker) project runs a complete OpenClaw daemon in Cloudflare Sandbox. It requires a **Workers Paid** account; persistent state across restarts should use R2 backups. The currently connected account has neither Containers access nor R2 enabled. Enabling paid Containers or supplying a separately funded VPS is an account-owner action; this repository does not attempt to change billing.

Official references: [Docker installation](https://docs.openclaw.ai/install/docker), [Gateway HTTP API](https://docs.openclaw.ai/gateway/openai-http-api), [OpenClaw security](https://docs.openclaw.ai/gateway/security), [Cloudflare moltworker](https://github.com/cloudflare/moltworker).
