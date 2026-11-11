from pathlib import Path
import json
import os
import secrets
import subprocess
import urllib.request

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
WORKSPACE = Path.home() / "wormstar-terminal-workspace"
WORKSPACE.mkdir(exist_ok=True)

KEY = os.environ.get("WORMSTAR_TERMINAL_TOKEN", "")
MODEL = "qwen3:0.6b"

if len(KEY) < 24:
    raise RuntimeError("WORMSTAR_TERMINAL_TOKEN is missing")

app = FastAPI(
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

class Task(BaseModel):
    task: str = Field(min_length=1, max_length=600)

class Command(BaseModel):
    command: str = Field(min_length=1, max_length=700)

def check_access(request):
    origin = request.headers.get("origin", "")
    allowed = (
        "http://localhost:8765",
        "http://127.0.0.1:8765",
    )
    if origin and origin not in allowed:
        raise HTTPException(403, "Invalid origin")

    supplied = request.headers.get("x-terminal-key", "")
    if not secrets.compare_digest(supplied, KEY):
        raise HTTPException(401, "Invalid access key")

@app.post("/api/local-terminal/suggest")
def suggest(body: Task, request: Request):
    check_access(request)

    prompt = (
        "/no_think\n"
        "Return exactly one Linux shell command. "
        "No markdown or explanations. "
        "Environment: isolated Alpine Linux with Python. "
        "No network or root access. "
        "Task: " + body.task
    )

    payload = json.dumps({
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "num_predict": 120,
            "num_ctx": 1024,
        },
    }).encode()

    try:
        req = urllib.request.Request(
            "http://127.0.0.1:11434/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=90) as response:
            result = json.load(response)
        return {"command": result.get("response", "").strip()[:700]}
    except Exception:
        raise HTTPException(503, "Ollama is unavailable")

@app.post("/api/local-terminal/run")
def run_command(body: Command, request: Request):
    check_access(request)

    name = "wormstar-task-" + secrets.token_hex(8)
    args = [
        "docker", "run", "--rm",
        "--name", name,
        "--network", "none",
        "--read-only",
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges",
        "--memory", "192m",
        "--memory-swap", "192m",
        "--cpus", "0.5",
        "--pids-limit", "32",
        "--user", f"{os.getuid()}:{os.getgid()}",
        "--workdir", "/workspace",
        "--env", "HOME=/workspace",
        "--mount",
        f"type=bind,src={WORKSPACE},dst=/workspace",
        "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=16m",
        "python:3.12-alpine",
        "sh", "-lc", body.command,
    ]

    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            errors="replace",
            timeout=15,
        )
        return {
            "output": (result.stdout + result.stderr)[:16000],
            "exit_code": result.returncode,
        }
    except subprocess.TimeoutExpired:
        subprocess.run(
            ["docker", "rm", "-f", name],
            capture_output=True,
            timeout=10,
        )
        raise HTTPException(408, "Command timed out")
    except OSError:
        raise HTTPException(503, "Docker unavailable")

app.mount(
    "/",
    StaticFiles(directory=str(ROOT / "wormstar-ui"), html=True),
    name="sentinel",
)
