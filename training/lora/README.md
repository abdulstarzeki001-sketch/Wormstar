# Wormstar — GPT-OSS LoRA training (external GPU only)

This is a **ready-to-run training scaffold**, not evidence of a trained model. It never executes inside Cloudflare Workers AI and does not modify `@cf/openai/gpt-oss-120b` hosted weights.

## Preparation

- Use an isolated Linux GPU workstation with sufficient VRAM; the example targets **`openai/gpt-oss-20b`**, not the significantly larger 120B.
- Review model card, license and current OpenAI/Hugging Face fine-tuning cookbook before selecting hardware.
- Create a consented training dataset of `{"messages":[{"role":"user","content":"..."},{"role":"assistant","content":"..."}]}` JSONL examples. Remove secrets, passwords, real customer documents and private data.
- Install compatible versions of `torch`, `transformers`, `accelerate`, `datasets`, `trl`, and `peft` on the GPU host. Verify support for GPT-OSS MoE before provisioning a costly GPU.

## Commands

```bash
cd training/lora
python3 train.py --dataset example-dataset.jsonl
# On a dedicated CUDA GPU after reviewing the examples and dependencies:
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python train.py --dataset YOUR_APPROVED_DATASET.jsonl --output-dir ./lora-output --max-steps 50 --train
```

**Deployment:** keep the adapter private; serve it from a runtime supporting GPT-OSS LoRA and authenticated HTTPS. Point a separate owner-gated Core inference route to that runtime only after verifying the model and privacy policy. Never commit weights, production datasets, API keys or adapter binaries to Git.

This scaffold does **not** claim GPU training, convergence, validated quality or live model deployment. Always evaluate on a held-out test set and compare to unmodified GPT-OSS.
