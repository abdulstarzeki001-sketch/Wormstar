const CORE_URL = "https://wormstar-core.internal";
const SENTINEL_URL = "https://wormstar-sentinel.internal";

function reply(value, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

async function check(service, url) {
  try {
    const response = await service.fetch(new Request(url, { method: "GET" }));
    return { connected: response.status < 500, status: response.status };
  } catch {
    return { connected: false, status: null };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return reply({ service: "wormstar-integration-hub", status: "online" });
    }

    if (url.pathname === "/api/integrations" && request.method === "GET") {
      const [core, sentinel] = await Promise.all([
        check(env.CORE, CORE_URL + "/api/health"),
        check(env.SENTINEL, SENTINEL_URL + "/"),
      ]);
      return reply({
        service: "wormstar-integration-hub",
        core,
        sentinel: { ...sentinel, mode: "reachability-only" },
      });
    }

    if (url.pathname === "/api/core/health" && request.method === "GET") {
      return env.CORE.fetch(new Request(CORE_URL + "/api/health", { method: "GET" }));
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      const headers = new Headers();
      for (const key of ["authorization", "content-type", "accept"]) {
        const value = request.headers.get(key);
        if (value) headers.set(key, value);
      }
      const upstream = new Request(CORE_URL + "/api/chat", {
        method: "POST",
        headers,
        body: request.body,
      });
      return env.CORE.fetch(upstream);
    }

    return reply({ error: "Not found" }, 404);
  },
};
