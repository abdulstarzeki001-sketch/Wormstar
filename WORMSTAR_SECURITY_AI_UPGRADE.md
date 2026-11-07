# Wormstar Sentinel & Core — Defensive AI Upgrade

## Deployment and verified state

- Frontend Worker: `wormstar-sentinel-preview`, Cloudflare Service Binding `CORE` → `wormstar-ai-lab`.
- Core Worker: `wormstar-ai-lab` with Workers AI, D1, owner token, and Vectorize `VECTORS`.
- Vectorize: `wormstar-knowledge-m3`, cosine similarity, 1024 dimensions, embedding model `@cf/baai/bge-m3`.
- The existing owner D1 knowledge corpus was indexed in November 2026 (88 source documents, 114 vectors at time of indexing). Vectorize holds numeric embeddings plus document UUIDs; original text remains in D1.
- GitHub Actions: `.github/workflows/deploy-cloudflare.yml` now gates production deployment on `npm test`; Sentinel has `node scripts/test-worker.mjs`.

## Owner authentication

1. Open Sentinel → AI Assistant.
2. Enter the **Core** `WORMSTAR_ACCESS_TOKEN` in the password field. Do not paste it into GitHub or a chat message. The token stays in the current browser page memory, not persistent browser storage.
3. Choose GPT‑OSS 120B (preferred) or 20B (faster); send the message.
4. View the actual model used, fallback status and retrieved D1 reference titles when applicable.
5. Disconnect when finished.

## Semantic search (RAG)

- `POST /api/rag/reindex` (owner token required) ingests D1 knowledge in batches of up to six documents; request body: `{"cursor":"","limit":4}`; pass `nextCursor` until `done` becomes true.
- `GET /api/rag/status` returns index binding status.
- Hybrid retrieval prefers high-relevance lexical matches and supplements them with semantic matches; semantic scores below 0.5 are ignored.
- The old lexical retrieval remains a fallback when Vectorize is unavailable.
- Re-index after updates; deleted sources are not returned because the retriever checks D1 before including any document. Index updates can be eventually consistent.

## Authorized security inspection

`POST /api/security/header-audit` accepts `{"target":"https://wormstar-sentinel-preview.abdulstarzeki001.workers.dev/"}` after owner authentication and explicit consent in the UI.

Allowed hostnames are configured in Core Wrangler `SCAN_ALLOWED_HOSTS`. The URL must be the exact HTTPS root with no explicit nondefault port, path, query, or credentials. The endpoint sends **one GET**, never follows redirects, inspects only common HTTP security headers, and enforces **one request per hostname per five-minute bucket** in D1. Missing headers are signals, not confirmed exploitable vulnerabilities.

The global policy `network.active_scan` remains **false**; no port scans, exploitation, credential probing, automation against arbitrary hosts, or browser crawling are enabled. This limited header audit is the only new network check.

## Task-specific agents

- `GET /api/agents` lists owner-triggered agents: `memory-analyst`, `code-reviewer`, and `incident-triage`.
- `POST /api/agents/run` accepts `{"agent":"memory-analyst","task":"..."}`.
- Each agent can retrieve approved owner knowledge, perform one bounded AI inference, and return an evidence-based report. It has no shell, network scanner tool, background schedule, or elevated privileges. Limit: one request per agent per minute, with D1 audit locks.
- Agent memory respects the owner's existing policy `memory_enabled` setting.

## External LoRA

The `training/lora/` scaffold validates a JSONL conversational dataset without requiring GPU. Running `--train` loads `openai/gpt-oss-20b` on a **separately provisioned CUDA GPU**, performs PEFT LoRA SFT, and saves the adapter locally for evaluation. It does not train or fine-tune the Cloudflare-hosted 120B model, and no custom model is yet deployed.

## Honest boundaries

- Active header inspection is **not** a full dynamic application scanner.
- Task agents are explicit and bounded rather than continuously autonomous.
- LoRA is provisioned as a training workflow but not executed.
- Public dashboard statistics and incident widgets that lack live feeds remain illustrative.
- Do not expose credentials, audit history, customer data or model checkpoint files in the public repository.
