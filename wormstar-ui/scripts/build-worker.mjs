import { readFileSync, writeFileSync } from 'node:fs';
import { Script } from 'node:vm';

// Bundle the Sentinel UI with a restricted, owner-authenticated Core service proxy.
let worker = readFileSync('worker.js', 'utf8');
const revision = (process.env.GITHUB_SHA || 'local').slice(0, 12);
const files = [
  ['INDEX', 'index.html'],
  ['MANIFEST', 'manifest.webmanifest'],
  ['SW', 'sw.js'],
  ['TERMINAL_JS', 'terminal.js'],
];

for (const [name, filename] of files) {
  let value = readFileSync(filename, 'utf8');
  if (name === 'MANIFEST') JSON.parse(value);
  if (name === 'SW') {
    value = value.replaceAll('wormstar-sentinel-ui-v1', `wormstar-sentinel-ui-${revision}`);
  }
  if (name === 'INDEX') {
    const scripts = [...value.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
    for (const script of scripts) new Script(script[1], { filename: 'index.html:inline' });
  }
  const pattern = new RegExp(`^const ${name} = .*;$`, 'm');
  if (!pattern.test(worker)) throw new Error(`Missing generated constant: ${name}`);
  // Callback replacement is essential: a string replacement interprets $$ as $.
  worker = worker.replace(pattern, () => `const ${name} = ${JSON.stringify(value)};`);
  const embedded = worker.match(pattern)?.[0].match(/^const \w+ = (.*);$/)?.[1];
  if (!embedded || JSON.parse(embedded) !== value) {
    throw new Error(`Embedded ${name} differs from ${filename}`);
  }
}

writeFileSync('worker.js', worker);
console.log(`Prepared Sentinel preview Worker (${revision})`);
