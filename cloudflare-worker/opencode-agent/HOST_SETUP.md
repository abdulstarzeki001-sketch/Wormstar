# Wormstar OpenCode v2 — host deployment checklist

This guide prepares the **real coding agent** on a separate Linux machine. It does not run OpenCode inside Cloudflare Workers. The Cloudflare Worker remains a narrow owner-authenticated proxy.

**Pinned upstream:** [anomalyco/opencode](https://github.com/anomalyco/opencode), official npm package `@opencode/cli@2.1.4` (OpenCode v2). The source tree and binary are downloaded on the host; do not commit vendor binaries, private tokens or model credentials to Wormstar.

## 1. Prepare an isolated host

Prerequisites: a dedicated Linux VM, Node.js 22+, npm, Git, curl, systemd, and a Cloudflare-managed domain. Provisioning, networking and model-provider costs are outside this repository.

As an administrator, create the dedicated non-root service account and directories (adapt the user-creation command if the account already exists):

```bash
sudo useradd --system --home-dir /var/lib/wormstar-agent --create-home --shell /usr/sbin/nologin wormstar-agent
sudo install -d -m 0700 -o wormstar-agent -g wormstar-agent /srv/wormstar-agent
sudo install -d -m 0700 -o wormstar-agent -g wormstar-agent /srv/wormstar-agent/workspace
sudo -u wormstar-agent -H git clone --depth 1 --no-recurse-submodules \
  https://github.com/abdulstarzeki001-sketch/Wormstar.git /srv/wormstar-agent/workspace
```

This clones the Wormstar code and its `.opencode/agents/` files, but does **not** download unrelated Git submodules.

## 2. Download and install the pinned OpenCode CLI

After reviewing `bootstrap-host.sh`, run it as the service account:

```bash
sudo -u wormstar-agent -H env OPENCODE_WORKSPACE=/srv/wormstar-agent/workspace \
  bash /srv/wormstar-agent/workspace/cloudflare-worker/opencode-agent/bootstrap-host.sh
/srv/wormstar-agent/bin/opencode --version
```

The bootstrap installs only the official pinned npm CLI into `/srv/wormstar-agent`. It does not start a service, provision Cloudflare, set credentials or deploy Wormstar.

## 3. Configure and start the private service

Generate a unique random password on the host (do not paste it into GitHub). Create a root-owned, mode-`0600` `/etc/wormstar-opencode.env` based on `host.env.example` with:

```dotenv
OPENCODE_SERVER_PASSWORD=<private-long-random-value>
OPENCODE_WORKSPACE=/srv/wormstar-agent/workspace
```

Use the provided `wormstar-opencode.service.example` template (review paths and permissions before installing):

```bash
sudo cp /srv/wormstar-agent/workspace/cloudflare-worker/opencode-agent/wormstar-opencode.service.example /etc/systemd/system/wormstar-opencode.service
sudo systemctl daemon-reload
sudo systemctl enable --now wormstar-opencode
sudo systemctl status wormstar-opencode --no-pager
```

The server must listen **only on 127.0.0.1:4096**. Do not expose TCP 4096 publicly. Configure a model provider independently inside the host according to the [official OpenCode v2 docs](https://opencode.ai/v2/docs/).

## 4. Validate the local protocol

Load the private password in the administrator's shell without printing it, and run:

```bash
sudo bash -c 'set -a; source /etc/wormstar-opencode.env; set +a; OPENCODE_BIN=/srv/wormstar-agent/bin/opencode bash /srv/wormstar-agent/workspace/cloudflare-worker/opencode-agent/verify-v2.sh'
```

The verifier performs read-only Basic-authenticated GET requests to `/api/session` and `/api/session/active`. The GitHub Actions workflow `OpenCode v2 Protocol Smoke` performs a separate **ephemeral** test without connecting to your real host or model provider.

## 5. Connect the host to Cloudflare securely

1. Install and run `cloudflared` on the host using Cloudflare's current Tunnel instructions.
2. Create a **named Cloudflare Tunnel** and a private hostname routing to `http://127.0.0.1:4096`.
3. Protect the hostname using a **Cloudflare Access service-token-only policy**. Do not expose OpenCode directly or use an unrestricted public hostname.
4. Create the following four **Worker secrets** on `wormstar-ai-lab` in Cloudflare (not in source code): `OPENCODE_BASE_URL`, `OPENCODE_SERVER_PASSWORD`, `OPENCODE_ACCESS_CLIENT_ID`, `OPENCODE_ACCESS_CLIENT_SECRET`.
5. Confirm the host responds through Access, then sign into Wormstar and check `GET /api/opencode/status` with your owner Bearer token. Only then create a session and submit a narrowly scoped task.

Cloudflare Access service-token values, host password and model-provider credentials must remain in their respective secret stores. Avoid sharing them in chat or CI logs.

## Rollback and limitations

Stop the host service with `sudo systemctl stop wormstar-opencode`. Revoke Access service tokens and rotate Worker secrets if exposed. Stopping a session does not undo file edits; review the Git diff before merging anything.

A successful CI smoke test proves the pinned CLI starts and its local API responds. It does **not** prove that the real host, Cloudflare Tunnel, model provider or live Wormstar bridge is connected.
