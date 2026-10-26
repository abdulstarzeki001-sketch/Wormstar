import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../worker.js';
import policy from '../permissions-module.js';
import UI from '../future-ui.js';

const TOKEN='wormstar-opencode-owner-token';
const PASSWORD='a-strong-test-password-not-for-production';
function env(connected=false){
 return {
  WORMSTAR_ACCESS_TOKEN:TOKEN,
  ...(connected?{
   OPENCODE_BASE_URL:'https://opencode-private.example.com/',
   OPENCODE_SERVER_PASSWORD:PASSWORD,
   OPENCODE_ACCESS_CLIENT_ID:'cf-access-id',
   OPENCODE_ACCESS_CLIENT_SECRET:'cf-access-secret-from-server'
  }:{}),
  DB:{prepare(){return {bind(){return this;},async first(){return null;},async all(){return {results:[]};}}}}
 };
}
async function request(path,method='GET',body,config=env(),auth=true){
 const headers=auth?{Authorization:'Bearer '+TOKEN}:{};
 if(body!==undefined)headers['Content-Type']='application/json';
 return worker.fetch(new Request('https://wormstar.test'+path,{
  method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})
 }),config,{});
}
test('OpenCode routes are owner-authenticated, allowlisted, and off until host is configured',async()=>{
 for(const c of ['agents.opencode.status','agents.opencode.sessions.read','agents.opencode.sessions.create','agents.opencode.prompt','agents.opencode.messages.read'])
  assert.equal(policy.serverCapabilities[c],true,c);
 assert.equal(policy.serverCapabilities['execution.shell'],false);
 assert.equal((await request('/api/opencode/status','GET',undefined,env(),false)).status,401);
 assert.equal((await request('/api/studio/opencode/session','GET',undefined,env(),false)).status,401);
 const status=await (await request('/api/opencode/status')).json();
 assert.deepEqual({configured:status.configured,connected:status.connected},{configured:false,connected:false});
 assert.equal((await request('/api/studio/opencode/session','GET')).status,503);
 assert.equal((await request('/api/studio/opencode/prompt','POST',{sessionID:'ses_abcdefgh',text:'hi'})).status,503);
});
test('session listing, creation and prompt use protected official OpenCode v2 routes',async()=>{
 const original=globalThis.fetch, seen=[];
 globalThis.fetch=async(url,init)=>{
  seen.push({url:String(url),init});
  if(init.method==='GET')return Response.json({data:[{id:'ses_abcdefghijkl',title:'Audit'}],cursor:{}});
  if(String(url).endsWith('/api/session'))return Response.json({data:{id:'ses_abcdefghijkl',title:'Audit'}});
  return Response.json({data:{id:'msg_hello',type:'user',text:'Review code'}});
 };
 try{
  const context=env(true);
  const list=await request('/api/studio/opencode/session','GET',undefined,context);
  assert.equal(list.status,200);
  assert.equal((await list.json()).sessions[0].id,'ses_abcdefghijkl');
  const made=await request('/api/studio/opencode/session','POST',{title:'Audit'},context);
  assert.equal(made.status,200);
  assert.equal((await made.json()).session.id,'ses_abcdefghijkl');
  const sent=await request('/api/studio/opencode/prompt','POST',{sessionID:'ses_abcdefghijkl',text:'Review code'},context);
  assert.equal(sent.status,200);
  assert.equal((await sent.json()).accepted,true);
  assert.equal(seen[0].url,'https://opencode-private.example.com/api/session?limit=15');
  assert.equal(seen[1].url,'https://opencode-private.example.com/api/session');
  assert.equal(seen[2].url,'https://opencode-private.example.com/api/session/ses_abcdefghijkl/prompt');
  assert.equal(JSON.parse(seen[2].init.body).text,'Review code');
  for(const item of seen){
   assert.match(item.init.headers.Authorization,/^Basic /);
   assert.equal(item.init.headers['CF-Access-Client-Id'],'cf-access-id');
   assert.equal(item.init.redirect,'error');
  }
 }finally{globalThis.fetch=original;}
});
test('session result projection strips reasoning and tool arguments',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({data:[
   {type:'assistant',content:[{type:'reasoning',text:'private reasoning'},{type:'tool',name:'bash',state:{input:{secret:'api-key'}}},{type:'text',text:'Fixed two tests'}]},
   {type:'user',text:'Check the project'}
 ]});
 try{
  const r=await request('/api/studio/opencode/messages?sessionID=ses_abcdefghijkl','GET',undefined,env(true));
  assert.equal(r.status,200);
  const serialized=JSON.stringify(await r.json());
  assert.match(serialized,/Fixed two tests/);
  assert.match(serialized,/Check the project/);
  assert.doesNotMatch(serialized,/private reasoning|api-key|bash/);
 }finally{globalThis.fetch=original;}
});
test('invalid session identifiers and URL-path traversal are rejected before host access',async()=>{
 const context=env(true);
 const r=await request('/api/studio/opencode/prompt','POST',{sessionID:'../../api/config',text:'read config'},context);
 assert.equal(r.status,502);
 const a=await r.json();
 assert.match(a.reason,/Invalid OpenCode session ID/);
});
test('mobile interface has separate OpenCode tab and uses textContent for results',()=>{
 const raw=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 const html=JSON.parse(raw.match(/^const HTML = (.+);$/m)[1]);
 for(const id of ['openCodePanel','odeStatusBadge','odeRefresh','odeList','odeCreate','odeSend','odeViewResults','odeResults'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/pre.textContent=String\(row.text/);
 assert.match(UI.boot,/cards.length!==7/);
 assert.match(UI.boot,/'studio\/opencode'/);
 assert.match(UI.css,/ode-results/);
});
