import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../worker.js';
import ui from '../future-ui.js';

const raw=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const match=raw.match(/^const HTML = (.+);$/m);
assert.ok(match,'Embedded HTML present');
const html=JSON.parse(match[1]);
const TOKEN='wormstar-private-test-token';
const id='11111111-1111-4111-8111-111111111111';
const activePolicy={
 version:1,mission:'Analyze saved code',answer_style:'Detailed Arabic engineering',
 allowed_modes:['assistant','code','logs','ioc','ctf','report'],required_terms:[],
 max_input_chars:12000,max_output_tokens:1600,memory_enabled:true,allow_web_import:true,allow_memory_delete:true,
 workflow_steps:['Read the task','Check memory','Analyze code']
};
const source='function add(a,b){return a+b;}';
function makeEnv(run){
 return {
  WORMSTAR_ACCESS_TOKEN:TOKEN,
  AI:{run:run||(async()=>({response:'الملف يحتوي على دالة add تجمع رقمين.'}))},
  DB:{prepare(sql){return {bind(){return this;},
   async first(){
    if(sql.includes('FROM ai_policy'))return {policy_json:JSON.stringify(activePolicy)};
    if(sql.includes('FROM ai_profile'))return {name:'Wormstar NEO',instructions:'Review saved source',constraints:''};
    if(sql.includes('FROM knowledge WHERE id='))return {id,title:'helpers.js',kind:'file',content:source};
    return null;
   },
   async all(){return {results:[]};}
  };}}
 };
}
async function chat(body,env){
 const request=new Request('https://wormstar.test/api/chat',{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+TOKEN},body:JSON.stringify(body)
 });
 return worker.fetch(request,env,{});
}
test('GPT-OSS 120B is the default while explicit GPT-OSS 20B and Qwen choices work',async()=>{
 let selected;
 const env=makeEnv(async(model)=>{selected=model;return {response:'تمت المراجعة'};});
 let result=await chat({mode:'assistant',message:'اشرح المشروع'},env);
 assert.equal(result.status,200);
 assert.equal(selected,'@cf/openai/gpt-oss-120b');
 assert.equal((await result.json()).modelUsed,selected);
 result=await chat({mode:'assistant',message:'اشرح الدالة',engine:'gpt-oss-20b'},env);
 assert.equal(result.status,200);
 assert.equal(selected,'@cf/openai/gpt-oss-20b');
 result=await chat({mode:'code',message:'اشرح الدالة',engine:'qwen-coder'},env);
 assert.equal(result.status,200);
 assert.match(selected,/qwen2\.5-coder-32b/);
});
test('A saved JS file selected by owner is provided to the model as source, not executed',async()=>{
 let passed;
 const env=makeEnv(async(model,params)=>{passed=params;return {response:'دالة add تجمع a و b'};});
 const result=await chat({mode:'code',message:'راجع هذا الملف',memoryIds:[id]},env);
 assert.equal(result.status,200);
 const data=await result.json();
 assert.equal(data.memoryUsed.length,1);
 assert.equal(data.memoryUsed[0].selected,true);
 assert.equal(data.memoryUsed[0].title,'helpers.js');
 assert.ok(passed.messages.at(-1).content.includes(source));
 assert.match(passed.messages.at(-1).content,/OWNER-SELECTED SAVED FILES/);
});
test('Invalid memory IDs cannot be loaded',async()=>{
 const r=await chat({mode:'assistant',message:'مرحبا',memoryIds:['../../secrets']},makeEnv());
 assert.equal(r.status,400);
});
test('Primary model failure falls back without claiming a larger model was used',async()=>{
 const seen=[];
 const env=makeEnv(async model=>{
  seen.push(model);
  if(seen.length===1)throw Error('Preferred model unavailable');
  return {response:'أستخدم البديل الآن'};
 });
 const r=await chat({mode:'assistant',message:'احلل المدخلات'},env);
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.modelUsed,'@cf/openai/gpt-oss-20b');
 assert.equal(data.fallbackUsed,true);
 assert.equal(data.engineRequested,'gpt-oss-120b');
 assert.equal(seen.length,2);
});
test('No unsupported model IDs can be injected into the Workers AI backend',async()=>{
 const result=await chat({mode:'assistant',message:'اختبار',engine:'@cf/untrusted/arbitrary'},makeEnv());
 assert.equal(result.status,400);
});
test('GPT-OSS completion returns only final answer, not model reasoning',async()=>{
 const env=makeEnv(async()=>({choices:[{message:{content:'الإجابة النهائية',reasoning_content:'internal reasoning is not UI text'}}]}));
 const result=await chat({mode:'assistant',message:'اختبار',engine:'gpt-oss-120b'},env);
 assert.equal(result.status,200);
 const data=await result.json();
 assert.equal(data.answer,'الإجابة النهائية');
 assert.ok(!JSON.stringify(data).includes('internal reasoning'));
});
test('Chat composer includes explicit memory file picker and avoids hidden iOS controls',()=>{
 for(const id of ['chatEngine','chatMemoryFile','refreshChatFiles','chatContextStatus','prompt','submit'])
  assert.ok(html.includes('id="'+id+'"'),id+' present');
 assert.match(html,/memoryIds:el\('chatMemoryFile'\)/);
 assert.match(html,/engine:el\('chatEngine'\)\.value/);
 assert.match(ui.boot,/ws-chat-screen/);
 assert.match(ui.css,/body\.ws-chat-screen #lab \.panel\{/);
 assert.match(ui.css,/body\.ws-chat-screen #lab \.messages\{/);
 assert.match(ui.css,/body\.ws-chat-screen #lab \.compose\{/);
 assert.match(ui.css,/height:calc\(100% - 72px - env\(safe-area-inset-bottom/);
 assert.match(ui.css,/min\(100dvh,var\(--ws-visual-height,100dvh\)\)/);
});


test('Wormstar Pro is a working Workers AI route without WormGPT secrets or model ID',async()=>{
 const invoked=[];
 const env=makeEnv(async(model,inputs)=>{invoked.push({model,inputs});return {response:'خدمة Wormstar Pro تعمل عبر Cloudflare'};});
 assert.equal(Object.hasOwn(env,'WORMGPT_API_KEY'),false);
 assert.equal(Object.hasOwn(env,'WORMGPT_MODEL_ID'),false);
 const response=await chat({mode:'assistant',message:'اختبار بسيط',engine:'wormstar-pro'},env);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.engineRequested,'wormstar-pro');
 assert.equal(body.modelUsed,'@cf/openai/gpt-oss-120b');
 assert.equal(body.modelHost,'cloudflare-workers-ai');
 assert.equal(body.fallbackUsed,false);
 assert.equal(body.answer,'خدمة Wormstar Pro تعمل عبر Cloudflare');
 assert.equal(invoked.length,1);
 assert.match(invoked[0].inputs.messages[0].content,/not WormGPT v5\.1/);
});

test('Wormstar Pro falls back to GPT-OSS 20B and reports exact model identity',async()=>{
 const seen=[];
 const env=makeEnv(async(model)=>{
  seen.push(model);
  if(model==='@cf/openai/gpt-oss-120b')throw Error('Preferred model unavailable');
  return {response:'تم الرد عبر البديل'};
 });
 const result=await chat({mode:'assistant',message:'اختبر البديل',engine:'wormstar-pro'},env);
 assert.equal(result.status,200);
 const reply=await result.json();
 assert.equal(reply.engineRequested,'wormstar-pro');
 assert.equal(reply.modelUsed,'@cf/openai/gpt-oss-20b');
 assert.equal(reply.modelHost,'cloudflare-workers-ai');
 assert.equal(reply.fallbackUsed,true);
 assert.deepEqual(reply.modelsTried,seen);
 assert.equal(seen.length,2);
});

test('Wormstar Pro UI is available while real WormGPT API remains a separate disabled provider',async()=>{
 const html=JSON.parse(readFileSync(new URL('../worker.js',import.meta.url),'utf8').match(/^const HTML = (.+);$/m)[1]);
 assert.match(html,/<option value="wormstar-pro">Wormstar Pro/);
 assert.match(html,/بدون مفتاح WormGPT/);
 assert.match(html,/const ENGINE_CHOICES=\['wormstar-pro'/);
 assert.match(html,/<option value="wormgpt-v51" data-wormgpt-model disabled>/);
 const env=makeEnv();
 const res=await chat({mode:'assistant',message:'Hello',engine:'wormgpt-v51'},env);
 assert.equal(res.status,503);
 assert.match((await res.json()).error,/not configured|not confirmed/);
});
