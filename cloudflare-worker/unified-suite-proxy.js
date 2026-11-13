/**
 * WORMSTAR ONE - same-origin module gateway
 *
 * - Railway remains the authenticated terminal backend. Browser sees ONLY
 *   /terminal/* on the wormstar-ai-lab hostname. The Railway password is sent
 *   by the original app, over WSS, and is NEVER handled or saved by this worker.
 * - OSINT and Audit stay isolated in the Sentinel Worker via Service Binding.
 * - No arbitrary upstream URL, credential forwarding, generic reverse proxy,
 *   iframe, bypass of the owner auth or fake terminal content.
 */
const RAILWAY_ORIGIN = 'https://terminal-production-fb16bd35.up.railway.app';
const SENTINEL_ORIGIN = 'https://wormstar-sentinel-preview.abdulstarzeki001.workers.dev';

const HARDENED_HEADERS=Object.freeze({
  'Cache-Control':'private, no-store, max-age=0',
  'CDN-Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'X-Frame-Options':'DENY',
  'Strict-Transport-Security':'max-age=31536000'
});
const TERMINAL_CSP=[
  "default-src 'none'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' https://cdn.jsdelivr.net",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "img-src 'self' data:",
  "connect-src 'self' wss:",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'"
].join('; ');

const ASSETS=new Map([
  ['/terminal/',['/','text/html; charset=utf-8']],
  ['/terminal/index.html',['/','text/html; charset=utf-8']],
  ['/terminal/app.js',['/app.js','text/javascript; charset=utf-8']],
  ['/terminal/neon.css',['/neon.css','text/css; charset=utf-8']]
]);

function err(message,status=503) {
  return new Response(message,{status,headers:{
    ...HARDENED_HEADERS,'Content-Type':'text/plain; charset=utf-8'
  }});
}
function sameOrigin(req) {
  const origin=req.headers.get('Origin');
  return origin===new URL(req.url).origin;
}
function safeNavigationResponse(request,suffix='/') {
  const u=new URL(request.url);
  u.pathname=u.pathname.endsWith('/')?u.pathname:u.pathname+suffix;
  u.search='';
  u.hash='';
  return new Response(null,{status:308,headers:{
    ...HARDENED_HEADERS,Location:u.toString()
  }});
}

export async function serveRailwayTerminal(request,backendFetch=fetch) {
  const url=new URL(request.url);
  const path=url.pathname;
  if(path==='/terminal') {
    if(request.method!=='GET'&&request.method!=='HEAD')return err('Method not allowed',405);
    return safeNavigationResponse(request);
  }
  if(path==='/terminal/ws') {
    if(request.method!=='GET')return err('Method not allowed',405);
    if((request.headers.get('Upgrade')||'').toLowerCase()!=='websocket')
      return err('WebSocket upgrade required',426);
    // Protect the standalone Railway password prompt from cross-site
    // websocket hijacking; the browser must initiate from this same origin.
    if(!sameOrigin(request))return err('Forbidden origin',403);
    try {
      const response=await backendFetch(RAILWAY_ORIGIN+'/ws',{
        method:'GET',headers:{Upgrade:'websocket'},
        redirect:'manual'
      });
      if(response.status!==101||!response.webSocket)
        return err('Terminal WebSocket backend is unavailable');
      // Returning the 101 response forwards the socket transparently.
      // Do NOT call .accept(): that would intercept frames and prevent proxying.
      return response;
    }catch(_) {return err('Terminal WebSocket connection failed');}
  }
  const asset=ASSETS.get(path);
  if(!asset)return err('Not found',404);
  if(request.method!=='GET'&&request.method!=='HEAD')return err('Method not allowed',405);
  try {
    const response=await backendFetch(RAILWAY_ORIGIN+asset[0],{
      method:request.method,redirect:'manual',
      headers:{Accept:request.headers.get('Accept')||'*/*'}
    });
    if(!response.ok||response.status!==200)return err('Terminal page is unavailable');
    const headers=new Headers(HARDENED_HEADERS);
    headers.set('Content-Type',asset[1]);
    if(path==='/terminal/'||path==='/terminal/index.html') {
      headers.set('Content-Security-Policy',TERMINAL_CSP);
      headers.set('X-Robots-Tag','noindex, nofollow');
    }
    return new Response(request.method==='HEAD'?null:response.body,{
      status:200,headers
    });
  }catch(_) {return err('Terminal backend connection failed');}
}

export async function serveSentinelModule(request,env) {
  const url=new URL(request.url);
  const path=url.pathname;
  if(!/^(?:\/osint|\/audit)(?:\/|$)/.test(path))return err('Not found',404);
  if(request.method!=='GET'&&request.method!=='HEAD')return err('Method not allowed',405);
  // Slash canonicalization is public and must work before checking the binding.
  if(path==='/osint'||path==='/audit')return safeNavigationResponse(request);
  if(!env?.SENTINEL_SUITE || typeof env.SENTINEL_SUITE.fetch!=='function')
    return err('Sentinel service binding unavailable');
  // Only the original public, local-only viewer routes are allowed. Nothing
  // under Core /api or token-bearing headers is proxied to Sentinel.
  const allowed=path.startsWith('/osint/')
    ? ['/osint/','/osint/index.html','/osint/app.js','/osint/health']
    : ['/audit/','/audit/index.html','/audit/health','/audit/api/sample'];
  if(!allowed.includes(path))return err('Not found',404);
  try {
    const upstream=new URL(SENTINEL_ORIGIN+path);
    const response=await env.SENTINEL_SUITE.fetch(
      new Request(upstream.toString(),{
        method:request.method,headers:{Accept:request.headers.get('Accept')||'*/*'}
      })
    );
    if(!response.ok)return err('Module unavailable',response.status===404?404:503);
    const headers=new Headers(response.headers);
    for(const key of ['Set-Cookie','Content-Length','Location','Access-Control-Allow-Origin']){
      headers.delete(key);
    }
    for(const [key,val] of Object.entries(HARDENED_HEADERS))headers.set(key,val);
    if(path==='/osint/'||path==='/audit/')
      headers.set('X-Robots-Tag','noindex, nofollow');
    return new Response(request.method==='HEAD'?null:response.body,{status:200,headers});
  }catch(_){return err('Sentinel module unavailable');}
}

const tiles=[
  ['/','AI Lab','الذكاء الاصطناعي ولوحة المتابعة','brain'],
  ['/workspace','NEXUS Workspace','المشاريع والفريق وذاكرة GitHub','layers'],
  ['/terminal/','Linux Terminal','Railway Bash الحقيقي بكلمة المرور المعتادة','terminal'],
  ['/osint/','OSINT Intelligence','عرض التقارير المحلية دون رفعها','search'],
  ['/audit/','Security Audit','فحص ملفات التقارير الساكنة','shield'],
  ['/academy/','Cyber Academy','محتوى التدريب والمهارات','academy']
];

export function suiteLanding(){
  const cards=tiles.map(([path,title,desc,icon])=>
    '<a class="tile" href="'+path+'" aria-label="'+title+'"><span class="icon">'+
    ({brain:'◆',layers:'▦',terminal:'⌘',search:'◎',shield:'⬡',academy:'◈'}[icon])+
    '</span><strong>'+title+'</strong><small>'+desc+'</small></a>'
  ).join('');
  const html=String.raw`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0a1120">
<title>WORMSTAR ONE | بوابة المشاريع الموحدة</title>
<style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,Segoe UI,Tahoma,sans-serif}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;background:radial-gradient(ellipse at 10% 5%,#16324a,transparent 52%),#0a1120;color:#e4ecfa}
main{max-width:1120px;margin:auto;padding:clamp(16px,4vw,38px)}
nav{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 32px}
nav a{color:#a3f0df;text-decoration:none;font-weight:700}
.kicker{color:#7be8d3;font:700 11px ui-monospace,monospace;letter-spacing:.12em}
h1{font-size:clamp(25px,4vw,40px);margin:12px 0}
p{color:#adbed5;line-height:1.8;margin-bottom:20px}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.tile{display:flex;flex-direction:column;gap:12px;min-width:0;min-height:162px;padding:22px;border:1px solid #30445b;border-radius:16px;background:#141f32;color:#edf4ff;text-decoration:none}
.tile:hover,.tile:focus-visible{border-color:#70e5d4;background:#1b2a3d}
.tile:focus-visible{outline:2px solid #70e5d4;outline-offset:2px}
.tile strong{font-size:16px;direction:auto}
.tile small{color:#acc1d7;line-height:1.6}
.icon{color:#7be8d3;font-size:27px}
.note{font-size:12px;color:#9eafc6;margin-top:24px}
@media(max-width:800px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:480px){.grid{grid-template-columns:1fr}.tile{min-height:112px;padding:16px;gap:7px}}
</style>
</head><body><main>
<nav><b>◆ WORMSTAR ONE</b><a href="/">العودة إلى AI Lab</a></nav>
<div class="kicker">UNIFIED CYBER PLATFORM</div>
<h1>كل أدوات Wormstar في مكان واحد</h1>
<p>تنقّل بين الوحدات تحت نطاق واحد. تعمل الخدمات في الخلفية على Cloudflare وRailway، وتحتفظ كل وحدة بمتطلبات الدخول والصلاحيات الخاصة بها.</p>
<div class="grid">${cards}</div>
<p class="note">Linux Terminal تتطلب كلمة مرور Railway كما كانت. أدوات OSINT وAudit تعرض بياناتك المحلية فقط.</p>
</main></body></html>`;
  return new Response(html,{
    headers:{
      ...HARDENED_HEADERS,
      'Content-Type':'text/html; charset=utf-8',
      'Content-Security-Policy':"default-src 'none';style-src 'unsafe-inline';base-uri 'none';frame-ancestors 'none';form-action 'none'",
      'X-Robots-Tag':'noindex, nofollow'
    }
  });
}
