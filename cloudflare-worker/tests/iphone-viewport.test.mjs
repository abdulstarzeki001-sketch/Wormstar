import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ui from '../future-ui.js';

const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const match=worker.match(/^const HTML = (.+);$/m);
assert.ok(match,'The Worker must embed valid HTML');
const html=JSON.parse(match[1]);
const css=ui.css;

test('iPhone Safari uses real viewport with safe-area support without forbidding accessible pinch zoom',()=>{
 assert.match(html,/name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover/);
 assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1/);
 assert.match(css,/WORMSTAR NEO v5/);
 assert.match(css,/touch-action:pan-y pinch-zoom/);
 assert.match(css,/overscroll-behavior-x:none/);
});

test('App shell prevents page-level horizontal overrun but keeps natural vertical scroll',()=>{
 assert.match(css,/html\{[\s\S]*?overflow-x:hidden;overflow-x:clip/);
 assert.match(css,/body\{[\s\S]*?overflow-x:hidden;overflow-x:clip/);
 assert.match(css,/\.layout\{width:100%;max-width:100%;min-width:0/);
 assert.match(css,/main\{[\s\S]*?max-width:100%/);
 assert.match(css,/\.content\{[\s\S]*?max-width:100%/);
 assert.match(css,/\.ws-note-row\{flex-wrap:wrap/);
});

test('Top bar, bottom tabs, and sidebar respect iPhone safe areas and mobile viewport',()=>{
 assert.match(css,/\.top\{[\s\S]*?safe-area-inset-top/);
 assert.match(css,/\.ws-mobile-dock\{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(css,/env\(safe-area-inset-bottom,0px\)/);
 assert.match(css,/#workspaceSidebar\{[\s\S]*?max-width:calc\(100% - 38px\)/);
 assert.match(css,/\.ws-crumb small,\.ws-crumb strong\{[\s\S]*?text-overflow:ellipsis/);
});

test('All focusable form areas have 16px iOS font to prevent auto-focus zoom',()=>{
 assert.match(css,/#studio \.ws-studio-card input,/);
 assert.match(css,/#lab input,#lab select,#lab textarea/);
 assert.match(css,/#auth input,#auth textarea,#auth select/);
 assert.match(css,/#prompt,#token,#sbEmail,#sbPassword,#researchUrl/);
 assert.match(css,/font-size:16px!important/);
 assert.match(css,/body:has\(input:focus\) \.ws-mobile-dock/);
});

test('Desktop layout and confidential actions remain in the existing source',()=>{
 assert.match(ui.boot,/wsStudioMobileSelect/);
 assert.match(worker,/Object\.freeze\(LAB_POLICY_MANIFEST\)/);
 assert.match(worker,/supabase_owner_binding/);
 assert.match(worker,/if\(url\.pathname\.startsWith\('\/api\/studio\/'\)/);
});
