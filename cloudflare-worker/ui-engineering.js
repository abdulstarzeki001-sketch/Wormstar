/* WORMSTAR ONE UI engineering. Static strings; no interpolation of user data. */
const STYLE="\n/* WORMSTAR UI ENGINEERING - progressive, layout-safe enhancements.\n   No authentication changes, no fabricated metrics and no new overlay. */\nhtml[data-ws-ui-engineering] {scroll-padding-top:68px}\nhtml[data-ws-ui-engineering] :where(.shell,.main,.app,.wrap,.page,.panel,.module,.tile,.stat-card,.hero,.card,.surface-pad) {min-width:0}\nhtml[data-ws-ui-engineering] :where(.nav-btn,.navbtn,.btn,.tile,.launch-card,.stat-card,.module) {overflow-wrap:anywhere}\nhtml[data-ws-ui-engineering] :where(.nav-btn,.navbtn,.btn,a,button,[role=\"button\"]):focus-visible {\n  outline:2px solid var(--mint,var(--accent,#70e8d4));outline-offset:3px\n}\nhtml[data-ws-ui-engineering] :where(.tile,.panel,.module,.stat-card,.launch-card,.context-card,.hero,.surface-pad) {\n  border-radius:clamp(12px,1.4vw,19px);\n}\nhtml[data-ws-ui-engineering] :where(.tile,.module,.stat-card,.launch-card,.context-card) {\n  position:relative;isolation:isolate;\n  transition:border-color .18s ease,box-shadow .18s ease;\n}\nhtml[data-ws-ui-engineering] [data-ws-spotlight] {position:relative;isolation:isolate}\nhtml[data-ws-ui-engineering] [data-ws-spotlight]::before {\n  content:'';position:absolute;inset:0;border-radius:inherit;\n  background:radial-gradient(280px circle at var(--ws-spot-x,50%) var(--ws-spot-y,50%),\n    rgba(119,229,210,.13),transparent 72%);\n  opacity:0;pointer-events:none;z-index:0;transition:opacity .22s ease\n}\nhtml[data-ws-ui-engineering] [data-ws-spotlight] > * {position:relative;z-index:1}\n@media (hover:hover) and (pointer:fine) {\n  html[data-ws-ui-engineering] [data-ws-spotlight]:hover::before {opacity:1}\n  html[data-ws-ui-engineering] [data-ws-spotlight]:hover {\n    border-color:rgba(119,229,210,.43);box-shadow:0 10px 28px rgba(0,0,0,.15)\n  }\n}\nhtml[data-ws-ui-engineering] :where(.xterm,.xterm-viewport,.terminal,.chat-history,.thread,.logs,pre,textarea,code,[data-native-scroll]) {\n  overscroll-behavior:contain\n}\nhtml[data-ws-ui-engineering] .ws-suite-shortcuts {\n  display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin:7px 0 10px;\n}\nhtml[data-ws-ui-engineering] .ws-suite-shortcuts a {\n  display:inline-flex;align-items:center;justify-content:center;min-height:36px;\n  padding:7px 10px;border:1px solid rgba(130,150,193,.27);\n  border-radius:10px;background:rgba(105,130,169,.08);\n  color:inherit;text-decoration:none;font-size:12px;font-weight:650\n}\nhtml[data-ws-ui-engineering] .ws-suite-shortcuts a:hover {border-color:#70e5d4}\n@media (max-width:760px) {\n  html[data-ws-ui-engineering] :where(.wrap,.page,.main,.hero,.panel,.module) {max-width:100%}\n  html[data-ws-ui-engineering] .ws-suite-shortcuts {gap:6px;margin:5px 0 9px}\n  html[data-ws-ui-engineering] .ws-suite-shortcuts a {font-size:11px;min-height:34px;padding:6px 9px}\n  html[data-ws-ui-engineering] :where(.stat-card,.tile,.launch-card) {min-height:0}\n}\n@media (max-width:390px) {\n  html[data-ws-ui-engineering] :where(.page,.wrap) {padding-inline:10px}\n}\n@media (prefers-reduced-motion:reduce) {\n  html[data-ws-ui-engineering] *,html[data-ws-ui-engineering] *::before,html[data-ws-ui-engineering] *::after {\n    animation-duration:.01ms!important;animation-iteration-count:1!important;\n    transition-duration:.01ms!important;scroll-behavior:auto!important\n  }\n  html[data-ws-ui-engineering] [data-ws-spotlight]::before {display:none}\n}\n";
const CLIENT="/* WORMSTAR UI ENGINEERING: no network requests or credential handling here. */\n(()=>{\n  'use strict';\n  if(window.__wormstarUiEngineering)return;\n  window.__wormstarUiEngineering=true;\n  const root=document.documentElement;\n  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');\n  const fine=window.matchMedia('(pointer: fine)');\n  const noSmooth='.xterm,.xterm-viewport,.terminal,#wsTermOutput,.logs,.log-view,.editor,.cm-editor,.monaco-editor,textarea,pre,.thread,.chat-history,.chat-compose,.drawer,.sidebar,.side,dialog,[data-native-scroll],[data-lenis-prevent]';\n  const cards='.tile,.stat-card,.launch-card,.module,.context-card,.panel';\n  const gsap=window.gsap,Trigger=window.ScrollTrigger,LenisCtor=window.Lenis;\n  let lenis=null,ticker=null,observer=null,scheduled=false;\n  let tweens=[],triggers=[],lastSection=null;\n  let enabled=true;\n\n  function stopMotion(){\n    for(const t of triggers)t.kill();\n    for(const t of tweens)t.kill();\n    triggers=[];tweens=[];\n    if(gsap){\n      const scope=document.querySelector('.page.active,[data-section].active,.app,.main');\n      if(scope)gsap.killTweensOf(scope.querySelectorAll(cards));\n    }\n  }\n  function stopLenis(){\n    if(ticker&&gsap)gsap.ticker.remove(ticker);\n    ticker=null;\n    if(lenis){lenis.destroy();lenis=null}\n  }\n  function canSmooth(){\n    if(reduced.matches||!fine.matches)return false;\n    if(location.pathname.startsWith('/terminal'))return false;\n    if(document.querySelector('dialog[open],.modal.open,[aria-modal=\"true\"]'))return false;\n    return document.documentElement.scrollHeight>innerHeight+120;\n  }\n  function startLenis(){\n    stopLenis();\n    if(!gsap||!Trigger||!LenisCtor||!canSmooth())return;\n    try{\n      lenis=new LenisCtor({\n        autoRaf:false,anchors:true,syncTouch:false,allowNestedScroll:true,\n        prevent:node=>Boolean(node?.closest?.(noSmooth))\n      });\n      lenis.on('scroll',Trigger.update);\n      ticker=time=>lenis?.raf(time*1000);\n      gsap.ticker.add(ticker);\n      gsap.ticker.lagSmoothing(0);\n    }catch(_){stopLenis()}\n  }\n  function activeSection(){\n    return document.querySelector('.page.active,[data-section].active,.view.active,[data-view-panel].active')||\n      document.querySelector('.main,.wrap,main');\n  }\n  function animateSection(){\n    if(!enabled)return;\n    const section=activeSection();\n    if(!section)return;\n    if(section===lastSection)return;\n    stopMotion();\n    lastSection=section;\n    if(reduced.matches||!gsap||!Trigger)return;\n    const headings=Array.from(section.querySelectorAll('h1,.page-title,.page-heading')).filter(\n      el=>el.offsetParent!==null\n    ).slice(0,2);\n    for(const el of headings){\n      tweens.push(gsap.fromTo(el,{autoAlpha:0,y:10},{\n        autoAlpha:1,y:0,duration:.32,ease:'power2.out',\n        overwrite:true,clearProps:'opacity,visibility,transform'\n      }));\n    }\n    const nodes=Array.from(section.querySelectorAll(cards))\n      .filter(el=>el.offsetParent!==null&&!el.closest(noSmooth)).slice(0,28);\n    for(const el of nodes){\n      triggers.push(Trigger.create({\n        trigger:el,start:'top 97%',once:true,\n        onEnter(){\n          tweens.push(gsap.fromTo(el,{opacity:0,y:10},{\n            opacity:1,y:0,duration:.34,ease:'power2.out',\n            overwrite:true,clearProps:'opacity,transform'\n          }));\n        }\n      }));\n    }\n    Trigger.refresh();\n  }\n  function schedule(){\n    if(scheduled)return;\n    scheduled=true;\n    requestAnimationFrame(()=>{scheduled=false;animateSection()});\n  }\n  function reset(){\n    lastSection=null;\n    stopMotion();\n    startLenis();\n    schedule();\n  }\n  // Pointer spotlight in the spirit of React Bits Spotlight Cards; authored\n  // locally for the existing DOM, without importing the React runtime.\n  function pointerMove(event){\n    if(reduced.matches||!fine.matches)return;\n    const card=event.target.closest?.(cards);\n    if(!card||card.closest(noSmooth))return;\n    if(!card.dataset.wsSpotlight)card.dataset.wsSpotlight='';\n    const rect=card.getBoundingClientRect();\n    card.style.setProperty('--ws-spot-x',(event.clientX-rect.left)+'px');\n    card.style.setProperty('--ws-spot-y',(event.clientY-rect.top)+'px');\n  }\n  const surface=document.querySelector('.main,.wrap,main,.app');\n  if(surface)surface.addEventListener('pointermove',pointerMove,{passive:true});\n  observer=new MutationObserver(records=>{\n    if(records.some(r=>r.type==='attributes'&&\n      (r.target.matches?.('.page,[data-section],.view,[data-view-panel]'))))schedule();\n  });\n  observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});\n  if(gsap&&Trigger)gsap.registerPlugin(Trigger);\n  reduced.addEventListener?.('change',reset);\n  fine.addEventListener?.('change',reset);\n  window.addEventListener('pagehide',()=>{\n    enabled=false;observer?.disconnect();\n    stopMotion();stopLenis();\n    reduced.removeEventListener?.('change',reset);\n    fine.removeEventListener?.('change',reset);\n  },{once:true});\n  root.dataset.wsUiEngineering='on';\n  startLenis();schedule();\n})();\n";
const vendorPaths=new Map([
['/ui/vendor/gsap.min.js','/assets/gsap.min.js'],
['/ui/vendor/ScrollTrigger.min.js','/assets/ScrollTrigger.min.js'],
['/ui/vendor/lenis.min.js','/assets/lenis.min.js']]);
const BOOTSTRAP="/* Wormstar: lazy motion bootstrap; skipped libraries on phones/reduced motion. */\n(()=>{\n  'use strict';\n  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;\n  const fine=window.matchMedia('(pointer: fine)').matches;\n  const srcs=fine&&!reduced?[\n    '/ui/vendor/gsap.min.js',\n    '/ui/vendor/ScrollTrigger.min.js',\n    '/ui/vendor/lenis.min.js',\n    '/ui/engine.js'\n  ]:['/ui/engine.js'];\n  function load(src){\n    return new Promise(resolve=>{\n      const script=document.createElement('script');\n      script.src=src;script.async=false;\n      script.onload=resolve;script.onerror=resolve;\n      document.head.appendChild(script);\n    });\n  }\n  async function start(){for(const src of srcs)await load(src)}\n  if('requestIdleCallback' in window)window.requestIdleCallback(()=>{void start()},{timeout:900});\n  else window.requestAnimationFrame(()=>{void start()});\n})();";
const CORE_SCRIPT_TAGS='<script src="/ui/bootstrap.js" defer></script>';

const HEAD_STYLE='<style id="ws-ui-engineering">'+STYLE+'</style>';
const SHORTCUTS='<div class="ws-suite-shortcuts" role="group" aria-label="الصفحات الموحدة">'+
  '<a href="/suite/">WORMSTAR ONE</a>'+
  '<a href="/terminal/">Linux Terminal</a>'+
  '<a href="/osint/">OSINT</a>'+
  '<a href="/audit/">Audit</a></div>';

/** Add assets without rewriting embedded application scripts or permission logic. */
export function enhanceUiPage(html,kind){
  if(!['nexus','workspace','academy'].includes(kind))throw Error('Unsupported page');
  if(typeof html!=='string'||!html.includes('</head>')||!html.includes('</body>'))
    throw Error('Invalid HTML page');
  if(html.includes('id="ws-ui-engineering"'))return html;
  let result=html.replace(/<html(?=[\\s>])/, '<html data-ws-ui-engineering="on"');
  result=result.replace('</head>',HEAD_STYLE+'</head>');
  if(kind==='workspace'){
    const target='<nav aria-label="تنقل المشاريع">';
    if(!result.includes(target))throw Error('Workspace nav contract changed');
    result=result.replace(target,target+SHORTCUTS);
  }
  result=result.replace('</body>',CORE_SCRIPT_TAGS+'</body>');
  return result;
}

function assetResponse(body,type,status=200){
  return new Response(body,{status,headers:{
    'Content-Type':type,'Cache-Control':'public, max-age=300',
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'
  }});
}
/** Local GSAP/Lenis bundles already pinned and deployed in Sentinel, reused
 * through Cloudflare's internal Service Binding without forwarding credentials. */
export async function serveUiAsset(request,env){
  const path=new URL(request.url).pathname;
  if(request.method!=='GET'&&request.method!=='HEAD')
    return assetResponse('Method not allowed','text/plain; charset=utf-8',405);
  if(path==='/ui/engine.js')
    return assetResponse(request.method==='HEAD'?null:CLIENT,'text/javascript; charset=utf-8');
  if(path==='/ui/bootstrap.js')
    return assetResponse(request.method==='HEAD'?null:BOOTSTRAP,'text/javascript; charset=utf-8');
  const original=vendorPaths.get(path);
  if(!original)return assetResponse('Not found','text/plain; charset=utf-8',404);
  if(!env?.SENTINEL_SUITE?.fetch)
    return assetResponse('Motion unavailable','text/plain; charset=utf-8',503);
  try{
    const response=await env.SENTINEL_SUITE.fetch(
      new Request('https://wormstar-sentinel-preview.abdulstarzeki001.workers.dev'+original,{
        method:request.method,headers:{Accept:'text/javascript'}
      })
    );
    if(!response.ok||response.status!==200)
      return assetResponse('Motion unavailable','text/plain; charset=utf-8',503);
    return assetResponse(request.method==='HEAD'?null:response.body,
      'text/javascript; charset=utf-8');
  }catch(_){return assetResponse('Motion unavailable','text/plain; charset=utf-8',503)}
}

export const UI_ENGINEERING_SOURCE={style:STYLE,client:CLIENT,bootstrap:BOOTSTRAP,paths:[...vendorPaths.keys()]};
