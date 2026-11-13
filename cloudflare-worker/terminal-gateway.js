/**
 * Wormstar Core -> Railway Linux Terminal
 * The Core owner token grants a short-lived connection ticket. The Railway
 * password stays in a Cloudflare secret and NEVER reaches the browser.
 *
 * Remote terminal sessions are still non-root and bounded by the Railway host.
 * No URL, host, or redirect is accepted from the incoming request.
 */
const BACKEND_ORIGIN = 'https://terminal-production-fb16bd35.up.railway.app';
const TICKET_TTL_MS = 20_000;
const encoder = new TextEncoder();

function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    }
  });
}

// The Railway server requires at least 12 password characters. Match its
// actual contract rather than reporting a working 12-23 char password as an
// entirely unconfigured gateway. Recommend 24+ on new password rotations.
function configurationIssues(env) {
  const issues = [];
  if(typeof env?.TERMINAL_TICKET_SECRET !== 'string' ||
     env.TERMINAL_TICKET_SECRET.length < 32)
    issues.push('TERMINAL_TICKET_SECRET');
  if(typeof env?.TERMINAL_RAILWAY_PASSWORD !== 'string' ||
     env.TERMINAL_RAILWAY_PASSWORD.length < 12)
    issues.push('TERMINAL_RAILWAY_PASSWORD');
  return issues;
}
function secretsReady(env) {
  return configurationIssues(env).length === 0;
}
function configurationError(env) {
  // This response is sent to a verified Wormstar owner only. Never return
  // secret values, actual lengths, hashes or the backend credential.
  return json({
    error:'Terminal gateway configuration needs correction',
    code:'TERMINAL_CONFIGURATION_INVALID',
    invalidSecrets:configurationIssues(env),
    requirement:'Set a 32+ character signing secret and the existing Railway password (12+ characters) as Cloudflare Secrets.'
  },503);
}

function sameOrigin(request, required=false) {
  const from = request.headers.get('Origin');
  return (!required && !from) || from === new URL(request.url).origin;
}

function b64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function signTicket(data, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC',key,encoder.encode(data)));
}

function equalSignature(a,b) {
  if(a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}

export async function createTerminalTicket(request, env, verifiedOwner) {
  if(request.method !== 'POST')return json({error:'Method not allowed'},405);
  if(!sameOrigin(request))return json({error:'Forbidden origin'},403);
  if(!verifiedOwner)return json({error:'Owner authentication required'},401);
  if(!secretsReady(env))return configurationError(env);
  const nonce = new Uint8Array(18);
  crypto.getRandomValues(nonce);
  const body = String(Date.now()) + '.' + b64url(nonce);
  const signature = await signTicket(body,env.TERMINAL_TICKET_SECRET);
  return json({ticket:body+'.'+signature,expiresInSeconds:20,
    wsPath:'/api/terminal/ws'});
}

async function validTicket(ticket,secret,now=Date.now()) {
  const parts = ticket.split('.');
  if(parts.length!==3 ||
     !/^\d{13}$/.test(parts[0]) ||
     !/^[A-Za-z0-9_-]{24}$/.test(parts[1]) ||
     !/^[A-Za-z0-9_-]{43}$/.test(parts[2]))return false;
  const issued=Number(parts[0]);
  if(!Number.isSafeInteger(issued)||issued>now+1000 || now-issued>TICKET_TTL_MS)return false;
  const expected=await signTicket(parts[0]+'.'+parts[1],secret);
  return equalSignature(parts[2],expected);
}

export async function openTerminalWebSocket(request,env,deps={}) {
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  if((request.headers.get('Upgrade')||'').toLowerCase()!=='websocket')
    return json({error:'WebSocket upgrade required'},426);
  if(!sameOrigin(request,true))return json({error:'Forbidden origin'},403);
  // Do not expose binding inventory to unauthenticated WebSocket requests.
  // Owner-only diagnostics are returned from /api/terminal/session instead.
  if(!secretsReady(env))return json({error:'Terminal unavailable'},503);
  const offered=(request.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(x=>x.trim());
  if(offered.length!==2 || offered[0]!=='wormstar-terminal' ||
     !offered[1].startsWith('ticket.'))
    return json({error:'Connection ticket required'},401);
  const ticket=offered[1].slice('ticket.'.length);
  if(!await validTicket(ticket,env.TERMINAL_TICKET_SECRET))
    return json({error:'Connection ticket expired or invalid'},401);

  // Static destination, never derived from user-controlled URL or a request header.
  let response;
  try {
    response=await (deps.fetchBackend||fetch)(BACKEND_ORIGIN+'/ws',{
      headers:{Upgrade:'websocket',Origin:BACKEND_ORIGIN},
      redirect:'error'
    });
  }catch(_) {
    return json({error:'Terminal service is unavailable'},503);
  }
  const remote=response?.webSocket;
  if(!remote||response.status!==101)
    return json({error:'Terminal service rejected connection'},503);

  const createPair=deps.createPair || (()=>new WebSocketPair());
  let client,server;
  try{[client,server]=Object.values(createPair());}
  catch(_){try{remote.close(1011,'Gateway unavailable');}catch(_){}return json({error:'Gateway unavailable'},503);}

  // Keep the proxy half-open so an upstream error can carry an explicit
  // close reason to Safari instead of turning into a mysterious code 1006.
  remote.accept({allowHalfOpen:true});
  server.accept({allowHalfOpen:true});
  let closed=false,ready=false;
  let maxAge,authTimeout;
  const end=(code=1000,reason='SESSION_ENDED')=>{
    if(closed)return;
    closed=true;
    clearTimeout(maxAge);
    clearTimeout(authTimeout);
    // Only report a bounded failure code. Never log credentials, tickets,
    // user commands, request URLs, IPs or upstream error payloads.
    if(code!==1000)console.warn(JSON.stringify({event:'wormstar_terminal_close',reason}));
    try{if(server.readyState<2)server.close(code,reason);}catch(_){}
    try{if(remote.readyState<2)remote.close(1000,'GATEWAY_CLOSED');}catch(_){}
  };
  maxAge=setTimeout(()=>end(1000,'SESSION_LIMIT'),60*60*1000);
  authTimeout=setTimeout(()=>end(1013,'RAILWAY_AUTH_TIMEOUT'),10000);

  remote.addEventListener('message',event=>{
    if(closed)return;
    const payload=typeof event.data==='string'?event.data:'';
    if(payload.length>65536){end(1009,'BACKEND_MESSAGE_TOO_LARGE');return;}
    let data;
    try{data=JSON.parse(payload);}catch(_){end(1003,'BAD_BACKEND_MESSAGE');return;}
    if(data.type==='error'){
      // Railway sends this for password rejection. Do not forward upstream
      // error payloads (which are untrusted) or hide the reason from the owner.
      try{server.send(JSON.stringify({type:'error',code:'RAILWAY_AUTH_REJECTED',
        message:'Railway authentication rejected. Check the configured password.'}));}catch(_){}
      end(1008,'RAILWAY_AUTH_REJECTED');
      return;
    }
    if(data.type==='ready'){
      ready=true;
      clearTimeout(authTimeout);
    }
    if(['ready','output','info'].includes(data.type)){
      try{server.send(payload);}catch(_){end(1011,'BROWSER_SEND_FAILED');}
    }
  });
  remote.addEventListener('close',()=>{
    if(!closed)end(ready?1000:1011,ready?'RAILWAY_CLOSED':'RAILWAY_CLOSED_BEFORE_READY');
  });
  remote.addEventListener('error',()=>end(1011,'RAILWAY_SOCKET_ERROR'));
  server.addEventListener('message',event=>{
    if(!ready||closed)return;
    if(typeof event.data!=='string'||event.data.length>8192){end(1009,'INPUT_TOO_LARGE');return;}
    let data;
    try{data=JSON.parse(event.data);}catch(_){return;}
    if(data?.type==='input'&&typeof data.data==='string'&&data.data.length<=4096)
      remote.send(JSON.stringify({type:'input',data:data.data}));
    else if(data?.type==='resize'&&Number.isInteger(data.cols)&&Number.isInteger(data.rows))
      remote.send(JSON.stringify({type:'resize',cols:Math.max(10,Math.min(240,data.cols)),
        rows:Math.max(5,Math.min(80,data.rows))}));
  });
  server.addEventListener('close',()=>end());
  server.addEventListener('error',()=>end(1011,'BROWSER_SOCKET_ERROR'));

  try{remote.send(JSON.stringify({type:'auth',password:env.TERMINAL_RAILWAY_PASSWORD}));}
  catch(_){end(1011,'RAILWAY_AUTH_SEND_FAILED');return json({error:'Terminal backend unavailable'},503);}
  const headers={
    'Sec-WebSocket-Protocol':'wormstar-terminal',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'
  };
  return deps.makeUpgradeResponse
    ? deps.makeUpgradeResponse(client,headers)
    : new Response(null,{status:101,webSocket:client,headers});
}


/**
 * An owner-only, on-demand end-to-end probe. Verifies Railway HTTP,
 * WebSocket upgrade, and password authentication without exposing secrets.
 * It closes the ephemeral shell as soon as a ready response is received.
 */
export async function diagnoseTerminalGateway(request,env,verifiedOwner,deps={}) {
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(!sameOrigin(request))return json({error:'Forbidden origin'},403);
  if(!verifiedOwner)return json({error:'Owner authentication required'},401);
  if(!secretsReady(env))return configurationError(env);
  const backend=deps.fetchBackend||fetch;
  let health;
  try{
    health=await backend(BACKEND_ORIGIN+'/health',{method:'GET',redirect:'error',cache:'no-store'});
    if(!health.ok)return json({ok:false,stage:'health',code:'RAILWAY_HEALTH_FAILED'},503);
  }catch(_){return json({ok:false,stage:'health',code:'RAILWAY_UNREACHABLE'},503);}
  let handshake;
  try{
    handshake=await backend(BACKEND_ORIGIN+'/ws',{
      headers:{Upgrade:'websocket',Origin:BACKEND_ORIGIN},redirect:'error'
    });
  }catch(_){return json({ok:false,stage:'websocket',code:'BACKEND_WS_CONNECT_FAILED'},503);}
  if(handshake.status!==101 || !handshake.webSocket)
    return json({ok:false,stage:'websocket',code:'BACKEND_WS_UPGRADE_REJECTED'},503);

  const ws=handshake.webSocket;
  try{ws.accept({allowHalfOpen:true});}
  catch(_){return json({ok:false,stage:'websocket',code:'BACKEND_WS_ACCEPT_FAILED'},503);}
  const outcome=await new Promise(resolve=>{
    let finished=false,timer;
    const done=code=>{
      if(finished)return;
      finished=true;clearTimeout(timer);resolve(code);
    };
    timer=setTimeout(()=>done('RAILWAY_AUTH_TIMEOUT'),8000);
    ws.addEventListener('message',event=>{
      let data;
      try{data=JSON.parse(event.data);}catch(_){done('RAILWAY_BAD_RESPONSE');return;}
      if(data.type==='ready')done('READY');
      else if(data.type==='error')done('RAILWAY_AUTH_REJECTED');
    });
    ws.addEventListener('close',()=>done('RAILWAY_CLOSED_BEFORE_READY'));
    ws.addEventListener('error',()=>done('RAILWAY_SOCKET_ERROR'));
    try{ws.send(JSON.stringify({type:'auth',password:env.TERMINAL_RAILWAY_PASSWORD}));}
    catch(_){done('RAILWAY_AUTH_SEND_FAILED');}
  });
  try{if(ws.readyState<2)ws.close(1000,'PROBE_DONE');}catch(_){}
  return json({ok:outcome==='READY',stage:'authentication',code:outcome},
    outcome==='READY'?200:503);
}

export const terminalGatewayInternals={validTicket,secretsReady};
