# Wormstar NEO — Own ORIGINAL GPT-OSS checkpoint deployment

Status on 26 October 2026: prepared, NOT activated. No dedicated GPU is connected to this account; Cloudflare R2 is disabled. The existing Cloudflare-hosted GPT-OSS 120B engine remains the working default.

This directory contains real tools to DOWNLOAD and SERVE the original MXFP4 weight shards from Hugging Face using a GPU machine you control. Saving links or knowledge in a database does not change model weights.

## Hardware and original files

| Model | Official MXFP4 checkpoint | GPU | Free disk recommended |
|---|---:|---|---|
| gpt-oss-120b | 60.8 GiB; 15 model.safetensors parts | NVIDIA H100/H200 with 80GB+ VRAM, or supported multi-GPU | 100+ GB |
| gpt-oss-20b | 12.8 GiB; 3 model.safetensors parts | 16GB+ GPU with supported MXFP4 kernels and extra headroom | 25+ GB |

The full model parameters are present in the official MXFP4 checkpoints; do not confuse MoE quantization with removing parameters. To load a 128K-token context can require considerably more GPU KV-cache memory than a minimum working model. On an 80GB GPU start with MAX_MODEL_LEN=32768 and increase only after load testing. Full unquantized BF16 weights require much more memory than MXFP4.

Verified source links:
- https://github.com/openai/gpt-oss
- https://huggingface.co/openai/gpt-oss-120b/tree/main
- https://huggingface.co/openai/gpt-oss-20b/tree/main
- https://github.com/vllm-project/recipes/blob/main/OpenAI/GPT-OSS.md

## Step 1 — Download REAL checkpoint bytes on a GPU host

You need Linux, Python 3.11+, enough persistent disk, Docker Engine, Docker Compose v2, NVIDIA drivers, and NVIDIA Container Toolkit. Run inside this directory:

~~~bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
sudo mkdir -p /opt/wormstar-gptoss/models
sudo chown "$(id -un):$(id -gn)" /opt/wormstar-gptoss/models

# Actual 120B MXFP4 checkpoint (15 shards, dozens of gigabytes)
python download_weights.py --model 120b --root /opt/wormstar-gptoss/models
python download_weights.py --model 120b --root /opt/wormstar-gptoss/models --verify-only

# Use these instead for the smaller 20B hardware (3 shards)
python download_weights.py --model 20b --root /opt/wormstar-gptoss/models
python download_weights.py --model 20b --root /opt/wormstar-gptoss/models --verify-only
~~~

The download script calls huggingface_hub.snapshot_download on the official repo, downloads actual binary model shards and tokenizer/config files, excludes additional original/ and metal/ directories, and validates each file listed by model.safetensors.index.json. The underlying HF downloader handles transfer integrity. Optionally pass --revision with the full upstream commit hash to pin a version. Internet bandwidth and storage may incur charges.

## Step 2 — Serve the local weight files using vLLM

~~~bash
cp .env.example .env
chmod 600 .env
openssl rand -hex 32
# Put that secret into GPU_API_TOKEN within .env
# Set MODEL_ROOT to an absolute directory containing gpt-oss-120b/
# Set MODEL_VARIANT to gpt-oss-120b or gpt-oss-20b.
# Pin the Docker image tag/digest before production.
docker compose --env-file .env up -d vllm
docker compose --env-file .env logs -f vllm
bash healthcheck.sh
~~~

The vLLM service mounts your original checkpoint files read-only under /models, has HF_HUB_OFFLINE=1, and listens on 127.0.0.1:8000 only. The healthcheck uses the actual model name and requires an authenticated completion from the locally loaded files.

IMPORTANT: vLLM VLLM_API_KEY secures /v1 routes but does NOT protect every endpoint. Never publish the native vLLM port unprotected.

## Step 3 — Secure private GPU access through Cloudflare Tunnel + Access

Set up a Cloudflare Tunnel origin pointing to http://vllm:8000. Before making it reachable, create a Cloudflare Access application covering ALL URL paths and a Service Auth policy that only accepts your service-token client. Choose an HTTPS hostname under a domain you control (example: https://gpu.yourdomain.example). Add the tunnel token to the private .env file and run:

~~~bash
docker compose --env-file .env --profile tunnel up -d
~~~

Then add these Worker SECRETS in the Cloudflare dashboard; never commit them or paste values into public chat:

- GPT_OSS_GPU_ENDPOINT: HTTPS origin only (no path), such as https://gpu.yourdomain.example
- GPT_OSS_GPU_TOKEN: exact random GPU_API_TOKEN used by vLLM
- GPT_OSS_ACCESS_CLIENT_ID: your Cloudflare Access service token client ID
- GPT_OSS_ACCESS_CLIENT_SECRET: your Cloudflare Access service token secret

The Worker will issue HTTPS-only requests to /v1/chat/completions, add both the vLLM Bearer token and Cloudflare Access service token headers, and reject unsafe HTTP origins or redirects. When secrets are configured, the chat UI enables private-GPU choices for GPT-OSS 120B and 20B. The response includes a clearly marked selfhost/openai/gpt-oss-120b (or 20b) actual model name. Errors from the GPU NEVER silently fall back to Cloudflare-hosted weights for this explicitly selected self-hosted option.

The /api/health field gpuSelfHostConfigured indicates only configuration, not successful GPU execution. After configuring new secrets, make sure subsequent deployments preserve their bindings with inherited Worker secret bindings.

## Full reasoning, context, and fine-tuning are different operations

The current Wormstar owner policy imposes output/prompt size limits (and a fixed permission gate), even for GPU inference. To exploit high reasoning effort and 128K context, deliberately raise policy and model limits only after measuring GPU VRAM, concurrent requests, token overhead, and cost. No memory-table insert constitutes parameter training. True fine-tuning would involve an approved dataset, GPU resources, training adapter/checkpoint, and independent evaluations.

## Current blockers

- DigitalOcean has no provisioned droplets and no connected GPU.
- Cloudflare R2 is not enabled; this is optional because download.py uses local GPU disk.
- There is no configured Tunnel/Access service identity or GPU endpoint.
- No actual multi-gigabyte model weight files have been transferred by ChatGPT.
- Never commit private weights/credentials to GitHub, and never use D1 or Supabase SQL tables as checkpoint storage.

This bundle is executable deployment code, not a false claim that hardware exists or that GPU inference has already been started.
