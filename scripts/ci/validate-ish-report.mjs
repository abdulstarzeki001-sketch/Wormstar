#!/usr/bin/env node
// Validates a local iSH static audit report without assigning imaginary severities.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const path=resolve(process.argv[2]||'');
const target=resolve(process.argv[3]||'artifacts/ish-inventory-summary.json');
if(!process.argv[2])throw Error('Provide input report path');
const payload=JSON.parse(readFileSync(path,'utf8'));
if(payload.static_read_only!==true || !Array.isArray(payload.files) ||
   !payload.files.every(x=>x&&typeof x.name==='string'&&Array.isArray(x.flags)&&Array.isArray(x.api_paths))){
 throw Error('Invalid iSH analyzer report schema');
}
const totals={js:payload.files.filter(f=>f.classification==='JS_SOURCE').length,files:payload.files.length,
  reviewFlags:payload.files.reduce((n,f)=>n+f.flags.length,0)};
const output={schemaVersion:1,kind:'ish-static-review-summary',git_sha:process.env.GITHUB_SHA||'local',
   counts:totals,disclaimer:'Heuristic code-review flags are not confirmed vulnerabilities. No remote requests were performed.'};
mkdirSync(dirname(target),{recursive:true});writeFileSync(target,JSON.stringify(output,null,2)+'\n');
console.log('iSH static scan parsed successfully:',JSON.stringify(totals));
