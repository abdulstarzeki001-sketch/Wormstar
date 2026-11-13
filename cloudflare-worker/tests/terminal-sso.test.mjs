import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTerminalTicket,openTerminalWebSocket,terminalGatewayInternals} from '../terminal-gateway.js';
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
  close(){this.readyState=3;this.emit('close');}
}

test('terminal HTML reuses AI Lab owner login without a second password form',()=>{
  assert.match(TERMINAL_HTML,/Linux Terminal/);
  assert.match(TERMINAL_HTML,/sessionStorage\.getItem\('wormstar-access'\)/);
  assert.match(TERMINAL_HTML,/\/api\/auth/);
  assert.match(TERMINAL_HTML,/\/api\/terminal\/session/);
  assert.match(TERMINAL_HTML,/\/api\/terminal\/ws/);
  assert.doesNotMatch(TERMINAL_HTML,/type="password"|id="pw"|id="password"/);
  assert.doesNotMatch(TERMINAL_HTML,/terminal-production-fb16bd35\.up\.railway\.app/);
  const match=TERMINAL_HTML.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match);
  assert.doesNotThrow(()=>new Function(match[1]));
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

test('Core routes preserve owner allow and do not expose Railway password in HTML',()=>{
 const core=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../redesign-ui.js',import.meta.url),'utf8');
 assert.match(core,/createTerminalTicket\(request,env,await allow\(request,env\)\)/);
 assert.match(core,/openTerminalWebSocket\(request,env\)/);
 assert.match(core,/if\(request.method==='GET'&&\['\/terminal','\/terminal\/'\]\.includes\(url.pathname\)\)/);
 assert.match(ui,/href="\/terminal"/);
 assert.match(core,/frame-ancestors 'none'/);
 assert.doesNotMatch(ui,/TERMINAL_RAILWAY_PASSWORD|TERMINAL_TICKET_SECRET/);
 assert.doesNotMatch(TERMINAL_HTML,/TERMINAL_RAILWAY_PASSWORD|TERMINAL_TICKET_SECRET/);
});
