import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import REDESIGN_HTML from '../redesign-ui.js';

const worker = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');

test('new interface is a standalone bilingual responsive workspace', () => {
  assert.match(REDESIGN_HTML, /<html lang="ar" dir="rtl" data-theme="light">/);
  assert.match(REDESIGN_HTML, /document\.documentElement\.dir=lang==='ar'\?'rtl':'ltr'/);
  assert.match(REDESIGN_HTML, /@media\(max-width:860px\)/);
  assert.match(REDESIGN_HTML, /@media\(max-width:620px\)/);
  assert.match(REDESIGN_HTML, /class="mobile-nav hidden"/);
  assert.match(REDESIGN_HTML, /id="sidebar"/);
  assert.match(REDESIGN_HTML, /prefers-reduced-motion/);
});

test('all existing analysis modes remain available', () => {
  for (const mode of ['assistant', 'code', 'logs', 'ioc', 'ctf', 'report']) {
    assert.match(REDESIGN_HTML, new RegExp('data-nav="' + mode + '"'));
    assert.ok(REDESIGN_HTML.includes("'" + mode + "'"));
  }
  assert.match(REDESIGN_HTML, /id="chatForm"/);
  assert.match(REDESIGN_HTML, /api\('\/api\/chat'/);
});

test('authentication remains bearer-token based and browser-session scoped', () => {
  assert.match(REDESIGN_HTML, /fetch\('\/api\/auth'/);
  assert.match(REDESIGN_HTML, /sessionStorage\.setItem\(KEY,value\)/);
  assert.match(REDESIGN_HTML, /sessionStorage\.removeItem\(KEY\)/);
  assert.doesNotMatch(REDESIGN_HTML, /localStorage\.(?:getItem|setItem)\(KEY/);
  assert.doesNotMatch(REDESIGN_HTML, /WORMSTAR_ACCESS_TOKEN|WORMGPT_API_KEY|OPENCLAW_GATEWAY_TOKEN/);
});

test('existing D1 archive, knowledge, policy and agent APIs are wired into the UI', () => {
  for (const route of [
    '/api/studio/chat-archive', '/api/studio/knowledge', '/api/studio/policy',
    '/api/lab/policy', '/api/openclaw/status', '/api/opencode/status', '/api/health'
  ]) assert.ok(REDESIGN_HTML.includes(route), 'missing route ' + route);
});

test('UI does not create an arbitrary execution or network-scan surface', () => {
  assert.match(REDESIGN_HTML, /Text analysis/);
  assert.match(REDESIGN_HTML, /لا يفتح أهدافاً خارجية/);
  assert.doesNotMatch(REDESIGN_HTML, /\beval\s*\(|new Function\s*\(/);
  assert.doesNotMatch(REDESIGN_HTML, /\/api\/(?:shell|exec|execute|scan)(?:\/|"|')/i);
  assert.doesNotMatch(REDESIGN_HTML, /<script[^>]+src=["']https?:\/\//i);
});

test('Cloudflare Worker serves the redesign but retains protected backend routes', () => {
  assert.match(worker, /import REDESIGN_HTML from '\.\/redesign-ui\.js'/);
  assert.match(worker, /const FUTURE_HTML=REDESIGN_HTML/);
  assert.match(worker, /new Response\(FUTURE_HTML/);
  assert.match(worker, /url\.pathname==='\/api\/chat'/);
  assert.match(worker, /url\.pathname\.startsWith\('\/api\/studio\/'\)/);
  assert.match(worker, /async function allow\(request,env\)/);
  assert.match(worker, /await allow\(request,env\)/);
  assert.match(worker, /theme_color:'#182a2c'/);
});
