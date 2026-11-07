import test from 'node:test';
import assert from 'node:assert/strict';
import {semanticSearch,hybridKnowledge,indexKnowledgeBatch} from '../advanced-rag.js';
import {runAuthorizedScan,runBoundedAgent,listAgents} from '../security-ops.js';
import worker from '../worker.js';

const ID='11111111-1111-4111-8111-111111111111';
const ROW={id:ID,title:'Authorized defensive checklist',kind:'note',content:'Check HTTPS header and document missing HSTS',updated_at:'2026-11-07'};
const vector=()=>Array(1024).fill(0.01);
function makeEnv(){
  const calls={ai:[],vectors:[],scans:[]};
  const DB={prepare(sql){
    let args=[];
    return {bind(...a){args=a;return this;},
      async all(){return {results:sql.includes('FROM knowledge')?[ROW]:[]}},
      async first(){return sql.includes('FROM knowledge')?ROW:sql.includes('FROM ai_policy')?{policy_json:JSON.stringify({
        version:1,mission:'',allowed_modes:['assistant','code','logs','ioc','ctf','report'],
        required_terms:[],max_input_chars:12000,max_output_tokens:512,memory_enabled:true,
        allow_web_import:false,allow_memory_delete:true,answer_style:'Clear',workflow_steps:['scope']})}:
        sql.includes('FROM ai_profile')?{name:'Wormstar',instructions:'',constraints:''}:null},
      async run(){return {meta:{changes:1}}}
    };
  }};
  const AI={async run(model,input){calls.ai.push({model,input});return model==='@cf/baai/bge-m3'
    ?{data:(input.text||[]).map(vector)}:{response:'Defensive analysis with evidence'};}};
  const VECTORS={
    async query(value,options){calls.vectors.push({operation:'query',options,dimensions:value.length});return {matches:[{id:ID+':0',metadata:{sourceId:ID},score:.9}]}},
    async upsert(rows){calls.vectors.push({operation:'upsert',rows});return {mutationId:'test'}}
  };
  return {env:{DB,AI,VECTORS,WORMSTAR_ACCESS_TOKEN:'example-test-only-owner-secret',SCAN_ALLOWED_HOSTS:'wormstar-sentinel-preview.abdulstarzeki001.workers.dev'},calls};
}
test('Multilingual RAG uses BGE-M3 with strict 1024 dimensions and D1 source content',async()=>{
  const {env,calls}=makeEnv();
  const out=await hybridKnowledge(env,'defensive checklist',{limit:3});
  assert.equal(out.retrieval,'online');
  assert.equal(out.documents[0].id,ID);
  assert.equal(calls.ai[0].model,'@cf/baai/bge-m3');
  assert.equal(calls.vectors[0].dimensions,1024);
  assert.ok(out.documents[0].content.includes('HSTS'));
});
test('Indexing sends only identifiers and embeddings to Vectorize',async()=>{
  const {env,calls}=makeEnv();
  const result=await indexKnowledgeBatch(env,{limit:1});
  assert.equal(result.indexedDocuments,1);
  assert.ok(result.indexedVectors>0);
  const up=calls.vectors.find(v=>v.operation==='upsert').rows;
  assert.ok(up.every(x=>x.values.length===1024&&x.metadata.sourceId===ID));
  assert.ok(up.every(x=>!Object.hasOwn(x.metadata,'content')));
  await assert.rejects(()=>indexKnowledgeBatch(env,{cursor:'../secret'}),/Invalid cursor/);
});
test('Scoped audit rejects arbitrary and private targets before any fetch',async()=>{
  const {env}=makeEnv();
  for(const target of ['http://wormstar-sentinel-preview.abdulstarzeki001.workers.dev/','https://127.0.0.1/','https://evil.example/','https://wormstar-sentinel-preview.abdulstarzeki001.workers.dev:8443/','https://wormstar-sentinel-preview.abdulstarzeki001.workers.dev/admin']){
    await assert.rejects(()=>runAuthorizedScan(env,target));
  }
});
test('Scoped audit issues exactly one GET and does not follow redirects',async()=>{
  const {env}=makeEnv();
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async(input,init)=>{calls++;assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');return new Response('ok',{headers:{'strict-transport-security':'max-age=31536000','x-content-type-options':'nosniff'}})};
  try{
    const result=await runAuthorizedScan(env,'https://wormstar-sentinel-preview.abdulstarzeki001.workers.dev/');
    assert.equal(result.requestsMade,1);assert.equal(calls,1);
    assert.ok(result.findings.some(x=>x.id==='csp'));
  }finally{globalThis.fetch=original;}
});
test('Task agents use a restricted role and single AI call',async()=>{
 const {env,calls}=makeEnv();
 assert.equal(listAgents().length,3);
 const result=await runBoundedAgent(env,{agent:'memory-analyst',task:'Summarize defensive checklist'});
 assert.equal(result.answer,'Defensive analysis with evidence');
 assert.equal(result.modelUsed,'@cf/openai/gpt-oss-20b');
 assert.equal(calls.ai.filter(x=>x.model.includes('gpt-oss')).length,1);
 assert.ok(result.sourceIds.length>0);
 const invalid=await runBoundedAgent(env,{agent:'arbitrary-shell',task:'execute arbitrary commands'});
 assert.equal(invalid.status,400);
});
test('API refuses unauthenticated semantic, scan and agent operations',async()=>{
 const {env}=makeEnv();
 for(const [method,path,body] of [['POST','/api/rag/reindex',{}],['POST','/api/security/header-audit',{target:'https://wormstar-sentinel-preview.abdulstarzeki001.workers.dev/'}],['POST','/api/agents/run',{agent:'memory-analyst',task:'hello'}],['GET','/api/agents',undefined]]){
   const req=new Request('https://wormstar-lab.invalid'+path,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
   const result=await worker.fetch(req,env,{});
   assert.equal(result.status,401,path);
 }
});
