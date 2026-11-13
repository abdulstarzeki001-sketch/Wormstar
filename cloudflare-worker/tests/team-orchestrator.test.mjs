import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import {TEAM_MODELS,routeTeamTask,runTeamTask} from '../team-orchestrator.js';
import {syncRepository} from '../repository-memory.js';
import {WORKSPACE_HTML} from '../unified-workspace.js';

const BASE='https://wormstar-validation.invalid';
const TOKEN='owner-test-token-only-for-ci';
const REV='a'.repeat(40);
const POLICY={version:1,mission:'Repository CI tests',answer_style:'Concise',
  allowed_modes:['assistant','code','logs','ioc','ctf','report'],
  required_terms:[],max_input_chars:12000,max_output_tokens:1024,memory_enabled:true,
  allow_web_import:false,allow_memory_delete:false,workflow_steps:['review','test']};
const REQUEST={message:'Review security code in worker.js',mode:'assistant'};
function mock({complete=true,evidence=true,allowCode=true,failReviewer=false}={}){
  const calls=[];
  const rows=evidence?[{
    vector_id:'verified-blob',path:'cloudflare-worker/worker.js',content:'Review security code in worker.js: authentication and validation must be checked before deployment.',
    line_start:100,line_end:104,revision:REV}]:[];
  const policy={...POLICY,allowed_modes:allowCode?POLICY.allowed_modes:POLICY.allowed_modes.filter(x=>x!=='code')};
  const env={WORMSTAR_ACCESS_TOKEN:TOKEN,
    DB:{prepare(sql){
      return {bind(){return this},async first(){
        if(sql.includes('FROM ai_policy'))return {policy_json:JSON.stringify(policy)};
        if(sql.includes('FROM repo_sync_state'))return {
          head_sha:complete?REV:'',cursor:'',total:1,visited:complete?1:0,complete:complete?1:0};
        if(sql.includes('COUNT(*) AS files'))return {files:1,searchable:1};
        if(sql.includes('COUNT(*) AS n'))return {n:1};
        return null;
      },async all(){
        if(sql.includes('FROM repo_fragments f JOIN'))return {results:rows};
        return {results:[]};
      }};
    }},
    REPO_VECTORS:{async query(){return {matches:[]}}},
    AI:{async run(model,input){
      calls.push({model,input});
      if(model==='@cf/baai/bge-m3')return {data:[Array(1024).fill(.02)]};
      if(failReviewer&&model===TEAM_MODELS.deep)throw Error('mock provider unavailable');
      if(model===TEAM_MODELS.coder)return {response:'Draft: tighten input validation in worker.js'};
      if(model===TEAM_MODELS.deep)return {response:'Independent review: add authorization and regression tests'};
      if(model===TEAM_MODELS.fast)return {response:'Fallback independent review: test before merge'};
      if(model===TEAM_MODELS.explainer)return {response:'Review: explain the changes and required tests'};
      throw Error('Unexpected model '+model);
    }}
  };
  return {env,calls};
}
async function request(env,payload=REQUEST,token=TOKEN){
  return worker.fetch(new Request(BASE+'/api/team/run',{
    method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
    body:JSON.stringify(payload)
  }),env,{});
}
test('automatic task router assigns all four supported models to suitable tracks',()=>{
  assert.equal(routeTeamTask('Fix Python code in worker.js').kind,'code-review');
  assert.equal(routeTeamTask('Investigate incident logs').kind,'incident-triage');
  assert.equal(routeTeamTask('Write a report','report').primary[0],TEAM_MODELS.deep);
  assert.equal(routeTeamTask('Hello about the project').primary[0],TEAM_MODELS.fast);
  assert.equal(routeTeamTask('Hello about the project').review[0],TEAM_MODELS.explainer);
  assert.throws(()=>routeTeamTask('','assistant'));
  assert.throws(()=>routeTeamTask('safe','shell'));
});
test('owner authentication is required before reading repo or invoking AI',async()=>{
  const {env,calls}=mock();
  const response=await request(env,REQUEST,'');
  assert.equal(response.status,401);
  assert.equal(calls.length,0);
});
test('owner-disabled code policy cannot be bypassed through auto-routing',async()=>{
  const {env,calls}=mock({allowCode:false});
  const response=await request(env);
  assert.equal(response.status,403);
  assert.equal(calls.length,0);
});
test('no inference is allowed while the GitHub repo snapshot is incomplete',async()=>{
  const {env,calls}=mock({complete:false});
  const response=await request(env);
  assert.equal(response.status,409);
  const body=await response.json();
  assert.equal(body.code,'REPOSITORY_INDEX_INCOMPLETE');
  assert.equal(body.index.complete,false);
  assert.equal(calls.length,0);
});
test('unrelated repository question does not contact text-generation models',async()=>{
  const {env,calls}=mock({evidence:false});
  const response=await request(env,{message:'Explain the repository authentication code',mode:'code'});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.grounded,false);
  assert.equal(body.modelUsed,null);
  assert.equal(calls.filter(x=>x.model!== '@cf/baai/bge-m3').length,0);
});
test('team routes code to Qwen then independent GPT-OSS 120B review with pinned sources',async()=>{
  const {env,calls}=mock();
  const response=await request(env);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.route,'code-review');
  assert.equal(body.status,'reviewed-awaiting-tests');
  assert.equal(body.modelUsed,TEAM_MODELS.coder);
  assert.equal(body.reviewerModelUsed,TEAM_MODELS.deep);
  assert.equal(body.revision,REV);
  assert.ok(body.sources[0].url.includes('/blob/'+REV+'/'));
  assert.match(body.answer,/Draft/);
  assert.match(body.review,/Independent review/);
  assert.equal(body.testsPassed,false);
  assert.equal(body.deploymentApproved,false);
  assert.equal(body.requiresCI,true);
  assert.equal(body.execution,'none');
  const generated=calls.filter(x=>x.model!=='@cf/baai/bge-m3');
  assert.deepEqual(generated.map(x=>x.model),[TEAM_MODELS.coder,TEAM_MODELS.deep]);
});
test('team reports reviewer fallback without claiming that tests passed',async()=>{
  const {env,calls}=mock({failReviewer:true});
  const result=await request(env);
  assert.equal(result.status,200);
  const body=await result.json();
  assert.equal(body.reviewerModelUsed,TEAM_MODELS.fast);
  assert.equal(body.fallbackUsed,true);
  assert.equal(body.testsPassed,false);
  assert.equal(body.deploymentApproved,false);
  assert.ok(calls.some(x=>x.model===TEAM_MODELS.deep));
});
test('UI preserves original workspace sections and adds real owner-bound team controls',()=>{
  assert.match(WORKSPACE_HTML,/data-view="team"/);
  assert.match(WORKSPACE_HTML,/data-section="team"/);
  assert.match(WORKSPACE_HTML,/id="teamIndexStatus"/);
  assert.match(WORKSPACE_HTML,/id="teamSyncIndex"/);
  assert.match(WORKSPACE_HTML,/id="teamRun"/);
  assert.match(WORKSPACE_HTML,/\/api\/team\/run/);
  assert.match(WORKSPACE_HTML,/\/api\/repo\/sync/);
  for(const name of ['overview','ai','security','projects','operations']){
    assert.ok(WORKSPACE_HTML.includes('data-section="'+name+'"'));
  }
  assert.doesNotMatch(WORKSPACE_HTML,/WORMSTAR_ACCESS_TOKEN|OPENCLAW_GATEWAY_TOKEN/);
});
test('repository indexing checkpoints files individually to resume after a failed file',async()=>{
  const previousFetch=globalThis.fetch;
  const head='b'.repeat(40), blob='c'.repeat(40);
  const files=[{path:'README.md',type:'blob',sha:blob,size:35},
    {path:'docs/a.md',type:'blob',sha:'d'.repeat(40),size:32}];
  const state={head_sha:'',cursor:'',visited:0,complete:0};
  let broken=true,firstDownloaded=0;
  const env={
    DB:{prepare(sql){
      let args=[];
      return {bind(...values){args=values;return this},
        async first(){
          if(sql.includes('FROM repo_sync_state'))return {...state};
          if(sql.includes('FROM repo_file_index'))return null;
          return {n:0};
        },
        async all(){return {results:[]}},
        async run(){
          if(sql.includes('UPDATE repo_sync_state')){
            Object.assign(state,{head_sha:args[0],cursor:args[1],visited:args[3],
              complete:sql.includes('complete=1')?1:0});
          }
          return {meta:{changes:1}};
        }
      };
    },async batch(){return []}},
    AI:{async run(_,input){return {data:input.text.map(()=>Array(1024).fill(.01))}}},
    REPO_VECTORS:{async upsert(){return {}},async delete(){return {}}}
  };
  globalThis.fetch=async url=>{
    const u=String(url);
    if(u.endsWith('/commits/main'))return Response.json({sha:head});
    if(u.includes('/git/trees/'))return Response.json({truncated:false,tree:files});
    if(u.includes('/README.md')){firstDownloaded++;return new Response('# First source\nReview security code in worker.js',{status:200})}
    if(u.includes('/docs/a.md')){
      if(broken)throw Error('mock interrupted network');
      return new Response('# Second source\nAdditional checks',{status:200});
    }
    throw Error('Unexpected fetch');
  };
  try{
    await assert.rejects(syncRepository(env,{maxFiles:2}),/mock interrupted/);
    assert.equal(state.cursor,'README.md');
    assert.equal(state.visited,1);
    assert.equal(state.complete,0);
    broken=false;
    const completed=await syncRepository(env,{maxFiles:2});
    assert.equal(completed.complete,true);
    assert.equal(state.complete,1);
    assert.equal(state.head_sha,head);
    assert.equal(firstDownloaded,1,'first source was not re-downloaded');
  }finally{globalThis.fetch=previousFetch}
});
