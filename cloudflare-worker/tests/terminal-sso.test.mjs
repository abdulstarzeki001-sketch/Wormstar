import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTerminalTicket,openTerminalWebSocket,diagnoseTerminalGateway,terminalGatewayInternals} from '../terminal-gateway.js';
import {TERMINAL_HTML} from '../terminal-page.js';

const origin='https://wormstar-ai-lab.abdulstarzeki001.workers.dev';
const goodEnv={
  TERMINAL_TICKET_SECRET:'a-fake-test-only-hmac-secret-that-is-at-least-32-chars',
  TERMINAL_RAILWAY_PASSWORD:'mock-password-only-for-unit-tests'
};
const request=(path,method='POST',headers={})=>
  new Request(origin+path,{method,headers:{Origin:origin,...headers}});
let fakeAuthHeaders={Authorization:'Bearer demo-owner-token'};

class Socket {
  constructor(){this.readyState=1;this.sent=[];this.handlers={};this.accepted=false;}
  accept(){this.accepted=true;}
  addEventListener(type,fn){(this.handlers[type] ||= []).push(fn);}
  emit(type,data){for(const fn of this.handlers[type]||[])fn({data});}
  send(value){this.sent.push(value);}
  close(code=1000,reason=''){this.closedWith={code,reason};this.readyState=3;this.emit('close');}
}

test('terminal HTML reuses AI Lab owner login without a second password form',()=>{
  assert.match(TERMINAL_HTML,/Linux Terminal/);
  assert.match(TERMINAL_HTML,/sessionStorage\.getItem\('wormstar-access'\)/);
  assert.match(TERMINAL_HTML,/\/api\/auth/);
  assert.match(TERMINAL_HTML,/\/api\/terminal\/session/);
  assert.match(TERMINAL_HTML,/\/api\/terminal\/ws/);
  assert.match(TERMINAL_HTML,/\/api\/terminal\/diagnose/);
  assert.match(TERMINAL_HTML,/RAILWAY_AUTH_REJECTED/);
  assert.doesNotMatch(TERMINAL_HTML,/type="password"|id="pw"|id="password"/);
  assert.doesNotMatch(TERMINAL_HTML,/terminal-production-fb16bd35\.up\.railway\.app/);
  const match=TERMINAL_HTML.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match);
  assert.doesNotThrow(()=>new Function(match[1]));
});

test('iPhone console removes intro text and uses one slim six-button toolbar',()=>{
  const mobile=TERMINAL_HTML.slice(TERMINAL_HTML.indexOf('/* Full-height mobile terminal:'));
  assert.ok(mobile.includes('@media(max-width:600px)'));
  assert.ok(mobile.includes('.buttons{display:grid;grid-template-columns:repeat(6,minmax(0,1fr))'));
  assert.ok(mobile.includes('.wrap{height:100dvh;'));
  assert.ok(mobile.includes('#output{flex:1 1 0;min-height:0;max-height:none;height:auto;'));
  assert.ok(mobile.includes('.term-meta .status'));
  assert.doesNotMatch(TERMINAL_HTML,/<section class="hero">/);
  assert.doesNotMatch(TERMINAL_HTML,/Linux Terminal — داخل Wormstar/);
  assert.doesNotMatch(TERMINAL_HTML,/ترمنال بجلسة المالك، بلا كلمة مرور إضافية/);
  assert.equal(TERMINAL_HTML.split('id="status"').length,2);
  assert.ok(TERMINAL_HTML.indexOf('id="status"')>TERMINAL_HTML.indexOf('<div class="term-meta">'));
  assert.ok(TERMINAL_HTML.includes('<details id="warning">'));
  for(const id of ['connect','diagnose','interrupt','copy','clear','disconnect']){
    assert.ok(TERMINAL_HTML.includes('id="'+id+'"'));
    assert.ok(TERMINAL_HTML.includes('aria-label='), 'buttons remain labelled');
  }
  for(const id of ['command','send','aiToggle']){
    assert.ok(TERMINAL_HTML.includes('id="'+id+'"'));
  }
  assert.ok(TERMINAL_HTML.includes("el('connect').addEventListener('click',connect)"));
  assert.ok(TERMINAL_HTML.includes("el('diagnose').addEventListener('click',diagnose)"));
  assert.ok(TERMINAL_HTML.includes("el('disconnect').addEventListener('click'"));
});

test('iPhone app viewport prevents zoom and sideways page scrolling',()=>{
  assert.ok(TERMINAL_HTML.includes('width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover'));
  const locked=TERMINAL_HTML.slice(TERMINAL_HTML.indexOf('/* Fixed iPhone app viewport:'));
  assert.ok(locked.includes('html,body{max-width:100%;overflow-x:hidden}'));
  assert.ok(locked.includes('touch-action:pan-y'));
  assert.ok(locked.includes('overflow:hidden;overscroll-behavior:none;'));
  assert.ok(locked.includes('height:var(--terminal-visual-height,100dvh);min-height:0;'));
  assert.ok(locked.includes('#output{'));
  assert.ok(locked.includes('overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;'));
  assert.ok(locked.includes('#command{min-width:0;width:0;flex:1 1 0;font-size:16px'));
  assert.ok(locked.includes('#aiPrompt{font-size:16px'));
  assert.ok(TERMINAL_HTML.includes('window.visualViewport.addEventListener(\'resize\',syncVisibleViewport'));
  assert.ok(TERMINAL_HTML.includes("window.addEventListener('resize',syncVisibleViewport"));
  assert.ok(TERMINAL_HTML.includes('syncVisibleViewport();'));
  // Only the terminal viewport changes; the authenticated shell/AI events stay wired.
  for (const id of ['connect','diagnose','interrupt','copy','clear','disconnect','command','send']){
    assert.ok(TERMINAL_HTML.includes('id="'+id+'"'));
  }
});

test('owner must be verified before issuing a short-lived gateway ticket',async()=>{
  assert.equal((await createTerminalTicket(request('/api/terminal/session'),goodEnv,false)).status,401);
  assert.equal((await createTerminalTicket(request('/api/terminal/session'),{},true)).status,503);
  assert.equal((await createTerminalTicket(request('/api/terminal/session','GET'),goodEnv,true)).status,405);
  assert.equal((await createTerminalTicket(request('/api/terminal/session','POST',{Origin:'https://attacker.example'}),goodEnv,true)).status,403);
  const res=await createTerminalTicket(request('/api/terminal/session','POST',fakeAuthHeaders),goodEnv,true);
  assert.equal(res.status,200);
  assert.match(res.headers.get('Cache-Control'),/no-store/);
  const data=await res.json();
  assert.match(data.ticket,/^\d{13}\.[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(data.expiresInSeconds,20);
  assert.equal(data.wsPath,'/api/terminal/ws');
  assert.equal(await terminalGatewayInternals.validTicket(data.ticket,goodEnv.TERMINAL_TICKET_SECRET),true);
  const broken=data.ticket.slice(0,-1)+(data.ticket.endsWith('A')?'B':'A');
  assert.equal(await terminalGatewayInternals.validTicket(broken,goodEnv.TERMINAL_TICKET_SECRET),false);
  assert.equal(await terminalGatewayInternals.validTicket(data.ticket,goodEnv.TERMINAL_TICKET_SECRET,Date.now()+40_000),false);
  assert.ok(!JSON.stringify(data).includes(goodEnv.TERMINAL_RAILWAY_PASSWORD));
});

test('gateway identifies invalid secrets to the verified owner without disclosing any value',async()=>{
  const bad={TERMINAL_TICKET_SECRET:'too-short',
    TERMINAL_RAILWAY_PASSWORD:'tiny'};
  const rejected=await createTerminalTicket(request('/api/terminal/session'),bad,true);
  assert.equal(rejected.status,503);
  const body=await rejected.json();
  assert.equal(body.code,'TERMINAL_CONFIGURATION_INVALID');
  assert.deepEqual(body.invalidSecrets,
    ['TERMINAL_TICKET_SECRET','TERMINAL_RAILWAY_PASSWORD']);
  assert.equal(JSON.stringify(body).includes(bad.TERMINAL_TICKET_SECRET),false);
  assert.equal(JSON.stringify(body).includes(bad.TERMINAL_RAILWAY_PASSWORD),false);
  assert.equal((await createTerminalTicket(request('/api/terminal/session'),bad,false)).status,401);
  const missingSigning={...goodEnv,TERMINAL_TICKET_SECRET:'short'};
  assert.deepEqual((await (await createTerminalTicket(
    request('/api/terminal/session'),missingSigning,true)).json()).invalidSecrets,
    ['TERMINAL_TICKET_SECRET']);
  // Railway accepts 12-character passwords. The gateway must match its contract.
  const railwayMinimum={...goodEnv,TERMINAL_RAILWAY_PASSWORD:'abcdefghijkl'};
  assert.equal((await createTerminalTicket(
    request('/api/terminal/session'),railwayMinimum,true)).status,200);
  const insufficientPassword={...goodEnv,TERMINAL_RAILWAY_PASSWORD:'12345678901'};
  assert.deepEqual((await (await createTerminalTicket(
    request('/api/terminal/session'),insufficientPassword,true)).json()).invalidSecrets,
    ['TERMINAL_RAILWAY_PASSWORD']);
});

test('WebSocket denies missing, stale, forged, and cross-origin credentials',async()=>{
  const mint=await createTerminalTicket(request('/api/terminal/session'),goodEnv,true);
  const ticket=(await mint.json()).ticket;
  const validHeader={'Upgrade':'websocket','Sec-WebSocket-Protocol':'wormstar-terminal, ticket.'+ticket};
  const cases=[
    {req:request('/api/terminal/ws','GET',{'Sec-WebSocket-Protocol':validHeader['Sec-WebSocket-Protocol']}),status:426},
    {req:request('/api/terminal/ws','GET',{'Upgrade':'websocket'}),status:401},
    {req:request('/api/terminal/ws','GET',{...validHeader,Origin:'https://evil.invalid'}),status:403},
    {req:request('/api/terminal/ws','GET',{...validHeader,'Sec-WebSocket-Protocol':'wormstar-terminal, ticket.fake'}),status:401},
  ];
  for(const {req,status} of cases){
    const res=await openTerminalWebSocket(req,goodEnv);
    assert.equal(res.status,status);
  }
  assert.equal((await openTerminalWebSocket(request('/api/terminal/ws','POST',validHeader),goodEnv)).status,405);
  const noConfig=await openTerminalWebSocket(request('/api/terminal/ws','GET',validHeader),{});
  assert.equal(noConfig.status,503);
  assert.equal(JSON.stringify(await noConfig.json()).includes('invalidSecrets'),false);
});

test('gateway authenticates Railway only server-side and filters browser messages',async()=>{
  const minted=await createTerminalTicket(request('/api/terminal/session'),goodEnv,true);
  const ticket=(await minted.json()).ticket;
  const remote=new Socket(),client=new Socket(),server=new Socket();
  let connectedTo='',headersSeen;
  const result=await openTerminalWebSocket(request('/api/terminal/ws','GET',{
    Upgrade:'websocket',
    'Sec-WebSocket-Protocol':'wormstar-terminal, ticket.'+ticket
  }),goodEnv,{
    fetchBackend:async(url,options)=>{connectedTo=url;headersSeen=options.headers;return {status:101,webSocket:remote};},
    createPair:()=>({0:client,1:server}),
    makeUpgradeResponse:(sock,headers)=>({status:101,webSocket:sock,headers})
  });
  assert.equal(result.status,101);
  assert.equal(result.webSocket,client);
  assert.equal(result.headers['Sec-WebSocket-Protocol'],'wormstar-terminal');
  assert.equal(connectedTo,'https://terminal-production-fb16bd35.up.railway.app/ws');
  assert.equal(headersSeen.Origin,'https://terminal-production-fb16bd35.up.railway.app');
  assert.deepEqual(JSON.parse(remote.sent[0]),{type:'auth',password:goodEnv.TERMINAL_RAILWAY_PASSWORD});
  // The browser cannot submit shell input before Railway has verified the server-side password.
  server.emit('message',JSON.stringify({type:'input',data:'echo too-soon\n'}));
  assert.equal(remote.sent.length,1);
  remote.emit('message',JSON.stringify({type:'ready'}));
  assert.deepEqual(JSON.parse(server.sent[0]),{type:'ready'});
  server.emit('message',JSON.stringify({type:'input',data:'echo allowed\n'}));
  assert.deepEqual(JSON.parse(remote.sent[1]),{type:'input',data:'echo allowed\n'});
  server.emit('message',JSON.stringify({type:'auth',password:'injected'}));
  assert.equal(remote.sent.length,2);
  server.emit('message',JSON.stringify({type:'resize',cols:400,rows:300}));
  assert.deepEqual(JSON.parse(remote.sent[2]),{type:'resize',cols:240,rows:80});
  remote.emit('message',JSON.stringify({type:'output',data:'hello'}));
  assert.deepEqual(JSON.parse(server.sent[1]),{type:'output',data:'hello'});
  assert.ok(!server.sent.some(x=>x.includes(goodEnv.TERMINAL_RAILWAY_PASSWORD)));
  server.close();
});

test('private origin header is forwarded only server-side to Railway health and WebSocket',async()=>{
  const originSecret='unit-only-origin-secret-0123456789-abcdefghijkl';
  const env={...goodEnv,TERMINAL_EDGE_ORIGIN_SECRET:originSecret};
  const ticket=(await (await createTerminalTicket(request('/api/terminal/session'),env,true)).json()).ticket;
  const remote=new Socket(),client=new Socket(),server=new Socket();
  let headersSeen;
  const result=await openTerminalWebSocket(request('/api/terminal/ws','GET',{
    Upgrade:'websocket','Sec-WebSocket-Protocol':'wormstar-terminal, ticket.'+ticket
  }),env,{
    fetchBackend:async(_url,opts)=>{headersSeen=opts.headers;return {status:101,webSocket:remote};},
    createPair:()=>({0:client,1:server}),
    makeUpgradeResponse:(socket,headers)=>({status:101,webSocket:socket,headers})
  });
  assert.equal(result.status,101);
  assert.equal(headersSeen['X-Star-Edge-Origin'],originSecret);
  assert.equal(result.headers['X-Star-Edge-Origin'],undefined);
  assert.equal(JSON.stringify(await (await createTerminalTicket(request('/api/terminal/session'),env,true)).json()).includes(originSecret),false);
  server.close();
  let healthHeaders;
  const diagnosis=await diagnoseTerminalGateway(request('/api/terminal/diagnose'),env,true,{
    fetchBackend:async(url,opts)=>{
      if(url.endsWith('/health')){healthHeaders=opts.headers;return {ok:false,status:503};}
      throw Error('unexpected websocket');
    }
  });
  assert.equal(diagnosis.status,503);
  assert.equal(healthHeaders['X-Star-Edge-Origin'],originSecret);
  assert.equal((await diagnosis.text()).includes(originSecret),false);
});

test('STAR AI chat is owner-ticket gated, advisory, bounded and never forwarded before Railway auth',async()=>{
  assert.match(TERMINAL_HTML,/id="aiToggle"/);
  assert.match(TERMINAL_HTML,/id="aiForm"/);
  assert.match(TERMINAL_HTML,/id="aiPrompt"/);
  assert.match(TERMINAL_HTML,/textContent=String\(text/);
  assert.doesNotMatch(TERMINAL_HTML,/AI_GATEWAY_TOKEN|AI_API_KEY/);
  const ticket=(await (await createTerminalTicket(request('/api/terminal/session'),goodEnv,true)).json()).ticket;
  const remote=new Socket(),client=new Socket(),server=new Socket();
  const ws=await openTerminalWebSocket(request('/api/terminal/ws','GET',{
    Upgrade:'websocket','Sec-WebSocket-Protocol':'wormstar-terminal, ticket.'+ticket
  }),goodEnv,{
    fetchBackend:async()=>({status:101,webSocket:remote}),
    createPair:()=>({0:client,1:server}),
    makeUpgradeResponse:(sock,headers)=>({status:101,webSocket:sock,headers})
  });
  assert.equal(ws.status,101);
  server.emit('message',JSON.stringify({type:'ai_chat',prompt:'pre-auth'}));
  server.emit('message',JSON.stringify({type:'ai_check'}));
  assert.equal(remote.sent.length,1); // backend password only
  remote.emit('message',JSON.stringify({type:'ai_status',ready:true,reason:'GATEWAY_READY'}));
  assert.equal(server.sent.length,0); // auth not completed
  remote.emit('message',JSON.stringify({type:'ready',aiEnabled:true}));
  assert.deepEqual(JSON.parse(server.sent[0]),{type:'ready',aiEnabled:true});
  server.emit('message',JSON.stringify({type:'ai_check'}));
  server.emit('message',JSON.stringify({type:'ai_chat',prompt:'اشرح الأمر uname -a'}));
  server.emit('message',JSON.stringify({type:'ai_chat',prompt:' '}));
  server.emit('message',JSON.stringify({type:'ai_chat',prompt:'x'.repeat(4001)}));
  server.emit('message',JSON.stringify({type:'auth',password:'browser-bypass'}));
  assert.deepEqual(remote.sent.slice(1).map(v=>JSON.parse(v)),[
    {type:'ai_check'},{type:'ai_chat',prompt:'اشرح الأمر uname -a'}
  ]);
  remote.emit('message',JSON.stringify({type:'ai_status',ready:true,reason:'GATEWAY_READY',secret:'never-forward'}));
  remote.emit('message',JSON.stringify({type:'ai_busy'}));
  remote.emit('message',JSON.stringify({type:'ai_reply',text:'SAFE RESPONSE',secret:'never-forward'}));
  remote.emit('message',JSON.stringify({type:'ai_error',message:'AI_RATE_LIMIT',secret:'never-forward'}));
  remote.emit('message',JSON.stringify({type:'secret',value:'never-forward'}));
  const ai=server.sent.slice(1).map(s=>JSON.parse(s));
  assert.deepEqual(ai,[
    {type:'ai_status',ready:true,reason:'GATEWAY_READY'},
    {type:'ai_busy'},
    {type:'ai_reply',text:'SAFE RESPONSE'},
    {type:'ai_error',message:'AI_RATE_LIMIT'}
  ]);
  assert.ok(!server.sent.join('').includes('never-forward'));
  assert.ok(!server.sent.join('').includes(goodEnv.TERMINAL_RAILWAY_PASSWORD));
  server.close();
});

test('Core routes preserve owner allow and do not expose Railway password in HTML',()=>{
 const core=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../redesign-ui.js',import.meta.url),'utf8');
 assert.match(core,/createTerminalTicket\(request,env,await allow\(request,env\)\)/);
 assert.match(core,/openTerminalWebSocket\(request,env\)/);
 assert.match(core,/diagnoseTerminalGateway\(request,env,await allow\(request,env\)\)/);
 assert.match(core,/if\(request.method==='GET'&&\['\/terminal','\/terminal\/'\]\.includes\(url.pathname\)\)/);
 assert.match(ui,/href="\/terminal\/"/);
 assert.match(ui,/href="\/suite\/"/);
 assert.match(ui,/href="\/osint\/"/);
 assert.match(ui,/href="\/audit\/"/);
 assert.doesNotMatch(ui,/href="https:\/\/terminal-production-fb16bd35\.up\.railway\.app\/"/);
 assert.match(core,/frame-ancestors 'none'/);
 assert.doesNotMatch(ui,/TERMINAL_RAILWAY_PASSWORD|TERMINAL_TICKET_SECRET/);
 assert.doesNotMatch(TERMINAL_HTML,/TERMINAL_RAILWAY_PASSWORD|TERMINAL_TICKET_SECRET/);
});


test('authenticated diagnostics distinguishes health, handshake and rejected password',async()=>{
  assert.equal((await diagnoseTerminalGateway(request('/api/terminal/diagnose'),goodEnv,false)).status,401);
  assert.equal((await diagnoseTerminalGateway(request('/api/terminal/diagnose','GET'),goodEnv,true)).status,405);
  assert.equal((await diagnoseTerminalGateway(
    request('/api/terminal/diagnose','POST',{Origin:'https://evil.example'}),goodEnv,true)).status,403);
  const badSecrets=await diagnoseTerminalGateway(request('/api/terminal/diagnose'),{},true);
  assert.equal(badSecrets.status,503);
  const badHealth=await diagnoseTerminalGateway(request('/api/terminal/diagnose'),goodEnv,true,{
    fetchBackend:async()=>({ok:false})
  });
  assert.equal((await badHealth.json()).code,'RAILWAY_HEALTH_FAILED');
  const badUpgrade=await diagnoseTerminalGateway(request('/api/terminal/diagnose'),goodEnv,true,{
    fetchBackend:async url=>url.endsWith('/health')
      ? {ok:true}:{status:400,webSocket:null}
  });
  assert.equal((await badUpgrade.json()).code,'BACKEND_WS_UPGRADE_REJECTED');
  for(const success of [true,false]){
    const upstream=new Socket();
    upstream.send=value=>{
      upstream.sent.push(value);
      const msg=JSON.parse(value);
      assert.equal(msg.type,'auth');
      if(success)upstream.emit('message',JSON.stringify({type:'ready'}));
      else upstream.emit('message',JSON.stringify({type:'error',message:'UNTRUSTED_SECRET_INJECTION'}));
    };
    const r=await diagnoseTerminalGateway(request('/api/terminal/diagnose'),goodEnv,true,{
      fetchBackend:async url=>url.endsWith('/health')
        ? {ok:true}:{status:101,webSocket:upstream}
    });
    const body=await r.json();
    assert.equal(body.stage,'authentication');
    assert.equal(body.code,success?'READY':'RAILWAY_AUTH_REJECTED');
    assert.equal(r.status,success?200:503);
    assert.equal(JSON.stringify(body).includes(goodEnv.TERMINAL_RAILWAY_PASSWORD),false);
    assert.equal(JSON.stringify(body).includes('UNTRUSTED_SECRET_INJECTION'),false);
    assert.equal(upstream.closedWith.code,1000);
  }
});

test('Railway authentication rejection reaches Safari with explicit close code and no secrets',async()=>{
  const minted=await createTerminalTicket(request('/api/terminal/session'),goodEnv,true);
  const ticket=(await minted.json()).ticket;
  const remote=new Socket(),client=new Socket(),server=new Socket();
  const result=await openTerminalWebSocket(request('/api/terminal/ws','GET',{
    Upgrade:'websocket','Sec-WebSocket-Protocol':'wormstar-terminal, ticket.'+ticket
  }),goodEnv,{
    fetchBackend:async()=>({status:101,webSocket:remote}),
    createPair:()=>({0:client,1:server}),
    makeUpgradeResponse:(s,h)=>({status:101,webSocket:s,headers:h})
  });
  assert.equal(result.status,101);
  assert.deepEqual(JSON.parse(remote.sent[0]),{
    type:'auth',password:goodEnv.TERMINAL_RAILWAY_PASSWORD
  });
  remote.emit('message',JSON.stringify({type:'error',message:'UNTRUSTED_SECRET_INJECTION'}));
  assert.deepEqual(server.closedWith,{code:1008,reason:'RAILWAY_AUTH_REJECTED'});
  assert.ok(server.sent.some(v=>JSON.parse(v).code==='RAILWAY_AUTH_REJECTED'));
  assert.ok(!server.sent.some(v=>v.includes('UNTRUSTED_SECRET_INJECTION')));
  assert.ok(!server.sent.some(v=>v.includes(goodEnv.TERMINAL_RAILWAY_PASSWORD)));
});

test('Railway close before ready and after ready are different statuses',async()=>{
  for(const started of [false,true]){
    const minted=await createTerminalTicket(request('/api/terminal/session'),goodEnv,true);
    const ticket=(await minted.json()).ticket;
    const remote=new Socket(),client=new Socket(),server=new Socket();
    await openTerminalWebSocket(request('/api/terminal/ws','GET',{
      Upgrade:'websocket','Sec-WebSocket-Protocol':'wormstar-terminal, ticket.'+ticket
    }),goodEnv,{
      fetchBackend:async()=>({status:101,webSocket:remote}),
      createPair:()=>({0:client,1:server}),
      makeUpgradeResponse:(sock,headers)=>({status:101,webSocket:sock,headers})
    });
    if(started)remote.emit('message',JSON.stringify({type:'ready'}));
    remote.close(1000,'backend closed');
    assert.deepEqual(server.closedWith,started
      ? {code:1000,reason:'RAILWAY_CLOSED'}
      : {code:1011,reason:'RAILWAY_CLOSED_BEFORE_READY'});
  }
});

test('Cloudflare-compatible manual redirect is enforced for health and WebSocket upstreams',async()=>{
  const modes=[];
  const upgraded=await createTerminalTicket(request('/api/terminal/session'),goodEnv,true);
  const ticket=(await upgraded.json()).ticket;
  const wsRequest=request('/api/terminal/ws','GET',{
    Upgrade:'websocket',
    'Sec-WebSocket-Protocol':'wormstar-terminal, ticket.'+ticket
  });
  const redirection=async(url,options)=>{
    modes.push({url,redirect:options.redirect});
    return {ok:false,status:302,webSocket:null};
  };
  const health=await diagnoseTerminalGateway(request('/api/terminal/diagnose'),goodEnv,true,{
    fetchBackend:redirection
  });
  assert.equal(health.status,503);
  assert.equal((await health.json()).code,'RAILWAY_HEALTH_FAILED');
  const socket=await openTerminalWebSocket(wsRequest,goodEnv,{
    fetchBackend:redirection
  });
  assert.equal(socket.status,503);
  assert.equal((await socket.json()).error,'Terminal service rejected connection');
  const handshake=await diagnoseTerminalGateway(request('/api/terminal/diagnose'),goodEnv,true,{
    fetchBackend:async(url,options)=>{
      modes.push({url,redirect:options.redirect});
      return url.endsWith('/health')
        ? {ok:true,status:200}
        : {ok:false,status:302,webSocket:null};
    }
  });
  assert.equal(handshake.status,503);
  assert.equal((await handshake.json()).code,'BACKEND_WS_UPGRADE_REJECTED');
  assert.equal(modes.length,4);
  assert.ok(modes.every(v=>v.redirect==='manual'));
  assert.ok(modes.every(v=>v.url.startsWith('https://terminal-production-fb16bd35.up.railway.app/')));
});
