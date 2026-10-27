import test from 'node:test';
import assert from 'node:assert/strict';
import { invokeWormGPT, wormgptConfigured, WORMGPT_ENDPOINT } from '../wormgpt-provider.js';

const env = { WORMGPT_API_KEY: 'test-credential-not-real-123456', WORMGPT_MODEL_ID: 'provider-confirmed-model-id' };
const messages = [{ role: 'system', content: 'Answer concisely.' }, { role: 'user', content: 'Hello' }];

test('external model remains disabled until both credentials and model ID exist', () => {
  assert.equal(wormgptConfigured({}), false);
  assert.equal(wormgptConfigured({ WORMGPT_API_KEY: env.WORMGPT_API_KEY }), false);
  assert.equal(wormgptConfigured({ ...env, WORMGPT_MODEL_ID: 'invalid model id' }), false);
  assert.equal(wormgptConfigured(env), true);
});

test('sends only explicitly supplied conversation to pinned HTTPS endpoint', async () => {
  let called = false;
  const answer = await invokeWormGPT(env, messages, 500, async (url, init) => {
    called = true;
    assert.equal(url, WORMGPT_ENDPOINT);
    assert.equal(init.method, 'POST');
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.headers.Authorization, 'Bearer ' + env.WORMGPT_API_KEY);
    const body = JSON.parse(init.body);
    assert.deepEqual(body.messages, messages);
    assert.equal(body.model, env.WORMGPT_MODEL_ID);
    assert.equal(body.stream, false);
    assert.equal(body.max_tokens, 500);
    return new Response(JSON.stringify({ choices: [{ message: { content: '  Verified mock reply  ' } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.equal(called, true);
  assert.equal(answer, 'Verified mock reply');
});

test('does not call external provider when unconfigured', async () => {
  await assert.rejects(() => invokeWormGPT({}, messages, 500, () => {
    throw new Error('must not call');
  }), /not configured/);
});

test('does not leak provider response bodies on errors', async () => {
  await assert.rejects(
    () => invokeWormGPT(env, messages, 500, async () =>
      new Response('provider-secret-or-internal-error', { status: 403 })),
    /HTTP 403/
  );
});

test('rejects malformed completions and oversized conversations', async () => {
  await assert.rejects(() => invokeWormGPT(env, messages, 500, async () =>
    new Response(JSON.stringify({ response: 'wrong shape' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } })),
    /invalid chat completion/);
  await assert.rejects(() => invokeWormGPT(env,
    [{ role: 'user', content: 'x'.repeat(30001) }], 500, () => {
      throw new Error('must not call');
    }), /Invalid provider conversation/);
});


test('external provider key with whitespace, CRLF, non-ASCII or extreme length is rejected before network', async () => {
  const badKeys = [
    env.WORMGPT_API_KEY + '\nInjected: value',
    env.WORMGPT_API_KEY + '\r',
    ' ' + env.WORMGPT_API_KEY,
    env.WORMGPT_API_KEY + ' ',
    'أ'.repeat(30),
    'a'.repeat(513),
    'tiny'
  ];
  for (const WORMGPT_API_KEY of badKeys) {
    const bad = { ...env, WORMGPT_API_KEY };
    assert.equal(wormgptConfigured(bad), false);
    await assert.rejects(
      () => invokeWormGPT(bad, messages, 500, () => {
        throw new Error('MUST_NOT_SEND_INVALID_KEY');
      }), /not configured/
    );
  }
});

test('external provider cannot follow redirects, cache private data or accept HTML', async () => {
  await assert.rejects(() => invokeWormGPT(env, messages, 500, async (url, init) => {
    assert.equal(url, WORMGPT_ENDPOINT);
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    return new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } });
  }), /unexpected content type/);
});

test('model ID is not inferred from promotional version label', () => {
  assert.equal(wormgptConfigured({ ...env, WORMGPT_MODEL_ID: '' }), false);
  assert.equal(wormgptConfigured({ ...env, WORMGPT_MODEL_ID: 'v5.1 unverified' }), false);
  assert.equal(wormgptConfigured({ ...env, WORMGPT_MODEL_ID: '../unapproved  model' }), false);
});
