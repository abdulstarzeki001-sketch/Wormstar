'use strict';

/*
 * Wormstar cloud terminal backend (interactive terminal only).
 *
 * A cloud-deployable sibling of the local Python service in the parent folder,
 * for owners who have no Linux host with Docker. It speaks the part of the
 * Sentinel contract (`wormstar-ui/terminal.js`) needed for a live terminal:
 *   - Bearer token auth (no password), token format [A-Za-z0-9_-]{24,256}
 *   - GET /api/health   -> { container_running, capabilities }
 *   - WS  /ws/terminal  (subprotocols: wormstar-terminal, auth.<token>)
 *
 * The AI plan/execute capabilities are deliberately NOT implemented here. They
 * run model-proposed commands and feed output back to a model, which is only
 * acceptable inside the verified, network-isolated sandbox of the local
 * backend. Sentinel disables those buttons when the capabilities are absent.
 *
 * Isolation: a managed host gives no nested Docker, so the deployment
 * container is the outer boundary. Inside it the service is privilege
 * separated: this process starts as root ONLY to launch each shell through
 * `setpriv` as a different unprivileged user, with supplementary groups
 * cleared, every capability dropped and no-new-privileges set. The shell
 * therefore cannot read this process's environment (the access token) and
 * cannot regain privileges through setuid binaries.
 */

const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');
const express = require('express');
const { WebSocketServer } = require('ws');
const pty = require('node-pty');

// ---- Configuration -------------------------------------------------------

const PORT = Number(process.env.PORT || 8080);
const ACCESS_TOKEN = String(process.env.TERMINAL_ACCESS_TOKEN || '').trim();
if (!/^[A-Za-z0-9_-]{24,256}$/.test(ACCESS_TOKEN)) {
  console.error('Set a random URL-safe TERMINAL_ACCESS_TOKEN (24-256 characters).');
  process.exit(1);
}

// Only these capabilities exist in the cloud backend; anything else requested
// through the environment is ignored rather than advertised to the UI.
const SUPPORTED = ['health', 'terminal'];
const CAPABILITIES = new Set(
  String(process.env.TERMINAL_CAPABILITIES || 'health,terminal')
    .split(',').map((x) => x.trim()).filter((x) => SUPPORTED.includes(x))
);

const RUN_AS = String(process.env.TERMINAL_RUN_AS || 'tuser');
const IDLE_MINUTES = Number(process.env.IDLE_MINUTES || 30);
const MAX_SESSION_MINUTES = Number(process.env.MAX_SESSION_MINUTES || 120);
const MAX_SESSIONS = Math.max(1, Number(process.env.MAX_SESSIONS || 4));

const BEARER = Buffer.from('Bearer ' + ACCESS_TOKEN);
const WS_AUTH = Buffer.from('auth.' + ACCESS_TOKEN);

function log(event, status) {
  // Record the event type and status only; never commands, tokens or output.
  console.log(`terminal_api event=${event} status=${status}`);
}

function safeEqual(value, expected) {
  if (typeof value !== 'string') return false;
  const buf = Buffer.from(value);
  // The length guard keeps timingSafeEqual from throwing on a size mismatch.
  return buf.length === expected.length && crypto.timingSafeEqual(buf, expected);
}

function allowedOrigins() {
  const result = new Set(['http://127.0.0.1:8080', 'http://localhost:8080']);
  for (const candidate of String(process.env.WORMSTAR_UI_ORIGINS || '').split(',')) {
    const value = candidate.trim();
    if (!value) continue;
    try {
      const u = new URL(value);
      if (u.protocol === 'https:' && u.hostname && !u.username && !u.password
          && (u.pathname === '' || u.pathname === '/') && !u.search && !u.hash) {
        result.add(`https://${u.host}`);
      }
    } catch (_) { /* ignore a malformed origin */ }
  }
  return result;
}

// ---- Privilege separation -------------------------------------------------

function lookupUser(name) {
  for (const line of fs.readFileSync('/etc/passwd', 'utf8').split('\n')) {
    const f = line.split(':');
    if (f[0] === name) return { uid: Number(f[2]), gid: Number(f[3]), home: f[5] };
  }
  return null;
}

// Decide how shells are launched. Fail closed: the service only runs when the
// shell is separated from this process, unless the owner explicitly waives it
// for local development with TERMINAL_ALLOW_SHARED_UID=1.
function resolveLauncher() {
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  if (isRoot) {
    const user = /^[a-z_][a-z0-9_-]{0,31}$/.test(RUN_AS) ? lookupUser(RUN_AS) : null;
    if (!user || !(user.uid > 0) || !(user.gid > 0)) {
      console.error(`TERMINAL_RUN_AS must name an existing non-root user (got "${RUN_AS}").`);
      process.exit(1);
    }
    return {
      separated: true, user: RUN_AS, uid: user.uid,
      home: process.env.TERMINAL_HOME || user.home,
      file: 'setpriv',
      args: [`--reuid=${user.uid}`, `--regid=${user.gid}`, '--clear-groups',
        '--no-new-privs', '--inh-caps=-all', '--bounding-set=-all'],
    };
  }
  if (process.env.TERMINAL_ALLOW_SHARED_UID !== '1') {
    console.error('Refusing to start: run as root so shells can be dropped to TERMINAL_RUN_AS, '
      + 'or set TERMINAL_ALLOW_SHARED_UID=1 for local development only.');
    process.exit(1);
  }
  console.warn('WARNING: shells share this process UID and can read its environment. Development only.');
  return { separated: false, user: process.env.USER || 'dev', uid: process.getuid(),
    home: process.env.TERMINAL_HOME || process.env.HOME || '/tmp', file: null, args: [] };
}

const LAUNCHER = resolveLauncher();
const WORKSPACE = process.env.TERMINAL_WORKSPACE || `${LAUNCHER.home}/workspace`;

function shellEnv() {
  // Explicit allowlist; nothing from this process's environment leaks through.
  return {
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    HOME: LAUNCHER.home, USER: LAUNCHER.user, LOGNAME: LAUNCHER.user,
    LANG: 'C.UTF-8', TERM: 'xterm-256color', COLORTERM: 'truecolor',
  };
}

function spawnAs(file, args, size) {
  const target = LAUNCHER.file ? [LAUNCHER.file, [...LAUNCHER.args, file, ...args]] : [file, args];
  return pty.spawn(target[0], target[1], {
    name: 'xterm-256color', cols: size.cols, rows: size.rows, cwd: WORKSPACE, env: shellEnv(),
  });
}

// Prove at startup that the launcher really lands on the expected UID. Health
// reports container_running=false (and terminals are refused) until it passes.
let sandboxReady = false;
function selfCheck() {
  return new Promise((resolve) => {
    let output = '';
    let probe;
    try { probe = spawnAs('/usr/bin/id', ['-u'], { cols: 80, rows: 24 }); } catch (_) { resolve(false); return; }
    const timer = setTimeout(() => { try { probe.kill(); } catch (_) { /* gone */ } }, 5000);
    probe.onData((d) => { output += d; });
    probe.onExit(({ exitCode }) => {
      clearTimeout(timer);
      sandboxReady = exitCode === 0 && output.trim() === String(LAUNCHER.uid)
        && (!LAUNCHER.separated || LAUNCHER.uid !== 0);
      resolve(sandboxReady);
    });
  });
}

// ---- HTTP app ------------------------------------------------------------

const app = express();
app.disable('x-powered-by');

// Auth + CORS gate for every /api/* route. No request body is ever parsed.
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins().has(origin)) {
    return res.status(403).json({ detail: 'Forbidden origin' });
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS' && origin) return res.status(204).end();
  if (!safeEqual(req.headers.authorization, BEARER)) {
    return res.status(401).json({ detail: 'Unauthorized' });
  }
  const capability = req.method === 'GET' && req.path === '/health' ? 'health' : null;
  if (!capability || !CAPABILITIES.has(capability)) {
    log('api', 403);
    return res.status(403).json({ detail: 'Capability not enabled' });
  }
  next();
});

app.get('/api/health', (_req, res) => {
  log('health', 200);
  res.json({ container_running: sandboxReady, capabilities: [...CAPABILITIES].sort() });
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// ---- Interactive terminal over WebSocket --------------------------------

const server = http.createServer(app);
const wss = new WebSocketServer({
  server, path: '/ws/terminal', maxPayload: 64 * 1024,
  // Reject at the handshake: no socket is opened for an unauthenticated peer.
  verifyClient: (info, done) => {
    const offered = String(info.req.headers['sec-websocket-protocol'] || '').split(',').map((s) => s.trim());
    if (!CAPABILITIES.has('terminal')) return done(false, 403, 'Capability not enabled');
    if (!allowedOrigins().has(info.origin)) return done(false, 403, 'Forbidden origin');
    if (!offered.includes('wormstar-terminal') || !offered.some((p) => safeEqual(p, WS_AUTH))) {
      return done(false, 401, 'Unauthorized');
    }
    if (!sandboxReady) return done(false, 503, 'Sandbox unavailable');
    if (wss.clients.size >= MAX_SESSIONS) return done(false, 503, 'Too many sessions');
    return done(true);
  },
  handleProtocols: (protocols) => (protocols.has('wormstar-terminal') ? 'wormstar-terminal' : false),
});

wss.on('connection', (ws) => {
  let term;
  try {
    term = spawnAs('/bin/bash', ['-l'], { cols: 90, rows: 26 });
  } catch (_) {
    ws.close(1011);
    return;
  }
  log('terminal_session', 'opened');
  term.onData((data) => { if (ws.readyState === ws.OPEN) ws.send(data); });
  term.onExit(() => ws.close());

  let idle = setTimeout(() => ws.close(), IDLE_MINUTES * 60000);
  const hard = setTimeout(() => ws.close(), MAX_SESSION_MINUTES * 60000);

  ws.on('message', (raw) => {
    if (raw.length > 8192) { ws.close(); return; }
    let packet;
    try { packet = JSON.parse(raw.toString()); } catch (_) { return; }
    if (!packet || typeof packet !== 'object') return;
    if (packet.type === 'input' && typeof packet.data === 'string') {
      clearTimeout(idle);
      idle = setTimeout(() => ws.close(), IDLE_MINUTES * 60000);
      term.write(packet.data.slice(0, 4096));
    } else if (packet.type === 'resize') {
      const cols = Math.min(240, Math.max(20, Number(packet.cols) || 90));
      const rows = Math.min(80, Math.max(5, Number(packet.rows) || 26));
      try { term.resize(cols, rows); } catch (_) { /* ignore bad geometry */ }
    }
  });

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearTimeout(idle);
    clearTimeout(hard);
    try { term.kill(); } catch (_) { /* already exited */ }
    log('terminal_session', 'closed');
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);
});

if (require.main === module) {
  selfCheck().then((ok) => {
    if (!ok) {
      console.error('Privilege-separation self-check failed; refusing to serve terminals.');
      process.exit(1);
    }
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Wormstar cloud terminal listening on port ${PORT} `
        + `(capabilities: ${[...CAPABILITIES].sort().join(',')}; shell user: ${LAUNCHER.user}; `
        + `separated: ${LAUNCHER.separated})`);
    });
  });
}

module.exports = { app, server, wss, selfCheck, allowedOrigins, LAUNCHER };
