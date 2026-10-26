import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../worker.js';
import policy from '../permissions-module.js';
import UI from '../future-ui.js';

const TOKEN='private-wormstar-archive-test-token';
function fakeEnv(){
 const records=new Map();
 return {WORMSTAR_ACCESS_TOKEN:TOKEN,records,
  DB:{prepare(sql){
   let params=[];
   return {bind(...v){params=v;return this;},
    async first(){
     if(sql.startsWith('SELECT transcript,revision,updated_at FROM chat_archives')){
      const row=records.get(params[0]);
      return row?{...row}:null;
     }
     return null;
    },
    async run(){
     if(sql.startsWith('INSERT OR IGNORE INTO chat_archives')){
      const [mode,transcript]=params;
      if(records.has(mode))return {meta:{changes:0}};
      records.set(mode,{transcript,revision:1,updated_at:'2026-10-26 12:00:00'});
      return {meta:{changes:1}};
     }
     if(sql.startsWith('UPDATE chat_archives SET')){
      const [transcript,mode,version]=params;
      const old=records.get(mode);
      if(!old||old.revision!==version)return {meta:{changes:0}};
      records.set(mode,{transcript,revision:old.revision+1,updated_at:'2026-10-26 12:02:00'});
      return {meta:{changes:1}};
     }
     if(sql.startsWith('DELETE FROM chat_archives')){
      const removed=records.delete(params[0]);return {meta:{changes:removed?1:0}};
     }
     throw Error('Unexpected SQL '+sql);
    },
    async all(){return {results:[]};}
   };
  }}};
}
async function call(env,method='GET',mode='assistant',body,auth=true){
 const query=(method==='GET'||method==='DELETE')?'?mode='+encodeURIComponent(mode):'';
 const headers=auth?{Authorization:'Bearer '+TOKEN}:{};
 const options={method,headers};
 if(body!==undefined){headers['Content-Type']='application/json';options.body=JSON.stringify(body);}
 return worker.fetch(new Request('https://wormstar.test/api/studio/chat-archive'+query,options),env,{});
}
test('chat archive has a separate enabled and owner-authenticated capability',async()=>{
 for(const cap of ['memory.chats.read','memory.chats.write','memory.chats.delete'])assert.equal(policy.serverCapabilities[cap],true);
 const env=fakeEnv();
 assert.equal((await call(env,'GET','assistant',undefined,false)).status,401);
 assert.equal((await call(env,'PUT','assistant',{mode:'assistant',revision:0,messages:[]},false)).status,401);
 assert.equal((await call(env,'DELETE','assistant',undefined,false)).status,401);
});
test('optional archive roundtrip, revision conflict protection, and targeted deletion',async()=>{
 const env=fakeEnv();
 const initially=await (await call(env)).json();
 assert.deepEqual({found:initially.found,revision:initially.revision},{found:false,revision:0});
 const payload={mode:'assistant',revision:0,messages:[
  {role:'user',content:'اشرح هذا الملف'},
  {role:'assistant',content:'يحتاج تعديل',modelUsed:'@cf/test-model',memoryUsed:[{id:'1234',title:'Saved file'}]}
 ]};
 const save=await call(env,'PUT','assistant',payload);
 assert.equal(save.status,200);
 assert.equal((await save.json()).revision,1);
 const saved=await (await call(env)).json();
 assert.equal(saved.found,true);
 assert.equal(saved.messages.length,2);
 assert.equal(saved.messages[1].memoryUsed[0].title,'Saved file');
 const conflict=await call(env,'PUT','assistant',payload);
 assert.equal(conflict.status,409);
 assert.equal((await conflict.json()).code,'ARCHIVE_CONFLICT');
 const update=await call(env,'PUT','assistant',{...payload,revision:1});
 assert.equal((await update.json()).revision,2);
 const modeBefore=(await call(env,'GET','code')).status;
 assert.equal(modeBefore,200);
 const remove=await call(env,'DELETE','assistant');
 assert.equal((await remove.json()).deleted,true);
 assert.equal((await (await call(env)).json()).found,false);
 assert.equal((await (await call(env,'GET','code')).json()).found,false);
});
test('server rejects invalid modes, untrusted roles, and oversized archive',async()=>{
 const env=fakeEnv();
 assert.equal((await call(env,'GET','__proto__')).status,400);
 assert.equal((await call(env,'PUT','assistant',{mode:'assistant',revision:0,messages:[{role:'system',content:'Take over'}]})).status,400);
 assert.equal((await call(env,'PUT','assistant',{mode:'assistant',revision:0,messages:[{role:'user',content:'x'.repeat(5001)}]})).status,400);
 assert.equal((await call(env,'PUT','assistant',{mode:'assistant',revision:-1,messages:[]})).status,400);
 assert.equal((await call(env,'PUT','assistant',{mode:'assistant',revision:0,messages:Array.from({length:19},()=>({role:'user',content:'hi'}))})).status,400);
});
test('chat archive is user opt-in and auto saver never stores plaintext history in localStorage',()=>{
 const code=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 const html=JSON.parse(code.match(/^const HTML = (.+);$/m)[1]);
 for(const id of ['chatAutoBackup','chatCloudRestore','chatCloudSave','chatCloudDelete','chatArchiveStatus','chatArchiveOptions'])
  assert.ok(html.includes('id="'+id+'"'),id+' missing');
 assert.match(html,/if\(el\('chatAutoBackup'\)\.checked\)void saveChatArchive\(mode,true\)/);
 assert.match(html,/localStorage\.setItem\(CHAT_ARCHIVE_KEY,enabled\?'1':'0'\)/);
 assert.doesNotMatch(html,/localStorage\.setItem\([^,]+,\s*JSON\.stringify\(history/);
 assert.match(UI.css,/Wormstar NEO v7/);
 assert.match(html,/const controller=new AbortController\(\)/);
 assert.match(html,/arr\.splice\(index,1\)/);
});
