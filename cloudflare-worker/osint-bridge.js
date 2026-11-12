/**
 * STAR OSINT cloud queue.
 * Cloudflare never calls Kali directly. A separately authenticated local agent
 * makes outbound HTTPS requests and runs strictly allowlisted passive collectors.
 */
export const COLLECTORS = Object.freeze(['dns','ct','whois','harvester','amass']);
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (value,status=200) => Response.json(value,{
  status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}
});
function canonicalDomain(raw) {
  if(typeof raw!=='string'||raw.length>253)return null;
  const domain=raw.toLowerCase().trim().replace(/\.$/,'');
  const labels=domain.split('.');
  if(labels.length<2 || domain.length<4 || domain.length>253 || /^\d+$/.test(labels.at(-1)))return null;
  if(labels.some(x=>x.length<1||x.length>63||!(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(x))))return null;
  if(['localhost','local','internal','test','invalid','example'].includes(labels.at(-1)))return null;
  return domain;
}
export function isAllowedDomain(input,allowed) {
  const domain=canonicalDomain(input);
  if(!domain||typeof allowed!=='string'||!allowed.trim())return false;
  return allowed.split(',').map(x=>x.trim().toLowerCase()).some(entry=>{
    if(entry.startsWith('*.'))return canonicalDomain(entry.slice(2))&&domain.endsWith(entry.slice(1))&&domain!==entry.slice(2);
    return canonicalDomain(entry)===entry&&entry===domain;
  });
}
async function agentAuthorized(request,env){
  const expected=env.OSINT_AGENT_TOKEN;
  if(typeof expected!=='string'||expected.length<32)return false;
  const h=request.headers.get('Authorization')||'';
  if(!h.startsWith('Bearer '))return false;
  const supplied=h.slice(7);
  if(supplied.length!==expected.length || supplied.length>512)return false;
  const a=new TextEncoder().encode(supplied),b=new TextEncoder().encode(expected);
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
function rowForOwner(row){
  const data={id:row.id,domain:row.domain,status:row.status,collectors:JSON.parse(row.collectors_json),
    analyze:Boolean(row.analyze),created_at:row.created_at,started_at:row.started_at,
    finished_at:row.finished_at,error:row.error||''};
  if(row.result_json){try{data.result=JSON.parse(row.result_json);}catch{data.error='Result serialization error';}}
  return data;
}
function resultPayload(body){
  if(!body||typeof body!=='object'||Array.isArray(body))return null;
  const status=body.status;
  if(!['done','failed'].includes(status))return null;
  const src=body.result;
  if(!src||typeof src!=='object'||Array.isArray(src))return null;
  const findings=Array.isArray(src.findings)?src.findings.slice(0,100).map(x=>({
    kind:String(x?.kind||'').slice(0,90), value:String(x?.value||'').slice(0,280),
    source:String(x?.source||'').slice(0,90),confidence:String(x?.confidence||'').slice(0,30)
  })):[];
  const sources=Array.isArray(src.sources)?src.sources.slice(0,5).map(x=>({
    source:String(x?.source||'').slice(0,30),status:String(x?.status||'').slice(0,20),
    findings:Number.isSafeInteger(x?.findings)?x.findings:0
  })):[];
  const sm=src.summary&&typeof src.summary==='object'&&!Array.isArray(src.summary)?src.summary:null;
  const summary=sm?{
    executive_summary:String(sm.executive_summary||'').slice(0,2500),
    risks:Array.isArray(sm.risks)?sm.risks.slice(0,8).map(x=>String(x).slice(0,300)):[],
    recommendations:Array.isArray(sm.recommendations)?sm.recommendations.slice(0,8).map(x=>String(x).slice(0,300)):[]
  }:null;
  const payload={status:String(src.status||status).slice(0,24),
    local_scan_id:Number.isSafeInteger(src.local_scan_id)?src.local_scan_id:null,
    count:Number.isSafeInteger(src.count)?src.count:findings.length,
    findings,sources,summary};
  if(JSON.stringify(payload).length>45000)return null;
  return payload;
}
const methodGuard=(request,allowed)=>allowed.includes(request.method)?null:json({error:'Method not allowed'},405);

export async function handleOsintBridge(request,env,path,readJson,{ownerAuthenticated=false}={}){
  const isAgent=path.startsWith('/api/osint/agent/');
  if(isAgent){
    if(!env.OSINT_AGENT_TOKEN||env.OSINT_AGENT_TOKEN.length<32)return json({error:'OSINT agent not configured'},503);
    if(!(await agentAuthorized(request,env)))return json({error:'Unauthorized'},401);
  }else if(!ownerAuthenticated)return json({error:'Unauthorized'},401);
  if(!env.DB)return json({error:'D1 database binding missing'},503);

  try {
    if(path==='/api/osint/jobs'){
      const guard=methodGuard(request,['GET','POST']);if(guard)return guard;
      if(request.method==='GET'){
        const result=await env.DB.prepare(
          'SELECT id,domain,status,collectors_json,analyze,created_at,started_at,finished_at,error,result_json FROM osint_jobs ORDER BY created_at DESC LIMIT 20'
        ).all();
        return json({jobs:(result.results||[]).map(rowForOwner)});
      }
      const data=await readJson(request,3000);
      const domain=canonicalDomain(data?.domain);
      if(!domain)return json({error:'Invalid public DNS domain'},400);
      if(!env.OSINT_ALLOWED_DOMAINS)return json({error:'OSINT_ALLOWED_DOMAINS not configured'},503);
      if(!isAllowedDomain(domain,env.OSINT_ALLOWED_DOMAINS))return json({error:'Domain not in owner allowlist'},403);
      if(data?.confirmed!==true)return json({error:'Explicit approval required'},400);
      const requested=data?.collectors;
      if(!Array.isArray(requested)||requested.length<1||requested.length>5||
        new Set(requested).size!==requested.length||requested.some(c=>!COLLECTORS.includes(c)))return json({error:'Only passive collectors are available'},400);
      const counts=await env.DB.prepare(
        "SELECT SUM(CASE WHEN status IN ('queued','running') THEN 1 ELSE 0 END) AS active, "+
        "SUM(CASE WHEN created_at >= datetime('now','-1 day') THEN 1 ELSE 0 END) AS daily FROM osint_jobs"
      ).first();
      if(Number(counts?.active||0)>=2 || Number(counts?.daily||0)>=12)return json({error:'Queue or daily limit reached'},429);
      const id=crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO osint_jobs(id,domain,status,collectors_json,analyze,created_at) VALUES(?,?,'queued',?,?,CURRENT_TIMESTAMP)"
      ).bind(id,domain,JSON.stringify(requested),data?.analyze===true?1:0).run();
      return json({id,status:'queued',domain,collectors:requested},202);
    }

    const detail=path.match(/^\/api\/osint\/jobs\/([a-f0-9-]{36})$/i);
    if(detail){
      const guard=methodGuard(request,['GET']);if(guard)return guard;
      if(!ID.test(detail[1]))return json({error:'Invalid job id'},400);
      const row=await env.DB.prepare(
        'SELECT id,domain,status,collectors_json,analyze,created_at,started_at,finished_at,error,result_json FROM osint_jobs WHERE id=?'
      ).bind(detail[1]).first();
      return row?json({job:rowForOwner(row)}):json({error:'Unknown job'},404);
    }

    if(path==='/api/osint/agent/claim'){
      const guard=methodGuard(request,['POST']);if(guard)return guard;
      const claim=crypto.randomUUID();
      const row=await env.DB.prepare(
        "UPDATE osint_jobs SET status='running',claim_id=?,started_at=CURRENT_TIMESTAMP "+
        "WHERE id=(SELECT id FROM osint_jobs WHERE status='queued' ORDER BY created_at LIMIT 1) "+
        "AND status='queued' RETURNING id,domain,collectors_json,analyze,claim_id"
      ).bind(claim).first();
      if(!row)return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
      return json({job:{id:row.id,domain:row.domain,collectors:JSON.parse(row.collectors_json),
        analyze:Boolean(row.analyze),claim_id:row.claim_id}});
    }

    const complete=path.match(/^\/api\/osint\/agent\/([a-f0-9-]{36})\/complete$/i);
    if(complete){
      const guard=methodGuard(request,['POST']);if(guard)return guard;
      if(!ID.test(complete[1]))return json({error:'Invalid job id'},400);
      const body=await readJson(request,50000);
      if(!ID.test(body?.claim_id||''))return json({error:'Invalid claim'},400);
      const payload=resultPayload(body);
      if(!payload)return json({error:'Invalid bounded result'},400);
      const done=await env.DB.prepare(
        "UPDATE osint_jobs SET status=?,finished_at=CURRENT_TIMESTAMP,result_json=?,error=? "+
        "WHERE id=? AND claim_id=? AND status='running'"
      ).bind(body.status,JSON.stringify(payload),String(body.error||'').slice(0,180),
        complete[1],body.claim_id).run();
      return done.meta?.changes===1?json({ok:true}):json({error:'Claim is no longer valid'},409);
    }
    return json({error:'Unknown OSINT endpoint'},404);
  } catch(error){
    if(error?.status===413)return json({error:'Payload too large'},413);
    if(error?.status===400)return json({error:'Invalid JSON'},400);
    return json({error:'OSINT queue unavailable: apply D1 migration and verify database'},503);
  }
}
