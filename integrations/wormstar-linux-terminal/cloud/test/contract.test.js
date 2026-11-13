'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

// A mock model endpoint that speaks the Ollama /api/chat response shape.
// Behaviour is switched per-request so one server covers happy/failure paths.
let modelMode = 'command';
const modelServer = http.createServer((req, res) => {
  if (modelMode === 'down') { res.statusCode = 500; res.end('nope'); return; }
  const content = modelMode === 'done'
    ? JSON.stringify({ done: true, explanation: 'انتهت المهمة', argv: [] })
    : JSON.stringify({ done: false, explanation: 'اعرض المسار', argv: ['pwd'] });
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ message: { content } }));
});

const TOKEN = 'test_token_abcdefghijklmnopqrstuvwxyz0123';
const ORIGIN = 'https://sentinel.example.com';
let app;
let base;
let appServer;

before(async () => {
  await new Promise((r) => modelServer.listen(0, '127.0.0.1', r));
  const modelPort = modelServer.address().port;
  process.env.TERMINAL_ACCESS_TOKEN = TOKEN;
  process.env.TERMINAL_CAPABILITIES = 'health,terminal,plan,execute';
  process.env.WORMSTAR_UI_ORIGINS = ORIGIN;
  process.env.OLLAMA_URL = `http://127.0.0.1:${modelPort}/api/chat`;
  process.env.TERMINAL_WORKSPACE = process.cwd();
  ({ app } = require('../server.js'));
  appServer = http.createServer(app);
  await new Promise((r) => appServer.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${appServer.address().port}`;
});

after(() => { appServer.close(); modelServer.close(); });

function call(path, { method = 'GET', token, origin, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (origin) headers.Origin = origin;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

test('health rejects a missing token', async () => {
  const res = await call('/api/health');
  assert.strictEqual(res.status, 401);
});

test('health rejects a forbidden origin', async () => {
  const res = await call('/api/health', { token: TOKEN, origin: 'https://evil.example.com' });
  assert.strictEqual(res.status, 403);
});

test('health returns capabilities for an authorized call', async () => {
  const res = await call('/api/health', { token: TOKEN, origin: ORIGIN });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.container_running, true);
  assert.ok(body.capabilities.includes('terminal'));
});

test('plan proposes an allowlisted command and an approval id', async () => {
  modelMode = 'command';
  const res = await call('/api/agent/plan', { method: 'POST', token: TOKEN, origin: ORIGIN, body: { goal: 'show the path', history: [] } });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.deepStrictEqual(body.argv, ['pwd']);
  assert.strictEqual(typeof body.approval_id, 'string');
});

test('execute refuses without a valid approval', async () => {
  const res = await call('/api/agent/execute', { method: 'POST', token: TOKEN, origin: ORIGIN, body: { argv: ['pwd'], approval_id: 'x'.repeat(24), approved: true } });
  assert.strictEqual(res.status, 403);
});

test('plan then execute runs the approved command end to end', async () => {
  modelMode = 'command';
  const planned = await (await call('/api/agent/plan', { method: 'POST', token: TOKEN, origin: ORIGIN, body: { goal: 'show the path', history: [] } })).json();
  const res = await call('/api/agent/execute', { method: 'POST', token: TOKEN, origin: ORIGIN, body: { argv: planned.argv, approval_id: planned.approval_id, approved: true } });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.exit_code, 0);
  assert.ok(body.output.length > 0);
});

test('an approval is single-use', async () => {
  modelMode = 'command';
  const planned = await (await call('/api/agent/plan', { method: 'POST', token: TOKEN, origin: ORIGIN, body: { goal: 'show the path', history: [] } })).json();
  const ok = await call('/api/agent/execute', { method: 'POST', token: TOKEN, origin: ORIGIN, body: { argv: planned.argv, approval_id: planned.approval_id, approved: true } });
  assert.strictEqual(ok.status, 200);
  const reuse = await call('/api/agent/execute', { method: 'POST', token: TOKEN, origin: ORIGIN, body: { argv: planned.argv, approval_id: planned.approval_id, approved: true } });
  assert.strictEqual(reuse.status, 403);
});

test('a non-allowlisted command is refused by execute', async () => {
  const res = await call('/api/agent/execute', { method: 'POST', token: TOKEN, origin: ORIGIN, body: { argv: ['rm', '-rf', '/'], approval_id: 'y'.repeat(24), approved: true } });
  assert.strictEqual(res.status, 403);
});

test('plan surfaces an upstream model failure as 502', async () => {
  modelMode = 'down';
  const res = await call('/api/agent/plan', { method: 'POST', token: TOKEN, origin: ORIGIN, body: { goal: 'show the path', history: [] } });
  assert.strictEqual(res.status, 502);
  modelMode = 'command';
});
