import { readFileSync, writeFileSync } from 'node:fs';

// Bundle the reviewed standalone UI files into the single-file Cloudflare Worker.
// This preview deliberately exposes no privileged APIs, secrets, or data bindings.
let worker = readFileSync('worker.js', 'utf8');
const revision = (process.env.GITHUB_SHA || 'local').slice(0, 12);
const files = [
  ['INDEX', 'index.html'],
  ['MANIFEST', 'manifest.webmanifest'],
  ['SW', 'sw.js'],
];

for (const [name, filename] of files) {
  let value = readFileSync(filename, 'utf8');
  if (name === 'MANIFEST') JSON.parse(value);
  if (name === 'SW') {
    value = value.replaceAll('wormstar-sentinel-ui-v1', `wormstar-sentinel-ui-${revision}`);
  }
  const pattern = new RegExp(`^const ${name} = .*;$`, 'm');
  if (!pattern.test(worker)) throw new Error(`Missing generated constant: ${name}`);
  worker = worker.replace(pattern, `const ${name} = ${JSON.stringify(value)};`);
}

writeFileSync('worker.js', worker);
console.log(`Prepared Sentinel preview Worker (${revision})`);
