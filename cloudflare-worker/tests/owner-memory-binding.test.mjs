import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const match=worker.match(/^const HTML = (.+);$/m);
assert.ok(match,'HTML must be embedded for browser UI');
const html=JSON.parse(match[1]);
const docs=JSON.parse(readFileSync(new URL('../knowledge/neo_advanced_library.json',import.meta.url),'utf8'));
const migration=readFileSync(new URL('../migrations/20261025_supabase_owner_binding.sql',import.meta.url),'utf8');

test('Wormstar memory pins exactly one verified Supabase identity',()=>{
 assert.match(worker,/if\(path==='\/api\/studio\/supabase-owner'\)/);
 assert.match(worker,/if\(request\.method==='POST'\)/);
 assert.match(worker,/supabase\.co\/auth\/v1\/user/);
 assert.match(worker,/INSERT OR IGNORE INTO supabase_owner_binding/);
 assert.match(worker,/bound\.owner_id!==uid/);
 assert.match(worker,/Account switching is blocked/);
 assert.match(migration,/PRIMARY KEY CHECK\(id = 1\)/);
 assert.match(migration,/owner_id TEXT NOT NULL/);
 assert.doesNotMatch(migration,/\b(?:refresh_token|access_token|password)\s+(?:TEXT|VARCHAR|BYTEA)\b/i);
});
test('Browser verifies the account before persisting linked sessions',()=>{
 assert.match(html,/await sbVerifyAndLockAccount\(data\)/);
 assert.match(html,/await sbVerifyAndLockAccount\(session\)/);
 assert.match(html,/await sbVerifyAndLockAccount\(sbSession\)/);
 assert.match(html,/async function sbRefresh\(\)/);
 assert.match(html,/localStorage\.setItem\(SB_SESSION_KEY/);
 assert.match(html,/sessionStorage\.setItem\(SB_SESSION_KEY/);
 assert.match(html,/id="sbRemember"/);
 assert.match(html,/عدم|حساب|مالك/);
 assert.doesNotMatch(html,/supabase\.co\/auth\/v1\/admin/);
});
test('Owner knowledge imports mirror to Supabase when a session is connected',()=>{
 assert.match(html,/id="sbImportStarter"/);
 assert.match(html,/await sbTryMirrorItem\(\{id:addedItem\.id/);
 assert.match(html,/sbImportStarter'\)\.onclick/);
});
test('Professional knowledge pack is unique, substantive and unprivileged',()=>{
 assert.equal(docs.modules.length,10);
 const slugs=docs.modules.map(x=>x.slug),titles=docs.modules.map(x=>x.title);
 assert.equal(new Set(slugs).size,slugs.length);
 assert.equal(new Set(titles).size,titles.length);
 for(const x of docs.modules){
  assert.ok(x.content.length>300,x.slug+' should contain actionable reference content');
  assert.equal(x.kind,'note');
 }
});
