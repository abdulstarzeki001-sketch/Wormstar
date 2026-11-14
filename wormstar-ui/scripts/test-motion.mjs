import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../index.html');
const motion = read('../motion.js');
const css = read('../motion.css');
const config = JSON.parse(read('../package.json'));
const lock = JSON.parse(read('../package-lock.json'));

test('motion dependencies are exact and locked', () => {
  assert.equal(config.dependencies.gsap, '3.15.0');
  assert.equal(config.dependencies.lenis, '1.3.27');
  assert.equal(lock.packages['node_modules/gsap'].version, '3.15.0');
  assert.equal(lock.packages['node_modules/lenis'].version, '1.3.27');
});

test('browser assets are served from the first-party origin, not a third-party script host', () => {
  for (const path of ['/assets/gsap.min.js','/assets/ScrollTrigger.min.js',
    '/assets/lenis.min.js','/motion.js','/assets/lenis.css','/motion.css']) {
    assert.ok(html.includes('"' + path + '"'), 'missing local resource ' + path);
  }
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//i);
  assert.ok(html.indexOf('/assets/gsap.min.js') < html.indexOf('/assets/ScrollTrigger.min.js'));
  assert.ok(html.indexOf('/assets/ScrollTrigger.min.js') < html.indexOf('/assets/lenis.min.js'));
  assert.ok(html.indexOf('/assets/lenis.min.js') < html.indexOf('/motion.js'));
});

test('motion enhancement parses and retains native touch, nested scroll and reduced motion', () => {
  new Script(motion, {filename:'motion.js'});
  assert.match(motion, /prefers-reduced-motion: reduce/);
  assert.match(motion, /pointer: fine/);
  assert.match(motion, /syncTouch: false/);
  assert.match(motion, /allowNestedScroll: true/);
  assert.match(motion, /ScrollTrigger|Trigger.update/);
  assert.match(motion, /'pagehide'/);
  assert.match(motion, /MutationObserver/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /focus-visible/);
  assert.match(css, /#wsTermOutput/);
});

test('auth and terminal modules remain untouched by the optional motion script', () => {
  assert.doesNotMatch(motion, /(?:fetch\s*\(|WebSocket\s*\(|localStorage|sessionStorage|Bearer\s|Authorization\s*:)/);
  assert.match(html, /id="wsTermToken"/);
  assert.match(html, /id="aiToken"/);
  assert.match(html, /src="\/terminal\.js"/);
});


test('motion improvements cover reports while keeping shell/editor/logs native',()=>{
  for(const token of ['.report-card','.metric-card','.xterm-viewport','.monaco-editor',
    '.cm-editor','.logs','[data-lenis-prevent]']){
    assert.ok(motion.includes(token),'missing motion safeguard '+token);
  }
  assert.match(motion,/\.filter\(card => !card\.closest\(noSmooth\)\)/);
  assert.match(motion,/\.slice\(0,28\)/);
  assert.match(css,/\.panel::before/);
  assert.match(css,/\.report-card::before/);
  assert.match(css,/overscroll-behavior:contain/);
});


test('layout pass applies as an override layer and keeps text legible',()=>{
  // motion.css overrides the page's own <style>; linked earlier, its equal-specificity rules are dead.
  assert.ok(html.indexOf('</style>') < html.indexOf('href="/motion.css"'),'motion.css must load after the inline style');
  // The initial terminal text once rendered a literal backslash-n.
  assert.doesNotMatch(html,/id="wsTermOutput"[^>]*>[^<]*\\n/);
  // Nothing in the layer may shrink text below the mobile-navigation label size.
  const sizes=[...css.matchAll(/font-size:\s*([\d.]+)px/g)].map(match=>Number(match[1]));
  assert.ok(sizes.length>=10);
  assert.ok(Math.min(...sizes)>=10.5,'smallest font size in motion.css is '+Math.min(...sizes)+'px');
  // iOS Safari zooms the viewport on focus when a control is under 16px.
  assert.match(css,/\.chat-compose textarea,\.ai-model-bar select,\.ai-auth input,\.ops-input,#iocInput\{font-size:16px\}/);
  // The phone layout hides the search label with font-size:0; only wider screens may restyle it.
  assert.match(css,/@media\(min-width:721px\)\{\.search-trigger\{font-size:12px\}\}/);
  assert.doesNotMatch(css.replace(/@media\(min-width:721px\)\{[^}]*\}\}/,''),/\.search-trigger/);
  // The conversation must keep its own height when the controls stack on phones.
  assert.match(css,/\.chat-history\{flex:none;min-height:260px;max-height:58dvh\}/);
  assert.match(css,/#wsTermExplanation:empty,#wsTermCommand:empty,#wsTermResult:empty\{display:none\}/);
});


test('leaving a page clears every entrance target, including the hero copy',()=>{
  // The entrance tween animates the heading and the hero copy; killing it mid-flight
  // without clearing both left the hero copy at opacity 0 after fast navigation.
  assert.match(motion,/const entry = \[heading, heroCopy\]/);
  assert.match(motion,/previous\.querySelectorAll\('\.page-heading, \.hero-copy'\)/);
});
