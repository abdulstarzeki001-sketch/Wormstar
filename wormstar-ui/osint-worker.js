// STAR OSINT AI — same-origin, read-only report dashboard.
// Files stay inside the browser tab. This module never contacts Kali or Core.
const PAGE = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>STAR OSINT AI | Wormstar Sentinel</title>
<style>
:root{color-scheme:dark;--bg:#080f1e;--panel:#121e31;--line:#304259;--ink:#eff7ff;--muted:#adc0d4;--green:#53dfc1;--blue:#82bafa}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#163047,transparent 50%),var(--bg);color:var(--ink);font:15px/1.8 system-ui,'Segoe UI',Tahoma,sans-serif}
main{max-width:1160px;margin:auto;padding:25px 18px 70px}a{color:var(--blue)}header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:1px solid var(--line);padding-bottom:18px}
h1{font-size:clamp(24px,4vw,38px);margin:28px 0 5px}h2{font-size:19px;margin:0 0 12px}.muted,p{color:var(--muted)}.pill{background:#19493e;color:#9df1d4;border:1px solid #3c7c68;border-radius:30px;padding:4px 12px;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:15px;margin:20px 0}.card{border:1px solid var(--line);border-radius:16px;background:var(--panel);padding:20px;min-width:0}
.action{display:inline-flex;gap:8px;align-items:center;border-radius:9px;border:1px solid #46736e;background:#193a3f;color:#e0fff7;padding:10px 16px;cursor:pointer;text-decoration:none;font:inherit}
.action:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--green);outline-offset:3px}
input[type=file]{width:100%;max-width:100%;background:#0b172a;border:1px solid var(--line);padding:14px;border-radius:10px;color:var(--ink)}
input[type=search],select{width:100%;padding:10px;background:#091527;color:var(--ink);border:1px solid var(--line);border-radius:9px;font:inherit}
.toolbar{display:grid;grid-template-columns:minmax(0,1fr) 210px;gap:10px;margin:12px 0}@media(max-width:600px){.toolbar{grid-template-columns:1fr}}
.big{font-size:27px;color:var(--green);font-weight:750}.summary{white-space:pre-wrap;overflow-wrap:anywhere;color:var(--ink)}.list{margin:0;padding-inline-start:23px}.list li{margin:5px 0;overflow-wrap:anywhere}
.tablewrap{max-height:600px;overflow:auto;border:1px solid var(--line);border-radius:12px}table{border-collapse:collapse;width:100%;text-align:right;min-width:590px}
th,td{border-bottom:1px solid var(--line);padding:11px;vertical-align:top;overflow-wrap:anywhere;max-width:490px}th{background:#1a2b41;position:sticky;top:0}
code{color:#a8efdd}small{font-size:12px}.warning{color:#f6d58e}.hidden{display:none!important}
</style>
</head>
<body>
<main>
<header><strong>WORMSTAR / STAR OSINT AI</strong><a href="/">العودة إلى Wormstar Sentinel</a></header>
<h1>مختبر OSINT والتحليل المحلي</h1>
<p>واجهة Wormstar لعرض الأدلة والتقارير التي يولدها STAR OSINT AI على Kali. لا يجري هذا القسم فحوصاً من السحابة ولا يتصل بخادمك المحلي تلقائياً.</p>
<div class="grid">
<section class="card"><span class="pill">LOCAL · KALI</span><h2>تشغيل جمع المعلومات</h2><p>شغّل فحوص DNS وCT وWHOIS وAmass والتحليل بواسطة Ollama من منصتك المحلية.</p><a class="action" href="http://127.0.0.1:8787/" target="_blank" rel="noopener noreferrer">فتح لوحة Kali المحلية</a><p><small>الرابط يعمل فقط على الجهاز الذي يصل إلى الخدمة محلياً (مثل Windows مع Kali/WSL). لن يعمل من هاتف خارجي تلقائياً.</small></p></section>
<section class="card"><span class="pill">NO UPLOAD</span><h2>استيراد التقرير داخل Wormstar</h2><p>من Kali نزّل التقرير بصيغة JSON، ثم اختر الملف هنا. التحليل المعروض محلي في هذه الصفحة؛ لا يُرفع إلى GitHub أو Cloudflare.</p>
<label for="reportFile">ملف تقرير STAR OSINT AI JSON</label><input id="reportFile" type="file" accept=".json,application/json">
<p id="message" role="status" aria-live="polite">لم يتم تحميل تقرير.</p>
<button id="clear" type="button" class="action">مسح التقرير من الصفحة</button></section>
</div>
<section id="output" class="hidden" aria-label="تقرير OSINT">
<div class="grid">
<div class="card"><small>النطاق</small><div class="big" id="domain"></div></div>
<div class="card"><small>حالة الفحص</small><div class="big" id="scanStatus"></div></div>
<div class="card"><small>عدد الأدلة المعروضة</small><div class="big" id="count"></div></div>
<div class="card"><small>نموذج التحليل</small><div class="big" id="model"></div></div>
</div>
<div class="grid">
<section class="card"><h2>الملخص التنفيذي</h2><p class="summary" id="executive"></p><small id="fingerprint"></small></section>
<section class="card"><h2>ملاحظات وتحذيرات</h2><ul id="risks" class="list"></ul><p class="warning">المعلومات العامة والمؤشرات لا تثبت وجود ثغرة؛ تحقق من الأدلة قبل اتخاذ قرار.</p></section>
<section class="card"><h2>التوصيات</h2><ul id="recommendations" class="list"></ul></section>
</div>
<section class="card"><h2>سجل الأدلة</h2><div class="toolbar"><input type="search" id="filter" placeholder="ابحث داخل الأدلة" aria-label="البحث في الأدلة"><select id="kind" aria-label="فلتر النوع"><option value="">جميع الأنواع</option></select></div><p id="shown" role="status"></p>
<div class="tablewrap"><table><thead><tr><th>النوع</th><th>القيمة</th><th>المصدر</th><th>الثقة</th></tr></thead><tbody id="evidence"></tbody></table></div></section>
</section>
<footer><p><small>البيانات تبقى في ذاكرة المتصفح حتى تغلق الصفحة أو تضغط مسح. لا توجد مزامنة، أو واجهة تنفيذ عن بعد، أو وصول سحابي إلى Ollama.</small></p></footer>
</main>
<script>
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  let records = [];
  const message = value => {el('message').textContent = value;};
  const short = (value, max=800) => String(value == null ? '' : value).slice(0,max);
  function reset(){
    records=[];el('reportFile').value='';el('output').classList.add('hidden');
    el('filter').value='';el('kind').replaceChildren(new Option('جميع الأنواع',''));
    el('evidence').replaceChildren();message('تم مسح التقرير من الصفحة.');
  }
  function bullets(id, entries){
    const list=el(id);list.replaceChildren();
    (Array.isArray(entries) ? entries.slice(0,30) : []).forEach(entry=>{
      const li=document.createElement('li');li.textContent=short(entry,700);list.append(li);
    });
  }
  function renderEvidence(){
    const query=el('filter').value.trim().toLocaleLowerCase();
    const kind=el('kind').value;
    const chosen=records.filter(r=>(!kind||r.kind===kind)&&(!query||[r.kind,r.value,r.source].join(' ').toLocaleLowerCase().includes(query)));
    const tbody=el('evidence');tbody.replaceChildren();
    for(const record of chosen.slice(0,2000)){
      const tr=document.createElement('tr');
      for(const key of ['kind','value','source','confidence']){
        const td=document.createElement('td');td.textContent=short(record[key],2000);tr.append(td);
      }
      tbody.append(tr);
    }
    el('shown').textContent='المعروض: '+Math.min(chosen.length,2000)+' من أصل '+records.length;
  }
  function render(data){
    if(!data || typeof data!=='object' || Array.isArray(data) || !data.scan || !Array.isArray(data.findings))throw Error('صيغة التقرير غير مدعومة: يجب وجود scan و findings');
    if(data.findings.length>10000)throw Error('التقرير يتجاوز حد 10,000 دليل');
    const scan=data.scan;
    if(!scan || typeof scan!=='object' || Array.isArray(scan))throw Error('بيانات الفحص غير صالحة');
    const summary=data.summary && typeof data.summary==='object' && !Array.isArray(data.summary) ? data.summary : {};
    records=data.findings.filter(x=>x&&typeof x==='object'&&!Array.isArray(x)).map(x=>({
      kind:short(x.kind,100),value:short(x.value,2000),source:short(x.source,100),confidence:short(x.confidence,100)
    }));
    el('domain').textContent=short(scan.domain,220)||'غير معروف';
    el('scanStatus').textContent=short(scan.status,40)||'غير معروف';
    el('count').textContent=String(records.length);
    el('model').textContent=short(data.report?.model || data.report?.model_used || 'Qwen / Local',60);
    el('executive').textContent=short(summary.executive_summary || 'لا يوجد تحليل AI محفوظ في التقرير.',4000);
    el('fingerprint').textContent='SHA-256: '+short(data.fingerprint || 'غير متاح',64);
    bullets('risks',summary.risks||summary.highlights);
    bullets('recommendations',summary.recommendations);
    const kinds=[...new Set(records.map(x=>x.kind).filter(Boolean))].sort();
    const select=el('kind');select.replaceChildren(new Option('جميع الأنواع',''));
    kinds.slice(0,200).forEach(k=>select.append(new Option(k,k)));
    el('filter').value='';el('output').classList.remove('hidden');renderEvidence();
    message('تم فتح التقرير محلياً: '+records.length+' دليل.');
  }
  el('reportFile').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    reset();el('reportFile').files=event.target.files;
    if(file.size>2*1024*1024){message('الملف أكبر من الحد المسموح: 2 MB');return;}
    try{render(JSON.parse(await file.text()));}catch(err){reset();message('تعذّر فتح التقرير: '+short(err.message,200));}
  });
  el('clear').addEventListener('click',reset);
  el('filter').addEventListener('input',renderEvidence);
  el('kind').addEventListener('change',renderEvidence);
})();
</script>
</body>
</html>`;

const headers = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"
};
export default {
  fetch(request){
    const path=new URL(request.url).pathname;
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
    if(path==='/osint/health')return Response.json({ok:true,local_only:true,mode:'browser-file-import'},{headers:{'Cache-Control':'no-store'}});
    if(!['/osint','/osint/','/osint/index.html'].includes(path))return new Response('Not found',{status:404});
    return new Response(request.method==='HEAD'?null:PAGE,{status:200,headers});
  }
};
