// Hybrid multilingual RAG: Vectorize stores IDs and embeddings only; D1 is the source of truth.
import {rankKnowledge,termsFor} from './rag-engine.js';
export const EMBEDDING_MODEL='@cf/baai/bge-m3';
const MAX_CHARS=1200;
const UUID=/^[a-f0-9-]{36}$/i;
function isVector(value){return Array.isArray(value)&&value.length===1024&&value.every(Number.isFinite);}
function embedding(response){const v=response?.data?.[0];if(!isVector(v))throw Error('Embedding output does not match 1024 dimensions');return v;}
function textChunks(row){
 const base=String(row.content||'').trim();
 if(!base)return [];
 const label=String(row.title||'').slice(0,130);
 const max=Math.max(200,MAX_CHARS-label.length-4);
 return [base.slice(0,max),base.slice(max,2*max)].filter(Boolean).map(x=>label+'\n'+x);
}
export async function semanticSearch(env,query,{limit=4,budget=6500}={}){
 if(!env.AI||!env.VECTORS||!env.DB||typeof query!=='string'||!query.trim())return [];
 const vector=embedding(await env.AI.run(EMBEDDING_MODEL,{text:[query.slice(0,900)]}));
 const result=await env.VECTORS.query(vector,{topK:12,returnMetadata:'all'});
 const matches=Array.isArray(result?.matches)?result.matches:[];
 const ids=[];
 for(const match of matches){
   // Low-score approximate matches are not trustworthy evidence.
   if(typeof match?.score!=='number'||match.score<0.5)continue;
   const id=match?.metadata?.sourceId;
   if(typeof id==='string'&&UUID.test(id)&&!ids.includes(id))ids.push(id);
   if(ids.length>=6)break;
 }
 let remaining=budget;
 const documents=[];
 for(const id of ids){
   if(documents.length>=limit||remaining<180)break;
   const row=await env.DB.prepare('SELECT id,title,kind,content FROM knowledge WHERE id=?').bind(id).first();
   if(!row)continue; // deleted/stale vector is never trusted as a source
   const excerpt=String(row.content||'').slice(0,Math.min(1900,remaining));
   if(!excerpt)continue;
   documents.push({id:row.id,title:row.title,kind:row.kind,content:excerpt,semantic:true});
   remaining-=excerpt.length;
 }
 return documents;
}
export async function hybridKnowledge(env,query,{limit=4,budget=8500}={}){
 const terms=termsFor(query);
 let lexical=[];
 if(env.DB&&terms.length){
   const keys=[...new Set(terms.slice(0,8).flatMap(t=>t.startsWith('ال')&&t.length>4?[t,t.slice(2)]:[t]))].slice(0,12);
   const sql=keys.map(()=>'(instr(lower(title), ?) > 0 OR instr(lower(content), ?) > 0)').join(' OR ');
   const rows=(await env.DB.prepare('SELECT id,title,kind,content,updated_at FROM knowledge WHERE '+sql+' ORDER BY updated_at DESC LIMIT 160').bind(...keys.flatMap(t=>[t,t])).all()).results||[];
   lexical=rankKnowledge(rows,query,{limit,budget});
 }
 let semantic=[];
 let vectorStatus='not-configured';
 if(env.VECTORS&&env.AI){
   try{semantic=await semanticSearch(env,query,{limit,budget});vectorStatus='online';}
   catch{vectorStatus='degraded';} // fallback to lexical without leaking private input in logs
 }
 const combined=[];let left=budget;
 // Keep exact lexical evidence first; semantic matches supply recall for paraphrases.
 for(const row of [...lexical.slice(0,2),...semantic,...lexical]){
   if(combined.some(r=>r.id===row.id))continue;
   const content=String(row.content||'').slice(0,Math.min(left,2200));
   if(!content)continue;
   combined.push({...row,content});
   left-=content.length;
   if(combined.length>=limit||left<200)break;
 }
 return {documents:combined,retrieval:vectorStatus,semanticSources:semantic.length};
}
export async function indexKnowledgeBatch(env,{cursor='',limit=4}={}){
 if(!env.DB||!env.AI||!env.VECTORS)throw Error('Vectorize or D1 binding unavailable');
 if(cursor&&!UUID.test(cursor))throw Error('Invalid cursor');
 if(!Number.isInteger(limit)||limit<1||limit>6)throw Error('Limit must be 1-6');
 const rows=(await env.DB.prepare('SELECT id,title,kind,content FROM knowledge WHERE id>? ORDER BY id LIMIT ?').bind(cursor,limit).all()).results||[];
 const vectors=[];
 for(const row of rows){
   if(!UUID.test(row.id))continue;
   const texts=textChunks(row);
   if(!texts.length)continue;
   const data=await env.AI.run(EMBEDDING_MODEL,{text:texts});
   if(!Array.isArray(data?.data)||data.data.length!==texts.length)throw Error('Embedding count mismatch');
   for(let i=0;i<texts.length;i++){
     if(!isVector(data.data[i]))throw Error('Unexpected embedding dimensions');
     vectors.push({id:row.id+':'+i,values:data.data[i],metadata:{sourceId:row.id}});
   }
 }
 if(vectors.length)await env.VECTORS.upsert(vectors);
 return {indexedDocuments:rows.length,indexedVectors:vectors.length,nextCursor:rows.at(-1)?.id||cursor,done:rows.length<limit,index:'wormstar-knowledge-m3',model:EMBEDDING_MODEL};
}
