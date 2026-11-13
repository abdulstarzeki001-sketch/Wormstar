import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import REDESIGN_HTML from '../redesign-ui.js';
import ACADEMY_HTML from '../academy-page.js';
import {WORKSPACE_HTML,WORKSPACE_SHORTCUT} from '../unified-workspace.js';
import {compactPage} from '../compact-layout.js';

const NEXUS=compactPage(REDESIGN_HTML.replace('</body></html>',WORKSPACE_SHORTCUT+'</body></html>'),'nexus');
const PROJECTS=compactPage(WORKSPACE_HTML,'workspace');
const ACADEMY=compactPage(ACADEMY_HTML,'academy');
const PAGES=[['NEXUS',NEXUS],['Projects',PROJECTS],['Academy',ACADEMY]];

function compactStyle(html){
  const found=html.match(/<style id="ws-layout-compact-2026">([\s\S]*?)<\/style>/);
  assert.ok(found,'compact style was not embedded in the static HTML');
  return found[1];
}

test('all pages retain RTL and receive a valid compact stylesheet for desktop and phones',()=>{
  for(const [name,html] of PAGES){
    assert.match(html,/<html[^>]+dir="rtl"/,name);
    assert.match(html,/<meta[^>]+name="viewport"/,name);
    assert.match(html,/<\/head>/,name);
    assert.match(html,/<\/body>/,name);
    const css=compactStyle(html);
    assert.match(css,/@media\(min-width:(?:741|761)px\)/,name);
    assert.match(css,/@media\(max-width:(?:740|760)px\)/,name);
    assert.match(css,/minmax\(0,1fr\)/,name);
    assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length,name+' CSS braces must balance');
    assert.doesNotMatch(css,/\.hidden\s*\{\s*display:block/,name);
  }
});
test('NEXUS: compact login/chat screens and project links in side and mobile More menu',()=>{
  assert.match(NEXUS,/id="loginForm"/);
  assert.match(NEXUS,/id="chatForm"/);
  assert.match(NEXUS,/id="sidebar"/);
  assert.match(NEXUS,/class="mobile-nav hidden"/);
  assert.match(NEXUS,/ws-project-nav-link[^>]*href="\/workspace"/);
  assert.match(NEXUS,/ws-project-sheet-link[^>]*href="\/workspace"/);
  assert.match(compactStyle(NEXUS),/\.page\{padding:14px 12px/);
  assert.match(compactStyle(NEXUS),/body:has\(#app:not\(\.hidden\)\) \.ws-unified-launch\{display:none!important\}/);
  for(const mode of ['assistant','code','logs','ioc','ctf','report','memory','agents','policy']){
    assert.ok(NEXUS.includes('data-nav="'+mode+'"'),mode);
  }
});
test('Projects: horizontal mobile tabs and all STAR AI TEAM/OSINT controls remain',()=>{
  for(const view of ['overview','ai','team','security','projects','operations']){
    assert.ok(PROJECTS.includes('data-section="'+view+'"'),view);
    assert.ok(PROJECTS.includes('data-view="'+view+'"'),view);
  }
  for(const id of ['teamRun','teamSyncIndex','connect','disconnect','projectGrid','projectSearch']){
    assert.ok(PROJECTS.includes('id="'+id+'"'),id);
  }
  assert.match(compactStyle(PROJECTS),/\.side nav\{display:flex;gap:6px;overflow-x:auto/);
  assert.match(WORKSPACE_SHORTCUT,/href="\/workspace"/);
});
test('Academy: lessons and progress remain and compact projects shortcut is available',()=>{
  for(const id of ['home','paths','library','saved','quiz'])assert.ok(ACADEMY.includes('data-nav="'+id+'"'),id);
  assert.match(ACADEMY,/class="mobile-nav"/);
  assert.match(ACADEMY,/class="ws-academy-back ws-academy-projects"/);
  assert.match(ACADEMY,/href="\/workspace"/);
  assert.match(compactStyle(ACADEMY),/\.path-card\{min-height:145px/);
});
test('live Worker routes serve improved layouts without changing API authorization',async()=>{
  for(const [url,marker] of [['/','ws-project-nav-link'],['/workspace','data-section="team"'],['/academy','ws-academy-projects']]){
    const result=await worker.fetch(new Request('https://wormstar.invalid'+url),{},{});
    assert.equal(result.status,200,url);
    assert.match(await result.text(),/ws-layout-compact-2026/);
    assert.match(await worker.fetch(new Request('https://wormstar.invalid'+url),{},{}).then(r=>r.text()),new RegExp(marker));
  }
  const unauthorized=await worker.fetch(new Request('https://wormstar.invalid/api/auth',{method:'POST'}),{},{});
  assert.equal(unauthorized.status,401);
});
test('compact decorator accepts only known static pages and never inserts runtime scripts',()=>{
  assert.throws(()=>compactPage('<html></html>','nexus'));
  assert.throws(()=>compactPage(REDESIGN_HTML,'unknown'));
  for(const [name,html] of PAGES){
    assert.doesNotMatch(html,/<script[^>]+src=["']https?:\/\//i,name);
    assert.doesNotMatch(html,/WORMSTAR_ACCESS_TOKEN|OPENCLAW_GATEWAY_TOKEN|CLOUDFLARE_API_TOKEN/,name);
  }
});
