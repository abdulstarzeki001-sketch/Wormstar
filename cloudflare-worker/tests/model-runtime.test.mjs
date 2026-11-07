import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseReasoningEffort,extractModelAnswer} from '../model-runtime.js';

test('Chat is fast, code is more deliberate, owner can request high reasoning',()=>{
 assert.equal(chooseReasoningEffort('assistant'),'low');
 assert.equal(chooseReasoningEffort('code'),'medium');
 assert.equal(chooseReasoningEffort('ctf','high',4096),'high');
 assert.equal(chooseReasoningEffort('assistant','high',256),'medium');
 assert.throws(()=>chooseReasoningEffort('assistant','unlimited'),/Invalid reasoning effort/);
});
test('Workers AI/Responses/OpenAI content formats yield user-visible answer',()=>{
 assert.equal(extractModelAnswer({response:' DONE '}),'DONE');
 assert.equal(extractModelAnswer({choices:[{message:{content:[{type:'text',text:'First'},{type:'text',text:'Second'}]}}]}),'First\nSecond');
 assert.equal(extractModelAnswer({output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'Final'}]}]}),'Final');
});
test('Never leaks model reasoning or internal content',()=>{
 assert.equal(extractModelAnswer({choices:[{message:{reasoning:'private',content:[]}}]}),'');
 assert.equal(extractModelAnswer({output:[{type:'reasoning',content:[{type:'text',text:'secret'}]}]}),'');
});
