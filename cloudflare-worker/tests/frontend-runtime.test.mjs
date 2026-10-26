import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import FUTURE_UI from '../future-ui.js';

const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const sourceMatch=source.match(/^const HTML = (.+);$/m);
assert.ok(sourceMatch,'Base HTML must be present');
const html=JSON.parse(sourceMatch[1]);

test('embedded UI scripts compile without execution or access to browser globals',()=>{
 const matches=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert.ok(matches.length>=1,'There must be a functional chat script');
 for(const match of matches) assert.doesNotThrow(()=>new Function(match[1]));
 assert.doesNotThrow(()=>new Function(FUTURE_UI.boot));
});
test('chat saving is optional, interactive and warns when local history may be lost',()=>{
 assert.match(html,/<input[^>]*id="chatAutoBackup"[^>]*type="checkbox"/);
 assert.match(html,/id="chatCloudSave"/);
 assert.match(html,/id="chatCloudRestore"/);
 assert.match(html,/id="chatCloudDelete"/);
 assert.match(html,/id="chatArchiveStatus"/);
 assert.match(html,/قد تضيع الرسائل التي لم تحفظها/);
 assert.match(html,/const archiveEnabled=\(\)=>/);
 assert.match(html,/async function maybeRestoreArchive\(mode\)/);
 assert.match(html,/async function restoreChatArchive\(mode=active,silent=false\)/);
 assert.match(html,/async function saveChatArchive\(mode=active,silent=false\)/);
});
test('keep private cloud archive behind bearer auth with no anonymous response',()=>{
 assert.match(source,/if\(url\.pathname\.startsWith\('\/api\/studio\/'\)\)\{if\(!\(await allow\(request,env\)\)\)/);
 assert.match(source,/return \{GET:'memory\.chats\.read',PUT:'memory\.chats\.write',DELETE:'memory\.chats\.delete'\}/);
});
