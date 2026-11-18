/* Core-owned terminal page: shares the existing Wormstar sign-in, not a second password form. */
export const TERMINAL_HTML=String.raw`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#090e1c">
<title>Linux Terminal | Wormstar AI Lab</title>
<style>
:root{color-scheme:dark;--bg:#090e1c;--panel:#111b2c;--card:#172338;--line:#283c53;--ink:#e8f3ff;--muted:#9cb0ca;--mint:#68eed1;--accent:#a6a0ff;--error:#ff9da7}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(circle at 90% 0%,#182843 0%,transparent 38%),var(--bg);color:var(--ink);font:14px/1.6 system-ui,Tahoma,-apple-system,sans-serif;min-height:100dvh}
button,input{font:inherit}
button{cursor:pointer}
button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid var(--mint);outline-offset:2px}
a{color:var(--mint);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:1200px;margin:auto;padding:16px clamp(12px,3vw,32px) 30px}
header{display:flex;align-items:center;gap:14px;justify-content:space-between;flex-wrap:wrap;margin-bottom:16px}
.brand{display:flex;gap:11px;align-items:center;font-weight:800}
.mark{width:39px;height:39px;background:linear-gradient(135deg,var(--mint),var(--accent));color:#061222;display:grid;place-items:center;border-radius:12px;font-size:22px}
.crumb{font-size:12px;color:var(--muted)}
.nav{display:flex;flex-wrap:wrap;gap:8px}
.nav a{padding:9px 13px;border:1px solid var(--line);border-radius:10px;color:var(--ink);background:var(--panel)}
.hero{padding:19px 21px;border:1px solid var(--line);background:var(--panel);border-radius:19px;margin-bottom:13px}
.hero h1{font-size:clamp(21px,3vw,28px);margin:0 0 7px}
.hero p{font-size:13px;color:var(--muted);margin:0;max-width:780px}
.status{display:inline-flex;align-items:center;gap:8px;margin-top:13px;padding:6px 11px;border-radius:9px;background:var(--card);border:1px solid var(--line)}
.status[data-state="ready"]{color:var(--mint)}
.status[data-state="error"]{color:var(--error)}
.dot{width:7px;height:7px;border-radius:50%;background:currentColor}
.term-shell{border:1px solid var(--line);border-radius:17px;overflow:hidden;background:#060b13}
.term-head{display:flex;justify-content:space-between;gap:9px;align-items:center;padding:12px 15px;background:#141f30;flex-wrap:wrap}
.term-head strong{font-size:13px;direction:ltr}
.buttons{display:flex;gap:7px;flex-wrap:wrap}
.btn{border:1px solid var(--line);border-radius:9px;background:#1b2a40;color:var(--ink);padding:8px 12px}
.btn.primary{background:var(--mint);color:#06231c;font-weight:800;border-color:transparent}
.btn:disabled{opacity:.45;cursor:not-allowed}
#output{direction:ltr;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;overflow:auto;margin:0;padding:18px;min-height:280px;height:clamp(300px,54dvh,650px);background:#070d16;color:#bcebd8;font:13px/1.62 ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;tab-size:4}
.controls{display:flex;gap:9px;align-items:center;padding:12px 14px;border-top:1px solid var(--line);background:var(--panel)}
.prompt{direction:ltr;color:var(--mint);font:700 15px monospace}
#command{flex:1;min-width:0;padding:11px;border-radius:10px;background:#0c1524;border:1px solid #30435c;color:var(--ink);direction:ltr;text-align:left;font:14px ui-monospace,monospace}
.ai-shell{margin-top:13px;border:1px solid var(--line);border-radius:17px;overflow:hidden;background:var(--panel)}
.ai-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:12px 15px}
.ai-head strong{color:var(--mint);font-size:16px}
.ai-head small{color:var(--muted)}
#aiPanel{padding:0 14px 14px;border-top:1px solid var(--line)}
[hidden]{display:none!important}
#aiState{font-size:12px;color:var(--muted);padding:10px 0}
#aiMessages{direction:rtl;max-height:340px;min-height:110px;overflow:auto;background:#091321;border:1px solid var(--line);border-radius:11px;padding:10px}
.ai-message{white-space:pre-wrap;overflow-wrap:anywhere;border-radius:10px;padding:10px;margin-bottom:8px;background:#17283b;font-size:13px}
.ai-message[data-kind="assistant"]{border-right:3px solid var(--mint)}
.ai-message[data-kind="user"]{border-right:3px solid var(--accent)}
.ai-message[data-kind="error"]{border-right:3px solid var(--error);color:var(--error)}
.ai-message strong{display:block;margin-bottom:4px;font-size:12px}
.ai-form{display:flex;gap:8px;align-items:stretch;margin-top:10px}
#aiPrompt{flex:1;resize:vertical;min-height:76px;max-height:180px;border:1px solid #30435c;background:#0c1524;border-radius:10px;padding:10px;color:var(--ink);direction:rtl;text-align:right}
#aiPrompt:disabled{opacity:.55}
.ai-actions{display:flex;flex-direction:column;gap:6px}
.ai-note{margin:8px 0 0;color:var(--muted);font-size:12px}
@media(max-width:600px){.ai-form{flex-direction:column}.ai-actions{flex-direction:row}.ai-actions button{flex:1}}
#warning{margin:12px 0 0;color:var(--muted);font-size:12px}
#warning a{color:var(--mint)}
@media(max-width:600px){.wrap{padding:11px}.hero{padding:15px}.term-head{padding:10px}.controls{padding:9px}.btn{padding:8px}#output{height:48dvh;min-height:270px;padding:11px}}

/* Compact touch controls: reduce vertical chrome without changing terminal behavior. */
@media(max-width:600px){
  .wrap{padding:8px 9px 14px}
  header{gap:7px;margin-bottom:8px}
  .brand{gap:7px;font-size:12px;line-height:1.3}
  .mark{width:29px;height:29px;border-radius:9px;font-size:17px;flex:none}
  .crumb{font-size:10px}
  .nav{gap:5px}
  .nav a{display:inline-flex;align-items:center;min-height:34px;padding:5px 9px;border-radius:8px;font-size:11px}
  .hero{padding:10px 11px;margin-bottom:8px;border-radius:13px}
  .hero h1{font-size:18px;line-height:1.32;margin:0 0 5px}
  .hero p{font-size:11px;line-height:1.45}
  .status{margin-top:8px;max-width:100%;padding:5px 8px;gap:6px;font-size:11px;line-height:1.4;border-radius:8px}
  .dot{flex:none;width:6px;height:6px}
  .term-shell{border-radius:13px}
  .term-head{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;padding:8px 9px}
  .term-head strong{font-size:11px;line-height:1.25}
  .buttons{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;width:100%}
  .buttons .btn{min-width:0;min-height:38px;padding:5px 4px;border-radius:8px;font-size:11px;line-height:1.25;white-space:normal}
  #output{height:47dvh;min-height:220px;max-height:520px;padding:9px;font-size:12px;line-height:1.44}
  .controls{gap:6px;padding:7px 9px}
  .prompt{font-size:13px}
  #command{min-height:38px;padding:7px 8px;border-radius:8px;font-size:12px}
  .controls .btn{min-height:38px;padding:5px 10px;font-size:11px}
  .ai-shell{margin-top:8px;border-radius:13px}
  .ai-head{padding:8px 10px;gap:6px}
  .ai-head strong{font-size:14px}
  .ai-head small{font-size:11px}
  #aiPanel{padding:0 9px 9px}
  #aiState{padding:7px 0}
  .ai-form{gap:6px;margin-top:7px}
  #aiPrompt{min-height:65px;padding:8px}
  .ai-actions button{min-height:38px;padding:5px 7px;font-size:11px}
  #warning{margin:8px 0 0;font-size:10px;line-height:1.45}
}
@media(max-width:360px){
  .brand{font-size:11px}
  .hero h1{font-size:17px}
  .buttons .btn{font-size:10.5px;padding-inline:2px}
}

/* Full-height mobile terminal: maximum output space, one compact control strip. */
.term-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:1;min-width:0}
.term-meta .status{margin:0;min-width:0;font-size:11px;line-height:1.3;padding:3px 7px}
.term-meta .status .dot{flex:none}
.button-symbol{display:none}
#warning summary{cursor:pointer;color:var(--muted)}
#warning p{margin:5px 0 0}
@media(max-width:600px){
  html,body{min-height:100%;height:100%;overscroll-behavior-y:contain}
  .wrap{height:100dvh;min-height:400px;max-width:none;display:flex;flex-direction:column;overflow:auto;padding:6px 7px calc(6px + env(safe-area-inset-bottom))}
  header{flex:none;gap:5px;margin-bottom:5px;flex-wrap:nowrap;align-items:center}
  .brand{min-width:0;gap:5px;font-size:11px;line-height:1.1;white-space:nowrap}
  .mark{width:23px;height:23px;font-size:14px;border-radius:7px;flex:none}
  .crumb{display:none}
  .nav{gap:4px;flex-wrap:nowrap}
  .nav a{font-size:10px;min-height:27px;padding:4px 6px;border-radius:7px;white-space:nowrap}
  .term-shell{flex:1 1 auto;min-height:220px;display:flex;flex-direction:column;border-radius:10px}
  .term-head{flex:none;display:flex;flex-direction:column;gap:5px;padding:6px 7px}
  .term-meta{width:100%;gap:5px}
  .term-meta strong{font-size:10px;white-space:nowrap;line-height:1.2}
  .term-meta .status{margin:0;flex:0 1 auto;max-width:63%;padding:3px 6px;font-size:10px;gap:4px;line-height:1.25}
  .term-meta .status #statusText{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .term-meta .status[data-state="error"] #statusText{white-space:normal;overflow-wrap:anywhere}
  .buttons{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:3px;width:100%}
  .buttons .btn{min-width:0;min-height:42px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;padding:3px 1px;border-radius:6px;line-height:1.1}
  .buttons .button-symbol{display:block;font-size:14px;font-weight:700;line-height:1.2}
  .buttons .button-label{font-size:9px;line-height:1.1;white-space:nowrap}
  #output{flex:1 1 0;min-height:0;max-height:none;height:auto;padding:8px;font-size:12px;line-height:1.45}
  .controls{flex:none;gap:5px;padding:5px 7px}
  #command{min-height:36px;padding:6px 7px;font-size:12px;border-radius:7px}
  .controls .btn{min-height:36px;padding:5px 9px;border-radius:7px;font-size:11px}
  .ai-shell{flex:none;margin-top:5px;border-radius:10px}
  .ai-head{padding:5px 7px;gap:5px}
  .ai-head strong{font-size:12px}
  .ai-head small{font-size:10px}
  .ai-head .btn{font-size:10px;min-height:29px;padding:4px 7px}
  #warning{flex:none;margin:4px 1px 0;font-size:10px;line-height:1.3}
  #warning summary{display:list-item;list-style-position:inside}
}
@media(max-width:360px){
  .brand{font-size:10px}
  .nav a{font-size:9px;padding:3px 5px}
  .term-meta .status{max-width:55%}
  .buttons .button-symbol{font-size:13px}
  .buttons .button-label{font-size:8.5px}
}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style>
</head>
<body>
<div class="wrap">
<header>
  <div class="brand"><span class="mark">⌘</span><span>WORMSTAR AI LAB <span class="crumb">/ Linux Terminal</span></span></div>
  <nav class="nav" aria-label="التنقل"><a href="/">الرئيسية</a><a href="/workspace">NEXUS Workspace</a></nav>
</header>
<section class="term-shell" aria-label="Linux terminal">
 <div class="term-head">
   <div class="term-meta">
     <strong>terminal@wormstar:~</strong>
     <div id="status" class="status" data-state="idle" role="status" aria-live="polite"><span class="dot"></span><span id="statusText">جارٍ التحقق من الجلسة...</span></div>
   </div>
   <div class="buttons" role="toolbar" aria-label="أدوات الترمنال">
     <button type="button" id="connect" class="btn primary" title="اتصال" aria-label="اتصال"><span class="button-symbol" aria-hidden="true">▶</span><span class="button-label">اتصال</span></button>
     <button type="button" id="diagnose" class="btn" title="فحص الاتصال" aria-label="فحص الاتصال"><span class="button-symbol" aria-hidden="true">⌕</span><span class="button-label">فحص</span></button>
     <button type="button" id="interrupt" class="btn" title="Ctrl+C" aria-label="إيقاف الأمر Ctrl+C" disabled><span class="button-symbol" aria-hidden="true">⌃C</span><span class="button-label">Ctrl+C</span></button>
     <button type="button" id="copy" class="btn" title="نسخ المخرجات" aria-label="نسخ المخرجات"><span class="button-symbol" aria-hidden="true">⧉</span><span class="button-label">نسخ</span></button>
     <button type="button" id="clear" class="btn" title="مسح الشاشة" aria-label="مسح الشاشة"><span class="button-symbol" aria-hidden="true">⌫</span><span class="button-label">مسح</span></button>
     <button type="button" id="disconnect" class="btn" title="قطع الاتصال" aria-label="قطع الاتصال" disabled><span class="button-symbol" aria-hidden="true">⏻</span><span class="button-label">قطع</span></button>
   </div>
 </div>
 <pre id="output" role="log" aria-label="مخرجات Linux" tabindex="0" aria-live="off">Wormstar Terminal
─────────────────────────────────────────
لا تُدخل أسراراً أو كلمات مرور أو مفاتيح API في جلسة الطرفية.
</pre>
 <form id="form" class="controls" autocomplete="off">
   <span class="prompt" aria-hidden="true">$</span>
   <input id="command" type="text" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="اكتب أمراً..." aria-label="أمر Linux" maxlength="4000" disabled>
   <button class="btn primary" type="submit" id="send" disabled>تنفيذ</button>
 </form>
</section>
<section class="ai-shell" aria-label="مساعد STAR AI">
  <div class="ai-head">
    <div><strong>STAR AI</strong><small> — مساعد لتحليل النتائج وشرح الأوامر</small></div>
    <button type="button" id="aiToggle" class="btn" aria-controls="aiPanel" aria-expanded="false" disabled>فتح المساعد</button>
  </div>
  <div id="aiPanel" hidden>
    <div id="aiState" role="status" aria-live="polite">اتصل بالطرفية أولاً</div>
    <div id="aiMessages" role="log" aria-label="محادثة STAR AI" aria-live="polite"></div>
    <form id="aiForm" class="ai-form" autocomplete="off">
      <textarea id="aiPrompt" rows="3" maxlength="4000" placeholder="اسأل STAR AI عن أمر أو نتيجة... (بدون أسرار أو مفاتيح)" aria-label="سؤال STAR AI" disabled></textarea>
      <div class="ai-actions">
        <button type="submit" id="aiSend" class="btn primary" disabled>اسأل STAR AI</button>
        <button type="button" id="aiCheck" class="btn" disabled>فحص AI</button>
      </div>
    </form>
    <p class="ai-note">إجابات STAR AI استشارية فقط ولا تنفّذ أي أوامر. لا ترسل بيانات خاصة أو مفاتيح API.</p>
  </div>
</section>
<details id="warning"><summary>ملاحظة الأمان</summary><p>عند انتهاء جلسة Wormstar، ارجع إلى <a href="/">الواجهة الرئيسية</a> وسجّل دخولك المعتاد فقط. الوصول إلى الطرفية يتطلب اتصال Cloudflare الآمن بخدمة Railway.</p></details>
</div>
<script>
(()=>{
'use strict';
const el=id=>document.getElementById(id);
const out=el('output');
const aiLog=el('aiMessages');
let aiReady=false,aiBusy=false,aiOpen=false;
function aiMessage(kind,text){
 const entry=document.createElement('div');
 entry.className='ai-message';
 entry.dataset.kind=kind;
 const heading=document.createElement('strong');
 heading.textContent=kind==='user'?'أنت':kind==='assistant'?'STAR AI':'تنبيه';
 const body=document.createElement('span');
 body.textContent=String(text||'').slice(0,8000);
 entry.append(heading,body);
 aiLog.appendChild(entry);
 while(aiLog.children.length>30)aiLog.firstChild.remove();
 aiLog.scrollTop=aiLog.scrollHeight;
}
function updateAiUi(){
 el('aiToggle').disabled=!ready;
 el('aiToggle').setAttribute('aria-expanded',String(aiOpen));
 el('aiToggle').textContent=aiOpen?'إغلاق المساعد':'فتح المساعد';
 el('aiPanel').hidden=!aiOpen;
 el('aiCheck').disabled=!ready;
 el('aiPrompt').disabled=!ready||!aiReady||aiBusy;
 el('aiSend').disabled=!ready||!aiReady||aiBusy;
}
const AI_REASONS={
 GATEWAY_READY:'STAR AI جاهز للأسئلة',
 GATEWAY_UNREACHABLE:'خدمة STAR AI غير قابلة للوصول حالياً',
 GATEWAY_NOT_CONFIGURED:'مفتاح مزوّد الذكاء الاصطناعي غير مهيأ',
 TERMINAL_NOT_CONFIGURED:'إعدادات STAR AI غير مكتملة على Railway',
 GATEWAY_ERROR:'خدمة STAR AI أعادت خطأ',
 GATEWAY_UNKNOWN:'تعذّر تحديد حالة STAR AI'
};
const status=(state,text)=>{el('status').dataset.state=state;el('statusText').textContent=text};
let socket=null,ready=false,connecting=false,diagnosing=false,lastCode='';
const ownerKey=()=>{try{return sessionStorage.getItem('wormstar-access')||''}catch(_){return ''}};
function log(line){
 const plain=String(line||'').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'').replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g,'').replace(/\r/g,'');
 out.textContent=(out.textContent+plain).slice(-120000);
 out.scrollTop=out.scrollHeight;
}
function updateUi(){
 el('connect').disabled=connecting||ready;
 el('disconnect').disabled=!socket;
 el('interrupt').disabled=!ready;
 el('command').disabled=!ready;
 el('send').disabled=!ready;
 updateAiUi();
}
function disconnected(message){
 ready=false;connecting=false;socket=null;aiReady=false;aiBusy=false;
 el('aiState').textContent='اتصل بالطرفية أولاً';
 updateUi();status('idle',message);
}
function send(data){if(socket&&socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(data))}

const FAILURE_MESSAGES={
 RAILWAY_AUTH_REJECTED:'رفض Railway كلمة المرور المحفوظة لدى Cloudflare. يجب أن تطابق كلمة مرور Railway نفسها حرفياً.',
 RAILWAY_UNREACHABLE:'Cloudflare لا يستطيع الاتصال بخدمة Railway. افحص الدومين وحالة الخدمة.',
 RAILWAY_HEALTH_FAILED:'Railway لا يستجيب لفحص /health بنجاح.',
 BACKEND_WS_CONNECT_FAILED:'تعذّر فتح WebSocket من Cloudflare إلى Railway.',
 BACKEND_WS_UPGRADE_REJECTED:'Railway رفض ترقية اتصال WebSocket. تحقق من مسار /ws.',
 BACKEND_WS_ACCEPT_FAILED:'تعذّر تهيئة WebSocket لدى Cloudflare.',
 RAILWAY_AUTH_TIMEOUT:'انتهت مهلة مصادقة Railway.',
 RAILWAY_CLOSED_BEFORE_READY:'أغلق Railway الاتصال قبل تشغيل جلسة Linux.',
 RAILWAY_SOCKET_ERROR:'حدث خطأ في WebSocket الخاص بخادم Railway.',
 RAILWAY_AUTH_SEND_FAILED:'فشل إرسال طلب المصادقة إلى Railway.'
};
function displayFailure(code){
 const label=FAILURE_MESSAGES[code]||'فشل اتصال الطرفية: '+String(code||'UNKNOWN');
 status('error',label);
 log('\n['+label+']\n');
}
async function diagnose(){
 if(diagnosing)return;
 const token=ownerKey();
 if(!token){status('error','سجّل دخول المالك إلى AI Lab أولاً');return;}
 diagnosing=true;el('diagnose').disabled=true;
 status('idle','جارٍ فحص Railway وWebSocket والمصادقة...');
 try{
  const res=await fetch('/api/terminal/diagnose',{
   method:'POST',headers:{Authorization:'Bearer '+token},cache:'no-store'
  });
  const data=await res.json().catch(()=>({}));
  if(data.ok&&data.code==='READY'){
   status('ready','الاتصال جاهز — اضغط اتصال');
   log('\n[فحص الاتصال: جميع المراحل ناجحة]\n');
  }else if(data.code) displayFailure(data.code);
  else if(data.invalidSecrets)displayFailure('CLOUDFLARE_SECRET_INVALID');
  else if(res.status===401)status('error','انتهت جلسة المالك. سجّل الدخول مجدداً.');
  else displayFailure('HTTP_'+res.status);
 }catch(_){displayFailure('NETWORK_DIAGNOSTIC_ERROR')}
 finally{diagnosing=false;el('diagnose').disabled=false}
}
async function connect(){
 if(socket||connecting)return;
 const token=ownerKey();
 if(!token){status('error','سجّل الدخول إلى Wormstar AI Lab أولاً');log('\n[تحتاج دخول المالك من الصفحة الرئيسية]\n');return;}
 lastCode='';connecting=true;updateUi();status('idle','جارٍ التحقق من دخول المالك...');
 try{
  const verified=await fetch('/api/auth',{method:'POST',headers:{Authorization:'Bearer '+token},cache:'no-store'});
  if(!verified.ok)throw Error('انتهت الجلسة. ارجع للصفحة الرئيسية وسجّل الدخول.');
  const response=await fetch('/api/terminal/session',{method:'POST',headers:{Authorization:'Bearer '+token},cache:'no-store'});
  if(!response.ok){
   const body=await response.json().catch(()=>({}));
   if(body.code==='TERMINAL_CONFIGURATION_INVALID' && Array.isArray(body.invalidSecrets)){
    const names=body.invalidSecrets.filter(name=>typeof name==='string' &&
      /^[A-Z][A-Z0-9_]{3,80}$/.test(name)).slice(0,2);
    throw Error('إعداد Cloudflare غير مكتمل: راجع قيمة '+(names.join(' و ')||'Secrets')+
      ' في Settings → Variables and Secrets. لا ترسل قيمة السر إلى المحادثة.');
   }
   throw Error(body.error||'خدمة الطرفية غير متاحة حالياً');
  }
  const ticket=await response.json();
  if(!ticket.ticket||ticket.wsPath!=='/api/terminal/ws')throw Error('استجابة اتصال غير صالحة');
  const proto=location.protocol==='https:'?'wss:':'ws:';
  const ws=new WebSocket(proto+'//'+location.host+ticket.wsPath,['wormstar-terminal','ticket.'+ticket.ticket]);
  socket=ws;status('idle','جارٍ فتح قناة الطرفية...');
  ws.onopen=()=>{if(socket===ws)status('idle','تم فتح WebSocket — جارٍ مصادقة Railway...')};
  ws.onmessage=event=>{
    let msg;try{msg=JSON.parse(event.data)}catch(_){return;}
    if(msg.type==='ready'){
      ready=true;connecting=false;aiReady=false;aiBusy=false;
      el('aiState').textContent=msg.aiEnabled===true?'جارٍ التحقق من STAR AI...':'STAR AI غير مفعّل على Railway';
      updateUi();status('ready','متصل — جلسة Linux فعالة');el('command').focus();
    }else if(msg.type==='output'||msg.type==='info')log(msg.data);
    else if(msg.type==='ai_status'){
      aiReady=msg.ready===true;aiBusy=false;
      const reason=typeof msg.reason==='string'?msg.reason:'GATEWAY_UNKNOWN';
      el('aiState').textContent=AI_REASONS[reason]||(aiReady?'STAR AI جاهز':'STAR AI غير جاهز: '+reason);
      updateAiUi();
    }else if(msg.type==='ai_busy'){
      aiBusy=true;el('aiState').textContent='STAR AI يفكّر...';updateAiUi();
    }else if(msg.type==='ai_reply'){
      aiBusy=false;aiMessage('assistant',msg.text);
      el('aiState').textContent='تم استلام الرد';updateAiUi();
    }else if(msg.type==='ai_error'){
      aiBusy=false;aiMessage('error',msg.message||'فشل طلب STAR AI');
      el('aiState').textContent='تعذّر إكمال الطلب';updateAiUi();
    }else if(msg.type==='error'){
      lastCode=typeof msg.code==='string'?msg.code:'RAILWAY_AUTH_REJECTED';
      displayFailure(lastCode);
    }
  };
  ws.onclose=event=>{
    if(socket!==ws)return;
    const hadShell=ready;
    const reason=lastCode||event.reason||'';
    disconnected('انتهى اتصال الطرفية');
    if(reason && FAILURE_MESSAGES[reason])displayFailure(reason);
    else if(!hadShell){
      status('idle','فشل بدء الجلسة — جارٍ تحديد السبب...');
      void diagnose();
    }else{
      status('idle','انتهت جلسة Linux. اضغط اتصال لإعادة الفتح.');
      log('\n[انتهى اتصال الطرفية]\n');
    }
  };
  ws.onerror=()=>{if(socket===ws)status('error','فشل اتصال WebSocket — جارٍ تحديد السبب...')};
  updateUi();
 }catch(error){disconnected('الطرفية غير متاحة');log('\n['+String(error.message||error)+']\n');}
}
el('aiToggle').addEventListener('click',()=>{
 if(!ready)return;
 aiOpen=!aiOpen;updateAiUi();
 if(aiOpen){send({type:'ai_check'});el('aiPrompt').focus();}
});
el('aiCheck').addEventListener('click',()=>{
 if(!ready)return;
 el('aiState').textContent='جارٍ فحص STAR AI...';
 send({type:'ai_check'});
});
el('aiForm').addEventListener('submit',event=>{
 event.preventDefault();
 if(!ready||!aiReady||aiBusy)return;
 const prompt=el('aiPrompt').value.trim();
 if(!prompt||prompt.length>4000)return;
 aiMessage('user',prompt);
 aiBusy=true;updateAiUi();
 el('aiState').textContent='جارٍ إرسال السؤال...';
 send({type:'ai_chat',prompt});
 el('aiPrompt').value='';
});
el('connect').addEventListener('click',connect);
el('diagnose').addEventListener('click',diagnose);
el('disconnect').addEventListener('click',()=>{if(socket)socket.close(1000,'User disconnected');disconnected('تم قطع الاتصال')});
el('interrupt').addEventListener('click',()=>send({type:'input',data:'\x03'}));
el('clear').addEventListener('click',()=>{out.textContent='';});
el('copy').addEventListener('click',()=>{if(navigator.clipboard?.writeText)navigator.clipboard.writeText(out.textContent).catch(()=>{});});
el('form').addEventListener('submit',event=>{
 event.preventDefault();if(!ready)return;
 const value=el('command').value;
 if(!value.trim())return;
 log('$ '+value+'\n');send({type:'input',data:value+'\n'});el('command').value='';
});
window.addEventListener('pagehide',()=>{if(socket)socket.close(1000,'Page closed')});
updateUi();connect();
})();
</script>
</body>
</html>`;
