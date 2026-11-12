import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../terminal.js', import.meta.url), 'utf8');
function fixture(deferPlan=false) {
  const ids=['wsTermConnect','wsTermEndpoint','wsTermToken','wsTermStatus','wsTermInput','wsTermSend','wsTermDisconnect','wsTermPlan','wsTermApprove','wsTermOutput','wsTermForm','wsTermGoal','wsTermExplanation','wsTermCommand','wsTermResult'];
  const elements=Object.fromEntries(ids.map(id=>[id,{value:'',textContent:'',dataset:{},disabled:false,addEventListener(event,fn){this[event]=fn},focus(){}}]));
  const requests=[], sockets=[];
  let releasePlan;
  class MockWebSocket {
    static OPEN=1;
    constructor(url,protocols){this.url=url;this.protocols=protocols;this.readyState=0;this.sent=[];sockets.push(this)}
    send(data){this.sent.push(JSON.parse(data))}
    close(){this.readyState=3}
    open(){this.readyState=1;this.onopen()}
  }
  const fetch=async (url,opts)=>{
    requests.push({url,opts});
    let value={container_running:true,capabilities:['terminal','plan','execute']};
    if(url.endsWith('/api/agent/plan')){
      value={done:false,explanation:'خطوة',argv:['pwd'],approval_id:'fake-approval-id-for-test-only'};
      if(deferPlan)return new Promise(resolve=>{releasePlan=()=>resolve({ok:true,json:async()=>value})});
    }
    if(url.endsWith('/api/agent/execute'))value={exit_code:0,output:'/workspace',truncated:false};
    return {ok:true,json:async()=>value};
  };
  vm.runInNewContext(source,{document:{getElementById:id=>elements[id]},location:{hostname:'sentinel.example'},WebSocket:MockWebSocket,URL,fetch});
  return {elements,requests,sockets,releasePlan:()=>releasePlan()};
}

test('private terminal connects and requires a separate approval for AI steps',async()=>{
  const {elements:e,requests,sockets}=fixture();
  e.wsTermEndpoint.value='https://terminal.example';
  e.wsTermToken.value='abcdefghijklmnopqrstuvwxyz123456';
  await e.wsTermConnect.click();
  assert.equal(e.wsTermToken.value,'');
  assert.equal(sockets.length,1);
  assert.equal(sockets[0].url,'wss://terminal.example/ws/terminal');
  sockets[0].open();
  e.wsTermInput.value='pwd'; e.wsTermForm.submit({preventDefault(){}});
  assert.deepEqual(sockets[0].sent[0],{type:'input',data:'pwd\n'});
  e.wsTermGoal.value='أظهر المجلد';
  await e.wsTermPlan.click();
  assert.equal(requests.filter(x=>x.url.endsWith('/api/agent/execute')).length,0);
  assert.equal(e.wsTermApprove.disabled,false);
  await e.wsTermApprove.click();
  assert.equal(requests.filter(x=>x.url.endsWith('/api/agent/execute')).length,1);
  assert.match(e.wsTermResult.textContent,/\/workspace/);
});

test('invalid endpoint is rejected before a token is transmitted',async()=>{
  const {elements:e,requests}=fixture();
  e.wsTermEndpoint.value='https://user:password@terminal.example';
  e.wsTermToken.value='abcdefghijklmnopqrstuvwxyz123456';
  await e.wsTermConnect.click();
  assert.equal(requests.length,0);
  assert.match(e.wsTermStatus.textContent,/فشل الاتصال/);
});

test('a late AI plan is discarded after disconnect',async()=>{
  const f=fixture(true), e=f.elements;
  e.wsTermEndpoint.value='https://terminal.example'; e.wsTermToken.value='abcdefghijklmnopqrstuvwxyz123456';
  await e.wsTermConnect.click(); f.sockets[0].open();
  e.wsTermGoal.value='show path';
  const waiting=e.wsTermPlan.click();
  e.wsTermDisconnect.click();
  f.releasePlan(); await waiting;
  assert.equal(e.wsTermApprove.disabled,true);
  assert.equal(e.wsTermCommand.textContent,'');
});
