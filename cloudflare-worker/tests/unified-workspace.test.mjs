import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import {WORKSPACE_HTML,WORKSPACE_SHORTCUT} from '../unified-workspace.js';

const url='https://wormstar-ai-lab.abdulstarzeki001.workers.dev';
const env={};

test('unified hub exposes accessible navigation and 15 real project entries',()=>{
  assert.match(WORKSPACE_HTML,/<html lang="ar" dir="rtl">/);
  for(const tab of ['overview','ai','security','projects','operations']){
    assert.ok(WORKSPACE_HTML.includes('data-section="'+tab+'"'));
    assert.ok(WORKSPACE_HTML.includes('data-view="'+tab+'"'));
  }
  assert.equal((WORKSPACE_HTML.match(/class="module"/g)||[]).length,15);
  assert.match(WORKSPACE_HTML,/href="\/academy"/);
  assert.match(WORKSPACE_HTML,/\/api\/chat/);
  assert.match(WORKSPACE_HTML,/\/api\/repo\/ask/);
  for(const model of ['gpt-oss-120b','gpt-oss-20b','qwen-coder','llama-3.3']){
    assert.ok(WORKSPACE_HTML.includes('value="'+model+'"'), 'Missing selectable model '+model);
  }
  assert.match(WORKSPACE_HTML,/\/api\/security\/header-audit/);
  assert.match(WORKSPACE_HTML,/Cloud Bridge/);
});
test('launcher preserves original homepage with a same-origin entry',()=>{
  assert.match(WORKSPACE_SHORTCUT,/href="\/workspace"/);
  assert.doesNotMatch(WORKSPACE_SHORTCUT,/target="_blank"/);
});
test('GET /workspace and /projects are private, non-cacheable HTML, no auth regression',async()=>{
  for(const route of ['/workspace','/workspace/','/projects']){
    const response=await worker.fetch(new Request(url+route),env,{waitUntil(){}});
    assert.equal(response.status,200);
    assert.match(response.headers.get('Content-Type')||'',/text\/html/);
    assert.match(response.headers.get('Cache-Control')||'',/no-store/);
    assert.match(response.headers.get('Content-Security-Policy')||'',/connect-src 'self'/);
    assert.match(await response.text(),/id="projectGrid"/);
  }
});
test('existing NEXUS landing page remains present and links to /workspace',async()=>{
  const response=await worker.fetch(new Request(url+'/'),env,{waitUntil(){}});
  assert.equal(response.status,200);
  const body=await response.text();
  assert.match(body,/WORMSTAR/);
  assert.match(body,/href="\/workspace"/);
  assert.match(body,/id="gate"/);
});
test('new hub does not weaken Core bearer authorization',async()=>{
  const response=await worker.fetch(new Request(url+'/api/auth',{method:'POST'}),env,{waitUntil(){}});
  assert.equal(response.status,401);
  assert.match(response.headers.get('Cache-Control')||'',/no-store/);
});
test('hub never embeds credentials or arbitrary execution endpoints',()=>{
  assert.doesNotMatch(WORKSPACE_HTML,/WORMSTAR_ACCESS_TOKEN|OPENCLAW_GATEWAY_TOKEN|OSINT_AGENT_TOKEN/);
  assert.doesNotMatch(WORKSPACE_HTML,/\beval\s*\(|new Function\s*\(/);
  assert.doesNotMatch(WORKSPACE_HTML,/\/api\/(?:shell|exec|execute)\b/);
  assert.match(WORKSPACE_HTML,/sessionStorage/);
  assert.doesNotMatch(WORKSPACE_HTML,/localStorage/);
});

test('repository-only endpoint accepts Llama 3.3 before checking backend bindings',async()=>{
  const secret='test-model-selection-owner-token';
  const response=await worker.fetch(new Request(url+'/api/repo/ask',{
    method:'POST',
    headers:{'Authorization':'Bearer '+secret,'Content-Type':'application/json'},
    body:JSON.stringify({message:'Explain repository entry points',engine:'llama-3.3',mode:'assistant'})
  }),{WORMSTAR_ACCESS_TOKEN:secret},{waitUntil(){}});
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,'Knowledge or inference binding missing');
});
