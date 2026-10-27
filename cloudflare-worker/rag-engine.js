// P1: privacy-preserving lexical RAG; no external inference or vector export.
const STOP = new Set('انا أنت انت هذا هذه ذلك تلك من في على الى إلى عن مع ماذا كيف هل كل عند بعد تم هو هي نعم لا please the and for you are with from this that have your file files'.split(/\s+/));
export function normalize(value) {
  return String(value || '').toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي');
}
export function termsFor(query) {
  const input = normalize(String(query||'').slice(0,1600));
  return [...new Set(input.split(/[^a-z0-9_\u0600-\u06ff]+/g).filter(t=>t.length>=2 && t.length<=45 && !STOP.has(t)))].slice(0,12);
}
function variants(term) {
  return term.startsWith('ال') && term.length>=5 ? [term,term.slice(2)] : [term];
}
function snippets(body,terms,budget) {
  const lines = String(body||'').split(/\r?\n/);
  const marked=[];
  for(let i=0;i<lines.length;i++){
    const text=normalize(lines[i]);
    if(terms.some(term=>variants(term).some(x=>text.includes(x)))) marked.push(i);
  }
  const selected=new Set();
  for(let i=0;i<Math.min(2,lines.length);i++)selected.add(i);
  for(const i of marked.slice(0,8))for(let j=Math.max(0,i-1);j<=Math.min(lines.length-1,i+1);j++)selected.add(j);
  const ordered=[...selected].sort((a,b)=>a-b);
  let remaining=budget;
  const output=[];
  let last=-2;
  for(const index of ordered){
    if(remaining<=0)break;
    const piece=(index>last+1?'…\n':'')+lines[index]+'\n';
    output.push(piece.slice(0,remaining));remaining-=piece.length;last=index;
  }
  return output.join('').trim().slice(0,budget);
}
export function rankKnowledge(rows,query,{limit=4,budget=8500}={}) {
  const terms=termsFor(query);
  if(!terms.length || !Array.isArray(rows))return [];
  const ranks=rows.map(row=>{
    const title=normalize(row?.title),body=normalize(row?.content);
    let score=0, hits=0,titleHits=0;
    for(const term of terms){
      const keys=variants(term);
      if(keys.some(k=>title.includes(k))){score+=15;hits++;titleHits++;}
      else if(keys.some(k=>body.includes(k))){score+=4;hits++;}
    }
    // Prefer multi-term matches. Never rank only on recency or length.
    if(titleHits)score+=3;
    score+=Math.min(hits,5)*2;
    return {row,score,hits,titleHits};
  }).filter(x=>x.score>0 && (x.titleHits>0 || x.hits>=2 || terms.length===1))
    .sort((a,b)=>b.score-a.score||String(b.row.updated_at||'').localeCompare(String(a.row.updated_at||'')))
    .slice(0,Math.min(limit,8));
  const out=[];
  let left=budget;
  for(const item of ranks){
    if(left<200)break;
    const excerpt=snippets(item.row.content,terms,Math.min(2600,left));
    if(!excerpt)continue;
    out.push({id:item.row.id,title:item.row.title,kind:item.row.kind,content:excerpt});
    left-=excerpt.length;
  }
  return out;
}
