"""Validate the dedicated Docker sandbox before any terminal operation."""
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT / "workspace"
CONTAINER = "wormstar-linux-terminal-sandbox"
LABEL = "org.wormstar.terminal-sandbox"


def valid_sandbox(data, require_running=True):
    """Reject reused or unsafe containers, even if they have the expected name."""
    try:
        config, host = data["Config"], data["HostConfig"]
        if require_running and data["State"]["Running"] is not True:
            return False
        if (config.get("Labels") or {}).get(LABEL) != "v1":
            return False
        user = config.get("User", "")
        if not re.fullmatch(r"[1-9][0-9]*:[1-9][0-9]*", user):
            return False
        if host.get("NetworkMode") != "none" or host.get("Privileged") is not False:
            return False
        if host.get("PidMode") not in (None, "", "private") or host.get("UTSMode") not in (None, ""):
            return False
        if host.get("IpcMode") not in (None, "", "private", "shareable") or host.get("UsernsMode") not in (None, ""):
            return False
        if any(host.get(key) for key in ("CapAdd", "Devices", "DeviceRequests", "DeviceCgroupRules", "GroupAdd")):
            return False
        if host.get("ReadonlyRootfs") is not True or "ALL" not in (host.get("CapDrop") or []):
            return False
        security = host.get("SecurityOpt") or []
        if not any(x.startswith("no-new-privileges") for x in security) or any("unconfined" in x for x in security):
            return False
        if not (0 < host.get("Memory", 0) <= 512 * 1024 * 1024):
            return False
        if not (0 < host.get("NanoCpus", 0) <= 1_000_000_000):
            return False
        if not (0 < host.get("PidsLimit", 0) <= 64):
            return False
        mounts = data.get("Mounts", [])
        if not isinstance(mounts, list):
            return False
        bind_mounts = [m for m in mounts if m.get("Type") == "bind"]
        other_mounts = [m for m in mounts if m.get("Type") != "bind"]
        if len(bind_mounts) != 1 or any(m.get("Type") != "tmpfs" or m.get("Destination") != "/tmp" for m in other_mounts):
            return False
        if any(path != "/tmp" for path in (host.get("Tmpfs") or {})):
            return False
        mount = bind_mounts[0]
        return (mount.get("Type") == "bind" and mount.get("Destination") == "/workspace"
                and mount.get("RW") is True and not WORKSPACE.is_symlink()
                and os.path.realpath(mount.get("Source", "")) == str(WORKSPACE.resolve()))
    except (KeyError, TypeError, ValueError):
        return False


def inspect_sandbox(require_running=True):
    try:
        result = subprocess.run(["docker", "inspect", CONTAINER], capture_output=True,
                                text=True, timeout=5, check=False)
        if result.returncode != 0:
            return False
        data = json.loads(result.stdout)
        return isinstance(data, list) and len(data) == 1 and valid_sandbox(data[0], require_running)
    except (OSError, subprocess.TimeoutExpired, ValueError):
        return False


if __name__ == "__main__":
    import sys
    ok = inspect_sandbox(require_running="--allow-stopped" not in sys.argv)
    print("Sandbox verified" if ok else "Sandbox missing or its security settings do not match")
    sys.exit(0 if ok else 1)
