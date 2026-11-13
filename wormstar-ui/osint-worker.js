// STAR OSINT — same-origin, browser-local read-only report viewer.
// No API collection, no remote upload, no access to CORE, D1, tokens or filesystem.
const HTML = String.raw`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0a101d">
<title>STAR OSINT | Wormstar Sentinel</title>
<style>
:root{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color-scheme:dark;background:#0a101d;color:#eef5fc}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(ellipse at 85% 0%,#133045,#0a101d 44%);padding:22px}
main{max-width:1200px;margin:auto}a{color:#75e2d2;text-decoration:none}a:hover{text-decoration:underline}
.top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:15px;margin-bottom:24px}
.brand{font:700 13px ui-monospace,monospace;letter-spacing:.12em;color:#80e4d1}
.hero{border:1px solid #2e455c;border-radius:22px;background:#111c2e;padding:25px;margin-bottom:18px}
h1{font-size:clamp(24px,4vw,36px);margin:4px 0 12px}h2{font-size:17px;margin:0 0 13px}
p{color:#b8c9d8;line-height:1.85;font-size:13px;margin:10px 0}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:15px 0}
.stat{background:#15273a;border:1px solid #2b4156;border-radius:15px;padding:17px}
.stat b{display:block;font-size:25px;color:#7de6d3;font-variant-numeric:tabular-nums}.stat small{color:#abc2d2;font-size:12px}
.panel{border:1px solid #2c4156;border-radius:17px;background:#111b2b;padding:19px;margin:15px 0}
.actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px}
.upload{border:1px solid #75d5c6;background:#163b39;padding:12px 15px;border-radius:11px;cursor:pointer;font-size:13px}
.upload:hover{background:#20524e}.upload input{position:absolute;width:1px;height:1px;opacity:0}
.note{border:1px dashed #476376;border-radius:12px;padding:12px;margin-top:15px}
input[type=search]{color:#eef5fc;background:#0c1726;border:1px solid #38526a;border-radius:10px;font:inherit;padding:12px;width:min(100%,440px)}
table{border-collapse:collapse;width:100%}th,td{text-align:right;padding:11px;border-bottom:1px solid #293d54;font-size:12px;overflow-wrap:anywhere}
th{color:#b0c6d6}td{vertical-align:top}td:first-child{font-family:ui-monospace,monospace;direction:ltr;text-align:left}
.tablebox{max-height:58vh;overflow:auto}code{font-family:ui-monospace,monospace;color:#84e4d5}
.pill{display:inline-block;border-radius:99px;border:1px solid #38556c;background:#1c3041;padding:3px 8px;margin:2px;font-size:10px}
.error{color:#ffa9a9;min-height:22px;line-height:1.6}.muted{color:#9bb2c4}
footer{padding:20px 0;color:#91a9bb;font-size:12px}
@media(max-width:740px){body{padding:13px}.grid{grid-template-columns:repeat(2,1fr)}.hero{padding:18px}.panel{padding:14px}}

/* WORMSTAR ONE: compact accessible read-only report navigation. */
.top nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.top nav a{display:inline-flex;align-items:center;min-height:34px;padding:6px 9px;
 border:1px solid #30475e;border-radius:9px}
.top nav a:focus-visible{outline:2px solid #75e2d2;outline-offset:3px}
.panel,.hero,.card{min-width:0;overflow-wrap:anywhere}
@media(max-width:640px){body{padding:11px}.top{gap:8px;margin-bottom:10px}
  .hero{padding:14px}.panel{padding:12px}
}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto!important}
  *,*::before,*::after{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<main>
<header class="top"><strong class="brand">WORMSTAR / STAR CYBER LAB / OSINT</strong><nav><a href="https://wormstar-ai-lab.abdulstarzeki001.workers.dev/suite/">WORMSTAR ONE</a> · <a href="/">الرئيسية</a> · <a href="/audit/">iSH Audit</a> · <a href="https://github.com/abdulstarzeki001-sketch/Wormstar/tree/main/integrations/star-osint" target="_blank" rel="noopener noreferrer">محرك Kali</a></nav></header>
<section class="hero">
<p class="brand">PASSIVE INTELLIGENCE / LOCAL REPORT VIEWER</p>
<h1>STAR OSINT — استخبارات النطاقات والبنية التحتية</h1>
<p>ارفع <code>report.json</code> الناتج من محرك STAR OSINT على جهازك لتشاهد الأصول ومصادرها، ويمكنك اختيارياً استيراد <code>infrastructure.json</code> لعرض IP وDNS وHTTP. الملفات تُقرأ داخل متصفحك ولا تُرفع إلى Cloudflare.</p>
<div class="actions">
<label class="upload">استيراد report.json <input id="reportFile" aria-label="استيراد تقرير OSINT" type="file" accept=".json,application/json"></label>
<label class="upload">استيراد infrastructure.json <input id="infraFile" aria-label="استيراد بيانات البنية التحتية" type="file" accept=".json,application/json"></label>
</div>
<p class="error" id="message" role="status" aria-live="polite"></p>
<div class="note"><p>هذا العارض لا يفحص نطاقات ولا يشغّل Amass أو Subfinder على Cloudflare، ولا يربط بيانات المستخدم الخاصة بـ Core. المعلومات من مصادر عامة وقد تكون تاريخية أو غير مؤكدة.</p></div>
</section>
<section class="grid" aria-label="إحصاءات التقرير">
<div class="stat"><b id="total">0</b><small>أسماء النطاقات</small></div>
<div class="stat"><b id="sources">0</b><small>مصادر الأدلة</small></div>
<div class="stat"><b id="edges">0</b><small>علاقات بنية تحتية</small></div>
<div class="stat"><b id="http">0</b><small>مشاهدات HTTP</small></div>
</section>
<section class="panel">
<h2>تفاصيل التقرير</h2>
<p id="metadata">لم يتم استيراد تقرير بعد. أنشئ واحداً باستخدام محرك Kali المدمج في Wormstar.</p>
<div class="actions"><label for="filter">بحث في المضيفين</label><input type="search" id="filter" placeholder="ابحث باسم النطاق أو مصدر الدليل" autocomplete="off"></div>
<p id="count" class="muted" aria-live="polite"></p>
<div class="tablebox"><table><thead><tr><th>Hostname</th><th>المصادر</th><th>الحالة / الأدلة</th></tr></thead><tbody id="rows"></tbody></table></div>
</section>
<footer>Wormstar Sentinel · Local-first read-only OSINT. No scanning, authentication, or upload endpoints.</footer>
</main>
<script defer src="/osint/app.js"></script>
</body>
</html>`;

const CLIENT_JS = String.raw`(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const state = { report: null, infrastructure: null };
  const maxBytes = 2_000_000, maxAssets = 10_000;
  function fail(message) { byId('message').textContent = message; }
  function cleanName(value) {
    return typeof value === 'string' && /^[a-z0-9.-]{1,253}$/i.test(value) &&
      !value.includes('..') && value.includes('.');
  }
  async function load(file, kind) {
    fail('');
    if (!file) return;
    if (file.size < 1 || file.size > maxBytes) throw Error('حجم الملف غير مقبول؛ الحد 2MB.');
    let doc;
    try { doc = JSON.parse(await file.text()); } catch { throw Error('الملف ليس JSON صالحاً.'); }
    if (!doc || typeof doc !== 'object' || !Array.isArray(doc.assets) ||
        doc.assets.length > maxAssets ||
        doc.schema !== (kind === 'report' ? 'star-osint-report/v1' : 'star-osint-infrastructure/v1')) {
      throw Error('نوع التقرير غير مدعوم أو تجاوز حد 10,000 أصل.');
    }
    if (!cleanName(doc.target)) throw Error('اسم النطاق في التقرير غير صالح.');
    for (const asset of doc.assets) {
      if (!asset || !cleanName(asset.hostname) ||
          !(asset.hostname === doc.target || asset.hostname.endsWith('.' + doc.target))) {
        throw Error('التقرير يحتوي على اسم مضيف خارج النطاق.');
      }
    }
    if (kind === 'infrastructure' && state.report && state.report.target !== doc.target)
      throw Error('تقرير البنية التحتية لا يطابق نطاق تقرير الأصول.');
    if (kind === 'report' && state.infrastructure && state.infrastructure.target !== doc.target)
      state.infrastructure = null;
    state[kind] = doc;
    render();
  }
  function element(tag, value, className) {
    const node = document.createElement(tag);
    node.textContent = value == null ? '' : String(value);
    if (className) node.className = className;
    return node;
  }
  function render() {
    const report = state.report, infra = state.infrastructure;
    const assets = report && Array.isArray(report.assets) ? report.assets : [];
    const lookup = new Map((infra ? infra.assets : []).map(a => [a.hostname, a]));
    const uniqSources = new Set();
    assets.forEach(a => (Array.isArray(a.sources) ? a.sources : []).forEach(s => {
      if (typeof s === 'string') uniqSources.add(s);
    }));
    byId('total').textContent = String(assets.length);
    byId('sources').textContent = String(uniqSources.size);
    byId('edges').textContent = String(infra && Array.isArray(infra.edges) ? infra.edges.length : 0);
    byId('http').textContent = String(infra ? infra.assets.reduce((n,a) => n + (
      Array.isArray(a.http_observations) ? a.http_observations.length : 0
    ),0) : 0);
    byId('metadata').textContent = report
      ? 'النطاق: ' + report.target + ' | تاريخ الجمع: ' + (report.generated_at_utc || 'غير محدد') +
        ' | تصنيف النتائج: مرشحة سلبياً (غير مؤكدة)'
      : (infra ? 'بيانات بنية تحتية للنطاق: ' + infra.target + ' — استورد report.json لعرض قائمة المضيفين' :
        'لم يتم استيراد تقرير بعد. أنشئ واحداً باستخدام محرك Kali المدمج في Wormstar.');
    const needle = byId('filter').value.trim().toLowerCase();
    const matches = assets.filter(a =>
      a.hostname.toLowerCase().includes(needle) ||
      (Array.isArray(a.sources) && a.sources.some(s => typeof s === 'string' && s.toLowerCase().includes(needle)))
    ).slice(0, 1000);
    byId('count').textContent = 'يعرض ' + matches.length + ' من ' + assets.length + ' أصل؛ الحد 1000 صف.';
    const body = byId('rows');
    body.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (const asset of matches) {
      const tr = document.createElement('tr');
      tr.appendChild(element('td', asset.hostname));
      const sources = document.createElement('td');
      for (const src of Array.isArray(asset.sources) ? asset.sources.slice(0, 25) : []) {
        if (typeof src === 'string') sources.appendChild(element('span', src.slice(0,100), 'pill'));
      }
      tr.appendChild(sources);
      const extra = lookup.get(asset.hostname);
      const evidence = ['مصدر مفتوح — غير مثبت التشغيل'];
      if (extra) {
        if (Array.isArray(extra.ip_addresses) && extra.ip_addresses.length)
          evidence.push('IP: ' + extra.ip_addresses.slice(0, 10).map(x => String(x).slice(0,50)).join(', '));
        if (Array.isArray(extra.cnames) && extra.cnames.length)
          evidence.push('CNAME: ' + extra.cnames.slice(0, 10).map(x => String(x).slice(0,100)).join(', '));
        if (Array.isArray(extra.http_observations) && extra.http_observations.length)
          evidence.push('HTTP: ' + extra.http_observations.slice(0, 10).map(x => String(x.status_code)).join(', '));
      }
      tr.appendChild(element('td', evidence.join(' | ')));
      fragment.appendChild(tr);
    }
    body.appendChild(fragment);
  }
  byId('reportFile').addEventListener('change', async event => {
    try { await load(event.target.files[0], 'report'); }
    catch(error) { fail(error.message); }
    finally { event.target.value = ''; }
  });
  byId('infraFile').addEventListener('change', async event => {
    try { await load(event.target.files[0], 'infrastructure'); }
    catch(error) { fail(error.message); }
    finally { event.target.value = ''; }
  });
  byId('filter').addEventListener('input', render);
  render();
})();`;

const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Resource-Policy": "same-origin"
};
const CSP = "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'";
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method;
    const common = { ...BASE_HEADERS, "Cache-Control": "no-store" };
    if (method !== "GET" && method !== "HEAD")
      return new Response("Method not allowed", {status:405, headers:{...common, Allow:"GET, HEAD"}});
    const head = method === "HEAD";
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(head ? null : HTML, {status:200, headers:{
        ...common, "Content-Type":"text/html; charset=utf-8", "Content-Security-Policy":CSP
      }});
    }
    if (url.pathname === "/app.js") {
      return new Response(head ? null : CLIENT_JS, {status:200, headers:{
        ...common, "Content-Type":"text/javascript; charset=utf-8"
      }});
    }
    if (url.pathname === "/health") {
      return new Response(head ? null : JSON.stringify({
        ok:true,service:"star-osint-viewer",read_only:true,local_only:true
      }), {status:200, headers:{...common,"Content-Type":"application/json; charset=utf-8"}});
    }
    return new Response(head ? null : "Not found",{status:404,headers:common});
  }
};
