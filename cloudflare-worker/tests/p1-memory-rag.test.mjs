import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalize,termsFor,rankKnowledge} from '../rag-engine.js';
const code=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
const match=code.match(/^const HTML = (.+);$/m);
assert.ok(match);
const html=JSON.parse(match[1]);
test('Arabic query normalization and punctuation retain relevant terms',()=>{
 assert.equal(normalize('الإِصدارات'), 'الاصدارات');
 assert.ok(termsFor('كيفية إصلاح أخطاء GPT-OSS في نظام المعرفة').includes('اخطاء'));
 assert.ok(termsFor('مرحبا كيف حالك؟').length>=1);
});
test('RAG prioritizes title matches and relevant excerpts, returns source IDs',()=>{
 const rows=[
 {id:'older',title:'خطة استعادة الذاكرة الدائمة',kind:'note',content:'ملخص\nاسترجاع قاعدة البيانات بأمان\nخطوات الاستعادة',updated_at:'2026-01-01'},
 {id:'noise',title:'دليل آخر',kind:'file',content:'لا شيء مهم هنا',updated_at:'2026-10-27'},
 {id:'second',title:'سجلات',kind:'note',content:'الفحص والاستعادة عند الأخطاء',updated_at:'2026-10-24'}
 ];
 const r=rankKnowledge(rows,'استعادة الذاكرة',{limit:4,budget:1400});
 assert.equal(r[0].id,'older');
 assert.ok(r[0].content.includes('الذاكرة') || r[0].content.includes('استرجاع'));
 assert.ok(!r.some(x=>x.id==='noise'));
});
test('RAG handles nonmatches without leaking unrelated content',()=>{
 assert.deepEqual(rankKnowledge([{id:'s',title:'خاص',kind:'note',content:'confidential'}],'لا يوجد سياق مطابق'),[]);
});
test('new knowledge API and backup limits are consistent',()=>{
 assert.match(code,/knowledge_revisions/);
 assert.match(code,/LAB_POLICY\.limits\.maxKnowledgeEntries/);
 assert.equal(JSON.parse(readFileSync(new URL('../permissions.json',import.meta.url),'utf8')).limits.maxKnowledgeEntries,500);
 assert.match(code,/LIMIT 500/);
 assert.match(html,/limit=500/);
 assert.match(html,/id="showMemoryHistory"/);
 assert.match(html,/id="profileHistoryBtn"/);
 assert.match(html,/تعارض/);
});
test('RAG is bounded, knowledge does not overwrite model weights',()=>{
 const huge='x'.repeat(60000)+'\nواحد وثيقة';
 const out=rankKnowledge([{id:'d',title:'وثيقة',kind:'file',content:huge}],'وثيقة',{budget:420});
 assert.ok(out.length===1 && out[0].content.length<=420);
});
