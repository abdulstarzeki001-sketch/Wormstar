import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,runInNewContext} from 'node:vm';
import {enhanceUiPage,serveUiAsset,UI_ENGINEERING_SOURCE} from '../ui-engineering.js';

test('UI enhancements keep fixed existing page contracts and never rewrite authentication',()=>{
  const nexus='<html><head></head><body><form id="login"><input type="password" /></form></body></html>';
  const ws='<html><head></head><body><nav aria-label="تنقل المشاريع"></nav><div class="app"></div></body></html>';
  for(const [html,page] of [[nexus,'nexus'],[ws,'workspace'],[nexus,'academy']]){
    const output=enhanceUiPage(html,page);
    assert.match(output,/id="ws-ui-engineering"/);
    assert.ok(output.includes('<script src="/ui/engine.js" defer></script>'));
    assert.ok(output.includes('<script src="/ui/vendor/gsap.min.js" defer></script>'));
    assert.ok(output.includes('<script src="/ui/vendor/ScrollTrigger.min.js" defer></script>'));
    assert.ok(output.includes('<script src="/ui/vendor/lenis.min.js" defer></script>'));
    assert.ok(output.includes(page==='workspace'?'<nav class="ws-suite-shortcuts"':'id="login"'));
    assert.equal(enhanceUiPage(output,page),output,'idempotent injection');
  }
  assert.throws(()=>enhanceUiPage(nexus,'terminal'));
  assert.throws(()=>enhanceUiPage('not html','nexus'));
});

test('Worker serves motion and pinned vendor scripts from the same origin, no credentials',async()=>{
  const root='https://wormstar-ai-lab.abdulstarzeki001.workers.dev';
  let calls=[];
  const env={SENTINEL_SUITE:{fetch:async req=>{
    calls.push(req);
    return new Response('window.Library=true;',{
      headers:{'Set-Cookie':'bad=1','Content-Type':'text/plain','Cache-Control':'public'}
    });
  }}};
  const get=(path,method='GET')=>new Request(root+path,{
    method,headers:{Cookie:'secret-cookie=123',Authorization:'Bearer sensitive-token'}
  });
  let local=await serveUiAsset(get('/ui/engine.js'),{});
  assert.equal(local.status,200);
  assert.match(await local.text(),/syncTouch:false/);
  assert.match(local.headers.get('Content-Type'),/javascript/);
  for(const path of UI_ENGINEERING_SOURCE.paths){
    const res=await serveUiAsset(get(path),env);
    assert.equal(res.status,200);
    assert.equal(await res.text(),'window.Library=true;');
    assert.match(res.headers.get('Cache-Control'),/max-age=300/);
    assert.equal(res.headers.get('Set-Cookie'),null);
    const forward=calls.at(-1);
    assert.equal(forward.headers.get('Cookie'),null);
    assert.equal(forward.headers.get('Authorization'),null);
    assert.equal(new URL(forward.url).origin,'https://wormstar-sentinel-preview.abdulstarzeki001.workers.dev');
  }
  assert.equal(calls.length,3);
  assert.equal((await serveUiAsset(get('/ui/vendor/other.js'),env)).status,404);
  assert.equal((await serveUiAsset(get('/ui/vendor/gsap.min.js','POST'),env)).status,405);
  assert.equal((await serveUiAsset(get('/ui/vendor/lenis.min.js'),{})).status,503);
});

test('Script and CSS support reduced motion, RTL, nested native scrolling and safe cleanup',()=>{
  const {client,style}=UI_ENGINEERING_SOURCE;
  new Script(client,{filename:'ui-engineering-client.js'});
  assert.match(client,/prefers-reduced-motion: reduce/);
  assert.match(client,/pointer: fine/);
  assert.match(client,/syncTouch:false/);
  assert.match(client,/allowNestedScroll:true/);
  assert.match(client,/gsap\.ticker\.remove/);
  assert.match(client,/lenis\.destroy/);
  assert.match(client,/ScrollTrigger|Trigger\.update/);
  assert.match(client,/pagehide/);
  assert.match(client,/MutationObserver/);
  assert.match(client,/\.xterm,.xterm-viewport/);
  assert.match(client,/\.monaco-editor/);
  assert.match(client,/dialog\[open\]/);
  assert.match(style,/focus-visible/);
  assert.match(style,/prefers-reduced-motion:reduce/);
  assert.match(style,/data-ws-spotlight/);
  assert.match(style,/max-width:390px/);
  assert.doesNotMatch(client,/(?:fetch\s*\(|new\s+WebSocket|localStorage|sessionStorage|document\.cookie|Authorization)/);
});

test('without motion libraries the original page remains readable and usable',()=>{
  let observed=false;
  const classes={contains:()=>false};
  const context={
    window:{
      matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),
      addEventListener(){},scrollTo(){}
    },
    document:{
      documentElement:{dataset:{},scrollHeight:1000},
      body:{},
      querySelector:()=>null
    },
    MutationObserver:class{observe(){observed=true;}disconnect(){}},
    innerHeight:900,
    location:{pathname:'/workspace'},
    requestAnimationFrame:fn=>fn()
  };
  runInNewContext(UI_ENGINEERING_SOURCE.client,context,{timeout:1000});
  assert.ok(observed);
  assert.equal(context.document.documentElement.dataset.wsUiEngineering,'on');
  assert.equal(context.window.__wormstarUiEngineering,true);
});

test('Core routes are additive and keep protected API and Railway terminal untouched',()=>{
  const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
  assert.match(source,/import \{enhanceUiPage,serveUiAsset\} from '\.\/ui-engineering\.js'/);
  assert.match(source,/return serveUiAsset\(request,env\)/);
  assert.match(source,/enhanceUiPage\(compactPage\(WORKSPACE_HTML,'workspace'\),'workspace'\)/);
  assert.match(source,/enhanceUiPage\(compactPage\(ACADEMY_HTML,'academy'\),'academy'\)/);
  assert.match(source,/enhanceUiPage\(compactPage\(FUTURE_HTML/);
  assert.match(source,/return serveRailwayTerminal\(request\)/);
  assert.match(source,/return serveSentinelModule\(request,env\)/);
  const block=source.slice(source.indexOf("if(request.method==='GET'&&['/workspace'"),source.indexOf("return json({error:'Not found'},404);",source.indexOf("if(request.method==='GET'&&['/workspace'")));
  assert.equal(block.split("script-src 'self' 'unsafe-inline'").length-1,3);
  assert.equal(block.split("frame-ancestors 'none'").length-1,3);
});
