import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import ui from '../future-ui.js';
import worker from '../worker.js';

test('owner file-inspired palette is valid JS and has selectable persistent UI themes',()=>{
 assert.doesNotThrow(()=>new Script(ui.boot));
 assert.match(ui.boot,/wsThemes=\[\['crimson'/);
 assert.match(ui.boot,/localStorage\.setItem\(wsThemeKey,wsTheme\)/);
 assert.match(ui.boot,/wsActions\.insertBefore\(btn,wsActions\.firstChild\)/);
 assert.match(ui.css,/html\[data-ws-theme="amethyst"\]/);
 assert.match(ui.css,/html\[data-ws-theme="aurora"\]/);
 assert.match(ui.css,/html\[data-ws-theme\]/);
 assert.match(ui.css,/prefers-reduced-motion/);
});

test('owner theme patch prevents horizontal overflow and iOS input autozoom',()=>{
 assert.match(ui.css,/overflow-x:clip/);
 assert.match(ui.css,/@media\(max-width:760px\)/);
 assert.match(ui.css,/:is\(input,textarea,select\)\{font-size:16px\}/);
 assert.match(ui.css,/body\.ws-chat-screen\{overflow:hidden\}/);
 assert.match(ui.css,/min-width:0;max-width:100%/);
});

test('uploaded third-party UI bundle is NOT mounted into privileged application',()=>{
 assert.doesNotMatch(ui.boot,/api\.wormgpt\.live|chat-proxy|v1\/chat\/completions/);
 assert.doesNotMatch(ui.boot,/registerServiceWorker|serviceWorker\.register|new Function\(/);
 assert.doesNotMatch(ui.css,/https:\/\/|javascript:/);
 const source=JSON.stringify(ui);
 assert.doesNotMatch(source,/index-C9Tq7R7e\.js|index-CKc5Vl0m\.css/);
 assert.match(ui.boot,/wsApplyTheme\(\)/);
});

test('existing Worker and PWA routes remain separate from untrusted uploaded manifest and SW',async()=>{
 const response=await worker.fetch(new Request('https://wormstar.test/manifest.webmanifest'),{},{}); 
 assert.equal(response.status,200);
 const manifest=await response.json();
 assert.match(manifest.name,/Wormstar/);
 assert.notEqual(manifest.name,'WormGPT');
 assert.equal(manifest.lang,'ar');
 assert.equal(manifest.dir,'rtl');
 assert.equal(manifest.display,'standalone');
 const sw=await worker.fetch(new Request('https://wormstar.test/sw.js'),{},{});
 assert.equal(sw.status,404);
});


test('chat-first Wormstar navigation matches the approved first-party routes',()=>{
 assert.match(ui.boot,/const routeFromHash=\(\)=>\{let route='assistant'/);
 assert.match(ui.boot,/if\(!names\[route\]\)route='assistant'/);
 assert.match(ui.boot,/data-ws-go="assistant"/);
 assert.match(ui.boot,/data-ws-go="code"/);
 assert.match(ui.boot,/data-ws-go="studio\/library"/);
 assert.match(ui.boot,/id="wsNewChat"/);
 assert.match(ui.boot,/id="wsFindPage"/);
 assert.match(ui.boot,/id="wsArchiveGo"/);
 assert.match(ui.boot,/data-ws-shortcut="studio\/library"/);
 assert.match(ui.boot,/go\('assistant'\);q\('clear'\)\?\.click\(\)/);
 assert.match(ui.boot,/openCommands\(\)/);
});

test('crimson identity is selectable, responsive and cannot expose secret-bound context',()=>{
 assert.match(ui.boot,/let wsTheme='crimson'/);
 assert.match(ui.boot,/wormstar-visual-theme-v2/);
 assert.match(ui.css,/data-ws-theme="crimson"/);
 assert.match(ui.css,/#wsNewChat/);
 assert.match(ui.css,/#workspaceSidebar/);
 assert.match(ui.css,/ws-chat-shortcuts/);
 assert.match(ui.css,/ws-mobile-dock/);
 assert.match(ui.css,/min-width:0/);
 assert.match(ui.css,/prefers-reduced-motion/);
 assert.doesNotMatch(ui.boot,/WORMSTAR_ACCESS_TOKEN|WORMGPT_API_KEY|OPENCLAW_GATEWAY_TOKEN/);
 assert.doesNotMatch(ui.boot,/https:\/\/|eval\(|new Function\(/);
 assert.doesNotThrow(()=>new Script(ui.boot));
});

test('Wormstar standalone manifest reflects new first-party black workspace',async()=>{
 const r=await worker.fetch(new Request('https://wormstar.test/manifest.webmanifest'),{},{});
 assert.equal(r.status,200);
 const manifest=await r.json();
 assert.equal(manifest.background_color,'#08090d');
 assert.equal(manifest.theme_color,'#08090d');
 assert.equal(manifest.name.startsWith('Wormstar'),true);
});
