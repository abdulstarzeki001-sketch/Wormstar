#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
if [[ ! -f .env ]]; then echo "Run bootstrap.sh first"; exit 2; fi
python3 - <<'PY'
from pathlib import Path
from urllib.request import Request, urlopen
import json, sys
pairs={}
for raw in Path(".env").read_text().splitlines():
 if "=" not in raw or raw.lstrip().startswith("#"): continue
 k,v=raw.split("=",1);pairs[k.strip()]=v.strip()
token=pairs.get("OPENCLAW_GATEWAY_TOKEN","")
if len(token)<32:sys.exit("Gateway token missing")
req=Request("http://127.0.0.1:18789/v1/models",headers={"Authorization":"Bearer "+token})
try:
 with urlopen(req,timeout=15) as resp: data=json.load(resp)
except Exception as e:sys.exit("Cannot reach local OpenClaw: "+type(e).__name__)
models=[m.get("id","") for m in data.get("data",[]) if isinstance(m,dict)]
print(json.dumps({"localGatewayOnline":True,"wormstarModelReady":"openclaw/default" in models,"modelCount":len(models)},indent=2))
if "openclaw/default" not in models: sys.exit("Gateway is live, but Wormstar-compatible model openclaw/default is not ready")
PY
