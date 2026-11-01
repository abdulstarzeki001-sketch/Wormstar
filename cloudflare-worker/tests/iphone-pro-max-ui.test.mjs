import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui=readFileSync(new URL('../redesign-ui.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');

test('iPhone Pro Max shell keeps the app edge-to-edge and safe-area aware',()=>{
  assert.match(ui,/iPhone Pro Max — native app refinement/);
  assert.match(ui,/viewport-fit=cover/);
  assert.match(ui,/env\\(safe-area-inset-top\\)/);
  assert.match(ui,/env\\(safe-area-inset-bottom\\)/);
  assert.match(ui,/100dvh/);
});

test('Mobile navigation is a five-item translucent dock with accessible touch targets',()=>{
  assert.match(ui,/id="mobileNav"/);
  assert.match(ui,/grid-template-columns:repeat\\(5,minmax\\(0,1fr\\)\\)/);
  assert.match(ui,/backdrop-filter:saturate\\(190%\\) blur\\(28px\\)/);
  assert.match(ui,/min-height:58px/);
  assert.match(ui,/button.active/);
});

test('The mobile polish changes presentation only and keeps the existing Worker UI entry point',()=>{
  assert.match(worker,/import REDESIGN_HTML from '\.\/redesign-ui\.js'/);
  assert.match(worker,/const FUTURE_HTML=REDESIGN_HTML/);
  assert.match(ui,/id="loginForm"/);
  assert.match(ui,/data-nav="assistant"/);
  assert.match(ui,/data-nav="code"/);
});
