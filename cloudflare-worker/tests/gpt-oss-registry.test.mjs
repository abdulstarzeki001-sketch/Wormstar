import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ui from '../future-ui.js';

const catalog=JSON.parse(readFileSync(new URL('../knowledge/gpt_oss_official_models.json',import.meta.url),'utf8'));
const raw=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const html=JSON.parse(raw.match(/^const HTML = (.+);$/m)[1]);

test('GPT-OSS model registry indexes independently hosted 120B and 20B base models',()=>{
 assert.equal(catalog.downloadStatus,'links_only_no_weights_downloaded');
 assert.equal(catalog.models.length,2);
 const list=Object.fromEntries(catalog.models.map(x=>[x.name,x]));
 assert.equal(list['gpt-oss-120b'].weightParts,15);
 assert.equal(list['gpt-oss-20b'].weightParts,3);
 assert.equal(list['gpt-oss-120b'].cloudflareModel,'@cf/openai/gpt-oss-120b');
 assert.equal(list['gpt-oss-20b'].cloudflareModel,'@cf/openai/gpt-oss-20b');
 for(const model of catalog.models){
  assert.equal(model.license,'Apache-2.0');
  assert.equal(model.files.filter(x=>x.filename.endsWith('.safetensors')).length,model.weightParts);
  assert.ok(model.files.some(x=>x.filename==='tokenizer.json'));
  assert.ok(model.files.some(x=>x.filename==='model.safetensors.index.json'));
  for(const file of model.files)assert.ok(file.url.startsWith('https://huggingface.co/'+model.id+'/resolve/main/'));
 }
});
test('Server enforces exact GPT-OSS selection and preserves an accessible fallback',()=>{
 assert.match(raw,/const WORMSTAR_ENGINES = Object.freeze/);
 assert.match(raw,/'gpt-oss-120b': Object.freeze/);
 assert.match(raw,/'gpt-oss-20b': Object.freeze/);
 assert.match(raw,/Object.hasOwn\(WORMSTAR_ENGINES,engine\)/);
 assert.match(raw,/fallbackUsed:model!==models\[0\]/);
 assert.match(raw,/model:'gpt-oss-120b'/);
});
test('iPhone model picker offers GPT-OSS and shows the model actually used',()=>{
 assert.match(html,/id="chatEngine"/);
 assert.match(html,/<option value="gpt-oss-120b">/);
 assert.match(html,/<option value="gpt-oss-20b">/);
 assert.match(html,/engine:el\('chatEngine'\)\.value/);
 assert.match(html,/modelUsed:data\.modelUsed/);
 assert.match(ui.css,/WORMSTAR GPT-OSS model picker/);
});
