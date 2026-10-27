"""Optional WormGPT API chat adapter; local Ollama remains the default.

The provider's OpenAI-compatible HTTP shape is documented, but its exact v5.1
model identifier must be obtained from the account dashboard. No SDK or source
repository is assumed to exist. No remote request occurs unless explicitly
selected by WORMSTAR_MODEL_PROVIDER=wormgpt-api.
"""
import json
import os
import re
import urllib.error
import urllib.request

ENDPOINT = "https://api.wormgpt.live/v1/chat/completions"
MODEL_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,95}$")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Never forward the API bearer credential to a redirect destination."""

    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def chat(messages, *, environ=None, opener=None):
    settings = os.environ if environ is None else environ
    key = settings.get("WORMGPT_API_KEY", "")
    model = settings.get("WORMGPT_MODEL_ID", "")
    if (not isinstance(key, str) or len(key) < 16 or key != key.strip()
            or "\r" in key or "\n" in key):
        raise ValueError("WORMGPT_API_KEY is not configured")
    if not isinstance(model, str) or not MODEL_ID.fullmatch(model):
        raise ValueError("WORMGPT_MODEL_ID must be confirmed with the provider")
    if (
        not isinstance(messages, list)
        or not 1 <= len(messages) <= 16
        or any(
            not isinstance(m, dict)
            or m.get("role") not in {"system", "user", "assistant"}
            or not isinstance(m.get("content"), str)
            or len(m["content"]) > 30000
            for m in messages
        )
        or sum(len(m["content"]) for m in messages) > 65000
    ):
        raise ValueError("Invalid provider conversation")
    payload = json.dumps({
        "model": model, "messages": messages, "max_tokens": 1024, "stream": False
    }).encode("utf-8")
    request = urllib.request.Request(
        ENDPOINT,
        data=payload,
        headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    open_request = opener or urllib.request.build_opener(_NoRedirect()).open
    try:
        with open_request(request, timeout=25) as response:
            if "application/json" not in response.headers.get("Content-Type", "").lower():
                raise RuntimeError("WormGPT API returned an unexpected content type")
            raw = response.read(100001)
            if len(raw) > 100000:
                raise RuntimeError("WormGPT API response exceeds size limit")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"WormGPT API returned HTTP {exc.code}") from None
    except urllib.error.URLError:
        raise RuntimeError("WormGPT API network request failed") from None
    try:
        data = json.loads(raw)
        answer = data["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError):
        raise RuntimeError("WormGPT API returned an invalid chat completion") from None
    if not isinstance(answer, str) or not answer.strip() or len(answer) > 20000:
        raise RuntimeError("WormGPT API returned an invalid chat completion")
    return answer.strip()
