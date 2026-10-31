const REDESIGN_HTML = String.raw\`<!doctype html>
<html lang="ar" dir="rtl" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f4f2eb">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Wormstar">
<meta name="mobile-web-app-capable" content="yes">
<meta name="format-detection" content="telephone=no">
<meta name="description" content="Wormstar — Cyber Intelligence Workspace">
<link rel="apple-touch-icon" sizes="96x96" href="/apple-touch-icon.png?v=20261101">
<link rel="icon" type="image/svg+xml" href="/icon.svg?v=20261101">
<link rel="manifest" href="/manifest.webmanifest?v=20261101">
<title>Wormstar — Intelligence Workspace</title>
<style>
:root{
 color-scheme:light;
 --bg:#f4f2eb;--paper:#fffefa;--paper-2:#f8f7f1;--ink:#19282a;--ink-2:#314447;
 --muted:#718082;--line:#e5e4dc;--line-strong:#d7d8ce;--sidebar:#182a2c;
 --sidebar-2:#213839;--sidebar-text:#d7e0dc;--accent:#176b5e;--accent-2:#258775;
 --accent-soft:#e7f2ed;--copper:#b66f4e;--copper-soft:#f7ece5;--gold:#d8b36b;
 --danger:#b44c49;--danger-soft:#f9e9e7;--good:#3b8066;--shadow:0 18px 45px rgba(28,42,39,.07);
 --radius:18px;--radius-sm:12px;--focus:0 0 0 3px rgba(23,107,94,.18);
 font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Arabic",Tahoma,Arial,sans-serif;
}
html[data-theme="dark"]{
 color-scheme:dark;--bg:#111a1c;--paper:#192526;--paper-2:#202e2f;--ink:#edf2eb;
 --ink-2:#cbd8d2;--muted:#9badaa;--line:#2e4140;--line-strong:#3d5250;
 --sidebar:#0d191a;--sidebar-2:#192b2b;--sidebar-text:#d7e0dc;--accent:#62b5a1;
 --accent-2:#79c8b3;--accent-soft:#1d3933;--copper:#d39170;--copper-soft:#3a2a24;
 --danger:#ef9189;--danger-soft:#402725;--good:#76b99a;--shadow:0 18px 45px rgba(0,0,0,.24);
}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:var(--bg);color:var(--ink)}
body{font-size:14px;line-height:1.55}
button,input,textarea,select{font:inherit}
button{cursor:pointer}
button:disabled{opacity:.55;cursor:not-allowed}
a{color:inherit}
.hidden{display:none!important}
.skip-link{position:fixed;top:10px;inset-inline-start:10px;z-index:1000;padding:10px 14px;border-radius:10px;background:var(--ink);color:#fff;transform:translateY(-150%)}
.skip-link:focus{transform:translateY(0)}
:focus-visible{outline:none;box-shadow:var(--focus)}
.gate{min-height:100svh;display:grid;place-items:center;padding:24px;background:
 radial-gradient(circle at 15% 15%,rgba(182,111,78,.10),transparent 28%),
 radial-gradient(circle at 85% 80%,rgba(23,107,94,.12),transparent 30%),var(--bg)}
.gate-card{width:min(100%,450px);padding:34px;background:var(--paper);border:1px solid var(--line);border-radius:26px;box-shadow:var(--shadow)}
.gate-brand{display:flex;align-items:center;gap:13px;margin-bottom:30px}
.brand-symbol{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;background:var(--sidebar);color:#e4c18a}
.brand-symbol svg{width:27px;height:27px}
.brand-name{font-size:19px;font-weight:800;letter-spacing:.12em;direction:ltr}
.brand-sub{font-size:10px;letter-spacing:.18em;color:var(--muted);direction:ltr}
.gate-kicker{color:var(--accent);font-weight:750;font-size:11px;letter-spacing:.12em;text-transform:uppercase}
.gate h1{font-size:28px;line-height:1.3;margin:10px 0}
.gate-copy{color:var(--muted);margin:0 0 25px;line-height:1.9}
.field-label{display:block;color:var(--ink-2);font-size:12px;font-weight:750;margin:0 0 8px}
.field{width:100%;min-height:48px;border:1px solid var(--line-strong);background:var(--paper-2);color:var(--ink);border-radius:12px;padding:12px 14px;outline:none}
.field:focus{border-color:var(--accent);box-shadow:var(--focus)}
.gate .field{direction:ltr;text-align:left;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
.btn{min-height:42px;padding:10px 15px;border-radius:11px;border:1px solid transparent;display:inline-flex;align-items:center;justify-content:center;gap:9px;font-weight:750;transition:transform .16s ease,background .16s ease,border-color .16s ease}
.btn:active{transform:translateY(1px)}
.btn-primary{background:var(--accent);color:#fff}
.btn-primary:hover{background:var(--accent-2)}
.btn-secondary{background:var(--paper);color:var(--ink);border-color:var(--line-strong)}
.btn-secondary:hover{background:var(--paper-2)}
.btn-soft{background:var(--accent-soft);color:var(--accent);border-color:transparent}
.btn-danger{background:var(--danger-soft);color:var(--danger)}
.btn-block{width:100%;margin-top:14px;min-height:49px}
.gate-error{min-height:22px;margin-top:12px;color:var(--danger);font-size:12px}
.gate-foot{border-top:1px solid var(--line);margin-top:22px;padding-top:17px;color:var(--muted);font-size:11px;display:flex;align-items:center;gap:8px}
.shell{min-height:100svh;display:grid;grid-template-columns:260px minmax(0,1fr);direction:rtl}
.sidebar{grid-column:1;grid-row:1;position:sticky;top:0;height:100svh;background:var(--sidebar);color:var(--sidebar-text);padding:25px 16px 18px;display:flex;flex-direction:column;z-index:40;overflow:auto}
.sidebar-brand{display:flex;align-items:center;gap:12px;padding:0 10px 24px;margin-bottom:18px;border-bottom:1px solid rgba(221,236,229,.12)}
.sidebar-brand .brand-symbol{width:42px;height:42px;border-radius:13px;background:var(--sidebar-2);color:#dfbd86}
.sidebar-brand .brand-name{font-size:17px;color:#f2f3eb}
.sidebar-brand .brand-sub{color:#91aaa1}
.nav-group{margin:12px 0 18px}
.nav-label{font-size:10px;font-weight:800;letter-spacing:.12em;color:#8ca39b;padding:0 12px 8px}
.nav{display:grid;gap:5px}
.nav-btn{width:100%;min-height:44px;border:1px solid transparent;border-radius:11px;background:transparent;color:#bdcbc4;display:flex;align-items:center;gap:12px;padding:10px 12px;text-align:start;transition:background .16s ease,color .16s ease}
.nav-btn svg{width:18px;height:18px;flex:none;opacity:.88}
.nav-btn:hover{background:rgba(255,255,255,.06);color:#fff}
.nav-btn.active{background:rgba(100,177,156,.16);border-color:rgba(134,203,182,.18);color:#aee2d0}
.nav-spacer{flex:1}
.sidebar-note{border:1px solid rgba(221,236,229,.12);background:rgba(255,255,255,.035);border-radius:13px;padding:13px;color:#a9bab2;font-size:11px;line-height:1.8}
.sidebar-note strong{display:block;color:#e4c18a;font-size:11px;margin-bottom:4px}
.main{min-width:0;grid-column:2;grid-row:1;direction:inherit}
.topbar{height:76px;position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(16px);border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 clamp(16px,3vw,42px);gap:14px}
.topbar-start,.topbar-actions{display:flex;align-items:center;gap:11px;min-width:0}
.breadcrumb{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.top-title{font-weight:800;font-size:14px;white-space:nowrap}
.icon-btn{width:40px;height:40px;border:1px solid var(--line);border-radius:12px;background:var(--paper);color:var(--ink-2);display:grid;place-items:center}
.icon-btn:hover{background:var(--paper-2);border-color:var(--line-strong)}
.icon-btn svg{width:18px;height:18px}
.status-pill{display:inline-flex;align-items:center;gap:8px;background:var(--accent-soft);color:var(--accent);border-radius:999px;padding:7px 11px;font-size:11px;font-weight:750;white-space:nowrap}
.status-dot{width:7px;height:7px;border-radius:50%;background:var(--good);box-shadow:0 0 0 3px color-mix(in srgb,var(--good) 15%,transparent)}
.page{max-width:1540px;margin:0 auto;padding:30px clamp(16px,3vw,42px) 56px}
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:25px;flex-wrap:wrap}
.page-eyebrow{font-size:10px;font-weight:850;letter-spacing:.16em;color:var(--accent);text-transform:uppercase}
.page-title{font-size:clamp(25px,3vw,34px);letter-spacing:-.035em;line-height:1.25;margin:7px 0}
.page-subtitle{margin:0;color:var(--muted);max-width:680px;line-height:1.8}
.page-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.hero{position:relative;overflow:hidden;border-radius:24px;background:linear-gradient(115deg,#1b3433 0%,#244a43 56%,#8b6a4e 145%);color:#f7f4e9;padding:clamp(24px,3vw,38px);min-height:212px;display:flex;align-items:center;justify-content:space-between;gap:22px;box-shadow:var(--shadow)}
.hero:after{content:"";position:absolute;width:280px;height:280px;border:1px solid rgba(238,222,190,.18);border-radius:50%;inset-inline-end:7%;top:-115px;box-shadow:0 0 0 26px rgba(238,222,190,.035),0 0 0 58px rgba(238,222,190,.025)}
.hero-copy{position:relative;z-index:1;max-width:640px}
.hero-kicker{display:inline-flex;align-items:center;gap:8px;color:#d9c49e;font-size:10px;font-weight:800;letter-spacing:.14em}
.hero h1{font-size:clamp(26px,3vw,37px);line-height:1.32;margin:15px 0 8px;letter-spacing:-.04em}
.hero p{color:#cfddd5;line-height:1.85;margin:0;max-width:590px;font-size:13px}
.hero-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:21px}
.hero .btn-primary{background:#e0c18c;color:#1c302e}
.hero .btn-secondary{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.19);color:#f8f5e9}
.hero-mark{position:relative;z-index:1;flex:none;width:120px;height:120px;border:1px solid rgba(226,205,161,.25);border-radius:34px;display:grid;place-items:center;color:#e2c18a;background:rgba(255,255,255,.055);transform:rotate(6deg)}
.hero-mark svg{width:68px;height:68px}
.stats-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:18px 0 29px}
.stat-card,.surface{background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);box-shadow:0 5px 18px rgba(32,48,45,.025)}
.stat-card{padding:17px 19px;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:94px}
.stat-label{font-size:11px;color:var(--muted);font-weight:750}
.stat-value{font-size:20px;font-weight:850;letter-spacing:-.03em;margin-top:5px}
.stat-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:var(--accent-soft);color:var(--accent)}
.stat-icon.copper{background:var(--copper-soft);color:var(--copper)}
.stat-icon svg{width:20px;height:20px}
.section-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:28px 0 13px}
.section-head h2{font-size:16px;margin:0;letter-spacing:-.02em}
.section-head p{font-size:11px;color:var(--muted);margin:4px 0 0}
.launch-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}
.launch-card{border:1px solid var(--line);border-radius:16px;background:var(--paper);padding:18px;min-height:145px;text-align:start;color:var(--ink);display:flex;flex-direction:column;align-items:flex-start;gap:9px;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}
.launch-card:hover{transform:translateY(-2px);border-color:var(--line-strong);box-shadow:var(--shadow)}
.launch-icon{width:39px;height:39px;border-radius:13px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center}
.launch-icon.copper{background:var(--copper-soft);color:var(--copper)}
.launch-icon svg{width:19px;height:19px}
.launch-title{font-weight:800;font-size:13px}
.launch-desc{font-size:11px;color:var(--muted);line-height:1.7}
.overview-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(260px,.8fr);gap:15px;align-items:start}
.surface-pad{padding:20px}
.status-list{display:grid;gap:12px}
.status-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 0;border-bottom:1px solid var(--line)}
.status-row:last-child{border-bottom:0;padding-bottom:0}
.status-row:first-child{padding-top:0}
.status-name{font-size:12px;font-weight:750}
.status-detail{font-size:10px;color:var(--muted);margin-top:2px}
.status-tag{font-size:10px;padding:5px 8px;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-weight:800;white-space:nowrap}
.status-tag.warn{background:var(--copper-soft);color:var(--copper)}
.workbench-grid{display:grid;grid-template-columns:minmax(0,1fr) 248px;gap:15px;align-items:start}
.chat-surface{overflow:hidden;min-width:0}
.chat-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 17px;border-bottom:1px solid var(--line);background:var(--paper-2);flex-wrap:wrap}
.chat-toolbar-group{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.toolbar-select{min-height:38px;padding:7px 11px;border:1px solid var(--line-strong);border-radius:10px;background:var(--paper);color:var(--ink);font-size:11px;max-width:210px}
.thread{min-height:360px;max-height:calc(100svh - 345px);overflow:auto;padding:20px;display:flex;flex-direction:column;gap:16px}
.thread-empty{margin:auto;text-align:center;max-width:410px;color:var(--muted);padding:28px 12px}
.thread-empty-mark{width:58px;height:58px;margin:0 auto 14px;border-radius:19px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center}
.thread-empty-mark svg{width:27px;height:27px}
.thread-empty strong{display:block;color:var(--ink);font-size:14px;margin-bottom:5px}
.thread-empty p{font-size:11px;line-height:1.8;margin:0}
.message{max-width:min(88%,850px);display:grid;gap:5px}
.message.user{align-self:flex-start}
.message.assistant{align-self:flex-end}
.message-meta{font-size:10px;color:var(--muted);display:flex;gap:8px;align-items:center}
.message.user .message-meta{justify-content:flex-start}
.message.assistant .message-meta{justify-content:flex-end}
.message-bubble{padding:13px 15px;border-radius:15px;border:1px solid var(--line);background:var(--paper-2);color:var(--ink);white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.9;font-size:13px}
.message.user .message-bubble{background:var(--accent-soft);border-color:transparent}
.message.assistant .message-bubble{background:var(--paper);border-bottom-inline-end:3px solid var(--accent)}
.typing{align-self:flex-end;color:var(--muted);font-size:11px;display:flex;gap:8px;align-items:center;padding:8px 4px}
.typing:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:12px 0 0 var(--accent),24px 0 0 var(--accent);margin-inline-end:23px;animation:pulse 1s infinite ease-in-out}
@keyframes pulse{50%{opacity:.35}}
.composer{border-top:1px solid var(--line);padding:14px;background:var(--paper)}
.composer textarea{width:100%;min-height:108px;max-height:240px;resize:vertical;border:1px solid var(--line-strong);border-radius:14px;background:var(--paper-2);color:var(--ink);padding:14px;line-height:1.8;outline:none}
.composer textarea:focus{border-color:var(--accent);box-shadow:var(--focus)}
.composer-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}
.composer-hint{font-size:10px;color:var(--muted)}
.quick-prompts{display:flex;gap:7px;flex-wrap:wrap;padding:0 17px 15px}
.quick-prompt{border:1px solid var(--line);background:var(--paper-2);color:var(--ink-2);border-radius:999px;padding:7px 11px;font-size:10px}
.quick-prompt:hover{border-color:var(--accent);color:var(--accent)}
.context-card{padding:17px}
.context-card h3{font-size:13px;margin:0 0 12px}
.context-line{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid var(--line);font-size:11px}
.context-line span:first-child{color:var(--muted)}
.context-line strong{font-size:10px}
.notice{margin-top:12px;border-radius:12px;padding:11px 12px;background:var(--copper-soft);color:var(--copper);font-size:10px;line-height:1.8}
.list{display:grid;gap:10px}
.list-item{display:flex;align-items:flex-start;gap:12px;padding:15px;border:1px solid var(--line);border-radius:13px;background:var(--paper)}
.list-icon{width:36px;height:36px;flex:none;border-radius:11px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center}
.list-icon svg{width:18px;height:18px}
.list-title{font-weight:800;font-size:12px}
.list-copy{color:var(--muted);font-size:11px;line-height:1.75;margin-top:3px}
.memory-grid{display:grid;grid-template-columns:minmax(260px,.72fr) minmax(0,1.5fr);gap:15px;align-items:start}
.form-card{padding:18px}
.form-card label{display:block;font-size:11px;font-weight:800;margin:0 0 7px}
.form-card input,.form-card textarea,.form-card select{width:100%;border:1px solid var(--line-strong);background:var(--paper-2);color:var(--ink);padding:11px 12px;border-radius:11px;margin-bottom:13px;outline:none}
.form-card textarea{min-height:150px;resize:vertical;line-height:1.7}
.empty-box{padding:28px;text-align:center;border:1px dashed var(--line-strong);border-radius:15px;color:var(--muted);font-size:12px}
.policy-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.policy-card{padding:17px}
.policy-card h3{margin:0 0 8px;font-size:13px}
.policy-card p{margin:0;color:var(--muted);font-size:11px;line-height:1.8}
.policy-state{display:inline-block;border-radius:999px;padding:5px 8px;margin-top:12px;font-size:10px;font-weight:800;background:var(--accent-soft);color:var(--accent)}
.policy-state.off{background:var(--danger-soft);color:var(--danger)}
.agent-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.agent-card{padding:20px}
.agent-card-top{display:flex;align-items:center;justify-content:space-between;gap:12px}
.agent-card h3{font-size:15px;margin:0}
.agent-card p{color:var(--muted);font-size:11px;line-height:1.8}
.agent-state{font-size:10px;font-weight:800;color:var(--copper);background:var(--copper-soft);border-radius:999px;padding:6px 9px}
.agent-state.online{color:var(--accent);background:var(--accent-soft)}
.kv{font-size:10px;color:var(--muted);padding-top:10px;border-top:1px solid var(--line);overflow-wrap:anywhere}
.toast{position:fixed;z-index:100;inset-inline-end:22px;bottom:22px;max-width:min(420px,calc(100vw - 30px));padding:12px 16px;border-radius:12px;background:var(--ink);color:#fff;box-shadow:var(--shadow);font-size:12px;opacity:0;transform:translateY(12px);pointer-events:none;transition:all .2s ease}
.toast.show{opacity:1;transform:translateY(0)}
.mobile-menu-btn{display:none}
.mobile-nav{display:none}
.mobile-veil{display:none}
@media(max-width:1120px){
 .shell{grid-template-columns:236px minmax(0,1fr)}
 .sidebar{padding-inline:12px}
 .overview-grid{grid-template-columns:minmax(0,1fr)}
 .workbench-grid{grid-template-columns:minmax(0,1fr)}
 .context-column{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
}
@media(max-width:860px){
 .shell{display:block}
 .sidebar{position:fixed;inset-block:0;inset-inline-end:0;width:min(290px,85vw);height:100svh;transform:translateX(110%);transition:transform .22s ease;box-shadow:var(--shadow)}
 html[dir="ltr"] .sidebar{transform:translateX(-110%);inset-inline-end:auto;inset-inline-start:0}
 .sidebar.open{transform:translateX(0)}
 .main{width:100%}
 .mobile-menu-btn{display:grid}
 .mobile-veil.show{display:block;position:fixed;inset:0;z-index:35;background:rgba(15,24,23,.35);backdrop-filter:blur(2px)}
 .topbar{height:66px}
 .stats-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
 .launch-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
 .mobile-nav{position:fixed;display:grid;grid-template-columns:repeat(5,1fr);z-index:32;inset-inline:10px;bottom:calc(9px + env(safe-area-inset-bottom));min-height:64px;padding:6px;border:1px solid var(--line);border-radius:18px;background:color-mix(in srgb,var(--paper) 94%,transparent);backdrop-filter:blur(18px);box-shadow:0 10px 30px rgba(20,30,28,.13)}
 .mobile-nav button{display:grid;align-content:center;justify-items:center;gap:3px;border:0;border-radius:12px;background:transparent;color:var(--muted);font-size:9px;font-weight:750;min-width:0}
 .mobile-nav button svg{width:18px;height:18px}
 .mobile-nav button.active{background:var(--accent-soft);color:var(--accent)}
 .page{padding-bottom:115px}
}
@media(max-width:620px){
 .topbar{padding:0 13px}
 .topbar .breadcrumb{display:none}
 .top-title{font-size:13px}
 .topbar-actions{gap:6px}
 .topbar-actions .status-pill{padding:6px 8px;font-size:9px}
 .icon-btn{width:38px;height:38px;border-radius:11px}
 .page{padding:20px 13px 116px}
 .page-head{align-items:flex-start;margin-bottom:18px}
 .page-actions{width:100%}
 .hero{padding:22px 19px;border-radius:20px;min-height:0}
 .hero-mark{width:65px;height:65px;border-radius:20px}
 .hero-mark svg{width:39px;height:39px}
 .hero h1{font-size:25px}
 .hero p{font-size:11px}
 .hero-actions .btn{min-height:42px;padding:9px 12px;font-size:11px}
 .stats-grid{grid-template-columns:1fr;gap:9px;margin:12px 0 22px}
 .stat-card{min-height:73px;padding:13px 15px}
 .stat-value{font-size:17px}
 .launch-grid{grid-template-columns:1fr;gap:9px}
 .launch-card{min-height:105px;padding:14px;display:grid;grid-template-columns:40px 1fr;align-items:center;column-gap:12px}
 .launch-icon{grid-row:span 2}
 .launch-title,.launch-desc{grid-column:2}
 .launch-desc{align-self:start}
 .workbench-grid{display:block}
 .thread{min-height:260px;max-height:calc(100svh - 340px);padding:14px}
 .chat-toolbar{padding:10px;align-items:flex-start}
 .chat-toolbar-group{width:100%}
 .toolbar-select{flex:1;max-width:none;min-width:0}
 .chat-toolbar .page-actions{width:auto}
 .message{max-width:96%}
 .message-bubble{font-size:12px;padding:11px 12px}
 .composer{padding:10px}
 .composer textarea{min-height:90px;font-size:13px}
 .composer-foot{align-items:flex-start}
 .composer-hint{max-width:60%}
 .context-column{grid-template-columns:1fr}
 .memory-grid,.agent-grid,.policy-grid{grid-template-columns:1fr}
 .gate-card{padding:25px 20px;border-radius:21px}
 .gate h1{font-size:24px}
}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation-duration:.01ms!important;transition-duration:.01ms!important}}
</style>
</head>
<body>
<a class="skip-link" href="#page">تجاوز إلى المحتوى</a>

<section id="gate" class="gate" aria-labelledby="gateTitle">
 <div class="gate-card">
  <div class="gate-brand">
   <div class="brand-symbol" aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none"><path d="M24 3.5 28.5 19.5 44.5 24 28.5 28.5 24 44.5 19.5 28.5 3.5 24 19.5 19.5 24 3.5Z" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><circle cx="24" cy="24" r="4" fill="currentColor"/></svg>
   </div>
   <div><div class="brand-name">WORMSTAR</div><div class="brand-sub">INTELLIGENCE WORKSPACE</div></div>
  </div>
  <div class="gate-kicker">PRIVATE SECURITY ENVIRONMENT</div>
  <h1 id="gateTitle">مساحة العمل الأمنية</h1>
  <p class="gate-copy">سجّل الدخول بمفتاح الوصول الخاص بالمختبر. يبقى المفتاح ضمن جلسة المتصفح ولا يُحفظ على الجهاز.</p>
  <form id="loginForm">
   <label for="accessToken" class="field-label">مفتاح الوصول</label>
   <input id="accessToken" class="field" type="password" autocomplete="current-password" autocapitalize="off" spellcheck="false" required placeholder="Wormstar access token">
   <button class="btn btn-primary btn-block" id="loginButton" type="submit">فتح مساحة العمل <span aria-hidden="true">↗</span></button>
   <div id="gateError" class="gate-error" role="alert" aria-live="polite"></div>
  </form>
  <div class="gate-foot"><span aria-hidden="true">◈</span> صلاحيات الخادم هي المرجع النهائي لكل عملية.</div>
 </div>
</section>

<div id="app" class="shell hidden" dir="rtl">
 <aside class="sidebar" id="sidebar" aria-label="التنقل الرئيسي">
  <div class="sidebar-brand">
   <div class="brand-symbol" aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none"><path d="M24 3.5 28.5 19.5 44.5 24 28.5 28.5 24 44.5 19.5 28.5 3.5 24 19.5 19.5 24 3.5Z" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><circle cx="24" cy="24" r="4" fill="currentColor"/></svg>
   </div>
   <div><div class="brand-name">WORMSTAR</div><div class="brand-sub">SECURITY INTELLIGENCE</div></div>
  </div>
  <div class="nav-group">
   <div class="nav-label" data-t="workspace">مساحة العمل</div>
   <nav class="nav">
    <button class="nav-btn active" data-nav="overview"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/></svg><span data-t="overview">نظرة عامة</span></button>
    <button class="nav-btn" data-nav="assistant"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3a8 8 0 0 0-8 8v2a3 3 0 0 0 3 3h1v-6H7a5 5 0 0 1 10 0h-1v6h1a3 3 0 0 0 3-3v-2a8 8 0 0 0-8-8Z"/><path d="M9 19h6"/></svg><span data-t="assistant">المساعد الذكي</span></button>
   </nav>
  </div>
  <div class="nav-group">
   <div class="nav-label" data-t="analysis">التحليل الأمني</div>
   <nav class="nav">
    <button class="nav-btn" data-nav="code"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg><span data-t="code">مراجعة الأكواد</span></button>
    <button class="nav-btn" data-nav="logs"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16M4 10h16M4 15h10M4 20h7"/><circle cx="18" cy="17" r="3"/></svg><span data-t="logs">تحليل السجلات</span></button>
    <button class="nav-btn" data-nav="ioc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v3M23 12h-3M12 23v-3M1 12h3"/></svg><span data-t="ioc">مؤشرات الاختراق</span></button>
    <button class="nav-btn" data-nav="ctf"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 21V4m0 0c5-3 9 3 14 0v11c-5 3-9-3-14 0"/></svg><span data-t="ctf">مختبر CTF</span></button>
    <button class="nav-btn" data-nav="report"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/></svg><span data-t="reports">التقارير</span></button>
   </nav>
  </div>
  <div class="nav-group">
   <div class="nav-label" data-t="platform">المنصة</div>
   <nav class="nav">
    <button class="nav-btn" data-nav="memory"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg><span data-t="memory">مكتبة المعرفة</span></button>
    <button class="nav-btn" data-nav="agents"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M9 7V4h6v3M8 12h.01M16 12h.01M9 16h6"/></svg><span data-t="agents">الوكلاء والتكاملات</span></button>
    <button class="nav-btn" data-nav="policy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="m9 12 2 2 4-4"/></svg><span data-t="policy">السياسات والصلاحيات</span></button>
   </nav>
  </div>
  <div class="nav-spacer"></div>
  <div class="sidebar-note"><strong>PRIVATE BY DESIGN</strong>تحليل المحتوى لا يعني تنفيذ فحص حي. تبقى صلاحيات التنفيذ والاتصال تحت تحكم الخادم.</div>
  <button class="nav-btn" data-nav="settings" style="margin-top:12px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a7.7 7.7 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a7.7 7.7 0 0 1-1.7-1l-1.7.6-1.4-2.4 1.4-1.1a7.5 7.5 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a7.7 7.7 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a7.7 7.7 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a7.5 7.5 0 0 1 0 2Z"/></svg><span data-t="settings">الإعدادات</span></button>
 </aside>
 <div class="mobile-veil" id="mobileVeil"></div>
 <main class="main" id="main">
  <header class="topbar">
   <div class="topbar-start">
    <button class="icon-btn mobile-menu-btn" id="mobileMenu" aria-label="فتح القائمة"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
    <div><div class="top-title" id="topTitle">نظرة عامة</div><div class="breadcrumb" id="breadcrumb">Wormstar / Intelligence Workspace</div></div>
   </div>
   <div class="topbar-actions">
    <span class="status-pill"><span class="status-dot"></span><span id="healthLabel">جارٍ التحقق من الخدمة</span></span>
    <button class="icon-btn" id="langButton" aria-label="Switch language" title="العربية / English">EN</button>
    <button class="icon-btn" id="themeButton" aria-label="تغيير المظهر" title="تغيير المظهر"><svg id="themeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>
    <button class="icon-btn" id="logoutButton" aria-label="تسجيل الخروج" title="تسجيل الخروج"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg></button>
   </div>
  </header>
  <div id="page" class="page" tabindex="-1"></div>
 </main>
</div>

<nav class="mobile-nav hidden" id="mobileNav" aria-label="التنقل السفلي">
 <button data-nav="overview" class="active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/></svg><span data-t="home">الرئيسية</span></button>
 <button data-nav="assistant"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3a8 8 0 0 0-8 8v2a3 3 0 0 0 3 3h1v-6H7a5 5 0 0 1 10 0h-1v6h1a3 3 0 0 0 3-3v-2a8 8 0 0 0-8-8Z"/></svg><span data-t="assistant">المساعد</span></button>
 <button data-nav="code"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg><span data-t="code">الأكواد</span></button>
 <button data-nav="reports"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/></svg><span data-t="reports">التقارير</span></button>
 <button id="mobileMore"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg><span data-t="more">المزيد</span></button>
</nav>
<div id="toast" class="toast" role="status" aria-live="polite"></div>

<script>
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const KEY='wormstar-access';
 const MODE_IDS=['assistant','code','logs','ioc','ctf','report'];
 const MODE_META={
  assistant:{ar:'المساعد الذكي',en:'AI assistant',subAr:'تحليل وبحث أمني',subEn:'Security research and analysis',hintAr:'اكتب سؤالك أو صف المهمة الأمنية...',hintEn:'Describe your security research task...',promptsAr:['صمّم خطة تقييم أمني ضمن نطاق مصرح به','اشرح الفرق بين SAST و DAST','أنشئ نموذج تهديدات لتطبيق SaaS'],promptsEn:['Design an authorized security assessment plan','Explain SAST vs DAST','Create a threat model for a SaaS app']},
  code:{ar:'مراجعة الأكواد',en:'Code review',subAr:'تحليل الشيفرة واكتشاف العيوب',subEn:'Source review and weakness analysis',hintAr:'الصق الشيفرة وحدد الجزء المطلوب مراجعته...',hintEn:'Paste source code and describe what to review...',promptsAr:['راجع هذا الكود بحثاً عن SQL injection','حلل إدارة الجلسات في هذا المقطع','اقترح إصلاحاً لتسريب أسرار API'],promptsEn:['Review this code for SQL injection','Analyze session handling','Suggest a fix for an API secret leak']},
  logs:{ar:'تحليل السجلات',en:'Log analysis',subAr:'فرز الأحداث وبناء الخط الزمني',subEn:'Event triage and timeline building',hintAr:'الصق السجلات أو الأحداث المطلوب تحليلها...',hintEn:'Paste logs or events for analysis...',promptsAr:['حلّل محاولات تسجيل الدخول غير المعتادة','كوّن خطاً زمنياً من سجلات الحادث','ميّز الإنذارات الحقيقية من الإيجابيات الكاذبة'],promptsEn:['Analyze unusual login attempts','Build an incident timeline','Separate true alerts from false positives']},
  ioc:{ar:'مؤشرات الاختراق',en:'IOC analysis',subAr:'تصنيف المؤشرات وتحليلها دون اتصال بها',subEn:'Classify indicators without contacting them',hintAr:'الصق عناوين IP أو الروابط أو الـ hashes...',hintEn:'Paste IPs, URLs or hashes...',promptsAr:['صنّف مؤشرات الاختراق الموجودة في النص','حلّل هذه الـ hashes والعناوين دون الاتصال بها','اكتب خطوات triage لمؤشرات مشبوهة'],promptsEn:['Classify the indicators in this text','Analyze hashes and addresses without contacting them','Write triage steps for suspicious indicators']},
  ctf:{ar:'مختبر CTF',en:'CTF lab',subAr:'تعلّم داخل تحديات تدريبية',subEn:'Practice in educational challenges',hintAr:'اكتب وصف تحدي CTF التدريبي...',hintEn:'Describe the CTF challenge...',promptsAr:['اشرح طريقة التفكير في تحدي Web CTF','علّمني تحليل ملفات PCAP في مختبر','ساعدني في تحدي تشفير تدريبي'],promptsEn:['Explain how to approach a Web CTF','Teach PCAP analysis in a lab','Help with a cryptography challenge']},
  report:{ar:'التقارير الفنية',en:'Technical reports',subAr:'تنظيم النتائج والأدلة والتوصيات',subEn:'Organize findings, evidence and recommendations',hintAr:'أدخل النتائج والأدلة لتوليد تقرير احترافي...',hintEn:'Enter findings and evidence to draft a report...',promptsAr:['أنشئ تقرير تقييم أمني من هذه النتائج','اكتب تقرير استجابة لحادث','رتّب النتائج حسب الشدة والأولوية'],promptsEn:['Draft a security assessment report','Write an incident response report','Prioritize findings by severity']},
 };
 const LABELS={
  overview:['نظرة عامة','Overview'],assistant:['المساعد الذكي','AI assistant'],code:['مراجعة الأكواد','Code review'],logs:['تحليل السجلات','Log analysis'],ioc:['مؤشرات الاختراق','IOC analysis'],ctf:['مختبر CTF','CTF lab'],report:['التقارير الفنية','Technical reports'],reports:['سجل التقارير','Report history'],memory:['مكتبة المعرفة','Knowledge library'],agents:['الوكلاء والتكاملات','Agents & integrations'],policy:['السياسات والصلاحيات','Policy & permissions'],settings:['الإعدادات','Settings']
 };
 const WORDS={
  workspace:['مساحة العمل','Workspace'],analysis:['التحليل الأمني','Security analysis'],platform:['المنصة','Platform'],home:['الرئيسية','Home'],more:['المزيد','More']
 };
 let token='',lang='ar',theme='light',pageName='overview',activeMode='assistant',busy=false,health=null,chat={},archiveRevision={},memoryItems=[];
 try{theme=localStorage.getItem('wormstar-theme')==='dark'?'dark':'light';}catch(e){}
 try{lang=localStorage.getItem('wormstar-lang')==='en'?'en':'ar';}catch(e){}
 try{chat=JSON.parse(sessionStorage.getItem('wormstar-chat')||'{}')||{};}catch(e){chat={};}

 function t(key){const pair=LABELS[key]||WORDS[key];return pair?pair[lang==='ar'?0:1]:key;}
 function modeLabel(id){return MODE_META[id]?MODE_META[id][lang==='ar'?'ar':'en']:id;}
 function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
 function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3400);}
 async function api(path,options){
  options=options||{};const headers=new Headers(options.headers||{});
  if(token)headers.set('Authorization','Bearer '+token);
  if(options.body!==undefined)headers.set('Content-Type','application/json');
  const response=await fetch(path,{...options,headers:headers,cache:'no-store'});
  let data={};try{data=await response.json();}catch(e){data={};}
  if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
  return data;
 }
 async function validateToken(value){
  const response=await fetch('/api/auth',{method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+value}});
  return response.ok;
 }
 function applyPrefs(){
  document.documentElement.dataset.theme=theme;
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==='ar'?'rtl':'ltr';
  const root=$('app');if(root)root.dir=lang==='ar'?'rtl':'ltr';
  document.querySelectorAll('[data-t]').forEach(el=>{
   const key=el.dataset.t;
   if(LABELS[key]||WORDS[key])el.textContent=t(key);
  });
  $('langButton').textContent=lang==='ar'?'EN':'ع';
  $('themeButton').setAttribute('aria-label',lang==='ar'?'تغيير المظهر':'Change appearance');
  $('mobileMenu').setAttribute('aria-label',lang==='ar'?'فتح القائمة':'Open navigation');
  $('logoutButton').setAttribute('aria-label',lang==='ar'?'تسجيل الخروج':'Sign out');
  renderPage();
 }
 function saveChat(){try{sessionStorage.setItem('wormstar-chat',JSON.stringify(chat));}catch(e){toast(lang==='ar'?'تعذر حفظ الجلسة في مساحة المتصفح':'Could not save this browser session');}}
 function setPage(next){
  pageName=next;
  if(MODE_IDS.includes(next))activeMode=next;
  $('sidebar').classList.remove('open');$('mobileVeil').classList.remove('show');
  document.querySelectorAll('[data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===next||(next==='reports'&&el.dataset.nav==='reports')));
  document.querySelectorAll('#mobileNav [data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===next));
  $('topTitle').textContent=t(next);
  $('breadcrumb').textContent='Wormstar / '+t(next);
  renderPage();
  if(MODE_IDS.includes(next))void loadArchive(next);
 }
 function overviewHTML(){
  const online=health&&health.aiConfigured===true;
  const model=health&&health.model?health.model:'GPT-OSS';
  return '<div class="page-head"><div><div class="page-eyebrow">WORMSTAR / COMMAND OVERVIEW</div><h1 class="page-title">'+(lang==='ar'?'مساحة العمل، بوضوح':'Your security workspace, in focus')+'</h1><p class="page-subtitle">'+(lang==='ar'?'مركز موحد للتحليل، مراجعة الشيفرة، فرز المؤشرات وإدارة المعرفة.':'A focused place for analysis, code review, indicator triage and knowledge management.')+'</p></div><div class="page-actions"><button class="btn btn-secondary" data-action="refresh-health">تحديث الحالة</button><button class="btn btn-primary" data-nav="assistant">ابدأ تحليلاً جديداً ↗</button></div></div>'+
  '<section class="hero"><div class="hero-copy"><div class="hero-kicker">✦ PRIVATE AI SECURITY WORKSPACE</div><h1>'+(lang==='ar'?'من الدليل إلى قرار أوضح.':'Turn evidence into clearer decisions.')+'</h1><p>'+(lang==='ar'?'حلّل النصوص والشيفرات والسجلات، وثّق النتائج، واحتفظ بالمعرفة ضمن مساحة خاصة بصلاحيات يفرضها الخادم.':'Analyze source, logs and indicators, document findings, and keep your knowledge in a private workspace governed by server-side permissions.')+'</p><div class="hero-actions"><button class="btn btn-primary" data-nav="assistant">'+(lang==='ar'?'فتح المساعد':'Open assistant')+' ↗</button><button class="btn btn-secondary" data-nav="memory">'+(lang==='ar'?'استعراض المعرفة':'Browse knowledge')+'</button></div></div><div class="hero-mark" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M24 3.5 28.5 19.5 44.5 24 28.5 28.5 24 44.5 19.5 28.5 3.5 24 19.5 19.5 24 3.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="24" cy="24" r="4" fill="currentColor"/></svg></div></section>'+
  '<section class="stats-grid"><article class="stat-card"><div><div class="stat-label">'+(lang==='ar'?'حالة الذكاء الاصطناعي':'AI service')+'</div><div class="stat-value">'+(online?(lang==='ar'?'متصل':'Available'):(lang==='ar'?'غير متاح':'Unavailable'))+'</div></div><div class="stat-icon"><span>✦</span></div></article><article class="stat-card"><div><div class="stat-label">'+(lang==='ar'?'المحرك الافتراضي':'Default engine')+'</div><div class="stat-value">'+esc(model)+'</div></div><div class="stat-icon copper"><span>◈</span></div></article><article class="stat-card"><div><div class="stat-label">'+(lang==='ar'?'جلسات هذا المتصفح':'Browser sessions')+'</div><div class="stat-value">'+MODE_IDS.reduce((n,id)=>n+((chat[id]||[]).length?1:0),0)+'</div></div><div class="stat-icon"><span>⌁</span></div></article></section>'+
  '<div class="overview-grid"><section><div class="section-head"><div><h2>'+(lang==='ar'?'ابدأ من وحدة':'Launch a workspace')+'</h2><p>'+(lang==='ar'?'اختر نوع التحليل المناسب للمهمة.':'Choose the workspace that fits the task.')+'</p></div></div><div class="launch-grid">'+
  launchCard('assistant','✦',lang==='ar'?'المساعد الذكي':'AI assistant',lang==='ar'?'بحث وتحليل ومساعدة تقنية':'Research, analysis and technical help',false)+
  launchCard('code','⌘',lang==='ar'?'مراجعة الأكواد':'Code review',lang==='ar'?'مراجعة الشيفرة واقتراح الإصلاحات':'Review source and suggest fixes',true)+
  launchCard('logs','≋',lang==='ar'?'تحليل السجلات':'Log analysis',lang==='ar'?'تجميع الأحداث وبناء التسلسل الزمني':'Correlate events and build timelines',false)+
  launchCard('ioc','◎',lang==='ar'?'تحليل المؤشرات':'IOC analysis',lang==='ar'?'تصنيف مؤشرات دون الاتصال بها':'Classify indicators without contacting them',true)+
  launchCard('ctf','⚑',lang==='ar'?'مختبر CTF':'CTF lab',lang==='ar'?'تدريب وتعلّم داخل تحديات':'Practice in educational challenges',false)+
  launchCard('report','▤',lang==='ar'?'التقارير الفنية':'Technical reports',lang==='ar'?'تنظيم الأدلة والتوصيات':'Structure evidence and recommendations',true)+
  '</div></section><aside class="surface surface-pad"><div class="section-head" style="margin-top:0"><div><h2>'+(lang==='ar'?'صحة المنصة':'Platform health')+'</h2><p>'+(lang==='ar'?'قراءة مباشرة من الخادم':'Live status from the Worker')+'</p></div></div><div class="status-list"><div class="status-row"><div><div class="status-name">Cloudflare Worker</div><div class="status-detail">'+(health&&health.ok?'API /health':'API status')+'</div></div><span class="status-tag">'+(health&&health.ok?(lang==='ar'?'يعمل':'Online'):(lang==='ar'?'غير مؤكد':'Unknown'))+'</span></div><div class="status-row"><div><div class="status-name">Workers AI</div><div class="status-detail">'+esc(health&&health.modelBackend||'AI binding')+'</div></div><span class="status-tag '+(online?'':'warn')+'">'+(online?(lang==='ar'?'مهيأ':'Configured'):(lang==='ar'?'غير مهيأ':'Not configured'))+'</span></div><div class="status-row"><div><div class="status-name">D1 Knowledge</div><div class="status-detail">'+(lang==='ar'?'الذاكرة الدائمة':'Persistent memory')+'</div></div><span class="status-tag">'+(lang==='ar'?'تتطلب صلاحية':'Protected')+'</span></div></div><div class="notice">'+(lang==='ar'?'الواجهة لا تنفذ فحصاً شبكياً تلقائياً. كل طلب يمر عبر سياسة الخادم ومفتاح الوصول.':'The interface does not run network scans automatically. Requests pass through server policy and access authentication.')+'</div></aside></div>';
 }
 function launchCard(id,symbol,title,desc,copper){
  return '<button class="launch-card" data-nav="'+id+'"><span class="launch-icon '+(copper?'copper':'')+'">'+symbol+'</span><span class="launch-title">'+title+'</span><span class="launch-desc">'+desc+'</span></button>';
 }
 function workspaceHTML(){
  const meta=MODE_META[activeMode],list=chat[activeMode]||[];
  const prompts=meta[lang==='ar'?'promptsAr':'promptsEn'];
  return '<div class="page-head"><div><div class="page-eyebrow">WORMSTAR / ANALYSIS WORKSPACE</div><h1 class="page-title">'+modeLabel(activeMode)+'</h1><p class="page-subtitle">'+meta[lang==='ar'?'subAr':'subEn']+'</p></div><div class="page-actions"><button class="btn btn-secondary" data-action="save-archive">حفظ المحادثة</button><button class="btn btn-secondary" data-action="export-chat">تصدير MD</button><button class="btn btn-soft" data-action="clear-chat">جلسة جديدة</button></div></div>'+
  '<div class="workbench-grid"><section class="surface chat-surface"><div class="chat-toolbar"><div class="chat-toolbar-group"><label class="field-label" for="modeSelect" style="margin:0">'+(lang==='ar'?'الوضع':'Mode')+'</label><select class="toolbar-select" id="modeSelect">'+MODE_IDS.map(id=>'<option value="'+id+'" '+(activeMode===id?'selected':'')+'>'+modeLabel(id)+'</option>').join('')+'</select><select class="toolbar-select" id="engineSelect" aria-label="'+(lang==='ar'?'محرك النموذج':'Model engine')+'"><option value="gpt-oss-120b">GPT-OSS 120B</option><option value="gpt-oss-20b">GPT-OSS 20B</option><option value="qwen-coder">Qwen Coder</option><option value="llama-3.3">Llama 3.3</option><option value="auto">Auto routing</option></select></div><span class="status-tag">'+(lang==='ar'?'تحليل نصي':'Text analysis')+'</span></div>'+
  '<div id="thread" class="thread" aria-live="polite">'+(list.length?renderMessages(activeMode):'<div class="thread-empty"><div class="thread-empty-mark">✦</div><strong>'+(lang==='ar'?'ابدأ بتحليل جديد':'Start a new analysis')+'</strong><p>'+(lang==='ar'?'أرسل سؤالاً أو مادة للتحليل. ستظهر النتائج هنا مع إمكانية تصديرها وحفظها في الذاكرة السحابية.':'Submit a question or material to analyze. Results appear here and can be exported or saved to cloud memory.')+'</p></div>')+'</div>'+
  '<div class="quick-prompts">'+prompts.map(p=>'<button class="quick-prompt" data-prompt="'+esc(p)+'">'+esc(p)+'</button>').join('')+'</div>'+
  '<form class="composer" id="chatForm"><textarea id="chatInput" maxlength="12000" placeholder="'+esc(meta[lang==='ar'?'hintAr':'hintEn'])+'" aria-label="'+esc(meta[lang==='ar'?'hintAr':'hintEn'])+'"></textarea><div class="composer-foot"><span class="composer-hint">'+(lang==='ar'?'Enter للإرسال · Shift + Enter لسطر جديد':'Enter to send · Shift + Enter for a new line')+'</span><button class="btn btn-primary" id="sendButton" type="submit">'+(lang==='ar'?'إرسال للتحليل':'Send for analysis')+' ↗</button></div></form></section>'+
  '<aside class="context-column"><section class="surface context-card"><h3>'+(lang==='ar'?'سياق المهمة':'Task context')+'</h3><div class="context-line"><span>'+(lang==='ar'?'الوضع الحالي':'Current mode')+'</span><strong>'+modeLabel(activeMode)+'</strong></div><div class="context-line"><span>'+(lang==='ar'?'المحرك':'Engine')+'</span><strong id="engineSummary">GPT-OSS 120B</strong></div><div class="context-line"><span>'+(lang==='ar'?'الرسائل':'Messages')+'</span><strong>'+list.length+'</strong></div><div class="context-line"><span>'+(lang==='ar'?'الحفظ':'Storage')+'</span><strong>'+(lang==='ar'?'جلسة المتصفح':'Browser session')+'</strong></div></section><section class="surface context-card"><h3>'+(lang==='ar'?'حدود التشغيل':'Operational boundary')+'</h3><p style="font-size:11px;color:var(--muted);line-height:1.85;margin:0">'+(lang==='ar'?'المساعد يحلل النصوص والأدلة التي تقدمها. لا يفتح أهدافاً خارجية ولا يشغّل أوامر أو أدوات هجومية من هذه الواجهة.':'The assistant analyzes the text and evidence you provide. This interface does not contact external targets or execute shell commands or offensive tools.')+'</p></section></aside></div>';
 }
 function renderMessages(mode){
  return (chat[mode]||[]).map(item=>'<article class="message '+(item.role==='user'?'user':'assistant')+'"><div class="message-meta"><span>'+(item.role==='user'?(lang==='ar'?'أنت':'You'):'Wormstar')+'</span><span>'+(item.modelUsed?esc(item.modelUsed):'')+'</span></div><div class="message-bubble">'+esc(item.content)+'</div></article>').join('');
 }
 function reportsHTML(){
  return '<div class="page-head"><div><div class="page-eyebrow">WORMSTAR / EXPORTS</div><h1 class="page-title">'+(lang==='ar'?'سجل التحليلات والتقارير':'Analysis and report history')+'</h1><p class="page-subtitle">'+(lang==='ar'?'المحادثات الحالية محفوظة ضمن جلسة المتصفح. يمكنك تصديرها أو أرشفتها في D1.':'Current conversations are held in this browser session. Export them or archive them in D1.')+'</p></div><div class="page-actions"><button class="btn btn-secondary" data-action="save-all">حفظ الجلسات</button></div></div><div class="list">'+MODE_IDS.map(id=>{
   const count=(chat[id]||[]).length;
   return '<article class="list-item"><div class="list-icon">'+(id==='code'?'⌘':id==='ioc'?'◎':id==='logs'?'≋':'▤')+'</div><div style="flex:1"><div class="list-title">'+modeLabel(id)+'</div><div class="list-copy">'+count+' '+(lang==='ar'?'رسالة ضمن الجلسة الحالية':'messages in this session')+'</div></div><button class="btn btn-secondary" data-action="open-mode" data-mode="'+id+'">'+(lang==='ar'?'فتح':'Open')+'</button><button class="btn btn-soft" data-action="export-mode" data-mode="'+id+'">'+(lang==='ar'?'تصدير':'Export')+'</button></article>';
  }).join('')+'</div>';
 }
 async function memoryHTML(){
  return '<div class="page-head"><div><div class="page-eyebrow">WORMSTAR / KNOWLEDGE</div><h1 class="page-title">'+(lang==='ar'?'مكتبة المعرفة':'Knowledge library')+'</h1><p class="page-subtitle">'+(lang==='ar'?'مراجع وملفات نصية محفوظة في Cloudflare D1 لاستخدامها في التحليل عند الحاجة.':'Text references and files stored in Cloudflare D1 and retrieved for analysis when relevant.')+'</p></div><div class="page-actions"><button class="btn btn-secondary" data-action="refresh-memory">'+(lang==='ar'?'تحديث المكتبة':'Refresh library')+'</button></div></div><div class="memory-grid"><form class="surface form-card" id="memoryForm"><h3 style="margin:0 0 15px">'+(lang==='ar'?'إضافة مرجع':'Add a reference')+'</h3><label for="memoryTitle">'+(lang==='ar'?'عنوان المرجع':'Reference title')+'</label><input id="memoryTitle" maxlength="130" required placeholder="'+(lang==='ar'?'مثال: ملاحظات مراجعة API':'Example: API review notes')+'"><label for="memoryKind">'+(lang==='ar'?'نوع المحتوى':'Content type')+'</label><select id="memoryKind"><option value="note">Note</option><option value="file">File</option><option value="correction">Correction</option></select><label for="memoryContent">'+(lang==='ar'?'المحتوى النصي':'Text content')+'</label><textarea id="memoryContent" maxlength="60000" required></textarea><button class="btn btn-primary" type="submit">'+(lang==='ar'?'حفظ في المكتبة':'Save to library')+'</button></form><section><div id="memoryList" class="list"><div class="empty-box">'+(lang==='ar'?'جارٍ تحميل المراجع...':'Loading references...')+'</div></div></section></div>';
 }
 function agentsHTML(){
  return '<div class="page-head"><div><div class="page-eyebrow">WORMSTAR / CONNECTORS</div><h1 class="page-title">'+(lang==='ar'?'الوكلاء والتكاملات':'Agents and integrations')+'</h1><p class="page-subtitle">'+(lang==='ar'?'حالة الاتصالات الفعلية التي يعيدها الخادم. لا تُعرض أي خدمة على أنها متصلة من دون تحقق.':'Actual connectivity reported by the server. A service is never shown as connected without verification.')+'</p></div><div class="page-actions"><button class="btn btn-secondary" data-action="refresh-agents">'+(lang==='ar'?'فحص الاتصال':'Check connections')+'</button></div></div><div class="agent-grid"><article class="surface agent-card"><div class="agent-card-top"><h3>OpenClaw Gateway</h3><span class="agent-state" id="openclawState">'+(lang==='ar'?'جارٍ الفحص':'Checking')+'</span></div><p>'+(lang==='ar'?'بوابة وكيل منفصلة. تتطلب عنوان HTTPS واعتمادات Cloudflare Access ومفتاح Gateway.':'Separate agent gateway. Requires an HTTPS endpoint, Cloudflare Access service credentials and a Gateway token.')+'</p><div class="kv" id="openclawDetail">—</div></article><article class="surface agent-card"><div class="agent-card-top"><h3>OpenCode v2</h3><span class="agent-state" id="opencodeState">'+(lang==='ar'?'جارٍ الفحص':'Checking')+'</span></div><p>'+(lang==='ar'?'جلسات تطوير ومراجعة كود عبر خادم خاص محمي.':'Development and code-review sessions through a protected private host.')+'</p><div class="kv" id="opencodeDetail">—</div></article></div><div class="notice" style="margin-top:16px">'+(lang==='ar'?'لا تُمكّن هذه اللوحة shell أو تشغيل كود عن بُعد؛ تكاملات الوكلاء تخضع لصلاحيات الخادم.':'This panel does not enable shell or remote code execution. Agent integrations remain subject to server-side permissions.')+'</div>';
 }
 function policyHTML(){
  return '<div class="page-head"><div><div class="page-eyebrow">WORMSTAR / GOVERNANCE</div><h1 class="page-title">'+(lang==='ar'?'السياسات والصلاحيات':'Policy and permissions')+'</h1><p class="page-subtitle">'+(lang==='ar'?'ملخص للقيود التي يفرضها Worker. إعدادات الواجهة لا تستطيع تجاوز سجل الصلاحيات على الخادم.':'A summary of controls enforced by the Worker. UI settings cannot override the server permission manifest.')+'</p></div><div class="page-actions"><button class="btn btn-secondary" data-action="refresh-policy">'+(lang==='ar'?'تحديث الصلاحيات':'Refresh policy')+'</button></div></div><div id="policyContent" class="policy-grid"><div class="empty-box">'+(lang==='ar'?'جارٍ تحميل السياسة...':'Loading policy...')+'</div></div>';
 }
 function settingsHTML(){
  return '<div class="page-head"><div><div class="page-eyebrow">WORMSTAR / PREFERENCES</div><h1 class="page-title">'+(lang==='ar'?'إعدادات مساحة العمل':'Workspace preferences')+'</h1><p class="page-subtitle">'+(lang==='ar'?'غيّر المظهر واللغة. خيارات العرض محفوظة محلياً ولا تغيّر إعدادات الخادم.':'Change appearance and language. Display preferences are local and do not alter server settings.')+'</p></div></div><div class="policy-grid"><section class="surface policy-card"><h3>'+(lang==='ar'?'المظهر':'Appearance')+'</h3><p>'+(lang==='ar'?'اختر الوضع الفاتح أو الداكن.':'Choose light or dark appearance.')+'</p><div style="display:flex;gap:8px;margin-top:15px"><button class="btn btn-secondary" data-action="set-theme" data-theme="light">Light</button><button class="btn btn-secondary" data-action="set-theme" data-theme="dark">Dark</button></div></section><section class="surface policy-card"><h3>'+(lang==='ar'?'اللغة والاتجاه':'Language and direction')+'</h3><p>'+(lang==='ar'?'العربية RTL والإنجليزية LTR.':'Arabic RTL and English LTR.')+'</p><div style="display:flex;gap:8px;margin-top:15px"><button class="btn btn-secondary" data-action="set-lang" data-lang="ar">العربية</button><button class="btn btn-secondary" data-action="set-lang" data-lang="en">English</button></div></section><section class="surface policy-card"><h3>'+(lang==='ar'?'جلسة الوصول':'Access session')+'</h3><p>'+(lang==='ar'?'مفتاح الوصول موجود في sessionStorage فقط ويُزال عند تسجيل الخروج أو إغلاق الجلسة.':'The access token is kept in sessionStorage and removed when you sign out or end the session.')+'</p><button class="btn btn-danger" style="margin-top:14px" data-action="logout">'+(lang==='ar'?'تسجيل الخروج':'Sign out')+'</button></section><section class="surface policy-card"><h3>'+(lang==='ar'?'إضافة إلى الشاشة الرئيسية':'Add to home screen')+'</h3><p>'+(lang==='ar'?'في Safari على iPhone أو iPad: افتح قائمة المشاركة ثم اختر إضافة إلى الشاشة الرئيسية.':'In Safari on iPhone or iPad, open Share and choose Add to Home Screen.')+'</p></section></div>';
 }
 function renderPage(){
  if(!$('page')||$('app').classList.contains('hidden'))return;
  if(pageName==='overview')$('page').innerHTML=overviewHTML();
  else if(MODE_IDS.includes(pageName))$('page').innerHTML=workspaceHTML();
  else if(pageName==='reports')$('page').innerHTML=reportsHTML();
  else if(pageName==='memory')$('page').innerHTML=memoryHTML();
  else if(pageName==='agents')$('page').innerHTML=agentsHTML();
  else if(pageName==='policy')$('page').innerHTML=policyHTML();
  else if(pageName==='settings')$('page').innerHTML=settingsHTML();
  wirePage();
 }
 function openApp(){
  $('gate').classList.add('hidden');$('app').classList.remove('hidden');$('mobileNav').classList.remove('hidden');
  applyPrefs();void refreshHealth();
 }
 function closeApp(){
  token='';try{sessionStorage.removeItem(KEY);}catch(e){}
  $('app').classList.add('hidden');$('mobileNav').classList.add('hidden');$('gate').classList.remove('hidden');$('accessToken').value='';$('gateError').textContent='';
 }
 async function refreshHealth(){
  try{health=await api('/api/health');$('healthLabel').textContent=health.aiConfigured?(lang==='ar'?'الخدمة متاحة':'Service ready'):(lang==='ar'?'الخادم متاح':'Worker online');}
  catch(e){health={ok:false,aiConfigured:false};$('healthLabel').textContent=lang==='ar'?'تعذر فحص الخدمة':'Health check failed';}
  if(pageName==='overview')renderPage();
 }
 async function doLogin(event){
  event.preventDefault();const value=$('accessToken').value.trim();if(!value)return;
  const button=$('loginButton');button.disabled=true;$('gateError').textContent=lang==='ar'?'جارٍ التحقق...':'Verifying...';
  try{
   if(!await validateToken(value))throw new Error(lang==='ar'?'مفتاح الوصول غير صحيح.':'The access token is not valid.');
   token=value;sessionStorage.setItem(KEY,value);$('gateError').textContent='';openApp();
  }catch(e){$('gateError').textContent=e.message||'Authentication failed.';}
  finally{button.disabled=false;}
 }
 async function sendChat(event){
  event.preventDefault();if(busy)return;
  const input=$('chatInput'),text=input.value.trim();if(!text)return;
  const mode=activeMode;const list=chat[mode]||(chat[mode]=[]);
  list.push({role:'user',content:text});input.value='';saveChat();busy=true;
  const button=$('sendButton');button.disabled=true;
  renderPage();const thread=$('thread');if(thread)thread.insertAdjacentHTML('beforeend','<div class="typing" id="typing">'+(lang==='ar'?'Wormstar يحلل المحتوى...':'Wormstar is analyzing...')+'</div>');
  const engine=$('engineSelect')?$('engineSelect').value:'gpt-oss-120b';
  try{
   const history=list.slice(-9,-1).map(item=>({role:item.role,content:item.content}));
   const result=await api('/api/chat',{method:'POST',body:JSON.stringify({mode:mode,message:text,history:history,engine:engine,memoryIds:[]})});
   if(typeof result.answer!=='string'||!result.answer.trim())throw new Error(lang==='ar'?'رد المحرك فارغ.':'The model returned an empty answer.');
   list.push({role:'assistant',content:result.answer,modelUsed:result.modelUsed||engine,memoryUsed:Array.isArray(result.memoryUsed)?result.memoryUsed:[]});
   saveChat();toast(lang==='ar'?'اكتمل التحليل':'Analysis completed');
  }catch(e){list.push({role:'assistant',content:(lang==='ar'?'تعذّر إكمال التحليل: ':'Analysis failed: ')+(e.message||'Unknown error')});saveChat();toast(e.message||'Request failed');}
  finally{busy=false;renderPage();}
 }
 function downloadMode(mode){
  const list=chat[mode]||[];if(!list.length){toast(lang==='ar'?'لا توجد رسائل للتصدير':'Nothing to export');return;}
  const body=['# Wormstar — '+modeLabel(mode),'',new Date().toISOString(),''].concat(list.map(item=>(item.role==='user'?'## '+(lang==='ar'?'السؤال':'Prompt'):'## '+(lang==='ar'?'التحليل':'Analysis'))+'\n\n'+item.content)).join('\n\n---\n\n');
  const url=URL.createObjectURL(new Blob([body],{type:'text/markdown;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='wormstar-'+mode+'-report.md';a.click();URL.revokeObjectURL(url);
 }
 async function loadArchive(mode){
  if(!token||chat[mode]&&chat[mode].length)return;
  try{
   const result=await api('/api/studio/chat-archive?mode='+encodeURIComponent(mode));
   archiveRevision[mode]=Number(result.revision)||0;
   if(result.found&&Array.isArray(result.messages)){chat[mode]=result.messages;saveChat();if(pageName===mode)renderPage();}
  }catch(e){/* Archive access can be disabled independently of chat. */}
 }
 async function saveArchive(mode){
  const list=chat[mode]||[];if(!list.length){toast(lang==='ar'?'لا توجد محادثة لحفظها':'No conversation to save');return;}
  try{
   let revision=archiveRevision[mode];
   if(revision===undefined){const current=await api('/api/studio/chat-archive?mode='+encodeURIComponent(mode));revision=Number(current.revision)||0;archiveRevision[mode]=revision;}
   const result=await api('/api/studio/chat-archive',{method:'PUT',body:JSON.stringify({mode:mode,revision:revision,messages:list.slice(-18)})});
   archiveRevision[mode]=Number(result.revision)||revision+1;toast(lang==='ar'?'حُفظت المحادثة في D1':'Conversation archived in D1');
  }catch(e){toast((lang==='ar'?'تعذر حفظ المحادثة: ':'Could not archive: ')+e.message);}
 }
 async function saveAll(){
  let count=0;
  for(const id of MODE_IDS){if((chat[id]||[]).length){await saveArchive(id);count++;}}
  if(!count)toast(lang==='ar'?'لا توجد جلسات للحفظ':'No sessions to archive');
 }
 async function loadMemory(){
  const list=$('memoryList');if(!list)return;
  try{
   const result=await api('/api/studio/knowledge');
   memoryItems=Array.isArray(result.items)?result.items:[];
   list.innerHTML=memoryItems.length?memoryItems.map(item=>'<article class="list-item"><div class="list-icon">▤</div><div style="flex:1;min-width:0"><div class="list-title">'+esc(item.title)+'</div><div class="list-copy">'+esc(item.kind)+' · '+esc(item.preview||'')+'</div><div class="list-copy">'+esc(item.updated_at||'')+'</div></div><button class="btn btn-secondary" data-action="open-memory" data-id="'+esc(item.id)+'">'+(lang==='ar'?'عرض':'View')+'</button></article>').join(''):'<div class="empty-box">'+(lang==='ar'?'مكتبة المعرفة فارغة حالياً.':'The knowledge library is empty.')+'</div>';
  }catch(e){list.innerHTML='<div class="empty-box">'+esc(e.message)+'</div>';}
 }
 async function createMemory(event){
  event.preventDefault();
  const title=$('memoryTitle').value.trim(),content=$('memoryContent').value.trim(),kind=$('memoryKind').value;
  if(!title||!content)return;
  try{await api('/api/studio/knowledge',{method:'POST',body:JSON.stringify({title:title,content:content,kind:kind})});$('memoryForm').reset();toast(lang==='ar'?'تم حفظ المرجع':'Reference saved');void loadMemory();}
  catch(e){toast(e.message);}
 }
 async function openMemory(id){
  const item=memoryItems.find(x=>x.id===id);if(!item)return;
  try{
   const full=await api('/api/studio/knowledge/'+encodeURIComponent(id));
   const content=full.content||full.item&&full.item.content||item.preview||'';
   const w=window.open('','_blank','noopener,noreferrer');
   if(w){w.document.write('<title>'+esc(item.title)+'</title><pre style="white-space:pre-wrap;word-break:break-word;font:14px system-ui;padding:24px">'+esc(content)+'</pre>');w.document.close();}
   else toast(lang==='ar'?'اسمح بفتح نافذة العرض':'Allow the preview window');
  }catch(e){toast(e.message);}
 }
 async function loadAgents(){
  const tasks=[['/api/openclaw/status','openclaw'],['/api/opencode/status','opencode']];
  for(const [path,id] of tasks){
   try{
    const result=await api(path);
    const connected=result.connected===true;
    const state=$(id+'State'),detail=$(id+'Detail');
    if(state){state.textContent=connected?(lang==='ar'?'متصل':'Connected'):(lang==='ar'?'غير متصل':'Not connected');state.classList.toggle('online',connected);}
    if(detail)detail.textContent=connected?JSON.stringify(result).slice(0,220):(result.configured?(lang==='ar'?'مهيأ لكن الخدمة غير متاحة':'Configured but unavailable'):(lang==='ar'?'لم يتم إعداد الاعتمادات':'Credentials not configured'));
   }catch(e){
    const state=$(id+'State'),detail=$(id+'Detail');
    if(state){state.textContent=lang==='ar'?'غير متاح':'Unavailable';state.classList.remove('online');}
    if(detail)detail.textContent=e.message;
   }
  }
 }
 async function loadPolicy(){
  const root=$('policyContent');if(!root)return;
  try{
   const [runtime,manifest]=await Promise.all([api('/api/studio/policy'),api('/api/lab/policy')]);
   const p=runtime.policy||{},caps=manifest.capabilities||{};
   const allowed=Array.isArray(p.allowed_modes)?p.allowed_modes:[];
   const cards=[
    ['ai.chat',lang==='ar'?'تحليل الذكاء الاصطناعي':'AI analysis',true],
    ['memory.profile.read',lang==='ar'?'قراءة الملف الشخصي':'Read profile',!!caps['memory.profile.read']],
    ['memory.items.read',lang==='ar'?'قراءة المعرفة':'Read knowledge',!!caps['memory.items.read']],
    ['memory.items.create',lang==='ar'?'إضافة معرفة':'Create knowledge',!!caps['memory.items.create']],
    ['agents.opencode.prompt',lang==='ar'?'طلبات OpenCode':'OpenCode prompts',!!caps['agents.opencode.prompt']],
    ['system.shell.execute',lang==='ar'?'تنفيذ أوامر النظام':'System command execution',!!caps['system.shell.execute']]
   ];
   root.innerHTML='<section class="surface policy-card"><h3>'+(lang==='ar'?'سياسة التشغيل':'Runtime policy')+'</h3><p>'+(lang==='ar'?'الأنماط المسموحة: ':'Allowed modes: ')+allowed.map(id=>esc(modeLabel(id))).join(' · ')+'</p><span class="policy-state">'+(lang==='ar'?'مفعّلة على الخادم':'Enforced by Worker')+'</span><p style="margin-top:10px">'+(lang==='ar'?'حد الإدخال: ':'Input limit: ')+esc(p.max_input_chars||'—')+' · '+(lang==='ar'?'حد الإخراج: ':'Output limit: ')+esc(p.max_output_tokens||'—')+'</p></section>'+cards.map(c=>'<section class="surface policy-card"><h3>'+esc(c[1])+'</h3><p>'+esc(c[0])+'</p><span class="policy-state '+(c[2]?'':'off')+'">'+(c[2]?(lang==='ar'?'مسموح':'Allowed'):(lang==='ar'?'غير مفعّل':'Not enabled'))+'</span></section>').join('');
  }catch(e){root.innerHTML='<div class="empty-box">'+esc(e.message)+'</div>';}
 }
 function wirePage(){
  document.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click',()=>setPage(el.dataset.nav)));
  document.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>{
   const action=el.dataset.action;
   if(action==='refresh-health')void refreshHealth();
   if(action==='save-archive')void saveArchive(activeMode);
   if(action==='save-all')void saveAll();
   if(action==='export-chat')downloadMode(activeMode);
   if(action==='export-mode')downloadMode(el.dataset.mode);
   if(action==='open-mode')setPage(el.dataset.mode);
   if(action==='clear-chat'){if(confirm(lang==='ar'?'بدء جلسة جديدة لهذا الوضع؟':'Start a new session for this mode?')){chat[activeMode]=[];saveChat();renderPage();}}
   if(action==='refresh-memory')void loadMemory();
   if(action==='open-memory')void openMemory(el.dataset.id);
   if(action==='refresh-agents')void loadAgents();
   if(action==='refresh-policy')void loadPolicy();
   if(action==='logout')closeApp();
   if(action==='set-theme'){theme=el.dataset.theme;try{localStorage.setItem('wormstar-theme',theme);}catch(e){}applyPrefs();}
   if(action==='set-lang'){lang=el.dataset.lang;try{localStorage.setItem('wormstar-lang',lang);}catch(e){}applyPrefs();}
  }));
  const form=$('chatForm');if(form)form.addEventListener('submit',sendChat);
  const modeSelect=$('modeSelect');if(modeSelect)modeSelect.addEventListener('change',()=>setPage(modeSelect.value));
  const engineSelect=$('engineSelect');if(engineSelect)engineSelect.addEventListener('change',()=>{const el=$('engineSummary');if(el)el.textContent=engineSelect.options[engineSelect.selectedIndex].text;});
  const input=$('chatInput');if(input)input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();if(form)form.requestSubmit();}});
  document.querySelectorAll('[data-prompt]').forEach(el=>el.addEventListener('click',()=>{const field=$('chatInput');if(field){field.value=el.dataset.prompt;field.focus();}}));
  const memForm=$('memoryForm');if(memForm)memForm.addEventListener('submit',createMemory);
  if(pageName==='memory')void loadMemory();
  if(pageName==='agents')void loadAgents();
  if(pageName==='policy')void loadPolicy();
 }
 $('loginForm').addEventListener('submit',doLogin);
 $('logoutButton').addEventListener('click',closeApp);
 $('themeButton').addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';try{localStorage.setItem('wormstar-theme',theme);}catch(e){}applyPrefs();});
 $('langButton').addEventListener('click',()=>{lang=lang==='ar'?'en':'ar';try{localStorage.setItem('wormstar-lang',lang);}catch(e){}applyPrefs();});
 $('mobileMenu').addEventListener('click',()=>{$('sidebar').classList.toggle('open');$('mobileVeil').classList.toggle('show');});
 $('mobileVeil').addEventListener('click',()=>{$('sidebar').classList.remove('open');$('mobileVeil').classList.remove('show');});
 $('mobileMore').addEventListener('click',()=>{$('sidebar').classList.add('open');$('mobileVeil').classList.add('show');});
 try{const saved=sessionStorage.getItem(KEY);if(saved){token=saved;validateToken(saved).then(ok=>{if(ok)openApp();else closeApp();}).catch(closeApp);}}catch(e){}
})();
</script>
</body>
</html>\`;
export default REDESIGN_HTML;
