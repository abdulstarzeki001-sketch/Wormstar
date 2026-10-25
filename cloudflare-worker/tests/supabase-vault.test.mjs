import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import UI from '../future-ui.js';
const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const original=worker.match(/^const HTML = (.+);$/m);
assert.ok(original,'HTML string must be present in Worker');
const html=JSON.parse(original[1]);
const migration=readFileSync(new URL('../../supabase/migrations/20261025_wormstar_cloud_sync_history.sql',import.meta.url),'utf8');

test('Supabase cloud vault has required login, backup, recovery, metrics and event history',()=>{
 for(const id of ['sbPanel','sbEmail','sbPassword','sbLogin','sbSignUp','sbResetPassword','sbLogout','sbRefreshStats','sbBackupNow','sbRestoreNow','sbRestorePolicy','sbCloudItems','sbCloudTraining','sbCloudVersions','sbCloudProfileState','sbCloudBadge','sbLastChecked','sbHistory','sbHistoryLabel']){
  assert.ok(html.includes('id="'+id+'"'), 'missing '+id);
 }
 assert.match(html,/مركز الذاكرة السحابية/);
 assert.match(html,/async function sbRefreshOverview/);
 assert.match(html,/async function sbCheckSession/);
 assert.match(html,/sbRecordEvent\('backup'/);
 assert.match(html,/sbRecordEvent\('restore_memory'/);
 assert.match(html,/sbRecordEvent\('restore_policy'/);
 assert.match(html,/auth\/v1\/user/);
 assert.match(html,/wormstar_sync_events\?select=/);
});
test('owner scoped Supabase audit history migration uses row-level security',()=>{
 assert.match(migration,/CREATE TABLE IF NOT EXISTS public\.wormstar_sync_events/);
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/auth\.uid\(\)/);
 assert.match(migration,/TO authenticated/);
 assert.match(migration,/GRANT SELECT, INSERT/);
 assert.doesNotMatch(migration,/GRANT.+TO anon/);
});
test('mobile studio uses native page selector instead of horizontally clipped tabs',()=>{
 assert.match(UI.boot,/wsStudioMobileSelect/);
 assert.match(UI.boot,/mobilePicker\.addEventListener\('change'/);
 assert.match(UI.css,/\.ws-mobile-studio-picker/);
 assert.match(UI.css,/\.ws-studio-tabs\{display:none!important/);
 assert.match(UI.css,/\.sb-form-grid\{grid-template-columns:1fr/);
 assert.match(UI.css,/\.sb-system-metrics/);
});
test('cloud vault owner-only APIs keep Wormstar access-token gate',()=>{
 assert.match(worker,/if\(url\.pathname\.startsWith\('\/api\/studio\/'\)\)\{if\(!\(await allow\(request,env\)\)\)/);
 assert.match(worker,/Object\.freeze\(LAB_POLICY_MANIFEST\)/);
 assert.doesNotMatch(worker,/service_role/);
});
