#!/usr/bin/env python3
"""Owner-run LoRA preparation/training for openai/gpt-oss-20b on an external GPU.
No weights are downloaded, trained, or deployed by Cloudflare Workers.
"""
import argparse
import json
from pathlib import Path

def validate(path: Path) -> int:
    if not path.is_file():
        raise SystemExit(f"Dataset not found: {path}")
    count = 0
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
            messages = obj["messages"]
            assert isinstance(messages, list) and len(messages) >= 2
            assert all(m.get("role") in {"system", "user", "assistant"} and isinstance(m.get("content"), str) for m in messages)
            assert any(m["role"] == "user" for m in messages)
            assert any(m["role"] == "assistant" for m in messages)
        except (KeyError, ValueError, TypeError, AssertionError) as exc:
            raise SystemExit(f"Invalid conversational JSONL line {n}: {exc}") from exc
        count += 1
    if count < 1:
        raise SystemExit("Dataset is empty")
    print(f"Validated {count} instruction examples. No model loaded.")
    return count

def train(dataset_file: Path, output_dir: Path, steps: int) -> None:
    validate(dataset_file)
    import torch
    if not torch.cuda.is_available():
        raise SystemExit("CUDA GPU required: use a dedicated external training host, not Workers or a phone.")
    from datasets import load_dataset
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import LoraConfig
    from trl import SFTConfig, SFTTrainer
    model_id = "openai/gpt-oss-20b"
    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=False)
    model = AutoModelForCausalLM.from_pretrained(
        model_id, device_map="auto", torch_dtype=torch.bfloat16, trust_remote_code=False
    )
    dataset = load_dataset("json", data_files=str(dataset_file), split="train")
    config = SFTConfig(
        output_dir=str(output_dir),
        max_steps=steps,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=2e-4,
        max_length=1024,
        logging_steps=5,
        save_steps=max(10, steps),
        gradient_checkpointing=True,
        bf16=True,
        report_to="none",
        packing=False,
    )
    lora = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05,
                      target_modules="all-linear", bias="none", task_type="CAUSAL_LM")
    trainer = SFTTrainer(model=model, args=config, train_dataset=dataset,
                         processing_class=tokenizer, peft_config=lora)
    trainer.train()
    trainer.save_model(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))
    print(f"LoRA adapter saved locally: {output_dir}. Not published to Cloudflare.")

if __name__ == "__main__":
    cli = argparse.ArgumentParser()
    cli.add_argument("--dataset", type=Path, required=True, help="Owner-approved JSONL chat examples")
    cli.add_argument("--output-dir", type=Path, default=Path("./lora-output"))
    cli.add_argument("--max-steps", type=int, default=50)
    cli.add_argument("--train", action="store_true", help="Explicitly run GPU training")
    args = cli.parse_args()
    if args.max_steps < 1 or args.max_steps > 50000:
        cli.error("max-steps must be between 1 and 50000")
    if args.train:
        train(args.dataset, args.output_dir, args.max_steps)
    else:
        validate(args.dataset)
