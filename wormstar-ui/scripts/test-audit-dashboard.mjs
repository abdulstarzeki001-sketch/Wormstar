import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker from '../worker.js';

const origin = 'https://sentinel.example';
let coreCalls = 0;
const env = { CORE: { async fetch() { coreCalls++; throw Error('Audit must not call Core'); } } };
const request = path => worker.fetch(new Request(origin + path), env);
const response = await request('/audit/');
const html = await response.text();
const sample = await (await request('/audit/api/sample')).json();

class Element {
  constructor() { this.children=[]; this.listeners={}; this.value=''; this.parentElement={}; this._text=''; }
  set textContent(value) { this._text=String(value); this.children=[]; }
  get textContent() { return this._text+this.children.map(c=>typeof c==='string'?c:c.textContent).join(''); }
  get firstChild() { return this.children[0]||null; }
  removeChild(child) { this.children.splice(this.children.indexOf(child),1); }
  append(...children) { this.children.push(...children); }
  addEventListener(name, fn) { this.listeners[name]=fn; }
  getBoundingClientRect() { return {width:600,height:230}; }
  getContext() { return new Proxy({}, {get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)}); }
  setPointerCapture() {}
  click() { this.listeners.click?.({}); }
}

function renderDashboard() {
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
  elements.filter.value='all';
  const requests=[];
  const document={getElementById:id=>elements[id],createElement:()=>new Element()};
  const window={devicePixelRatio:1,addEventListener(){}};
  class ResizeObserver { observe() {} }
  const fetch=async url=>{ requests.push(url); return {ok:true,json:async()=>structuredClone(sample)}; };
  const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'The audit dashboard script must exist');
  vm.runInNewContext(script,{document,window,ResizeObserver,fetch,console,Blob,URL,setTimeout});
  return {elements,requests};
}

test('same-origin audit renders real sample counts without Core access', async()=>{
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.match(html,/fetch\("\/audit\/api\/sample"/);
  assert.match(html,/خريطة نتائج التقرير/);
  const {elements,requests}=renderDashboard();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(requests,['/audit/api/sample']);
  assert.equal(elements.sceneFiles.textContent,'6');
  assert.equal(elements.sceneApis.textContent,'8');
  assert.equal(elements.sceneFlags.textContent,'20');
  for (const id of ['audit3dLeft','audit3dRight','audit3dReset']) elements[id].click();
  assert.equal(coreCalls,0);
});

test('local imports select duplicate names by path and reject incomplete oversized results', async()=>{
  const {elements,requests}=renderDashboard();
  await new Promise(resolve=>setImmediate(resolve));
  const before=requests.length;
  const report={files:[
    {name:'same.js',relative_path:'first/same.js',classification:'JS_SOURCE',api_paths:['/a'],flags:['first']},
    {name:'same.js',relative_path:'second/same.js',classification:'JS_SOURCE',api_paths:['/b'],flags:['second']}
  ]};
  const upload=async value=>elements.upload.listeners.change({target:{files:[{size:100,text:async()=>JSON.stringify(value)}],value:'test'}});
  await upload(report);
  assert.equal(elements.sceneFiles.textContent,'2');
  elements.files.children[1].click();
  assert.match(elements.detail.textContent,/second\/same\.js/);
  assert.match(elements.detail.textContent,/second/);
  assert.doesNotMatch(elements.detail.textContent,/first/);
  await upload({files:Array.from({length:501},()=>({name:'item.js'}))});
  assert.match(elements.message.textContent,/500/);
  assert.equal(elements.sceneFiles.textContent,'2');
  await upload({files:[{name:'item.js',flags:Array.from({length:251},()=> 'flag')}]});
  assert.match(elements.message.textContent,/250/);
  assert.equal(requests.length,before,'Import must not send data to any service');
  assert.equal(coreCalls,0);
});
