import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleKaliTerminalBridge} from '../kali-terminal-bridge.js';

const endpoint='https://wormstar-ai-lab.abdulstarzeki001.workers.dev/api/integrations/kali/terminal/';
const secret='unit-only-kali-pages-bridge-secret-at-least-32-chars';
const env={
 KALI_TERMINAL_BRIDGE_SECRET:secret,
 TERMINAL_TICKET_SECRET:'unit-only-terminal-ticket-secret-at-least-32-chars',
 TERMINAL_RAILWAY_PASSWORD:'test-only-password-123456'
};
function request(path,method='POST',headers={}){
 return new Request(endpoint+path,{method,headers});
}

test('Pages bridge never gives a ticket without private server-side credential',async()=>{
 const missing=await handleKaliTerminalBridge(request('session'),env);
 assert.equal(missing.status,403);
 const wrong=await handleKaliTerminalBridge(request('session','POST',{'X-Kali-Terminal-Bridge':'wrong'}),env);
 assert.equal(wrong.status,403);
 const missingConfig=await handleKaliTerminalBridge(request('session','POST',{'X-Kali-Terminal-Bridge':secret}),{});
 assert.equal(missingConfig.status,403);
 const wrongMethod=await handleKaliTerminalBridge(request('session','GET',{'X-Kali-Terminal-Bridge':secret}),env);
 assert.equal(wrongMethod.status,405);
 const unknown=await handleKaliTerminalBridge(request('password','POST',{'X-Kali-Terminal-Bridge':secret}),env);
 assert.equal(unknown.status,404);
});

test('Pages bridge issues a short-lived HMAC ticket but never emits credentials',async()=>{
 const response=await handleKaliTerminalBridge(request('session','POST',{'X-Kali-Terminal-Bridge':secret}),env);
 assert.equal(response.status,200);
 const data=await response.json();
 assert.match(data.ticket,/^\d{13}\.[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{43}$/);
 assert.equal(data.expiresInSeconds,20);
 assert.equal(data.wsPath,'/api/terminal/ws');
 assert.equal(JSON.stringify(data).includes(secret),false);
 assert.equal(JSON.stringify(data).includes(env.TERMINAL_RAILWAY_PASSWORD),false);
});

test('Pages bridge forwards only fixed, valid WebSocket protocol with restricted origin',async()=>{
 const good=await (await handleKaliTerminalBridge(request('session','POST',{'X-Kali-Terminal-Bridge':secret}),env)).json();
 const invalid=await handleKaliTerminalBridge(request('ws','GET',{
   'X-Kali-Terminal-Bridge':secret,
   Upgrade:'websocket',
   'Sec-WebSocket-Protocol':'attacker, ticket.'+good.ticket
 }),env);
 assert.equal(invalid.status,401);
 let received=null;
 const success=await handleKaliTerminalBridge(request('ws','GET',{
   'X-Kali-Terminal-Bridge':secret,
   Upgrade:'websocket',
   'Sec-WebSocket-Protocol':'wormstar-terminal, ticket.'+good.ticket
 }),env,{openWebSocket:(request,providedEnv)=>{
   received={request,providedEnv};
   return new Response('gateway hooked',{status:200});
 }});
 assert.equal(success.status,200);
 assert.ok(received);
 assert.equal(received.request.headers.get('Origin'),'https://wormstar-ai-lab.abdulstarzeki001.workers.dev');
 assert.equal(received.request.headers.get('X-Kali-Terminal-Bridge'),null);
 assert.equal(received.request.headers.get('Upgrade'),'websocket');
 assert.equal(received.providedEnv,env);
});

test('Wormstar Worker dispatches only its explicit private bridge prefix',()=>{
 const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 assert.match(source,/import \{handleKaliTerminalBridge\} from '\.\/kali-terminal-bridge\.js'/);
 assert.match(source,/if\(url\.pathname\.startsWith\('\/api\/integrations\/kali\/terminal\/'\)\)/);
 assert.match(source,/return handleKaliTerminalBridge\(request,env\)/);
});
