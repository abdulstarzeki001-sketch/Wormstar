# STAR OSINT Cloud → Kali Agent

## Current status
This feature branch implements a bounded, passive-only remote job queue. It is **not live** until the owner approves deployment, the D1 migration is applied, and the local agent starts. No public Kali, SSH, or Ollama ports are opened.

### Architecture

```text
Wormstar Sentinel (owner key in memory)
  | POST /api/osint/jobs
  v
Sentinel Worker --private CORE binding--> Wormstar Core Worker
                                                | checks owner bearer + capability
                                                | checks configured target domain allowlist
                                                v
                                         Cloudflare D1 osint_jobs
                                                ^
                                                | outbound HTTPS agent poll and completion
                                                |
                                   Kali cloud_agent.py (dedicated agent key)
                                                |
                                       local passive collectors
                                        DNS / CT / WHOIS
                                        theHarvester / Amass
                                                |
                                   Local SQLite + optional Ollama
                                                |
                                  sanitized bounded evidence to D1
```

## Required security controls

- Owner key: use existing `WORMSTAR_ACCESS_TOKEN` through Wormstar Sentinel; never send it to the local agent.
- Agent key: a separate 32+ character random `OSINT_AGENT_TOKEN` Cloudflare secret and Kali agent config. Do not paste in chats or commit it.
- Independent positive domain allowlists **in Cloudflare AND Kali** (exact or `*.subdomain`), e.g. `owned-domain.org,*.owned-domain.org`. Empty allowlists disable queue creation/execution.
- Passive-only collectors; no arbitrary command/URL execution; no automatic access to private network addresses.
- Maximum 2 queued/running jobs, 12 submissions per day, 100 findings per cloud result and a bounded response.
- Agent polls using outgoing HTTPS only. Do not expose ports 8787 or 11434 externally.
- Owner must approve each new job on screen.

## Deployment checklist (only after owner approval)

Run these from Kali. This makes live Cloudflare changes, so **don't run before approval/CI pass**.

1. Update the branch, review PR #46, and merge through the protected PR workflow after all checks pass.
2. Deploy the Core and Sentinel through their existing approved GitHub Actions pipelines; do not bypass quality gates.
3. Apply the isolated D1 schema migration one time:

```bash
cd ~/Wormstar-OSINT/cloudflare-worker
npx wrangler login
npx wrangler d1 execute wormstar_ai_memory --remote \
  --file=migrations/20261112_osint_remote_queue.sql
```

4. Generate one private agent token locally and a matching domain allowlist. Replace the example domain with a verified scope you administer:

```bash
umask 077
mkdir -p "$HOME/.config/wormstar"
read -rp "Owned domain(s), comma-separated: " OSINT_ALLOWED_DOMAINS
OSINT_AGENT_TOKEN="$(openssl rand -hex 32)"
{
 printf 'OSINT_AGENT_TOKEN=%s\n' "$OSINT_AGENT_TOKEN"
 printf 'OSINT_ALLOWED_DOMAINS=%s\n' "$OSINT_ALLOWED_DOMAINS"
 printf 'OSINT_CORE_ORIGIN=https://wormstar-ai-lab.abdulstarzeki001.workers.dev\n'
} > "$HOME/.config/wormstar/osint-agent.env"
chmod 600 "$HOME/.config/wormstar/osint-agent.env"
cd ~/Wormstar-OSINT/cloudflare-worker
printf '%s' "$OSINT_AGENT_TOKEN" | npx wrangler secret put OSINT_AGENT_TOKEN
printf '%s' "$OSINT_ALLOWED_DOMAINS" | npx wrangler secret put OSINT_ALLOWED_DOMAINS
unset OSINT_AGENT_TOKEN OSINT_ALLOWED_DOMAINS
```

**Important:** Wrangler secret updates deploy new Worker versions on some configurations. Verify your existing deployment procedure and user approval before changing production secrets.

5. Copy the versioned outbound agent into your existing installed local STAR OSINT project so it keeps the current SQLite data and `.env`:

```bash
cd ~/Wormstar-OSINT
git pull --ff-only
install -m 755 integrations/star-osint-ai/scripts/cloud_agent.py \
  "$HOME/star-osint-v2/star-osint-ai/scripts/cloud_agent.py"
cd "$HOME/star-osint-v2/star-osint-ai"
.venv/bin/python scripts/cloud_agent.py --once
```

Once a single poll works, run the persistent foreground agent in a second Kali terminal:

```bash
cd "$HOME/star-osint-v2/star-osint-ai"
.venv/bin/python scripts/cloud_agent.py
```

6. In Wormstar Sentinel, connect your existing **Core owner key** under the AI assistant tab. Open **STAR OSINT**, enter an explicitly allowed domain, choose passive sources, tick scope confirmation, and click **Run Kali scan from cloud**. Use Refresh or automatic polling to see the status, evidence, and (optionally) locally generated Ollama summary.

### Trouble-shooting

- `401` owner: Wormstar Core owner key missing/wrong. Connect via existing owner login first.
- `401` agent: token mismatch between Kali config and Cloudflare secret.
- `403` domain: missing/not matching positive allowlist on Cloudflare or local Kali.
- `503`: D1 migration missing, D1 binding absent or agent secret not installed.
- `queued`: Kali agent not polling; start `cloud_agent.py`.
- `running`: the local collector or Ollama report is executing; do not run duplicate scans.
- `failed`: inspect bounded errors and local collector source states.

### Remaining limitations

- This is a real job queue but requires a running Kali computer and active outbound agent.
- Jobs can remain `running` if the agent dies before completion; a future enhancement can add manual owner retry and heartbeat leases. They are **not auto-reexecuted**, to prevent unexpected duplicate scans.
- Cloud reports include at most 100 sanitized findings; complete evidence remains in the local SQLite database.
- This does not provide terminal access, arbitrary penetration tests, open proxies, unattended targeting of external systems or model tools.
