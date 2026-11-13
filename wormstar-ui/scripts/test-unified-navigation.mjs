import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const origin='https://wormstar-sentinel-preview.example';
const app='https://wormstar-ai-lab.abdulstarzeki001.workers.dev';
const get=path=>worker.fetch(new Request(origin+path),{});

test('OSINT report navigation includes the Wormstar suite without touching local evidence data',async()=>{
  const response=await get('/osint/');
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/aria-label|<nav/);
  assert.ok(html.includes('href="'+app+'/suite/"'));
  assert.ok(html.includes('href="/audit/"'));
  assert.ok(html.includes('report.json'));
  assert.ok(html.includes('infrastructure.json'));
  assert.match(html,/prefers-reduced-motion:reduce/);
  assert.doesNotMatch(html,/<script[^>]+src="https?:\/\//i);
});

test('Audit view has compact suite navigation while remaining static and local-only',async()=>{
  const response=await get('/audit/');
  assert.equal(response.status,200);
  const html=await response.text();
  assert.ok(html.includes('class="ws-suite-nav"'));
  assert.ok(html.includes('href="'+app+'/suite/"'));
  assert.ok(html.includes('href="'+app+'/terminal/"'));
  assert.ok(html.includes('href="'+app+'/osint/"'));
  assert.ok(html.includes('analysis.json'));
  assert.match(html,/prefers-reduced-motion:reduce|ws-suite-nav/);
  assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});

test('Audit and OSINT metadata cannot accidentally become authorization or a shell invocation',async()=>{
  for(const page of ['/osint/','/audit/']){
    const html=await (await get(page)).text();
    assert.equal(html.includes('TERMINAL_PASSWORD'),false);
    assert.equal(html.includes('window.location.href = "https://terminal-'),false);
    assert.equal(html.includes('Authorization: Bearer'),false);
  }
});
