import test from 'node:test';
import assert from 'node:assert/strict';
import REDESIGN_HTML from '../redesign-ui.js';
import ACADEMY_HTML from '../academy-page.js';
import {WORKSPACE_HTML,WORKSPACE_SHORTCUT} from '../unified-workspace.js';

const pages=[
  ['NEXUS',REDESIGN_HTML],
  ['Projects',WORKSPACE_HTML],
  ['Academy',ACADEMY_HTML]
];

function compactStyle(html){
  const match=html.match(/<style id="ws-layout-compact-2026">([\s\S]*?)<\/style>/);
  assert.ok(match,'compact CSS missing');
  return match[1];
}

test('all three pages include compact responsive styles and retain intact HTML structures',()=>{
  for(const [name,html] of pages){
    assert.match(html,/<html[^>]+dir="rtl"/,name);
    assert.match(html,/<meta[^>]+name="viewport"/,name);
    assert.match(html,/<\/head>/,name);
    assert.match(html,/<\/body>/,name);
    const css=compactStyle(html);
    assert.match(css,/@media\(max-width:760px\)/,name);
    assert.match(css,/@media\(min-width:761px\)/,name);
    assert.match(css,/minmax\(0,1fr\)/,name);
    assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length,name+' CSS braces');
    assert.doesNotMatch(css,/\.hidden\s*\{\s*display:block/,name);
    assert.doesNotMatch(css,/\beval\s*\(/,name);
  }
});
test('main NEXUS retains login, modes, mobile navigation and offers visible projects links',()=>{
  assert.match(REDESIGN_HTML,/id="loginForm"/);
  assert.match(REDESIGN_HTML,/id="chatForm"/);
  assert.match(REDESIGN_HTML,/id="sidebar"/);
  assert.match(REDESIGN_HTML,/class="mobile-nav hidden"/);
  assert.match(REDESIGN_HTML,/ws-project-nav-link[^>]*href="\/workspace"/);
  assert.match(REDESIGN_HTML,/ws-project-sheet-link[^>]*href="\/workspace"/);
  for(const mode of ['assistant','code','logs','ioc','ctf','report','memory','agents','policy']){
    assert.ok(REDESIGN_HTML.includes('data-nav="'+mode+'"'),mode);
  }
  assert.match(compactStyle(REDESIGN_HTML),/\.page\{padding:14px 12px/);
});
test('project hub keeps STAR AI TEAM and source-aware controls with responsive horizontal navigation',()=>{
  for(const view of ['overview','ai','team','security','projects','operations']){
    assert.ok(WORKSPACE_HTML.includes('data-section="'+view+'"'),view);
    assert.ok(WORKSPACE_HTML.includes('data-view="'+view+'"'),view);
  }
  for(const id of ['teamRun','teamSyncIndex','connect','disconnect','projectGrid','projectSearch']){
    assert.ok(WORKSPACE_HTML.includes('id="'+id+'"'),id);
  }
  assert.match(compactStyle(WORKSPACE_HTML),/\.side nav\{display:flex;gap:6px;overflow-x:auto/);
  assert.match(WORKSPACE_SHORTCUT,/href="\/workspace"/);
  assert.match(WORKSPACE_SHORTCUT,/body:has\(#app:not\(\.hidden\)\) \.ws-unified-launch\{display:none!important\}/);
});
test('academy retains all learning sections, mobile bar and compact return-to-projects navigation',()=>{
  for(const id of ['home','paths','library','saved','quiz']){
    assert.ok(ACADEMY_HTML.includes('data-nav="'+id+'"'),id);
  }
  assert.match(ACADEMY_HTML,/class="mobile-nav"/);
  assert.match(ACADEMY_HTML,/class="ws-academy-back ws-academy-projects"/);
  assert.match(ACADEMY_HTML,/href="\/workspace"/);
  assert.match(compactStyle(ACADEMY_HTML),/\.path-card\{min-height:145px/);
});
test('privacy: UI spacing pass did not introduce inline external scripts or expose credentials',()=>{
  for(const [name,html] of pages){
    assert.doesNotMatch(html,/<script[^>]+src=["']https?:\/\//i,name);
    assert.doesNotMatch(html,/WORMSTAR_ACCESS_TOKEN|OPENCLAW_GATEWAY_TOKEN|CLOUDFLARE_API_TOKEN/,name);
  }
});
