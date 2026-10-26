#!/usr/bin/env python3
"""Download the ACTUAL official MXFP4 GPT-OSS weight files onto a GPU machine.

Requires sufficient disk space. The script downloads only root checkpoint files,
not optional "original/" or "metal/" datasets, which can greatly increase volume.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

from huggingface_hub import snapshot_download

MODELS = {
    "120b": {"repo": "openai/gpt-oss-120b", "shards": 15, "min_free": 85_000_000_000},
    "20b": {"repo": "openai/gpt-oss-20b", "shards": 3, "min_free": 25_000_000_000},
}
PATTERNS = [
    "model-*.safetensors",
    "model.safetensors.index.json",
    "*.json", "*.jinja",
    "LICENSE", "README.md", "USAGE_POLICY", ".gitattributes",
]


def verify_checkpoint(directory: Path, required: int) -> dict:
    index = directory / "model.safetensors.index.json"
    if not index.is_file():
        raise RuntimeError(f"Model index is missing: {index}")
    meta = json.loads(index.read_text(encoding="utf-8"))
    shards = sorted(set(meta.get("weight_map", {}).values()))
    if len(shards) != required:
        raise RuntimeError(f"Expected {required} weight parts but model index references {len(shards)}")
    total = 0
    for name in shards:
        if "/" in name or "\\" in name or not name.endswith(".safetensors"):
            raise RuntimeError(f"Unexpected checkpoint path in index: {name}")
        file = directory / name
        if not file.is_file() or file.stat().st_size < 1024 * 1024:
            raise RuntimeError(f"Missing, incomplete, or unexpectedly small shard: {file}")
        total += file.stat().st_size
    for file in ("config.json", "tokenizer.json", "tokenizer_config.json", "chat_template.jinja"):
        if not (directory / file).is_file():
            raise RuntimeError(f"Required model support file is missing: {file}")
    return {"parts": len(shards), "bytes": total, "directory": str(directory.resolve())}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", choices=MODELS, required=True)
    ap.add_argument("--root", type=Path, default=Path("./models"))
    ap.add_argument("--revision", default="main", help="Optional pinned Hugging Face commit SHA")
    ap.add_argument("--verify-only", action="store_true", help="No downloads: check existing files")
    args = ap.parse_args()

    model = MODELS[args.model]
    directory = args.root.expanduser().resolve() / f"gpt-oss-{args.model}"
    directory.mkdir(parents=True, exist_ok=True)
    if not args.verify_only:
        available = shutil.disk_usage(directory).free
        if available < model["min_free"]:
            raise RuntimeError(
                f"Insufficient disk space: {available / 1e9:.1f} GB free; "
                f"reserve at least {model['min_free'] / 1e9:.0f} GB for this download."
            )
        print(f"Downloading ORIGINAL {model['repo']} checkpoint into {directory}", flush=True)
        print("This will transfer many gigabytes. Check provider storage/bandwidth charges.", flush=True)
        snapshot_download(
            repo_id=model["repo"],
            repo_type="model",
            revision=args.revision,
            local_dir=str(directory),
            allow_patterns=PATTERNS,
            ignore_patterns=["original/*", "metal/*", "*.bin", "*.pt"],
            max_workers=4,
        )
    result = verify_checkpoint(directory, model["shards"])
    print(json.dumps({"ok": True, "repo": model["repo"], **result}, ensure_ascii=False, indent=2))
    print("Verified shard presence and sizes; download library handles transfer integrity.")
    print("This is a checkpoint download, not fine-tuning and not a Cloudflare D1 write.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
