import json
import subprocess
import sys
import urllib.request
from pathlib import Path

WORKSPACE = Path("/workspaces/Wormstar")
OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
MODEL = "llama3.2:1b"
MAX_ROUNDS = 5

SYSTEM_PROMPT = """You are WormGPT, a careful software engineering assistant.
Solve the user's programming task in small steps. Keep changes inside the workspace.
Before writing or running anything, explain the next action.

Respond with one JSON object only, using one of these shapes:
1. {"action":"read","path":"relative/path"}
2. {"action":"write","path":"relative/path","content":"file content"}
3. {"action":"python","code":"python code","approve":true}
4. {"action":"shell","command":"safe command","approve":true}
5. {"action":"finish","summary":"result"}
No markdown and no comments outside the JSON object."""


def chat(messages):
    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.1, "num_ctx": 4096},
    }
    request = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        data = json.load(response)
    return data["message"]["content"]


def parse_json(text):
    text = text.strip()
    if "```" in text:
        text = text.split("```", 1)[1].split("```", 1)[0].strip()
        if text.startswith("json"):
            text = text[4:].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        return {"action": "finish", "summary": f"Invalid model response: {exc}\n{text}"}


def safe_path(raw_path):
    candidate = (WORKSPACE / raw_path).resolve()
    if candidate != WORKSPACE and WORKSPACE not in candidate.parents:
        raise ValueError("Path must remain inside the workspace")
    return candidate


def approved():
    return input("Execute this action? [y/N]: ").strip().lower() in {"y", "yes"}


def execute(action):
    kind = action.get("action")

    if kind == "read":
        path = safe_path(action["path"])
        return path.read_text(encoding="utf-8") if path.is_file() else "File not found"

    if kind == "write":
        path = safe_path(action["path"])
        if not approved():
            return "Write cancelled by user"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(action["content"], encoding="utf-8")
        return f"Written to {path.relative_to(WORKSPACE)}"

    if kind in {"python", "shell"}:
        if not approved():
            return "Execution cancelled by user"
        if kind == "python":
            command = [sys.executable, "-c", action["code"]]
        else:
            command = ["/bin/bash", "-lc", action["command"]]
        result = subprocess.run(
            command,
            cwd=WORKSPACE,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return json.dumps({
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
        })

    raise ValueError(f"Unknown action: {kind}")


def main():
    print("WormGPT integrated assistant. Commands: exit or quit.")
    while True:
        user_request = input("\n[USER COMMAND]: ").strip()
        if user_request.lower() in {"exit", "quit"}:
            break

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_request},
        ]

        for round_number in range(1, MAX_ROUNDS + 1):
            try:
                action = parse_json(chat(messages))
                if action.get("action") == "finish":
                    print("\n[FINAL RESULT]:", action.get("summary", "Done"))
                    break
                result = execute(action)
                print(f"\n[ROUND {round_number}] {action.get('action')}: {result}")
                messages.append({"role": "assistant", "content": json.dumps(action)})
                messages.append({
                    "role": "user",
                    "content": f"Tool result: {result}\nContinue. If there is an error, repair the action and retry.",
                })
            except Exception as exc:
                print(f"\n[ERROR ROUND {round_number}]: {exc}")
                messages.append({"role": "user", "content": f"Execution error: {exc}\nTry one corrected JSON action."})
        else:
            print("\n[STOPPED]: Maximum self-correction rounds reached.")


if __name__ == "__main__":
    main()
