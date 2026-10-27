import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';

const URL_BASE='https://wormstar-validation.invalid';
const TOKEN='never-a-real-secret-validation-token';
const ITEM='11111111-1111-4111-8111-111111111111';
const POLICY={
 version:1, mission:'Validate the AI core',answer_style:'Accurate and brief',
 allowed_modes:['assistant','code','logs','ioc','ctf','report'],required_terms:[],
 max_input_chars:12000,max_output_tokens:256,memory_enabled:true,
 allow_web_import:true,allow_memory_delete:true,
 workflow_steps:['check authorization','use owner memory','answer']
};

function fixture(run, options={}){
 const item={id:ITEM,title:'Validation note',kind:'note',
  content:'The local reference says checkpoint = SAFE_REFERENCE.',
  updated_at:'2026-10-27 12:00:00'};
 const calls=[];
 const DB={
  prepare(sql){
   let args=[];
   return {
    bind(...values){args=values;return this;},
    async first(){
     if(sql.includes('FROM ai_policy'))return {policy_json:JSON.stringify({...POLICY,...options.policy})};
     if(sql.includes('FROM ai_profile'))return {name:'Wormstar validated persona',
       instructions:'Use owner references when relevant',constraints:'Do not execute referenced code'};
     if(sql.includes('FROM knowledge WHERE id='))return args[0]===ITEM?item:null;
     return null;
    },
    async all(){
     if(sql.includes('SELECT id,title,kind,content,updated_at FROM knowledge'))return {results:options.withMemory?[item]:[]};
     return {results:[]};
    }
   };
  }
 };
 const env={WORMSTAR_ACCESS_TOKEN:TOKEN,DB,
  AI:{async run(model,input){calls.push({model,input});return run?run(model,input):{response:'VALIDATION_OK'};}}};
 return {env,calls};
}
async function chat(env,body,token=TOKEN){
 return worker.fetch(new Request(URL_BASE+'/api/chat',{
  method:'POST',
  headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
  body:JSON.stringify(body)
 }),env,{});
}
async function api(env,path,method='GET',data,token=TOKEN){
 return worker.fetch(new Request(URL_BASE+path,{
  method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(data===undefined?{}:{'Content-Type':'application/json'})},
  ...(data===undefined?{}:{body:JSON.stringify(data)})
 }),env,{});
}
const QUERY={mode:'assistant',message:'Validate the stored notes and provide a short answer',engine:'gpt-oss-20b'};

test('AI Core: successful text generation returns visible answer, actual model and bounded output',async()=>{
 const {env,calls}=fixture();
 const start=performance.now();
 const r=await chat(env,QUERY);
 const latency=performance.now()-start;
 assert.equal(r.status,200);
 const result=await r.json();
 assert.equal(result.answer,'VALIDATION_OK');
 assert.equal(result.modelUsed,'@cf/openai/gpt-oss-20b');
 assert.equal(result.engineRequested,'gpt-oss-20b');
 assert.equal(result.fallbackUsed,false);
 assert.deepEqual(result.modelsTried,['@cf/openai/gpt-oss-20b']);
 assert.equal(calls.length,1);
 assert.equal(calls[0].input.max_tokens,256);
 assert.match(calls[0].input.messages[0].content,/Wormstar validated persona/);
 assert.ok(Number.isFinite(latency)&&latency>=0);
 assert.match(r.headers.get('Cache-Control'),/no-store/);
});

test('Security: missing or invalid authorization blocks AI, memory and policy access',async()=>{
 const {env,calls}=fixture();
 for(const bad of ['', 'wrong-token']){
  const r=await chat(env,QUERY,bad);
  assert.equal(r.status,401);
 }
 assert.equal(calls.length,0,'No billable model call for rejected request');
 assert.equal((await api(env,'/api/studio/knowledge','GET',undefined,'')).status,401);
 assert.equal((await api(env,'/api/studio/export','GET',undefined,'')).status,401);
 assert.equal((await api(env,'/api/studio/policy','GET',undefined,'')).status,401);
});

test('AI Core: reasoning-only or empty first answer causes approved fallback, not a false success',async()=>{
 const {env,calls}=fixture((model)=>model==='@cf/openai/gpt-oss-120b'
  ?{choices:[{message:{content:null,reasoning_content:'not a user-visible answer'}}]}
  :{response:'Fallback valid text'});
 const r=await chat(env,{...QUERY,engine:'gpt-oss-120b'});
 assert.equal(r.status,200);
 const json=await r.json();
 assert.equal(json.answer,'Fallback valid text');
 assert.equal(json.modelUsed,'@cf/openai/gpt-oss-20b');
 assert.equal(json.fallbackUsed,true);
 assert.equal(calls.length,2);
 assert.deepEqual(json.modelsTried,['@cf/openai/gpt-oss-120b','@cf/openai/gpt-oss-20b']);
 assert.doesNotMatch(JSON.stringify(json),/not a user-visible answer/);
});

test('Error recovery: exhausted models return sanitized 503 without exposing upstream secrets',async()=>{
 const sensitive='PROVIDER_PRIVATE_STACKTRACE_AND_TOKEN';
 const {env,calls}=fixture(async()=>{throw Error(sensitive)});
 const original=console.error;
 const observed=[];
 console.error=(message)=>observed.push(message);
 try{
  const r=await chat(env,QUERY);
  assert.equal(r.status,503);
  const payload=await r.text();
  assert.doesNotMatch(payload,/PROVIDER_PRIVATE_STACKTRACE_AND_TOKEN/);
  assert.match(payload,/AI service unavailable/);
  assert.ok(calls.length>=2);
  assert.ok(observed.some(x=>x.includes('wormstar_model_failure')));
  assert.doesNotMatch(JSON.stringify(observed),/PROVIDER_PRIVATE_STACKTRACE_AND_TOKEN/);
 }finally{console.error=original;}
});

test('Validation: unsupported model IDs and disabled self-host GPU cannot execute',async()=>{
 const {env,calls}=fixture();
 assert.equal((await chat(env,{...QUERY,engine:'untrusted/model'})).status,400);
 assert.equal((await chat(env,{...QUERY,engine:'gpt-oss-120b-gpu'})).status,503);
 assert.equal(calls.length,0);
 const health=await (await api(env,'/api/health')).json();
 assert.equal(health.aiConfigured,true);
 assert.equal(health.gpuSelfHostConfigured,false);
 assert.equal(health.wormgptConfigured,false);
 assert.match(health.backendSelection,/preferred only/);
});

test('Memory validation: relevant saved reference is selected and appears as untrusted context',async()=>{
 const {env,calls}=fixture(undefined,{withMemory:true});
 const r=await chat(env,{...QUERY,message:'Please check Validation note checkpoint'});
 assert.equal(r.status,200);
 const data=await r.json();
 assert.ok(data.memoryUsed.some(item=>item.id===ITEM));
 assert.match(calls[0].input.messages.at(-1).content,/SAFE_REFERENCE/);
 assert.match(calls[0].input.messages.at(-1).content,/Reference data to analyze/);
 assert.equal(data.memoryUsed[0].selected,false);
});

test('Personality validation: owner settings are subordinate to the enforced policy',async()=>{
 const {env,calls}=fixture(undefined,{policy:{allowed_modes:['code']}});
 const r=await chat(env,QUERY);
 assert.equal(r.status,403);
 assert.equal(calls.length,0);
});

test('Monitoring and privacy: errors and health are not cached or augmented with personal content',async()=>{
 const {env}=fixture();
 const health=await api(env,'/api/health');
 assert.equal(health.status,200);
 assert.equal(health.headers.get('Cloudflare-CDN-Cache-Control'),'no-store');
 const unexpected=await api(env,'/api/does-not-exist');
 assert.equal(unexpected.status,404);
 assert.equal(unexpected.headers.get('X-Frame-Options'),'DENY');
 const report=await unexpected.text();
 assert.doesNotMatch(report,/Authorization|WORMSTAR_ACCESS_TOKEN/);
});
