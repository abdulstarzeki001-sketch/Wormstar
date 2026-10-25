import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import UI from '../future-ui.js';

const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const base=source.match(/^const HTML = (.+);$/m);
assert.ok(base,'worker HTML must exist');
const html=JSON.parse(base[1]);
const pack=JSON.parse(readFileSync(new URL('../knowledge/wormstar-neo-knowledge-pack.json',import.meta.url),'utf8'));
const migration=readFileSync(new URL('../../supabase/migrations/20261025_wormstar_neo_starter_knowledge_catalog.sql',import.meta.url),'utf8');

test('Wormstar NEO preset is fully populated and validated',()=>{
 assert.ok(pack.profile.name.includes('Wormstar'));
 assert.ok(pack.profile.instructions.length>=1500);
 assert.ok(pack.profile.constraints.length>200);
 assert.ok(pack.policy.mission.length>300);
 assert.equal(pack.policy.allowed_modes.length,6);
 assert.deepEqual(pack.policy.required_terms,[]);
 assert.equal(pack.policy.memory_enabled,true);
 assert.ok(pack.policy.workflow_steps.length<=8);
 assert.equal(pack.policy.max_output_tokens,1800);
});
test('catalog contains 25 unique non-empty guides and RLS read-only policies',()=>{
 assert.equal(pack.entries.length,25);
 assert.equal(new Set(pack.entries.map(x=>x.slug)).size,25);
 for(const x of pack.entries){assert.ok(x.title.length>8&&x.content.length>240);}
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/GRANT SELECT ON public\.wormstar_starter_library TO authenticated/);
 assert.doesNotMatch(migration,/GRANT (INSERT|UPDATE|DELETE) ON public\.wormstar_starter_library TO authenticated/);
});
test('on-device Supabase persistence remains optional and session refresh is serialized',()=>{
 assert.match(html,/id="sbRemember"/);
 assert.match(html,/localStorage\.setItem\(SB_SESSION_KEY/);
 assert.match(html,/sessionStorage\.setItem\(SB_SESSION_KEY/);
 assert.match(html,/function sbForgetSession/);
 assert.match(html,/let sbRefreshPromise=null/);
 assert.match(html,/if\(sbRefreshPromise\)return sbRefreshPromise/);
 assert.match(html,/if\(sbSession\)void sbCheckSession/);
 assert.match(html,/auth\/v1\/logout/);
 assert.doesNotMatch(html,/service_role/);
});
test('memory library provides filters and guided knowledge templates',()=>{
 for(const id of ['sbImportStarter','noteTemplate','libraryVisibleCount','memorySearch','memoryList'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/data-library-kind="correction"/);
 assert.match(html,/const libraryTemplates/);
 assert.match(html,/wormstar_starter_library\?select=/);
 assert.match(UI.css,/\.sb-remember-option/);
 assert.match(UI.css,/\.ws-library-filters/);
 assert.match(UI.boot,/localStorage\.getItem\('wormstar-sb-session'\)/);
});
