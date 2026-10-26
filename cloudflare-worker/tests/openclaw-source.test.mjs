import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

const root=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>readFileSync(path.join(root,p),'utf8');
const PIN='cd3bcc01765305ff1a44f70ca187734269183965';

test('OpenClaw is the original upstream source pinned as a Git submodule',()=>{
 const modules=read('.gitmodules');
 assert.match(modules,/\[submodule "OpenClaw"\]/);
 assert.match(modules,/path = OpenClaw/);
 assert.match(modules,/url = https:\/\/github\.com\/openclaw\/openclaw\.git/);
 const tree=execFileSync('git',['ls-tree','HEAD','OpenClaw'],{cwd:root,encoding:'utf8'}).trim();
 assert.equal(tree,'160000 commit '+PIN+'\tOpenClaw');
});

test('Official OpenClaw Docker gateway is published on loopback only',()=>{
 const overlay=read('integrations/openclaw/docker-compose.extra.yml');
 assert.match(overlay,/ports: !override/);
 for(const port of [18789,18790,3978])
   assert.ok(overlay.includes('127.0.0.1:'+port+':'+port));
 assert.doesNotMatch(overlay,/0\.0\.0\.0:/);
});

test('Installer is opt-in, uses the official source, and preserves Wormstar CLI',()=>{
 const setup=read('integrations/openclaw/setup.sh');
 assert.match(setup,/git submodule update --init OpenClaw/);
 assert.match(setup,/scripts\/docker\/setup\.sh/);
 assert.match(setup,/docker compose -f docker-compose\.yml -f docker-compose\.extra\.yml config/);
 assert.match(setup,/--install/);
 assert.match(setup,/loopback|127\.0\.0\.1/);
 const config=read('integrations/openclaw/enable-wormstar-api.sh');
 assert.match(config,/config set gateway\.http\.endpoints\.chatCompletions\.enabled true/);
 assert.match(config,/stop openclaw-gateway/);
 assert.match(config,/config validate/);
 assert.match(config,/up -d openclaw-gateway/);
 for(const file of ['setup.sh','enable-wormstar-api.sh'])
   assert.doesNotThrow(()=>execFileSync('bash',['-n',path.join(root,'integrations/openclaw',file)],{encoding:'utf8'}));
});

test('Gateway status and chat are authenticated and never claim connection without a host',()=>{
 const js=read('cloudflare-worker/worker.js');
 assert.match(js,/async function probeOpenClaw\(env\)/);
 assert.match(js,/async function invokeOpenClaw\(env/);
 assert.match(js,/agents\.openclaw\.chat/);
 assert.match(js,/\/v1\/models/);
 assert.match(js,/openclaw\/default/);
 const caps=JSON.parse(read('openclaw/capabilities.json'));
 assert.equal(caps.connected,false);
 assert.equal(caps.hostRequired,true);
});
