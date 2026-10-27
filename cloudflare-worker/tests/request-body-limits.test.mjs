import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../worker.js';

const TOKEN='local-test-token-never-deployed';
const ORIGIN='https://wormstar-audit.invalid';
const policy={
 version:1,mission:'Audit fixture',allowed_modes:['assistant','code','logs','ioc','ctf','report'],
 required_terms:[],max_input_chars:12000,max_output_tokens:256,memory_enabled:true,
 allow_web_import:true,allow_memory_delete:true,answer_style:'Accurate',
 workflow_steps:['Review','Answer']
};
let calls=0;
function fixture({full=false,duplicate=false}={}){
 return {
  WORMSTAR_ACCESS_TOKEN:TOKEN,
  AI:{async run(){calls++;return {response:'OK'};}},
  DB:{prepare(sql){
   let args=[];
   return {
    bind(...a){args=a;return this;},
    async first(){
     if(sql.includes('FROM ai_policy'))return {policy_json:JSON.stringify(policy)};
     if(sql.includes('FROM ai_profile'))return {name:'Wormstar',instructions:'',constraints:''};
     if(sql.includes('SELECT id FROM knowledge WHERE title=? AND content=?'))return duplicate?{id:'11111111-1111-4111-8111-111111111111'}:null;
     if(sql.toLowerCase().includes('count(*)'))return {n:full?500:88};
     return null;
    },
    async all(){return {results:[]};},
    async run(){return {success:true};}
   };
  }}
 };
}
function send(path,body,env=fixture(),headers={}){
 return worker.fetch(new Request(ORIGIN+path,{
  method:'POST',
  headers:{Authorization:'Bearer '+TOKEN,'Content-Type':'application/json',...headers},
  body
 }),env,{});
}

test('chat limits real UTF-8 bytes even without a Content-Length header',async()=>{
 calls=0;
 const body=JSON.stringify({mode:'assistant',message:'x'.repeat(66000)});
 const res=await send('/api/chat',body);
 assert.equal(res.status,413);
 assert.equal((await res.json()).error,'Request too large');
 assert.equal(calls,0);
});

test('multibyte Arabic is counted as bytes, not JS character length',async()=>{
 calls=0;
 const body=JSON.stringify({mode:'assistant',message:'ع'.repeat(33000)});
 assert.ok(body.length<65000);
 const res=await send('/api/chat',body);
 assert.equal(res.status,413);
 assert.equal(calls,0);
});

test('studio rejects an oversized JSON stream before writing to D1',async()=>{
 const body=JSON.stringify({title:'example',kind:'note',content:'x'.repeat(126000)});
 const res=await send('/api/studio/knowledge',body);
 assert.equal(res.status,413);
 assert.match((await res.json()).error,/storage size limit/);
});

test('invalid JSON is rejected as a client error, not a server exception',async()=>{
 const res=await send('/api/chat','{"mode":');
 assert.equal(res.status,400);
 assert.equal((await res.json()).error,'Invalid JSON');
});

test('authorization is evaluated before reading the request body',async()=>{
 const req=new Request(ORIGIN+'/api/chat',{method:'POST',body:'x'.repeat(66000)});
 const res=await worker.fetch(req,fixture(),{});
 assert.equal(res.status,401);
});

test('a duplicate item is idempotent even at the 500-entry cap',async()=>{
 const payload=JSON.stringify({title:'existing',content:'text',kind:'note'});
 const dup=await send('/api/studio/knowledge',payload,fixture({full:true,duplicate:true}));
 assert.equal(dup.status,200);
 assert.equal((await dup.json()).duplicate,true);
 const newItem=await send('/api/studio/knowledge',payload,fixture({full:true,duplicate:false}));
 assert.equal(newItem.status,409);
});

test('source-of-truth and generated permission policies agree on 500 entries',()=>{
 const base=JSON.parse(readFileSync(new URL('../../policy/permissions.json',import.meta.url),'utf8'));
 const live=JSON.parse(readFileSync(new URL('../permissions.json',import.meta.url),'utf8'));
 assert.equal(base.limits.maxKnowledgeEntries,500);
 assert.equal(live.limits.maxKnowledgeEntries,500);
});


test('owner bearer comparison respects UTF-8 byte length for non-ASCII tokens',async()=>{
 const env=fixture();
 env.WORMSTAR_ACCESS_TOKEN='owner-🔐-private';
 const valid=new Request(ORIGIN+'/api/auth',{method:'POST',headers:{Authorization:'Bearer owner-🔐-private'}});
 const accepted=await worker.fetch(valid,env,{});
 assert.equal(accepted.status,200);
 const invalid=new Request(ORIGIN+'/api/auth',{method:'POST',headers:{Authorization:'Bearer owner-🔑-private'}});
 const denied=await worker.fetch(invalid,env,{});
 assert.equal(denied.status,401);
});


test('authorized policy API advertises the same memory cap enforced by the Worker',async()=>{
 const request=new Request(ORIGIN+'/api/lab/policy',{headers:{Authorization:'Bearer '+TOKEN}});
 const res=await worker.fetch(request,fixture(),{});
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.limits.maxKnowledgeEntries,500);
});
