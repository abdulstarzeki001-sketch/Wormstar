#!/usr/bin/env python3
"""Optional self-hosted model smoke test. Not a Cloudflare Worker or GPT-OSS-120B test.

No model downloads by default, no shell commands, no API credentials,
no pickle deserialization, and no network unless --allow-download is given.
Usage (on a machine with Python, transformers and torch installed):
    python3 tools/validate_selfhosted_ai.py --model distilgpt2
    python3 tools/validate_selfhosted_ai.py --model distilgpt2 --allow-download
"""
import argparse
import gc
import json
import sys
from time import perf_counter


def main():
    parser = argparse.ArgumentParser(description="Local, optional CPU/GPU inference check")
    parser.add_argument("--model", default="distilgpt2", help="Trusted HF model ID or local model directory")
    parser.add_argument("--allow-download", action="store_true", help="Explicitly permit downloading model files")
    parser.add_argument("--max-new-tokens", type=int, default=24)
    args = parser.parse_args()
    if not 1 <= args.max_new_tokens <= 128:
        parser.error("--max-new-tokens must be between 1 and 128")
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError:
        print("ERROR: Optional torch/transformers are not installed; no test was executed.", file=sys.stderr)
        return 2

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    report = {"model_id": args.model, "device": device.type,
              "local_files_only": not args.allow_download}
    model = tokenizer = inputs = outputs = None
    try:
        started = perf_counter()
        tokenizer = AutoTokenizer.from_pretrained(
            args.model, local_files_only=not args.allow_download, trust_remote_code=False)
        model = AutoModelForCausalLM.from_pretrained(
            args.model, local_files_only=not args.allow_download, trust_remote_code=False)
        report["load_seconds"] = round(perf_counter() - started, 3)
        report["weight_memory_mebibytes"] = round(model.get_memory_footprint() / 1048576, 2)
        model = model.to(device).eval()
        inputs = tokenizer("Hello, how are you?", return_tensors="pt")
        inputs = {key: value.to(device) for key, value in inputs.items()}
        started = perf_counter()
        with torch.inference_mode():
            outputs = model.generate(**inputs, max_new_tokens=args.max_new_tokens, do_sample=False,
                                     pad_token_id=tokenizer.eos_token_id)
        if device.type == "cuda":
            torch.cuda.synchronize()
        report["generation_seconds"] = round(perf_counter() - started, 3)
        full_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        report["visible_text_generated"] = bool(full_text.strip() and
                                                outputs[0].shape[-1] > inputs["input_ids"].shape[-1])
        report["generated_excerpt"] = full_text[-160:]
        if device.type == "cuda":
            report["gpu_name"] = torch.cuda.get_device_name(0)
            report["gpu_peak_memory_mebibytes"] = round(torch.cuda.max_memory_allocated() / 1048576, 2)
            x = torch.randn(256, 256, device=device)
            y = torch.randn(256, 256, device=device)
            torch.cuda.synchronize()
            started = perf_counter()
            _ = x @ y
            torch.cuda.synchronize()
            report["gpu_matmul_ms"] = round((perf_counter() - started) * 1000, 3)
            del x, y, _
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0 if report["visible_text_generated"] else 1
    except Exception as error:
        # Avoid dumping model internals or accidental credentials into logs.
        report["error_type"] = type(error).__name__
        print(json.dumps(report, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1
    finally:
        del model, tokenizer, inputs, outputs
        gc.collect()
        if device.type == "cuda":
            torch.cuda.empty_cache()


if __name__ == "__main__":
    sys.exit(main())
