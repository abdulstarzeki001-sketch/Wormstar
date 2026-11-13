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

function secretsReady(env) {
  return typeof env?.TERMINAL_TICKET_SECRET === 'string'
    && env.TERMINAL_TICKET_SECRET.length >= 32
    && typeof env?.TERMINAL_RAILWAY_PASSWORD === 'string'
    && env.TERMINAL_RAILWAY_PASSWORD.length >= 24;
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
  if(!secretsReady(env))return json({error:'Terminal gateway is not configured'},503);
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
  if(!secretsReady(env))return json({error:'Terminal gateway is not configured'},503);
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

  remote.accept();
  server.accept();
  let closed=false,ready=false;
  const safeClose=(socket,code=1000,reason='Session ended')=>{
    try{if(socket && socket.readyState<2)socket.close(code,reason);}catch(_){}
  };
  const disconnect=()=>{
    if(closed)return;
    closed=true;
    safeClose(server);safeClose(remote);
  };
  const maxAge=setTimeout(disconnect,60*60*1000); // gateway session max one hour
  const stop=()=>{clearTimeout(maxAge);disconnect();};

  // Authenticate to Railway from inside the Worker, never from browser code.
  remote.addEventListener('message',event=>{
    if(closed)return;
    const payload=typeof event.data==='string'?event.data:'';
    if(payload.length>65536){stop();return;}
    let data;
    try{data=JSON.parse(payload);}catch(_){stop();return;}
    if(data.type==='error'){stop();return;}
    if(data.type==='ready')ready=true;
    if(['ready','output','info'].includes(data.type)){
      try{server.send(payload);}catch(_){stop();}
    }
  });
  remote.addEventListener('close',stop);
  remote.addEventListener('error',stop);
  server.addEventListener('message',event=>{
    if(!ready||closed)return;
    if(typeof event.data!=='string'||event.data.length>8192){stop();return;}
    let data;
    try{data=JSON.parse(event.data);}catch(_){return;}
    if(data?.type==='input'&&typeof data.data==='string'&&data.data.length<=4096)
      remote.send(JSON.stringify({type:'input',data:data.data}));
    else if(data?.type==='resize'&&Number.isInteger(data.cols)&&Number.isInteger(data.rows))
      remote.send(JSON.stringify({type:'resize',cols:Math.max(10,Math.min(240,data.cols)),
        rows:Math.max(5,Math.min(80,data.rows))}));
  });
  server.addEventListener('close',stop);
  server.addEventListener('error',stop);

  try{remote.send(JSON.stringify({type:'auth',password:env.TERMINAL_RAILWAY_PASSWORD}));}
  catch(_){stop();return json({error:'Terminal service authentication failed'},503);}
  return new Response(null,{status:101,webSocket:client,headers:{
    'Sec-WebSocket-Protocol':'wormstar-terminal',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'
  }});
}

export const terminalGatewayInternals={validTicket,secretsReady};
