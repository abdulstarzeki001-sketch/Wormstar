'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const WebSocket = require('ws');

const TOKEN = 'test_token_abcdefghijklmnopqrstuvwxyz0123';
const ORIGIN = 'https://sentinel.example.com';
const IS_ROOT = typeof process.getuid === 'function' && process.getuid() === 0;

let mod;
let base;
let wsBase;
const sockets = [];

before(async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'wormstar-cloud-'));
  fs.chmodSync(workspace, 0o777);
  process.env.TERMINAL_ACCESS_TOKEN = TOKEN;
  process.env.WORMSTAR_UI_ORIGINS = ORIGIN;
  // plan/execute are requested on purpose: the cloud backend must ignore them.
  process.env.TERMINAL_CAPABILITIES = 'health,terminal,plan,execute';
  process.env.TERMINAL_WORKSPACE = workspace;
  process.env.TERMINAL_HOME = workspace;
  if (IS_ROOT) process.env.TERMINAL_RUN_AS = 'nobody';
  else process.env.TERMINAL_ALLOW_SHARED_UID = '1';
  mod = require('../server.js');
  assert.strictEqual(await mod.selfCheck(), true, 'launcher self-check must pass');
  await new Promise((r) => mod.server.listen(0, '127.0.0.1', r));
  const { port } = mod.server.address();
  base = `http://127.0.0.1:${port}`;
  wsBase = `ws://127.0.0.1:${port}/ws/terminal`;
});

after(() => {
  for (const s of sockets) { try { s.terminate(); } catch (_) { /* closed */ } }
  mod.wss.close();
  mod.server.close();
});

function call(route, { method = 'GET', token, origin, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (origin) headers.Origin = origin;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

function connect({ token = TOKEN, origin = ORIGIN } = {}) {
  const options = origin ? { origin } : {};
  const ws = new WebSocket(wsBase, ['wormstar-terminal', 'auth.' + token], options);
  sockets.push(ws);
  return ws;
}

// Resolves with the HTTP status of a refused handshake.
function refusedStatus(ws) {
  return new Promise((resolve, reject) => {
    ws.on('unexpected-response', (_req, res) => resolve(res.statusCode));
    ws.on('open', () => reject(new Error('handshake unexpectedly accepted')));
    ws.on('error', () => { /* surfaced through unexpected-response */ });
  });
}

// Sends one command line and resolves with the first regex match in the output.
function run(ws, command, pattern) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('no match for ' + pattern + ' in: ' + output.slice(-400))), 8000);
    const onMessage = (data) => {
      output += data.toString();
      const match = output.match(pattern);
      if (match) { clearTimeout(timer); ws.off('message', onMessage); resolve(match); }
    };
    ws.on('message', onMessage);
    ws.send(JSON.stringify({ type: 'input', data: command + '\n' }));
  });
}

function opened(ws) {
  return new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });
}

test('health rejects a missing token', async () => {
  assert.strictEqual((await call('/api/health')).status, 401);
});

test('health rejects a wrong token', async () => {
  assert.strictEqual((await call('/api/health', { token: TOKEN.slice(0, -1) + 'X' })).status, 401);
});

test('health rejects a forbidden origin', async () => {
  const res = await call('/api/health', { token: TOKEN, origin: 'https://evil.example.com' });
  assert.strictEqual(res.status, 403);
});

test('health advertises only the supported capabilities', async () => {
  const res = await call('/api/health', { token: TOKEN, origin: ORIGIN });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('access-control-allow-origin'), ORIGIN);
  const body = await res.json();
  assert.strictEqual(body.container_running, true);
  assert.deepStrictEqual(body.capabilities, ['health', 'terminal']);
});

test('the AI plan and execute routes are not exposed', async () => {
  const plan = await call('/api/agent/plan', { method: 'POST', token: TOKEN, origin: ORIGIN, body: { goal: 'list files', history: [] } });
  assert.strictEqual(plan.status, 403);
  const execute = await call('/api/agent/execute', { method: 'POST', token: TOKEN, origin: ORIGIN, body: { argv: ['pwd'], approval_id: 'x'.repeat(24), approved: true } });
  assert.strictEqual(execute.status, 403);
});

test('malformed request bodies never reach a parser', async () => {
  const res = await fetch(base + '/api/agent/plan', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: '{"history":[{"argv":[{"toString":null}]}' });
  assert.strictEqual(res.status, 403);
});

test('terminal handshake rejects a wrong token', async () => {
  assert.strictEqual(await refusedStatus(connect({ token: 'wrong_token_abcdefghijklmnopqrstuvwxyz' })), 401);
});

test('terminal handshake rejects a foreign or missing origin', async () => {
  assert.strictEqual(await refusedStatus(connect({ origin: 'https://evil.example.com' })), 403);
  assert.strictEqual(await refusedStatus(connect({ origin: null })), 403);
});

test('an authorized terminal session runs commands', async () => {
  const ws = connect();
  await opened(ws);
  assert.strictEqual(ws.protocol, 'wormstar-terminal');
  const match = await run(ws, 'echo MARK_$((6*7))', /MARK_(\d+)/);
  assert.strictEqual(match[1], '42');
  ws.close();
});

test('the shell is privilege separated from the server', { skip: !IS_ROOT && 'requires root to drop privileges' }, async () => {
  const ws = connect();
  await opened(ws);
  const uid = await run(ws, 'echo UID_$(id -u)_END', /UID_(\d+)_END/);
  assert.notStrictEqual(uid[1], '0');
  assert.strictEqual(uid[1], String(mod.LAUNCHER.uid));
  // The access token lives in this (server) process's environment.
  const leak = await run(ws, `echo LEAK_$(head -c1 /proc/${process.pid}/environ >/dev/null 2>&1 && echo Y3S || echo N0)`, /LEAK_(Y3S|N0)/);
  assert.strictEqual(leak[1], 'N0', 'shell must not read the server environment');
  const nnp = await run(ws, "echo NNP_$(grep -c '^NoNewPrivs:.1' /proc/self/status)", /NNP_(\d)/);
  assert.strictEqual(nnp[1], '1');
  const caps = await run(ws, "echo CAPS_$(awk '/^CapBnd:/{print $2}' /proc/self/status)_END", /CAPS_([0-9a-f]+)_END/);
  assert.match(caps[1], /^0+$/, 'capability bounding set must be empty');
  ws.close();
});
