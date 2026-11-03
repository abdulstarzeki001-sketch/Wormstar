import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ACADEMY_HTML from '../academy-page.js';
import REDESIGN_HTML from '../redesign-ui.js';

const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');

test('Cyber Quest retains complete original lessons, quizzes, and mobile layout',()=>{
  assert.equal((ACADEMY_HTML.match(/https:\/\/drive\.google\.com\/file\/d\//g)||[]).length,71);
  assert.match(ACADEMY_HTML,/18 وحدة/);
  assert.match(ACADEMY_HTML,/localStorage/);
  assert.match(ACADEMY_HTML,/data-nav="quiz"/);
  assert.match(ACADEMY_HTML,/@media\(max-width:760px\)/);
  const scripts=[...ACADEMY_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length>0);
  for(const [,body] of scripts)assert.doesNotThrow(()=>new Function(body));
});

test('academy is linked from both sidebar and mobile more sheet',()=>{
  assert.equal((REDESIGN_HTML.match(/href="\/academy"/g)||[]).length,2);
  assert.match(ACADEMY_HTML,/href="\/"/);
  for(const mode of ['assistant','code','logs','ioc','ctf','report'])assert.ok(REDESIGN_HTML.includes('data-nav="'+mode+'"'));
});

test('academy is a static GET route with private headers and strict CSP',()=>{
  assert.match(worker,/import ACADEMY_HTML from '\.\/academy-page\.js'/);
  assert.ok(worker.includes("url.pathname==='/academy'"));
  assert.ok(worker.includes("url.pathname==='/academy/'"));
  assert.ok(worker.includes("'Content-Security-Policy':"));
  assert.ok(worker.includes("'X-Robots-Tag':'noindex, nofollow'"));
  assert.ok(worker.includes("url.pathname==='/api/chat'"));
  assert.ok(worker.includes("url.pathname.startsWith('/api/studio/')"));
  assert.ok(worker.includes("new Response(FUTURE_HTML"));
});
