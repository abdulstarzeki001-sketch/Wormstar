import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import worker from '../worker.js';

const TOKEN='wormstar-test-private-owner-token';
const GPU_TOKEN='a-much-longer-private-owner-gpu-token-not-in-ui';
const policy={
 version:1,mission:'Review uploaded references',
 allowed_modes:['assistant','code','logs','ioc','ctf','report'],
 required_terms:[],max_input_chars:12000,max_output_tokens:1500,
 memory_enabled:true,allow_web_import:false,allow_memory_delete:false,
 answer_style:'direct',workflow_steps:['review']
};
function mockEnv(config=true){
 return {
  WORMSTAR_ACCESS_TOKEN:TOKEN,
  ...(config?{
   GPT_OSS_GPU_ENDPOINT:'https://gpu.example.test',
   GPT_OSS_GPU_TOKEN:GPU_TOKEN,
   GPT_OSS_ACCESS_CLIENT_ID:'service-client-id',
   GPT_OSS_ACCESS_CLIENT_SECRET:'service-secret',
  }:{}),
  DB:{
   prepare(sql){return {
    bind(){return this;},
    async first(){
     if(sql.includes('FROM ai_policy'))return {policy_json:JSON.stringify(policy)};
     if(sql.includes('FROM ai_profile'))return {name:'Wormstar',instructions:'',constraints:''};
     return null;
    },
    async all(){return {results:[]};},
   };}
  }
 };
}
async function request(env,engine,mode='assistant'){
 return worker.fetch(new Request('https://app.invalid/api/chat',{
  method:'POST',headers:{Authorization:'Bearer '+TOKEN,'Content-Type':'application/json'},
  body:JSON.stringify({mode,engine,message:'راجع وظيفة دالة بسيطة'})
 }),env,{});
}
test('full checkpoint inference stays disabled until an owner GPU endpoint is configured',async()=>{
 const res=await request(mockEnv(false),'gpt-oss-120b-gpu');
 assert.equal(res.status,503);
 const data=await res.json();
 assert.match(data.error,/not connected/);
});
test('private GPU inference uses the owner checkpoint and never leaks secrets or internal reasoning',async()=>{
 const prior=globalThis.fetch,seen=[];
 globalThis.fetch=async(url,init)=>{
  seen.push({url,init});
  return Response.json({choices:[{message:{content:'هذه إجابة من النموذج الخاص.',reasoning_content:'PRIVATE INTERNAL REASONING'}}]});
 };
 try{
  const res=await request(mockEnv(true),'gpt-oss-120b-gpu');
  assert.equal(res.status,200);
  const data=await res.json();
  assert.equal(data.modelUsed,'selfhost/openai/gpt-oss-120b');
  assert.equal(data.weightsSource,'owner-gpu-local-checkpoint');
  assert.equal(data.engineRequested,'gpt-oss-120b-gpu');
  assert.equal(data.fallbackUsed,false);
  assert.equal(data.answer,'هذه إجابة من النموذج الخاص.');
  assert.equal(seen.length,1);
  assert.equal(seen[0].url,'https://gpu.example.test/v1/chat/completions');
  const p=JSON.parse(seen[0].init.body);
  assert.equal(p.model,'gpt-oss-120b');
  assert.equal(seen[0].init.headers.Authorization,'Bearer '+GPU_TOKEN);
  assert.equal(seen[0].init.headers['CF-Access-Client-Id'],'service-client-id');
  assert.equal(seen[0].init.headers['CF-Access-Client-Secret'],'service-secret');
  assert.equal(seen[0].init.redirect,'error');
  assert.ok(!JSON.stringify(data).includes('PRIVATE INTERNAL REASONING'));
  assert.ok(!JSON.stringify(data).includes(GPU_TOKEN));
 }finally{globalThis.fetch=prior;}
});
test('hosted GPT-OSS is not silently substituted if private 20B GPU fails',async()=>{
 const prior=globalThis.fetch;
 globalThis.fetch=async()=>new Response('not ready',{status:502});
 try{
  const r=await request(mockEnv(true),'gpt-oss-20b-gpu');
  assert.equal(r.status,503);
  assert.match((await r.json()).error,/Cloudflare fallback was not used/);
 }finally{globalThis.fetch=prior;}
});
test('private endpoint must be HTTPS, protected by server settings',async()=>{
 let env=mockEnv(true);env.GPT_OSS_GPU_ENDPOINT='http://localhost:8000';
 const r=await request(env,'gpt-oss-120b-gpu');
 assert.equal(r.status,503);
 assert.match((await r.json()).reason,/HTTPS origin/);
});
test('GPU deployment scripts contain actual download, shard verification, private serving and no embedded keys',()=>{
 const base=new URL('../gptoss-selfhost/',import.meta.url);
 const downloader=fileURLToPath(new URL('download_weights.py',base));
 const health=fileURLToPath(new URL('healthcheck.sh',base));
 execFileSync('python3',['-m','py_compile',downloader]);
 execFileSync('bash',['-n',health]);
 const python=readFileSync(downloader,'utf8');
 const compose=readFileSync(new URL('compose.yaml',base),'utf8');
 const envExample=readFileSync(new URL('.env.example',base),'utf8');
 assert.match(python,/snapshot_download/);
 assert.match(python,/model\.safetensors\.index\.json/);
 assert.match(python,/verify_checkpoint/);
 assert.match(compose,/VLLM_API_KEY/);
 assert.match(compose,/HF_HUB_OFFLINE/);
 assert.match(compose,/127\.0\.0\.1:8000:8000/);
 assert.match(compose,/capabilities: \[gpu\]/);
 assert.match(envExample,/MODEL_VARIANT=gpt-oss-120b/);
 assert.doesNotMatch(envExample,/sk-proj-|hf_[a-zA-Z0-9]{25,}/);
});
