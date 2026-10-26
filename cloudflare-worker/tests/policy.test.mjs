import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../worker.js';

const policy = JSON.parse(readFileSync(new URL('../../policy/permissions.json', import.meta.url), 'utf8'));
const examples = readFileSync(new URL('../../policy/training.jsonl', import.meta.url), 'utf8').trim().split('\n').map(JSON.parse);
const TOKEN='local-test-token-not-deployed';

const ownerPolicy = {
  version:1,
  mission:'مختبر أمن سيبراني متخصص',
  allowed_modes:['assistant','code','logs','ioc','ctf','report'],
  required_terms:[],
  max_input_chars:12000,
  max_output_tokens:1500,
  memory_enabled:true,
  allow_web_import:true,
  allow_memory_delete:true,
  answer_style:'واضح ودقيق',
  workflow_steps:['فهم المهمة','مراجعة الأدلة','تقديم النتائج']
};

function makeEnv(onGenerate){
  return {
    WORMSTAR_ACCESS_TOKEN: TOKEN,
    AI: { async run(model, params){
      onGenerate?.(model,params);
      return {response:'Mock model reply'};
    }},
    DB: {
      prepare(sql){
        return {
          bind(){return this;},
          async first(){
            if(sql.includes('FROM ai_policy'))return {policy_json:JSON.stringify(ownerPolicy)};
            if(sql.includes('FROM ai_profile'))return {name:'Wormstar',instructions:'',constraints:''};
            return null;
          },
          async all(){return {results:[]};},
        };
      },
    },
  };
}

async function request(path,{method='GET',authenticated=false,body,env}={}){
  const headers = authenticated?{'Authorization':'Bearer '+TOKEN}:{};
  if(body!==undefined)headers['Content-Type']='application/json';
  const req = new Request('https://wormstar-test.invalid'+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
  return worker.fetch(req,env||makeEnv(),{});
}

test('Policy pack contains valid modes and offline training examples',()=>{
  assert.equal(policy.id,'wormstar-authorized-cyber-lab');
  assert.equal(policy.defaultDecision,'deny');
  assert.equal(examples.length,12);
  for(const x of examples){assert.ok(policy.allowedModes.includes(x.mode));assert.ok(x.ideal);}
  for(const name of ['execution.shell','execution.python','execution.user_code','network.active_scan','deployment.self_modify']) {
    assert.equal(policy.serverCapabilities[name],false);
  }
});

test('unauthenticated requests cannot read policy or run inference',async()=>{
  const p=await request('/api/lab/policy');
  assert.equal(p.status,401);
  const chat=await request('/api/chat',{method:'POST',body:{mode:'assistant',message:'Hi'}});
  assert.equal(chat.status,401);
});

test('authorized user sees compiled restrictions and modes',async()=>{
  const res=await request('/api/lab/policy',{authenticated:true});
  assert.equal(res.status,200);
  const config=await res.json();
  assert.equal(config.id,policy.id);
  assert.equal(config.version,policy.version);
  assert.deepEqual(config.modes,policy.allowedModes);
  assert.equal(config.capabilities['execution.shell'],false);
  assert.equal(config.capabilities['memory.items.create'],true);
});

test('nonlisted API lab tool denied even with owner token',async()=>{
  const res=await request('/api/lab/execute',{method:'POST',authenticated:true,body:{command:'echo example'}});
  assert.equal(res.status,403);
});

test('invalid modes and excessive input rejected before AI call',async()=>{
  const invalid=await request('/api/chat',{method:'POST',authenticated:true,body:{mode:'shell',message:'hi'}});
  assert.equal(invalid.status,400);
  const large=await request('/api/chat',{method:'POST',authenticated:true,body:{mode:'assistant',message:'x'.repeat(12001)}});
  assert.equal(large.status,400);
});

test('all six legitimate modes can send analysis-only prompts',async()=>{
  for(const mode of policy.allowedModes){
    let captured=null;
    const env=makeEnv((model,parameters)=>{captured={model,parameters};});
    const res=await request('/api/chat',{method:'POST',authenticated:true,body:{mode,message:'Explain defensive analysis'},env});
    assert.equal(res.status,200);
    assert.equal((await res.json()).answer,'Mock model reply');
    assert.ok(captured.model.startsWith('@cf/'));
    assert.equal(captured.model,'@cf/openai/gpt-oss-120b');
    assert.equal(captured.parameters.messages[0].role,'system');
    assert.match(captured.parameters.messages[0].content,/Wormstar NEO/);
    assert.equal(captured.parameters.messages.at(-1).role,'user');
  }
});

test('owner preferences are lower-priority than server policy',async()=>{
  let captured;
  const env=makeEnv((model,parameters)=>{captured=parameters;});
  const res=await request('/api/chat',{method:'POST',authenticated:true,env,body:{
    mode:'assistant',
    message:'review an example',
    history:[{role:'assistant',content:'Earlier explanation'}]
  }});
  assert.equal(res.status,200);
  assert.match(captured.messages[0].content,/OWNER WORKSPACE SETTINGS/);
  assert.match(captured.messages[0].content,/subordinate to fixed server policy/);
  assert.match(captured.messages[0].content,/Owner mission/);
  assert.equal(captured.messages[1].role,'assistant');
  assert.equal(captured.messages.at(-1).role,'user');
});

test('studio operations cannot be reached without authorization',async()=>{
  const r=await request('/api/studio/profile');
  assert.equal(r.status,401);
});
