import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {APP_ICON_PNG_B64,APP_ICON_SVG} from '../app-icon.js';
import FUTURE_UI from '../future-ui.js';
import REDESIGN_HTML from '../redesign-ui.js';

const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const htmlRaw=worker.match(/^const HTML = (.+);$/m);
assert.ok(htmlRaw,'Worker contains base HTML');
const html=JSON.parse(htmlRaw[1]);

test('iOS icon is a real decodable PNG with correct dimensions',()=>{
 const image=Buffer.from(APP_ICON_PNG_B64,'base64');
 assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(image.subarray(12,16).toString('ascii'),'IHDR');
 const width=image.readUInt32BE(16),height=image.readUInt32BE(20);
 assert.equal(width,96);
 assert.equal(height,96);
 assert.ok(image.length>1000);
 assert.equal(image.subarray(-8,-4).toString('ascii'),'IEND');
 let offset=8,compressed=[];
 while(offset+12<=image.length){
  const length=image.readUInt32BE(offset),type=image.subarray(offset+4,offset+8).toString('ascii');
  if(type==='IDAT')compressed.push(image.subarray(offset+8,offset+8+length));
  offset+=length+12;
  if(type==='IEND')break;
 }
 assert.ok(inflateSync(Buffer.concat(compressed)).length>96*96/8,'PNG pixel data actually decompresses');
});
test('home screen links and standalone manifest routes are present',()=>{
 assert.match(html,/rel="apple-touch-icon"/);
 assert.match(html,/href="\/manifest\.webmanifest\?v=/);
 assert.match(html,/apple-mobile-web-app-capable/);
 assert.match(html,/apple-mobile-web-app-title/);
 assert.match(worker,/url\.pathname==='\/apple-touch-icon\.png'/);
 assert.match(worker,/url\.pathname==='\/manifest\.webmanifest'/);
 assert.match(worker,/display:'standalone'/);
 assert.match(worker,/img-src 'self' data:/);
});
test('SVG shield icon is valid standalone media',()=>{
 assert.match(APP_ICON_SVG,/^<svg /);
 assert.match(APP_ICON_SVG,/<\/svg>$/);
 assert.match(APP_ICON_SVG,/viewBox="0 0 512 512"/);
 assert.match(worker,/Content-Type':'image\/svg\+xml/);
});
test('login page and futuristic navigation really replaced old front door',()=>{
 assert.match(html,/class="ws-gateway"/);
 assert.match(html,/id="gateHeadline"/);
 assert.match(html,/id="loginForm"/);
 assert.match(html,/id="authStatus"/);
 assert.doesNotMatch(html,/تم نشر الواجهة على Cloudflare\. أدخل مفتاح/);
 assert.match(FUTURE_UI.css,/FULL-SCREEN ZERO-TRUST GATEWAY/);
 assert.match(FUTURE_UI.css,/\.ws-gate-emblem-wrap/);
 assert.match(FUTURE_UI.boot,/ws-future-overview/);
 assert.match(FUTURE_UI.boot,/wsCommandModal/);
});
test('new look preserves required security and memory API contracts',()=>{
 assert.match(worker,/Object\.freeze\(LAB_POLICY_MANIFEST\)/);
 assert.match(worker,/if\(request\.method==='POST'&&url\.pathname==='\/api\/auth'\)/);
 assert.match(worker,/url\.pathname\.startsWith\('\/api\/studio\/'\)/);
 assert.match(worker,/new Response\(FUTURE_HTML/);
 assert.doesNotMatch(worker,/service_role/);
});

test('PWA service worker is served at root scope and uses navigation-only offline fallback',()=>{
 assert.ok(worker.includes("url.pathname==='/service-worker.js'"));
 assert.ok(worker.includes("'Service-Worker-Allowed':'/'"));
 assert.ok(worker.includes('PWA_SERVICE_WORKER'));
 assert.ok(worker.includes("request.mode==='navigate'"));
 assert.ok(worker.includes("OFFLINE_URL='/offline.html'"));
 assert.ok(worker.includes("worker-src 'self'"));
});
test('iPhone home-screen launch has a splash and standalone detection',()=>{
 assert.match(REDESIGN_HTML,/ws-launch-splash/);
 assert.match(REDESIGN_HTML,/pwa-standalone/);
 assert.match(REDESIGN_HTML,/navigator\.standalone/);
 assert.ok(REDESIGN_HTML.includes("serviceWorker.register('/service-worker.js'"));
 assert.match(REDESIGN_HTML,/safe-area-inset-top/);
 assert.match(REDESIGN_HTML,/safe-area-inset-bottom/);
});
test('Manifest provides standalone launch and a maskable scalable icon',()=>{
 assert.ok(worker.includes("display_override:['standalone','minimal-ui']"));
 assert.ok(worker.includes("purpose:'any maskable'"));
 assert.ok(worker.includes("start_url:'/?source=homescreen'"));
 assert.ok(worker.includes("url.pathname==='/offline.html'"));
});
