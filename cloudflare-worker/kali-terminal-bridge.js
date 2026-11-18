/**
 * Private KALI-OSINT-STAR Pages -> Wormstar terminal bridge.
 *
 * The Pages Function is protected by its own Cloudflare Access owner app.
 * Only server-side Pages Functions have the bridge secret. Neither the
 * browser nor the public Pages bundle receives it. The Railway credentials
 * remain exclusively inside the existing Wormstar Worker.
 */
import {createTerminalTicket,openTerminalWebSocket,diagnoseTerminalGateway,downloadTerminalSnapshot} from './terminal-gateway.js';

const WORKER_ORIGIN='https://wormstar-ai-lab.abdulstarzeki001.workers.dev';
const INTEGRATION_PREFIX='/api/integrations/kali/terminal/';
const RAILWAY_ORIGIN='https://terminal-production-fb16bd35.up.railway.app';

function reply(code,status=403){
  return new Response(JSON.stringify({code}),{status,headers:{
    'content-type':'application/json;charset=utf-8',
    'cache-control':'no-store','x-content-type-options':'nosniff'
  }});
}

async function equalSecrets(value,secret){
  if(typeof value!=='string'||typeof secret!=='string'||secret.length<32||value.length>4096)return false;
  const encoded=new TextEncoder();
  const [left,right]=await Promise.all([
    crypto.subtle.digest('SHA-256',encoded.encode(value)),
    crypto.subtle.digest('SHA-256',encoded.encode(secret))
  ]);
  const a=new Uint8Array(left),b=new Uint8Array(right);
  let mismatch=0;
  for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];
  return mismatch===0;
}

function workerRequest(path,method,headers={}){
  return new Request(WORKER_ORIGIN+path,{method,headers:{Origin:WORKER_ORIGIN,...headers}});
}

export async function handleKaliTerminalBridge(request,env,deps={}){
  const pathname=new URL(request.url).pathname;
  if(!pathname.startsWith(INTEGRATION_PREFIX))return reply('NOT_FOUND',404);
  if(!await equalSecrets(request.headers.get('X-Kali-Terminal-Bridge'),env?.KALI_TERMINAL_BRIDGE_SECRET))
    return reply('FORBIDDEN');
  // Only trusted Pages Access requests are forwarded by the Pages Function;
  // unauthenticated clients can neither obtain the bridge secret nor the ticket.
  const route=pathname.slice(INTEGRATION_PREFIX.length);
  if(route==='session'){
    if(request.method!=='POST')return reply('METHOD_NOT_ALLOWED',405);
    return (deps.createTicket||createTerminalTicket)(
      workerRequest('/api/terminal/session','POST'),env,true);
  }
  if(route==='diagnose'){
    if(request.method!=='POST')return reply('METHOD_NOT_ALLOWED',405);
    return (deps.diagnose||diagnoseTerminalGateway)(
      workerRequest('/api/terminal/diagnose','POST'),env,true,deps.gateway);
  }
  if(route==='backup/latest'){
    if(request.method!=='POST')return reply('METHOD_NOT_ALLOWED',405);
    return (deps.downloadSnapshot||downloadTerminalSnapshot)(
      workerRequest('/api/terminal/backup/latest','POST'),env,true,deps.gateway);
  }
  if(route==='training/status'||route==='training/verify'){
    if(request.method!=='POST')return reply('METHOD_NOT_ALLOWED',405);
    const secret=env?.TERMINAL_EDGE_ORIGIN_SECRET;
    if(typeof secret!=='string'||secret.length<32)return reply('TRAINING_EDGE_UNAVAILABLE',503);
    const verify=route==='training/verify';
    const declaredSize=Number(request.headers.get('content-length')||0);
    if(verify && declaredSize>2048)return reply('TRAINING_INPUT_TOO_LARGE',413);
    let body=null;
    if(verify){
      body=await request.text();
      if(new TextEncoder().encode(body).length>2048)return reply('TRAINING_INPUT_TOO_LARGE',413);
      try {const value=JSON.parse(body);
        if(!value||typeof value!=='object'||Array.isArray(value))return reply('TRAINING_BAD_JSON',400);
      }catch(_){return reply('TRAINING_BAD_JSON',400);}
    }
    try{
      const response=await (deps.fetchTraining||fetch)(RAILWAY_ORIGIN+'/api/training/'+(verify?'verify':'status'),{
        method:'POST',redirect:'manual',cache:'no-store',
        headers:{'X-Star-Edge-Origin':secret,'Content-Type':'application/json'},
        body:verify?body:'{}'
      });
      if(response.status<200||response.status>=500)return reply('TRAINING_UPSTREAM_UNAVAILABLE',503);
      return new Response(response.body,{status:response.status,headers:{
        'Content-Type':'application/json;charset=utf-8','Cache-Control':'private, no-store',
        'X-Content-Type-Options':'nosniff'
      }});
    }catch(_){return reply('TRAINING_UPSTREAM_UNAVAILABLE',503);}
  }
  // Exact read-only tool operations on the same Railway Linux container.
  // Pages already checked the owner Access JWT and bridge secret; no target
  // addresses, user shell strings or arbitrary subpaths are accepted.
  if(['tools/catalog','tools/run','tools/assistant','tools/diagnostics','tools/live-ai','tools/install/status','tools/install/start'].includes(route)){
    if(request.method!=='POST')return reply('METHOD_NOT_ALLOWED',405);
    const secret=env?.TERMINAL_EDGE_ORIGIN_SECRET;
    if(typeof secret!=='string'||secret.length<32)return reply('TOOLS_EDGE_UNAVAILABLE',503);
    const kind=route.slice('tools/'.length);
    let body='{}';
    if(!['catalog','diagnostics','install/status'].includes(kind)){
      const declared=Number(request.headers.get('content-length')||0);
      if(declared>2048)return reply('TOOLS_INPUT_TOO_LARGE',413);
      body=await request.text();
      if(new TextEncoder().encode(body).length>2048)return reply('TOOLS_INPUT_TOO_LARGE',413);
      let value;
      try{value=JSON.parse(body);}catch(_){return reply('TOOLS_BAD_JSON',400);}
      if(!value||typeof value!=='object'||Array.isArray(value))
        return reply('TOOLS_BAD_JSON',400);
      if(kind==='run'){
        if(Object.keys(value).some(k=>!['tool_id','action'].includes(k))||
           typeof value.tool_id!=='string'||!/^[-a-z0-9]{2,32}$/.test(value.tool_id)||
           !['inspect','version'].includes(value.action))return reply('TOOLS_INVALID_ACTION',400);
      }else if(kind==='assistant'){
        if(typeof value.prompt!=='string'||!value.prompt.trim()||value.prompt.length>400||
           Object.keys(value).some(k=>k!=='prompt'))return reply('TOOLS_INVALID_PROMPT',400);
      }else if(kind==='live-ai'){
        if(Object.keys(value).length!==1||value.confirm!=='RUN_ONE_PROVIDER_CHECK')
          return reply('AI_PROBE_CONFIRM_REQUIRED',400);
      }else if(kind==='install/start'){
        if(Object.keys(value).sort().join(',')!=='confirm,tool_id'||
           !['frida','impacket'].includes(value.tool_id)||
           value.confirm!=='INSTALL_CURATED_PINNED')
          return reply('INSTALL_NOT_APPROVED',400);
      }else return reply('TOOLS_INVALID_ACTION',400);
    }
    try{
      const response=await (deps.fetchTools||fetch)(RAILWAY_ORIGIN+'/api/tools/'+kind,{
        method:'POST',redirect:'manual',cache:'no-store',
        headers:{'X-Star-Edge-Origin':secret,'Content-Type':'application/json'},
        body
      });
      if(response.status<200||response.status>=500)return reply('TOOLS_UPSTREAM_UNAVAILABLE',503);
      return new Response(response.body,{status:response.status,headers:{
        'Content-Type':'application/json;charset=utf-8',
        'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'
      }});
    }catch(_){return reply('TOOLS_UPSTREAM_UNAVAILABLE',503);}
  }
  if(route==='ws'){
    if(request.method!=='GET'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')
      return reply('UPGRADE_REQUIRED',426);
    const proto=request.headers.get('Sec-WebSocket-Protocol')||'';
    if(!/^wormstar-terminal,\s*ticket\.[A-Za-z0-9_.-]{60,180}$/.test(proto))
      return reply('INVALID_SUBPROTOCOL',401);
    return (deps.openWebSocket||openTerminalWebSocket)(
      workerRequest('/api/terminal/ws','GET',{
        Upgrade:'websocket','Sec-WebSocket-Protocol':proto
      }),env,deps.gateway);
  }
  return reply('NOT_FOUND',404);
}

export const kaliBridgeContract={WORKER_ORIGIN,INTEGRATION_PREFIX};
