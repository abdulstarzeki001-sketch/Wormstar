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
test('AI model routing upgrades generic responses and specializes code review',async()=>{
 let selected;
 const env=makeEnv(async(model)=>{selected=model;return {response:'تمت المراجعة'};});
 let result=await chat({mode:'assistant',message:'اشرح المشروع'},env);
 assert.equal(result.status,200);
 assert.match(selected,/llama-3\.3-70b/);
 assert.equal((await result.json()).modelUsed,selected);
 result=await chat({mode:'code',message:'اشرح الدالة'},env);
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
 assert.equal(data.modelUsed,'@cf/meta/llama-3.1-8b-instruct-fast');
 assert.equal(seen.length,2);
});
test('Chat composer includes explicit memory file picker and avoids hidden iOS controls',()=>{
 for(const id of ['chatMemoryFile','refreshChatFiles','chatContextStatus','prompt','submit'])
  assert.ok(html.includes('id="'+id+'"'),id+' present');
 assert.match(html,/memoryIds:el\('chatMemoryFile'\)/);
 assert.match(ui.boot,/ws-chat-screen/);
 assert.match(ui.css,/body\.ws-chat-screen #lab \.panel\{/);
 assert.match(ui.css,/body\.ws-chat-screen #lab \.messages\{/);
 assert.match(ui.css,/body\.ws-chat-screen #lab \.compose\{/);
 assert.match(ui.css,/height:calc\(100% - 72px - env\(safe-area-inset-bottom/);
 assert.match(ui.css,/min\(100dvh,var\(--ws-visual-height,100dvh\)\)/);
});
