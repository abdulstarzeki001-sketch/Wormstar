// Local preview only. Runs the Sentinel and Core Worker fetch handlers behind
// plain Node HTTP so their pages can be opened in a real browser without
// Cloudflare. No owner token, D1, Vectorize or AI binding is provided: pages
// render, authenticated API calls fail closed.
import http from 'node:http';

const root = new URL('../../', import.meta.url);
const { default: sentinel } = await import(new URL('wormstar-ui/worker.js', root));
const { default: core } = await import(new URL('cloudflare-worker/worker.js', root));

const unavailable = { async fetch() { return Response.json({ error: 'preview: Core not connected' }, { status: 503 }); } };
const sentinelEnv = { CORE: unavailable };
const coreEnv = { SENTINEL_SUITE: { fetch: request => sentinel.fetch(request, sentinelEnv, {}) } };
const context = { waitUntil() {}, passThroughOnException() {} };

function serve(worker, env, port) {
  http.createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key, value);
      const hasBody = !['GET', 'HEAD'].includes(req.method) && chunks.length;
      const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
        method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined,
      });
      const response = await worker.fetch(request, env, context);
      const out = {};
      response.headers.forEach((value, key) => { out[key] = value; });
      res.writeHead(response.status, out);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('preview error: ' + (error && error.message));
    }
  }).listen(port, '127.0.0.1', () => console.log(`preview on http://127.0.0.1:${port}`));
}

serve(sentinel, sentinelEnv, Number(process.env.SENTINEL_PORT || 8801));
serve(core, coreEnv, Number(process.env.CORE_PORT || 8802));
