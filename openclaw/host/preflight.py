#!/usr/bin/env python3
"""Wormstar NEO — read-only OpenClaw host readiness check.

No packages installed; no secrets printed; no billed resources provisioned.
Use --json for machine-readable diagnostics and --ci for structural-only checks.
"""
from __future__ import annotations
import argparse
import json
import os
import platform
import shutil
import socket
import subprocess
from pathlib import Path

BASE = Path(__file__).resolve().parent
def cmd(argv, timeout=6):
    try:
        p = subprocess.run(argv, text=True, capture_output=True, timeout=timeout, check=False)
        return p.returncode == 0, (p.stdout or "").strip()[:250]
    except (OSError, subprocess.TimeoutExpired):
        return False, ""

def host_ram_gib():
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("MemTotal:"):
                return round(int(line.split()[1]) / (1024 * 1024), 1)
    except (OSError, ValueError):
        pass
    return None

def env_presence():
    path = BASE / ".env"
    if not path.is_file():
        return {"exists": False, "gateway_token": False, "provider_key": False, "tunnel_token": False}
    values = {}
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip().strip('"').strip("'")
    except OSError:
        return {"exists": False, "gateway_token": False, "provider_key": False, "tunnel_token": False}
    # Never print credential contents or masked prefixes.
    return {"exists": True, "gateway_token": len(values.get("OPENCLAW_GATEWAY_TOKEN", "")) >= 32,
            "provider_key": len(values.get("OPENAI_API_KEY", "")) >= 16,
            "tunnel_token": len(values.get("CLOUDFLARE_TUNNEL_TOKEN", "")) >= 20}

def run_checks(ci=False):
    docker_present = bool(shutil.which("docker"))
    compose = cmd(["docker", "compose", "version"])[0] if docker_present else False
    daemon = cmd(["docker", "info", "--format", "{{.ServerVersion}}"])[0] if compose and not ci else False
    disk = shutil.disk_usage(BASE)
    ram = host_ram_gib()
    gpu_ok, gpu_info = cmd(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"], 5) if shutil.which("nvidia-smi") else (False, "")
    env = env_presence()
    notes = []
    if not docker_present: notes.append("Install Docker Engine or Docker Desktop.")
    elif not compose: notes.append("Install Docker Compose v2.")
    elif not daemon and not ci: notes.append("Start the Docker daemon and verify docker info works.")
    if not env["exists"]: notes.append("Run bash bootstrap.sh once to create the private .env file.")
    elif not env["gateway_token"]: notes.append("Generate a random 32-byte Gateway token in .env.")
    if not env["provider_key"]: notes.append("Set an authorized model provider API key in the private host .env file.")
    if disk.free < 5_000_000_000: notes.append("Reserve at least 5 GB of free disk for the gateway and its logs.")
    if ram is not None and ram < 4: notes.append("Increase host RAM: 4 GiB minimum is recommended for the prebuilt image.")
    if not env["tunnel_token"]: notes.append("For remote Wormstar use, configure Cloudflare Tunnel and Access before adding a tunnel token.")
    if not gpu_ok: notes.append("NVIDIA GPU optional for OpenClaw; required only if self-hosting GPT-OSS model weights.")
    cpu = platform.machine()
    return {
        "service": "OpenClaw real gateway host readiness",
        "mode": "ci_structure_only" if ci else "host_check",
        "platform": platform.system(),
        "cpu_architecture": cpu,
        "ram_gib": ram,
        "disk_free_gb": round(disk.free/1e9, 1),
        "checks": {
            "docker_installed": docker_present,
            "docker_compose_v2": compose,
            "docker_daemon_running": daemon if not ci else None,
            "host_env_exists": env["exists"],
            "gateway_token_configured": env["gateway_token"],
            "model_provider_key_configured": env["provider_key"],
            "cloudflare_tunnel_token_configured": env["tunnel_token"],
            "nvidia_gpu_available": gpu_ok
        },
        "gpu_descriptions": gpu_info.splitlines()[:4] if gpu_ok else [],
        "ready_for_local_start": False if ci else bool(daemon and env["gateway_token"] and env["provider_key"] and disk.free >= 5_000_000_000 and (ram is None or ram >= 4)),
        "notes": notes
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--ci", action="store_true", help="CI dry inspection; not a claim of live host readiness")
    args = ap.parse_args()
    result = run_checks(args.ci)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print("Wormstar OpenClaw host readiness:", "READY" if result["ready_for_local_start"] else "NOT READY")
        for k, v in result["checks"].items():
            print(f"  {k}: {v}")
        for note in result["notes"]:
            print("  Action:", note)
    if args.ci:
        return 0
    return 0 if result["ready_for_local_start"] else 1

if __name__ == "__main__":
    raise SystemExit(main())
