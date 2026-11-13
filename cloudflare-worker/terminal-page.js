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
#warning{margin:12px 0 0;color:var(--muted);font-size:12px}
#warning a{color:var(--mint)}
@media(max-width:600px){.wrap{padding:11px}.hero{padding:15px}.term-head{padding:10px}.controls{padding:9px}.btn{padding:8px}#output{height:48dvh;min-height:270px;padding:11px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style>
</head>
<body>
<div class="wrap">
<header>
  <div class="brand"><span class="mark">⌘</span><span>WORMSTAR AI LAB <span class="crumb">/ Linux Terminal</span></span></div>
  <nav class="nav" aria-label="التنقل"><a href="/">الرئيسية</a><a href="/workspace">NEXUS Workspace</a></nav>
</header>
<section class="hero">
 <h1>Linux Terminal — داخل Wormstar</h1>
 <p>الطرفية تستخدم جلسة المالك التي سجّلت بها الدخول إلى Wormstar AI Lab. لا تحتاج كلمة مرور إضافية. الأوامر تُنفَّذ على حاوية Railway المعزولة، وليست على جهازك.</p>
 <div id="status" class="status" data-state="idle" role="status" aria-live="polite"><span class="dot"></span><span id="statusText">جارٍ التحقق من الجلسة...</span></div>
</section>
<section class="term-shell" aria-label="Linux terminal">
 <div class="term-head">
   <strong>terminal@wormstar:~</strong>
   <div class="buttons">
     <button type="button" id="connect" class="btn primary">اتصال</button>
     <button type="button" id="interrupt" class="btn" disabled>Ctrl+C</button>
     <button type="button" id="copy" class="btn">نسخ المخرجات</button>
     <button type="button" id="clear" class="btn">مسح الشاشة</button>
     <button type="button" id="disconnect" class="btn" disabled>قطع الاتصال</button>
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
<p id="warning">عند انتهاء جلسة Wormstar، ارجع إلى <a href="/">الواجهة الرئيسية</a> وسجّل دخولك المعتاد فقط. الوصول إلى الطرفية يتطلب اتصال Cloudflare الآمن بخدمة Railway.</p>
</div>
<script>
(()=>{
'use strict';
const el=id=>document.getElementById(id);
const out=el('output');
const status=(state,text)=>{el('status').dataset.state=state;el('statusText').textContent=text};
let socket=null,ready=false,connecting=false;
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
}
function disconnected(message){
 ready=false;connecting=false;socket=null;updateUi();status('idle',message);
}
function send(data){if(socket&&socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(data))}
async function connect(){
 if(socket||connecting)return;
 const token=ownerKey();
 if(!token){status('error','سجّل الدخول إلى Wormstar AI Lab أولاً');log('\n[تحتاج دخول المالك من الصفحة الرئيسية]\n');return;}
 connecting=true;updateUi();status('idle','جارٍ التحقق من دخول المالك...');
 try{
  const verified=await fetch('/api/auth',{method:'POST',headers:{Authorization:'Bearer '+token},cache:'no-store'});
  if(!verified.ok)throw Error('انتهت الجلسة. ارجع للصفحة الرئيسية وسجّل الدخول.');
  const response=await fetch('/api/terminal/session',{method:'POST',headers:{Authorization:'Bearer '+token},cache:'no-store'});
  if(!response.ok){
   const body=await response.json().catch(()=>({}));
   throw Error(body.error||'خدمة الطرفية غير متاحة حالياً');
  }
  const ticket=await response.json();
  if(!ticket.ticket||ticket.wsPath!=='/api/terminal/ws')throw Error('استجابة اتصال غير صالحة');
  const proto=location.protocol==='https:'?'wss:':'ws:';
  const ws=new WebSocket(proto+'//'+location.host+ticket.wsPath,['wormstar-terminal','ticket.'+ticket.ticket]);
  socket=ws;status('idle','جارٍ فتح قناة الطرفية...');
  ws.onmessage=event=>{
    let msg;try{msg=JSON.parse(event.data)}catch(_){return;}
    if(msg.type==='ready'){
      ready=true;connecting=false;updateUi();status('ready','متصل — جلسة Linux فعالة');el('command').focus();
    }else if(msg.type==='output'||msg.type==='info')log(msg.data);
    else if(msg.type==='error')log('\n[حدث خطأ بالجلسة]\n');
  };
  ws.onclose=()=>{if(socket===ws){disconnected('انتهى اتصال الطرفية');log('\n[اتصال الطرفية انتهى]\n')}};
  ws.onerror=()=>{if(socket===ws)status('error','فشل اتصال الطرفية. تحقق من إعداد بوابة Railway.');};
  updateUi();
 }catch(error){disconnected('الطرفية غير متاحة');log('\n['+String(error.message||error)+']\n');}
}
el('connect').addEventListener('click',connect);
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
