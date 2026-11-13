import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const {default:worker}=await import(new URL('../worker.js',import.meta.url));
const origin='https://wormstar-sentinel-preview.example';
const url=path=>origin+path;
let coreCalls=[];

const env={
  CORE:{
    async fetch(request) {
      const path=new URL(request.url).pathname;
      coreCalls.push({path,auth:request.headers.get('Authorization')});
      if(path==='/api/health')return Response.json({ok:true,service:'wormstar-ai-lab'});
      return Response.json({error:'Wormstar token required'},{status:401});
    }
  }
};
const go=(path,init={},e=env)=>worker.fetch(new Request(url(path),init),e);

test('Sentinel homepage is the Wormstar AI unified starting point',async()=>{
 const res=await go('/');
 assert.equal(res.status,200);
 const html=await res.text();
 for(const uri of ['/workspace/','/core/','/core/workspace','/osint/','/audit/']) {
   assert.ok(html.includes('href="'+uri+'"'),'missing link '+uri);
 }
 assert.match(html,/suiteWelcome/);
 assert.match(html,/data-page="workspace"/);
 assert.match(html,/id="suiteRefresh"/);
 assert.match(html,/id="wsTermConnect"/);
 assert.match(html,/id="aiConnectForm"/);
 assert.match(html,/data-i18n="hero_title"/);
 assert.match(res.headers.get('Content-Security-Policy'),/script-src 'self'/);
});

test('Workspace is served locally and deep-link refresh remains possible',async()=>{
 for(const path of ['/workspace','/workspace/']) {
   const res=await go(path);
   assert.equal(res.status,200);
   const html=await res.text();
   assert.match(html,/page-workspace/);
   assert.match(html,/location.pathname/);
   assert.match(res.headers.get('X-Frame-Options'),/DENY/);
   const head=await go(path,{method:'HEAD'});
   assert.equal(head.status,200);
   assert.equal(await head.text(),'');
 }
 assert.equal((await go('/workspace/nope')).status,404);
});

test('Core and NEXUS redirect via fixed targets without forwarding secrets',async()=>{
 const aliases=[
  ['/core','https://wormstar-ai-lab.abdulstarzeki001.workers.dev/'],
  ['/core/','https://wormstar-ai-lab.abdulstarzeki001.workers.dev/'],
  ['/core/workspace','https://wormstar-ai-lab.abdulstarzeki001.workers.dev/workspace'],
  ['/core/workspace/','https://wormstar-ai-lab.abdulstarzeki001.workers.dev/workspace']
 ];
 const n=coreCalls.length;
 for(const [path,target] of aliases){
   const res=await go(path+'?token=dont-forward',{redirect:'manual'});
   assert.equal(res.status,302);
   assert.equal(res.headers.get('Location'),target);
   assert.equal(res.headers.get('Cache-Control'),'no-store');
   assert.equal(res.headers.get('Referrer-Policy'),'no-referrer');
 }
 assert.equal(coreCalls.length,n,'Core redirects must not invoke service binding');
 assert.equal((await go('/core/delete',{method:'GET'})).status,404);
 assert.equal((await go('/core/',{method:'POST'})).status,405);
});

test('Suite status checks Core binding and two local read-only modules',async()=>{
 const res=await go('/api/suite/status');
 assert.equal(res.status,200);
 const json=await res.json();
 assert.equal(json.ok,true);
 assert.deepEqual(json.modules.core,{reachable:true,authRequired:true});
 assert.equal(json.modules.osint.reachable,true);
 assert.equal(json.modules.audit.reachable,true);
 assert.equal(json.modules.osint.localOnly,true);
 assert.equal(json.modules.audit.readOnly,true);
 assert.equal(JSON.stringify(json).includes('token'),false);
 assert.equal(coreCalls.at(-1).path,'/api/health');
 assert.equal(coreCalls.at(-1).auth,null);
 assert.equal((await go('/api/suite/status',{method:'POST'})).status,405);
 const offline=await (await go('/api/suite/status',{},{})).json();
 assert.equal(offline.modules.core.reachable,false);
 assert.equal(offline.modules.osint.reachable,true);
});

test('Private Core operations remain owner-authenticated',async()=>{
 const n=coreCalls.length;
 assert.equal((await go('/api/repo/status')).status,401);
 assert.equal((await go('/api/agents')).status,401);
 assert.equal((await go('/api/rag/status')).status,401);
 assert.equal(coreCalls.length,n,'Untrusted requests must never reach Core');
});

test('OSINT and audit preserve local processing, source pages and suite links',async()=>{
 let res=await go('/osint/');
 assert.equal(res.status,200);
 let html=await res.text();
 assert.match(html,/href="\/workspace\/"/);
 assert.match(html,/href="\/core\/"/);
 assert.match(html,/href="\/audit\/"/);
 assert.match(res.headers.get('Content-Security-Policy'),/connect-src 'none'/);
 assert.equal((await go('/osint/health')).status,200);

 res=await go('/audit/');
 assert.equal(res.status,200);
 html=await res.text();
 assert.match(html,/href="\/workspace\/"/);
 assert.match(html,/href="\/core\/"/);
 assert.match(html,/href="\/osint\/"/);
 assert.match(html,/fetch\("\/audit\/api\/sample"/);
 assert.match(res.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
 assert.equal((await go('/audit/health')).status,200);
 assert.equal((await go('/audit/api/sample')).status,200);
});

test('Source contains no external API calls in standalone suite controls',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const controls=html.slice(html.indexOf('// Suite routes and authenticated Core operations share'),html.indexOf('</script>',html.indexOf('// Suite routes')));
 assert.match(controls,/opsRequest\(path\)/);
 assert.match(controls,/fetch\("\/api\/suite\/status"/);
 assert.doesNotMatch(controls,/https:\/\//);
 assert.doesNotMatch(controls,/localStorage|sessionStorage/);
});
