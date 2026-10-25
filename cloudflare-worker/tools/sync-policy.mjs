#!/usr/bin/env node
// Source-of-truth sync: policy/permissions.json + policy/system_prompt.md -> Worker embedded policy.
// Run from any directory: node cloudflare-worker/tools/sync-policy.mjs [--check].
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workerPath = path.join(root, 'cloudflare-worker', 'worker.js');
const permissionsPath = path.join(root, 'policy', 'permissions.json');
const promptPath = path.join(root, 'policy', 'system_prompt.md');
const permissions = JSON.parse(fs.readFileSync(permissionsPath, 'utf8'));
const prompt = fs.readFileSync(promptPath, 'utf8').trim();
const original = fs.readFileSync(workerPath, 'utf8');

function replaceBetween(text, prefix, suffix, replacement) {
  const a = text.indexOf(prefix);
  if (a < 0 || text.indexOf(prefix, a + prefix.length) >= 0) {
    throw new Error('Missing or duplicated policy marker: ' + prefix);
  }
  const b = text.indexOf(suffix, a + prefix.length);
  if (b < 0) throw new Error('Missing trailing policy marker: ' + suffix);
  return text.slice(0, a) + replacement + text.slice(b);
}

let updated = replaceBetween(
  original,
  'const LAB_POLICY = Object.freeze(',
  ';\nconst LAB_BASE_INSTRUCTIONS',
  'const LAB_POLICY = Object.freeze(' + JSON.stringify(permissions) + ')'
);
updated = replaceBetween(
  updated,
  'const LAB_BASE_INSTRUCTIONS = ',
  ';\nfunction capabilityEnabled',
  'const LAB_BASE_INSTRUCTIONS = ' + JSON.stringify(prompt)
);

if (process.argv.includes('--check')) {
  if (updated !== original) {
    console.error('Worker policy out of sync. Run: node cloudflare-worker/tools/sync-policy.mjs');
    process.exitCode = 1;
  } else {
    console.log('Policy synced with Cloudflare Worker.');
  }
} else {
  fs.writeFileSync(workerPath, updated);
  console.log('Updated Cloudflare Worker policy from policy/ files.');
}
