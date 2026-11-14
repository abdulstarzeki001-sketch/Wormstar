import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

// These pages are static GET responses; no owner session or binding is involved.
const origin='https://wormstar-ai-lab.abdulstarzeki001.workers.dev';
const page=async path=>{
  const response=await worker.fetch(new Request(origin+path),{},{waitUntil(){},passThroughOnException(){}});
  assert.equal(response.status,200,path);
  return response.text();
};

test('NEXUS launcher stays a compact pill on phones instead of stretching over the login gate',async()=>{
  const html=await page('/');
  // The launcher ships its own later mobile rule that sets `bottom`. The compact layout moves the
  // link to the top, so its rule must outrank that one; otherwise top and bottom both apply and the
  // fixed link stretches the full height of the screen.
  assert.ok(html.includes('@media(max-width:760px){body .ws-unified-launch{bottom:auto;height:auto;top:calc(9px + env(safe-area-inset-top))'));
  assert.equal(html.includes('@media(max-width:760px){.ws-unified-launch{bottom:auto'),false);
  const own=html.indexOf('.ws-unified-launch{bottom:calc(85px');
  assert.ok(own>html.indexOf('body .ws-unified-launch{bottom:auto'),'launcher rule is expected later in the document');
});

test('Workspace shortcuts do not wrap inside the horizontal phone navigation',async()=>{
  const html=await page('/workspace');
  assert.ok(html.includes('.side nav{display:flex;gap:7px;overflow-x:auto'),'phone navigation contract changed');
  assert.ok(html.includes('html[data-ws-ui-engineering] .side nav > .ws-suite-shortcuts {flex:none;flex-wrap:nowrap;margin:0;order:1}'));
  assert.ok(html.includes('html[data-ws-ui-engineering] .side nav > .ws-suite-shortcuts a {white-space:nowrap}'));
});

test('Academy bottom navigation fits five destinations on a 320px screen',async()=>{
  const html=await page('/academy');
  assert.ok(html.includes('.mobile-nav button{'),'bottom navigation contract changed');
  assert.ok(html.includes('@media(max-width:360px){.mobile-nav{padding-inline:6px}.mobile-nav button{min-width:0;flex:1 1 0}}'));
});
