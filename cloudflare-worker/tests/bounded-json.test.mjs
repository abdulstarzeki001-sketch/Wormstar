import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const token='local-only-body-size-validation';
const env={
  WORMSTAR_ACCESS_TOKEN:token,
  DB:{prepare(){throw Error('Database must not be called for oversized JSON');}},
  AI:{async run(){throw Error('Workers AI must not be called for oversized JSON');}}
};

async function send(path,object,{declared}={}){
  const headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'};
  if(declared!==undefined)headers['Content-Length']=String(declared);
  const r=await worker.fetch(new Request('https://wormstar-local.invalid'+path,{
    method:'POST',headers,body:typeof object==='string'?object:JSON.stringify(object)
  }),env,{});
  return {status:r.status,body:await r.json()};
}

test('chat rejects oversized JSON without declared Content-Length',async()=>{
  const r=await send('/api/chat',{mode:'assistant',message:'x'.repeat(66000)});
  assert.equal(r.status,413);
  assert.match(r.body.error,/Request too large/);
});

test('chat rejects maliciously understated Content-Length',async()=>{
  const r=await send('/api/chat',{mode:'assistant',message:'x'.repeat(66000)},{declared:1});
  assert.equal(r.status,413);
});

test('studio rejects oversized JSON without declared Content-Length',async()=>{
  const r=await send('/api/studio/knowledge',{title:'test',kind:'note',content:'a'.repeat(126000)});
  assert.equal(r.status,413);
  assert.match(r.body.error,/storage size/);
});

test('studio rejects maliciously understated Content-Length',async()=>{
  const r=await send('/api/studio/knowledge',{title:'test',kind:'note',content:'a'.repeat(126000)},{declared:10});
  assert.equal(r.status,413);
});

test('small malformed JSON is rejected without database work',async()=>{
  const r=await send('/api/studio/knowledge','{"title":}');
  assert.equal(r.status,400);
  assert.equal(r.body.error,'Invalid JSON');
});

test('auth is checked before reading a large request body',async()=>{
  const r=await worker.fetch(new Request('https://wormstar-local.invalid/api/chat',{
    method:'POST',headers:{Authorization:'Bearer invalid'},
    body:JSON.stringify({mode:'assistant',message:'x'.repeat(66000)})
  }),env,{});
  assert.equal(r.status,401);
});
