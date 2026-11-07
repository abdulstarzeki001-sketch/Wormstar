import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeDiff} from './security-gate.mjs';
test('detects a newly added unsafe evaluation and preserves line number',()=>{
 const diff=['diff --git a/wormstar-ui/x.js b/wormstar-ui/x.js','+++ b/wormstar-ui/x.js','@@ -4,0 +5,2 @@','+const safe=true;','+eval(input);'].join('\n');
 const out=analyzeDiff(diff);
 assert.equal(out.findings.length,1);
 assert.deepEqual([out.findings[0].id,out.findings[0].line],['dynamic-eval',6]);
});
test('excludes third-party archived data and test fixtures',()=>{
 const diff=['+++ b/integrations/star-cyber-audit-ish/tests/fixture.py','@@ -0,0 +1 @@',"+eval(input)",'+++ b/research/raw-uploads/source.js','@@ -0,0 +1 @@','+eval(input)'].join('\n');
 assert.equal(analyzeDiff(diff).findings.length,0);
});
test('does not flag ordinary safe functions and regular expressions',()=>{
 const diff=['+++ b/cloudflare-worker/rules.js','@@ -2,0 +3,2 @@',"+const fn=(x)=>x+1;",'+const text="security checks enabled";'].join('\n');
 assert.equal(analyzeDiff(diff).findings.length,0);
});
test('marks newly added committed credentials as high',()=>{
 const diff=['+++ b/cloudflare-worker/worker.js','@@ -0,0 +1 @@',"+const secret='sk-proj-FAKE_TEST_SECRET_DO_NOT_DEPLOY';"].join('\n');
 assert.equal(analyzeDiff(diff).findings[0].severity,'high');
});
