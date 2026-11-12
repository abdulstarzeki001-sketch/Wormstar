import test from 'node:test';
import assert from 'node:assert/strict';
import {handleOsintBridge,isAllowedDomain} from '../osint-bridge.js';

const OWNER = {ownerAuthenticated:true};
const TOKEN = 'S'.repeat(48);
class FakeD1 {
  constructor(){this.jobs=[];}
  prepare(sql){
    const db=this;
    let args=[];
    return {
      bind(...input){args=input;return this;},
      async all(){
        assert.match(sql,/ORDER BY created_at DESC LIMIT 20/);
        return {results:db.jobs.slice().reverse()};
      },
      async first(){
        if(sql.includes('SUM(CASE'))return {
          active:db.jobs.filter(x=>['queued','running'].includes(x.status)).length,
          daily:db.jobs.length
        };
        if(sql.includes('FROM osint_jobs WHERE id=?'))return db.jobs.find(x=>x.id===args[0])||null;
        if(sql.startsWith('UPDATE osint_jobs')&&sql.includes('RETURNING')){
          const job=db.jobs.find(x=>x.status==='queued');
          if(!job)return null;
          job.status='running';job.claim_id=args[0];job.started_at=new Date().toISOString();
          return job;
        }
        throw new Error('Unexpected first: '+sql);
      },
      async run(){
        if(sql.startsWith('INSERT INTO osint_jobs')){
          const [id,domain,collectors,analyze]=args;
          db.jobs.push({id,domain,collectors_json:collectors,analyze,
            created_at:new Date().toISOString(),status:'queued',started_at:null,
            finished_at:null,claim_id:null,error:'',result_json:''});
          return {meta:{changes:1}};
        }
        if(sql.startsWith('UPDATE osint_jobs')&&sql.includes('status=?')){
          const [status,payload,error,id,claim]=args;
          const job=db.jobs.find(x=>x.id===id&&x.claim_id===claim&&x.status==='running');
          if(!job)return {meta:{changes:0}};
          Object.assign(job,{status,result_json:payload,error,finished_at:new Date().toISOString()});
          return {meta:{changes:1}};
        }
        throw new Error('Unexpected run: '+sql);
      }
    };
  }
}
const env=()=>({DB:new FakeD1(),OSINT_AGENT_TOKEN:TOKEN,
  OSINT_ALLOWED_DOMAINS:'owned-site.org,*.owned-site.org'});
function req(path,method='GET',token='',body){
  return new Request('https://core.invalid'+path,{
    method,headers:{...(token?{Authorization:'Bearer '+token}:{}),
      ...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
}
async function readJson(request,max){
  const text=await request.text();
  if(text.length>max)throw Object.assign(new Error('too long'),{status:413});
  try{return JSON.parse(text);}catch{throw Object.assign(new Error('bad json'),{status:400});}
}
const call=(request,environment,owner=false)=>
  handleOsintBridge(request,environment,new URL(request.url).pathname,readJson,{ownerAuthenticated:owner});

test('allowlist matches only exact approved domains or explicitly wildcarded hosts',()=>{
  assert.equal(isAllowedDomain('owned-site.org','owned-site.org'),true);
  assert.equal(isAllowedDomain('www.owned-site.org','owned-site.org'),false);
  assert.equal(isAllowedDomain('www.owned-site.org','*.owned-site.org'),true);
  for(const value of ['owned-site.org.attacker.net','https://owned-site.org/path','127.0.0.1',
    'localhost','owned-site.org:443','foo..owned-site.org','owned-site.org/']){
    assert.equal(isAllowedDomain(value,'owned-site.org,*.owned-site.org'),false,value);
  }
  assert.equal(isAllowedDomain('owned-site.org',''),false);
});

test('owner authorization and local agent secret are independent',async()=>{
  const e=env();
  assert.equal((await call(req('/api/osint/jobs'),e)).status,401);
  assert.equal((await call(req('/api/osint/agent/claim','POST','WRONG'),e)).status,401);
  assert.equal((await call(req('/api/osint/agent/claim','POST',TOKEN),e)).status,204);
  assert.equal((await call(req('/api/osint/jobs','POST','',{domain:'not-allowed.org',collectors:['dns'],confirmed:true}),e,true)).status,403);
  assert.equal((await call(req('/api/osint/jobs','POST','',{domain:'owned-site.org',collectors:['dns'],confirmed:false}),e,true)).status,400);
  assert.equal((await call(req('/api/osint/jobs','POST','',{domain:'owned-site.org',collectors:['dns','shell'],confirmed:true}),e,true)).status,400);
});

test('owner queues, agent atomically claims, completes, owner reads bounded results',async()=>{
  const e=env();
  let r=await call(req('/api/osint/jobs','POST','',{domain:'owned-site.org',collectors:['dns','ct'],confirmed:true,analyze:true}),e,true);
  assert.equal(r.status,202);
  const posted=await r.json();assert.ok(posted.id);
  assert.equal((await call(req('/api/osint/jobs'),e,true)).status,200);
  r=await call(req('/api/osint/agent/claim','POST',TOKEN),e);
  assert.equal(r.status,200);
  const claimed=(await r.json()).job;
  assert.equal(claimed.domain,'owned-site.org');
  assert.equal(claimed.analyze,true);
  assert.equal((await call(req('/api/osint/agent/claim','POST',TOKEN),e)).status,204);
  const path='/api/osint/agent/'+claimed.id+'/complete';
  r=await call(req(path,'POST',TOKEN,{claim_id:crypto.randomUUID(),status:'done',
    result:{status:'done',count:1,findings:[{kind:'dns',value:'198.51.100.1',source:'dns',confidence:'medium'}]}}),e);
  assert.equal(r.status,409);
  r=await call(req(path,'POST',TOKEN,{claim_id:claimed.claim_id,status:'done',
    result:{status:'done',count:1,findings:[{kind:'dns',value:'198.51.100.1',source:'dns',confidence:'medium'}]}}),e);
  assert.equal(r.status,200);
  assert.equal((await call(req(path,'POST',TOKEN,{claim_id:claimed.claim_id,status:'done',result:{status:'done'}}),e)).status,409);
  const result=await call(req('/api/osint/jobs/'+claimed.id),e,true);
  assert.equal(result.status,200);
  const owner=(await result.json()).job;
  assert.equal(owner.status,'done');
  assert.equal(owner.result.findings[0].value,'198.51.100.1');
  assert.equal(owner.claim_id,undefined);
});

test('queue requires explicit safe configuration, rate limit and no arbitrary calls',async()=>{
  const e=env();delete e.OSINT_ALLOWED_DOMAINS;
  assert.equal((await call(req('/api/osint/jobs','POST','',{domain:'owned-site.org',collectors:['dns'],confirmed:true}),e,true)).status,503);
  e.OSINT_ALLOWED_DOMAINS='owned-site.org';
  for(let i=0;i<2;i++){
    assert.equal((await call(req('/api/osint/jobs','POST','',{domain:'owned-site.org',collectors:['ct'],confirmed:true}),e,true)).status,202);
  }
  assert.equal((await call(req('/api/osint/jobs','POST','',{domain:'owned-site.org',collectors:['ct'],confirmed:true}),e,true)).status,429);
  assert.equal((await call(req('/api/osint/agent/missing','POST',TOKEN),e)).status,404);
});
