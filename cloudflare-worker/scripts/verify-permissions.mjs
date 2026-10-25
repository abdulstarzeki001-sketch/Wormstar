// Verify generated module and deny-by-default baseline without executing application code.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const policy = JSON.parse(await readFile(new URL('../permissions.json', import.meta.url), 'utf8'));
const moduleText = await readFile(new URL('../permissions-module.js', import.meta.url), 'utf8');
const match = moduleText.match(/export default (\{[\s\S]*\});\s*$/);
assert.ok(match, 'Generated module must export a JSON object');
assert.deepEqual(JSON.parse(match[1]), policy, 'Generated module must match permissions.json');
assert.equal(policy.defaultDecision, 'deny');
for (const capability of ['execution.shell', 'execution.python', 'execution.user_code', 'network.active_scan', 'credentials.harvest', 'deployment.self_modify']) {
  assert.equal(policy.serverCapabilities[capability], false, capability + ' must remain disabled');
}
assert.equal(policy.authRequiredForAllOperations, true);
console.log('Permission manifest verified');
