import { readFileSync, writeFileSync } from 'node:fs';
import { Script } from 'node:vm';

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
  // Use a replacement CALLBACK: String.replace(template) interprets '$' in the
  // serialized HTML as '
}

writeFileSync('worker.js', worker);
console.log(`Prepared Sentinel preview Worker (${revision})`);
, breaking the '$' DOM helper and every UI control.
  worker = worker.replace(pattern, () => `const ${name} = ${JSON.stringify(value)};`);
  const embedded = worker.match(pattern)?.[0].match(/^const \w+ = (.*);$/)?.[1];
  if (!embedded || JSON.parse(embedded) !== value) {
    throw new Error(`Embedded ${name} differs from ${filename}`);
  }
  if (name === 'INDEX') {
    const scripts = [...value.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
    for (const script of scripts) new Script(script[1], { filename: 'index.html:inline' });
  }
}

writeFileSync('worker.js', worker);
console.log(`Prepared Sentinel preview Worker (${revision})`);
