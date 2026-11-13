import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import REDESIGN_HTML from '../redesign-ui.js';
import {compactPage} from '../compact-layout.js';

const BASE='https://wormstar-ai-lab.example';
function scriptSource(html){
  const match=html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match,'NEXUS inline application script must exist');
  return match[1];
}

test('knowledge library template is synchronous in the served NEXUS page',async()=>{
  const original=scriptSource(REDESIGN_HTML);
  assert.match(original,/async function memoryHTML\(\)\{/);
  const response=await worker.fetch(new Request(BASE+'/'),{}, {waitUntil(){}});
  assert.equal(response.status,200);
  const served=await response.text();
  const script=scriptSource(served);
  assert.match(script,/function memoryHTML\(\)\{/);
  assert.doesNotMatch(script,/async function memoryHTML\(\)\{/);
  assert.match(script,/else if\(pageName==='memory'\)\$\('page'\)\.innerHTML=memoryHTML\(\)/);
  assert.match(script,/return '<div class="page-head">/);
  assert.match(served,/id="memoryDialog"/);
  assert.match(served,/data-nav="memory"/);
  assert.match(response.headers.get('Content-Type')||'',/text\/html/);
});

test('knowledge library actions and owner-protected APIs remain present',()=>{
  const served=compactPage(REDESIGN_HTML,'nexus');
  for(const name of ["async function loadMemory()","async function createMemory(event)","async function openMemory(id)","data-action=\"refresh-memory\"","/api/studio/knowledge"]){
    assert.ok(served.includes(name),'missing library action '+name);
  }
  assert.doesNotMatch(served,/\[object Promise\]/);
  assert.match(served,/function renderPage\(\)/);
  assert.match(served,/function memoryHTML\(\)/);
});

test('library fix does not change any API authorization behavior',async()=>{
  const protectedApi=await worker.fetch(new Request(BASE+'/api/studio/knowledge'),{}, {waitUntil(){}});
  assert.equal(protectedApi.status,401);
  const tokenCheck=await worker.fetch(new Request(BASE+'/api/auth',{method:'POST'}),{}, {waitUntil(){}});
  assert.equal(tokenCheck.status,401);
});
