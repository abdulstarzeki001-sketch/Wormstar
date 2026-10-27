# Wormstar AI Core, Security, Memory & Recovery Validation

Review date: 2026-10-27. This runbook is for the ACTUAL Wormstar NEO architecture:
Cloudflare Worker, Workers AI, D1, Cloudflare Access, GitHub Actions and
owner-scoped Supabase. This is not a local Python service deployment.

## 2. AI Core Validation

- An online request to the Cloudflare Workers AI REST endpoint
  @cf/openai/gpt-oss-20b generated visible text "READY", returned HTTP 200
  and finished normally. A single observed call took about 670 ms;
  it is not a reliable benchmark nor a guarantee about 120B availability.
- At least one earlier low-max-tokens successful HTTP response carried no
  visible final content. Tests must reject empty/None output and check
  actual modelUsed, not HTTP 200 alone or a UI label.
- Cloudflare Worker /api/chat already uses model allowlists and explicit
  fallback. Node tests test model selection, result text, fallback from
  reasoning-only completions, no tool execution, authorization and
  zero-leakage failure messages using in-memory mocks.
- No original GPT-OSS 120B GPU instance was verified or provisioned here.
  Cloudflare Workers AI serving a remote model is NOT self-hosted inference.

## Optional local PyTorch/Transformers validation

When a trusted machine or GPU server actually exists and packages are
installed, run:

    cd cloudflare-worker
    python3 tools/validate_selfhosted_ai.py --model distilgpt2

The command **does not download models** unless --allow-download is
explicitly passed. DistilGPT2 is only a small independent demonstration,
not WormGPT or GPT-OSS. Its generated output may differ substantially from
a quoted example. If the model is not cached, the script exits with an
error. Torch/Transformers are optional dependencies and MUST NOT be
installed inside the production Cloudflare Worker.

The script uses time.perf_counter, torch.inference_mode, explicit
torch.cuda.is_available checks, optional GPU synchronization and safe
cleanup. Do NOT use IPython-only %timeit magic in a .py file.

## 3. Security Validation

- Cloudflare Access protects the Worker; the private Studio, chat and
  memory APIs also require the existing owner bearer secret. Denied
  requests must never call the AI model.
- Worker secrets are configured via Cloudflare "Variables and Secrets",
  not through a public repository or committed .env file.
- Supabase publishable credentials may be used client-side ONLY with
  authenticated, owner-isolated RLS; never expose a service-role key.
- Existing external WormGPT adapter uses a pinned HTTPS endpoint,
  non-forwarded redirects, bounded request/response sizes, and a validated
  model ID. The optional provider remains unavailable without separately
  verified WORMGPT_API_KEY and WORMGPT_MODEL_ID. An endpoint URL in source
  is not evidence that an account or paid model exists.
- Avoid unsafe arbitrary subprocess shell=True and unsandboxed git-clone/run.
  Actual agents must use scoped tools, approvals and an isolated host.
- A root account is not an automatic vulnerability if it is the deployment
  administration account; the runtime should use least privilege.
- Do not run pip upgrades blindly. Lock versions, check vulnerability
  advisories and test compatibility before dependency changes.

## 4. Memory Validation

- D1 knowledge, AI profile, policy and chat archive are existing persistent
  services; owner-scoped Supabase is a separate browser-authenticated backup.
  Do NOT set a 24-hour TTL on permanent knowledge by introducing Redis.
- Existing memory revision storage and chat archive tests cover revisions,
  bounded content, policy enforcement, authorization and conflict handling.
- The new AI Core tests verify that owner-scoped references enter prompts
  as untrusted data and do not become privileged instructions.
- Native Worker code does not expose the machine's memory allocator or
  a directly attached CUDA GPU. Optional GPU memory tests belong on the
  independently provisioned host.
- Do not deserialize untrusted pickle files for checkpoints; choose
  safetensors or other reviewed model formats. empty_cache() only clears
  eligible cached allocations, not all active GPU memory.

## 5. Error Recovery

- Cloudflare Workers AI supports ordered fallback on failures; callers
  receive the actually used model name, attempted model list and
  fallbackUsed flag.
- The final API error and sanitized Cloudflare model_failure event omit
  upstream stack traces, bearer secrets, prompts and attached knowledge.
- Automatic repeat calls to a billable inference endpoint are deliberately
  not added by this change: retries must be bounded and weigh duplicate
  cost and privacy. No fake failover to a provider with absent secrets.
- D1 backup/restore and Supabase version conflicts retain their existing
  safeguards. Never restore from unknown pickle blobs or overwrite a
  newer cloud version without owner confirmation.

## 6. Model and Persona Validation

- Owner persona is stored in D1, protected by the server policy and
  versioned before edits, with Supabase backups requiring Auth.
- Tests prove a restrictive policy blocks a chat request despite any
  persona text. An answer alone is not proof that a model is unrestricted.
- Requests reveal the actual modelUsed after completion; the health
  endpoint's default or preferred model label is not a successful
  inference measurement.

## 7. Monitoring Validation

- Cloudflare Workers Observability Logs use 10% sampling with automatic
  invocation logs disabled, query-string redaction enabled, and traces
  disabled. Native Workers Issues and the account-level email alert policy
  are enabled. These are native substitutes for unnecessary Prometheus
  and Grafana infrastructure when no independent machine exists.
- Offline CI: cloudflare-worker/npm test and the Python adapter mock suite
  run through existing GitHub Actions workflow checks.
- Online smoke checks must be explicitly performed and must not leak
  protected data into logs. A successful CI job does not prove a production
  alert email was delivered.

## Phases 8–13 and additional infrastructure

- Existing P1 production release is Worker v38; D1+Supabase are the
  persistent sources and the current RAG is lexical/bounded rather than
  a vector search engine. Do not introduce an independent PostgreSQL
  server, Elasticsearch or Redis unless there is a measured requirement,
  a backup/retention plan, an authorization model and approved hosting.
- External GitHub, web search and browser agents are separate tool
  integrations and are not granted arbitrary code execution by these
  tests. OpenCode/OpenClaw require owner-controlled server processes;
  a Cloudflare Worker is not a general-purpose Docker host.

## CI command

    cd cloudflare-worker
    npm test

The test suite uses synthetic data and mocked AI responses; it must not
require owner keys, live user messages or changes to D1 or Supabase.
