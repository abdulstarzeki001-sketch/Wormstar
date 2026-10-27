import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const base = 'https://wormstar-security-test.invalid';
const env = { WORMSTAR_ACCESS_TOKEN: 'offline-test-token', AI: {} };

async function get(path, options) {
  return worker.fetch(new Request(base + path, options), env, {});
}

test('public icons and web app manifest have only one-hour cacheability', async () => {
  for (const path of ['/apple-touch-icon.png', '/icon.png', '/favicon.png',
    '/icon.svg', '/favicon.svg', '/manifest.webmanifest']) {
    const response = await get(path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=3600, s-maxage=3600', path);
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff', path);
    assert.equal(response.headers.get('Strict-Transport-Security'), 'max-age=31536000', path);
    assert.equal(response.headers.has('Set-Cookie'), false, path);
  }
});

test('all JSON API responses, including health and unauthorized chat, forbid CDN storage', async () => {
  const health = await get('/api/health');
  const denied = await get('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'assistant', message: 'private text' })
  });
  const notFound = await get('/api/does-not-exist');
  for (const response of [health, denied, notFound]) {
    assert.match(response.headers.get('Cache-Control') || '', /private, no-store/);
    assert.equal(response.headers.get('CDN-Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
    assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
    assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
    assert.equal(response.headers.get('Permissions-Policy'), 'camera=(), microphone=(), geolocation=()');
  }
  assert.equal(health.status, 200);
  assert.equal(denied.status, 401);
  assert.equal(notFound.status, 404);
});

test('private application shell cannot be stored or framed', async () => {
  const response = await get('/');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Cache-Control') || '', /no-store/);
  assert.equal(response.headers.get('Cloudflare-CDN-Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.match(response.headers.get('Content-Security-Policy') || '', /frame-ancestors 'none'/);
});

test('external model remains disabled without verified provider secrets', async () => {
  const response = await get('/api/health');
  const body = await response.json();
  assert.equal(body.wormgptConfigured, false);
  assert.equal(response.headers.get('Cache-Control').includes('no-store'), true);
});
