import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import ui from '../future-ui.js';
import worker from '../worker.js';

test('owner file-inspired palette is valid JS and has selectable persistent UI themes',()=>{
 assert.doesNotThrow(()=>new Script(ui.boot));
 assert.match(ui.boot,/wsThemes=\[\['ember'/);
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
