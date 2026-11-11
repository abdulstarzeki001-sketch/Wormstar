"""CI-only smoke test for an ephemeral local Docker terminal service."""
import asyncio
import json
import os
import time

import httpx
import websockets

TOKEN = os.environ["TERMINAL_ACCESS_TOKEN"]
BASE = "http://127.0.0.1:8000"


def wait_for_service():
    deadline = time.monotonic() + 180
    with httpx.Client(timeout=2, trust_env=False) as client:
        while time.monotonic() < deadline:
            try:
                response = client.get(BASE + "/api/health", headers={"Authorization": "Bearer " + TOKEN})
                if response.status_code == 200 and response.json().get("container_running") is True:
                    assert client.get(BASE + "/api/health").status_code == 401
                    return
            except (httpx.HTTPError, ValueError):
                pass
            time.sleep(1)
    raise RuntimeError("Private terminal service or verified Docker sandbox did not start")


async def check_terminal():
    async with websockets.connect(
        "ws://127.0.0.1:8000/ws/terminal", origin=BASE,
        subprotocols=["wormstar-terminal", "auth." + TOKEN], open_timeout=10,
    ) as socket:
        assert socket.subprotocol == "wormstar-terminal"
        await socket.send(json.dumps({"type": "input", "data": "pwd\n"}))
        output = ""
        async with asyncio.timeout(15):
            while "/workspace" not in output:
                output += await socket.recv()
                if len(output) > 16000:
                    raise RuntimeError("Unexpected terminal output")
    print("Verified Docker sandbox, authentication and real WebSocket shell")


if __name__ == "__main__":
    wait_for_service()
    asyncio.run(check_terminal())
