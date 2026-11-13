import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serveRailwayTerminal,serveSentinelModule,suiteLanding} from '../unified-suite-proxy.js';

const root='https://wormstar-ai-lab.abdulstarzeki001.workers.dev';
const request=(path,method='GET',headers={})=>
  new Request(root+path,{method,headers});

test('single-domain suite exposes real module routes without external navigation',async()=>{
  const response=suiteLanding();
  assert.equal(response.status,200);
  const html=await response.text();
  for(const path of ['/','/workspace','/terminal/','/osint/','/audit/','/academy/']){
    assert.ok(html.includes('href="'+path+'"'),path);
  }
  assert.ok(html.includes('WORMSTAR ONE'));
  assert.ok(!html.includes('href="https://terminal-production'));
  assert.match(response.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
});

test('Railway pages and assets are served via a strict fixed upstream allowlist',async()=>{
  const paths=new Map([
    ['/terminal/','/'],
    ['/terminal/index.html','/'],
    ['/terminal/app.js','/app.js'],
    ['/terminal/neon.css','/neon.css']
  ]);
  const seen=[];
  const mock=async(url,init)=>{
    seen.push({url,method:init.method,headers:init.headers});
    return new Response('static', {status:200,headers:{
      'Set-Cookie':'upstream-secret=should-not-appear',
      'Location':'https://other.example',
      'Cache-Control':'public,max-age=9999',
      'Content-Type':'text/html'
    }});
  };
  for(const [path,target] of paths){
    const res=await serveRailwayTerminal(request(path),mock);
    assert.equal(res.status,200,path);
    assert.equal(await res.text(),'static');
    assert.equal(res.headers.get('Set-Cookie'),null);
    assert.equal(res.headers.get('Location'),null);
    assert.match(res.headers.get('Cache-Control'),/no-store/);
    assert.equal(seen.at(-1).url,
      'https://terminal-production-fb16bd35.up.railway.app'+target);
  }
  assert.equal((await serveRailwayTerminal(request('/terminal/../api/secret'),mock)).status,404);
  assert.equal((await serveRailwayTerminal(request('/terminal/private.txt'),mock)).status,404);
  assert.equal((await serveRailwayTerminal(request('/terminal/app.js','POST'),mock)).status,405);
  assert.equal((await serveRailwayTerminal(request('/terminal/neon.css','HEAD'),mock)).status,200);
  assert.equal(await (await serveRailwayTerminal(request('/terminal/neon.css','HEAD'),mock)).text(),'');
  assert.equal((await serveRailwayTerminal(request('/terminal/?origin=https://evil.example'),mock)).status,200);
  assert.equal(seen.at(-1).url,'https://terminal-production-fb16bd35.up.railway.app/');
});

test('same-origin trailing slash redirect stays within Wormstar and strips query data',async()=>{
  for(const path of ['/terminal','/osint','/audit']){
    const res=path==='/terminal'
      ? await serveRailwayTerminal(request(path+'?password=must-not-forward'))
      : await serveSentinelModule(request(path+'?token=must-not-forward'),{});
    assert.equal(res.status,308);
    assert.equal(new URL(res.headers.get('Location')).origin,root);
    assert.equal(new URL(res.headers.get('Location')).pathname,path+'/');
    assert.equal(new URL(res.headers.get('Location')).search,'');
  }
});

test('WebSocket transparently proxies real Railway WSS only for same-origin browsers',async()=>{
  const webSocketResponse={status:101,webSocket:{proxy:true}};
  const seen=[];
  const backend=async(url,init)=>{
    seen.push({url,init});return webSocketResponse;
  };
  const headers={Upgrade:'websocket',Origin:root};
  const result=await serveRailwayTerminal(request('/terminal/ws','GET',headers),backend);
  assert.equal(result,webSocketResponse);
  assert.equal(seen[0].url,'https://terminal-production-fb16bd35.up.railway.app/ws');
  assert.equal(seen[0].init.headers.Upgrade,'websocket');
  assert.ok(!('Cookie' in seen[0].init.headers));
  assert.ok(!('Authorization' in seen[0].init.headers));
  assert.equal((await serveRailwayTerminal(request('/terminal/ws','GET',{Upgrade:'websocket',Origin:'https://evil.example'}),backend)).status,403);
  assert.equal((await serveRailwayTerminal(request('/terminal/ws','GET',{Upgrade:'websocket'}),backend)).status,403);
  assert.equal((await serveRailwayTerminal(request('/terminal/ws'),backend)).status,426);
  assert.equal((await serveRailwayTerminal(request('/terminal/ws','POST',headers),backend)).status,405);
  assert.equal(seen.length,1,'rejected cross-origin attempts must not reach Railway');
});

test('sentinel viewers use service binding but never forward Core owner tokens',async()=>{
  const seen=[];
  const env={SENTINEL_SUITE:{async fetch(req){
    seen.push(req);
    return new Response('safe response',{status:200,headers:{
      'Set-Cookie':'session=not-allowed',
      'Access-Control-Allow-Origin':'*',
      'Content-Security-Policy':"default-src 'none'",
      'Content-Type':'text/html'
    }});
  }}};
  const allowed=['/osint/','/osint/index.html','/osint/app.js','/osint/health','/audit/','/audit/index.html','/audit/health','/audit/api/sample'];
  for(const path of allowed){
    const res=await serveSentinelModule(request(path,'GET',{
      Authorization:'Bearer private-key',
      Cookie:'owner_cookie=sensitive',
      'X-Api-Key':'another-secret'
    }),env);
    assert.equal(res.status,200,path);
    assert.equal(res.headers.get('Set-Cookie'),null);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'),null);
    assert.equal(res.headers.get('Content-Security-Policy'),"default-src 'none'");
    assert.match(res.headers.get('Cache-Control'),/no-store/);
    const forwarded=seen.at(-1);
    assert.equal(forwarded.headers.get('Authorization'),null);
    assert.equal(forwarded.headers.get('Cookie'),null);
    assert.equal(forwarded.headers.get('X-Api-Key'),null);
    assert.equal(new URL(forwarded.url).pathname,path);
  }
  assert.equal((await serveSentinelModule(request('/audit/api/admin'),env)).status,404);
  assert.equal((await serveSentinelModule(request('/osint/private'),env)).status,404);
  assert.equal((await serveSentinelModule(request('/audit/','POST'),env)).status,405);
  assert.equal((await serveSentinelModule(request('/osint/'),{})).status,503);
});

test('Core integrates terminal before legacy ticket page and binds Sentinel internally',()=>{
  const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
  const config=readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8');
  const nav=readFileSync(new URL('../redesign-ui.js',import.meta.url),'utf8');
  assert.ok(worker.indexOf("return serveRailwayTerminal(request)")<
            worker.indexOf("return new Response(TERMINAL_HTML"));
  assert.match(worker,/return serveSentinelModule\(request,env\)/);
  assert.match(config,/\[\[services\]\]\s*binding = "SENTINEL_SUITE"\s*service = "wormstar-sentinel-preview"/);
  for(const path of ['/terminal/','/suite/','/osint/','/audit/']){
    assert.ok(nav.includes('href="'+path+'"'),path);
  }
  assert.doesNotMatch(nav,/href="https:\/\/terminal-production-fb16bd35\.up\.railway\.app/);
});
