import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const { default: worker } = await import(new URL("../worker.js", import.meta.url));
const origin = "https://wormstar-sentinel-preview.example";
let forwarded = [];

const env = {
  CORE: {
    async fetch(request) {
      forwarded.push({
        pathname: new URL(request.url).pathname,
        authorization: request.headers.get("Authorization"),
        contentType: request.headers.get("Content-Type"),
        body: request.body ? await request.text() : ""
      });
      if (new URL(request.url).pathname === "/api/auth") return Response.json({ ok: true });
      return Response.json({ answer: "Verified live Core route", modelUsed: "gpt-oss-20b" });
    }
  }
};
const url = path => origin + path;
const go = (path, init) => worker.fetch(new Request(url(path), init), env);
const bearer = "Bearer TESTOWNERKEY123";
const jsonHeaders = { "Authorization": bearer, "Origin": origin, "Content-Type": "application/json" };
const chat = { mode: "assistant", message: "Explain this code", history: [], engine: "gpt-oss-20b", memoryIds: [] };

let response = await go("/");
assert.equal(response.status, 200);
let html = await response.text();
assert.match(html, /id="aiConnectForm"/);
assert.match(html, /<option value="auto" selected>/);
assert.match(html, /<option value="gpt-oss-120b">/);
assert.match(html, /id="aiMode"/);
assert.match(html, /id="aiReasoning"/);
assert.match(html, /id="repoOnly" type="checkbox" checked/);
assert.match(html, /id="repoStatusBtn"/);
assert.match(html, /\/api\/repo\/ask/);
assert.match(html, /engine:\$\("#aiModel"\)\.value/);
assert.match(html, /mode:\$\("#aiMode"\)\.value/);
assert.match(html, /reasoningEffort:\$\("#aiReasoning"\)\.value/);
assert.match(html, /data\.memoryUsed/);
assert.match(html, /data\.fallbackUsed/);
assert.match(html, /id="ragIndexBtn"/);
assert.match(html, /id="scanRun"/);
assert.match(html, /id="agentRun"/);
assert.match(html, /id="wsTermConnect"/);
assert.match(html, /src="\/terminal\.js"/);
assert.match(html, /id="uboorLabCard"/);
assert.match(html, /\/api\/rag\/reindex/);
assert.match(html, /\/api\/security\/header-audit/);
assert.match(html, /\/api\/agents\/run/);
assert.match(html, /const \$=s=>document.querySelector\(s\), \$\$=s=>Array\.from/);
assert.doesNotMatch(html, /Input received by the UI prototype only/);
assert.equal((await go("/api/health")).status, 200);
assert.equal((await go('/terminal.js')).status, 200);

for (const [path, expectedType, marker] of [
  ['/assets/gsap.min.js','text/javascript','gsap'],
  ['/assets/ScrollTrigger.min.js','text/javascript','ScrollTrigger'],
  ['/assets/lenis.min.js','text/javascript','Lenis'],
  ['/assets/lenis.css','text/css','lenis'],
  ['/motion.js','text/javascript','prefers-reduced-motion'],
  ['/motion.css','text/css','focus-visible'],
]) {
  const asset=await go(path);
  assert.equal(asset.status,200, 'asset status: ' + path);
  assert.match(asset.headers.get('Content-Type'), new RegExp(expectedType));
  assert.ok((await asset.text()).includes(marker), 'asset content: ' + path);
  const head=await go(path,{method:'HEAD'});
  assert.equal(head.status,200);
  assert.equal(await head.text(),'');
}
assert.ok(html.includes('src="/assets/gsap.min.js"'));
assert.ok(html.includes('src="/motion.js"'));
assert.match((await go('/')).headers.get('Content-Security-Policy'),/script-src 'self'/);

let terminalPolicy = await worker.fetch(new Request(url('/')), {...env, TERMINAL_UI_BACKEND_ORIGIN:'https://terminal.example'});
assert.match(terminalPolicy.headers.get('Content-Security-Policy'), /https:\/\/terminal\.example wss:\/\/terminal\.example/);
terminalPolicy = await worker.fetch(new Request(url('/')), {...env, TERMINAL_UI_BACKEND_ORIGIN:'https://terminal.example/path'});
assert.doesNotMatch(terminalPolicy.headers.get('Content-Security-Policy'), /terminal\.example/);
terminalPolicy = await worker.fetch(new Request(url('/')), {...env, TERMINAL_UI_BACKEND_ORIGIN:'http://external.example'});
assert.doesNotMatch(terminalPolicy.headers.get('Content-Security-Policy'), /external\.example/);

assert.equal((await go("/api/auth", {method:"POST"})).status, 401);
assert.equal((await go("/api/chat", {method:"GET"})).status, 405);
assert.equal((await go("/api/auth", {method:"POST",headers:{Authorization:bearer,Origin:"https://not-owner.example"}})).status, 403);
assert.equal((await go("/api/chat", {method:"POST",headers:{Authorization:bearer,Origin:origin,"Content-Type":"text/plain"},body:"test"})).status, 415);
assert.equal((await go("/api/chat", {method:"POST",headers:jsonHeaders,body:"x".repeat(70000)})).status, 413);
assert.equal(forwarded.length, 0);

response = await go("/api/auth", {method:"POST",headers:{Authorization:bearer,Origin:origin}});
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), {ok:true});
assert.equal(forwarded[0].pathname, "/api/auth");

response = await go("/api/chat", {method:"POST",headers:jsonHeaders,body:JSON.stringify(chat)});
assert.equal(response.status, 200);
assert.equal((await response.json()).answer, "Verified live Core route");
assert.equal(forwarded[1].authorization, bearer);
assert.deepEqual(JSON.parse(forwarded[1].body), chat);
assert.equal(forwarded.length, 2);
assert.equal((await go("/api/security/header-audit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target:"https://test.invalid/"})})).status,401);
assert.equal((await go("/api/rag/status")).status,401);
assert.equal((await go("/api/repo/status")).status,401);
assert.equal((await go("/api/goclaw/status")).status,401);
assert.equal((await go("/api/goclaw/status",{method:"POST",headers:jsonHeaders,body:"{}"})).status,405);
assert.equal((await go("/api/repo/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})).status,401);
response=await go("/api/rag/status",{method:"GET",headers:{Authorization:bearer,Origin:origin}});
assert.equal(response.status,200);
assert.equal(forwarded.at(-1).pathname,"/api/rag/status");
response=await go("/api/repo/status",{method:"GET",headers:{Authorization:bearer,Origin:origin}});
assert.equal(response.status,200);
assert.equal(forwarded.at(-1).pathname,"/api/repo/status");
response=await go("/api/goclaw/status",{method:"GET",headers:{Authorization:bearer,Origin:origin}});
assert.equal(response.status,200);
assert.equal(forwarded.at(-1).pathname,"/api/goclaw/status");
response=await go("/api/repo/ask",{method:"POST",headers:jsonHeaders,body:JSON.stringify({message:"What is the architecture?",engine:"auto"})});
assert.equal(response.status,200);
assert.equal(forwarded.at(-1).pathname,"/api/repo/ask");
response=await go("/api/agents/run",{method:"POST",headers:jsonHeaders,body:JSON.stringify({agent:"memory-analyst",task:"Assess evidence"})});
assert.equal(response.status,200);
assert.equal(forwarded.at(-1).pathname,"/api/agents/run");
assert.equal((await go("/api/admin/secrets",{method:"POST",headers:jsonHeaders,body:"{}"})).status,405);


const beforeAuditCalls=forwarded.length;
assert.match(html,/data-open-audit/);
assert.match(html,/closest\("\[data-open-audit\]"\)/);
assert.ok(html.includes('href="/osint/"'));
assert.match(html,/SOURCE_INVENTORY\.json/);
assert.match(html,/star-cyber-audit-ish\/upstream/);
response=await go("/audit/");
assert.equal(response.status,200);
assert.match(response.headers.get("Content-Security-Policy"),/frame-ancestors 'none'/);
let auditHtml=await response.text();
assert.match(auditHtml,/STAR CYBER AUDIT/);
assert.match(auditHtml,/fetch\("\/audit\/api\/sample"/);
assert.match(auditHtml,/href="\/"/);
assert.doesNotMatch(auditHtml,/fetch\("\/api\/sample"/);
response=await go("/audit/api/sample");
assert.equal(response.status,200);
const auditSample=await response.json();
assert.equal(auditSample.static_read_only,true);
assert.ok(Array.isArray(auditSample.files)&&auditSample.files.length>0);
assert.equal((await go("/audit/health")).status,200);
assert.equal((await go("/audit/missing")).status,404);
assert.equal((await go("/audit/",{method:"POST",body:"ignored"})).status,405);
assert.equal(forwarded.length,beforeAuditCalls,"Local audit must not invoke private Core");


// STAR OSINT reports are displayed exclusively within the browser; never sent to Core.
const beforeOsintCalls = forwarded.length;
assert.match(html,/id="osintLabCard"/);
assert.ok(html.includes('href="/osint/"'));
response = await go("/osint/");
assert.equal(response.status,200);
assert.match(response.headers.get("Content-Security-Policy"),/connect-src 'none'/);
const osintHtml = await response.text();
assert.match(osintHtml,/STAR OSINT/);
assert.match(osintHtml,/id="reportFile"/);
assert.match(osintHtml,/id="infraFile"/);
assert.ok(osintHtml.includes('src="/osint/app.js"'));
response = await go("/osint/app.js");
assert.equal(response.status,200);
const osintClient = await response.text();
assert.match(osintClient,/file\.text\(\)/);
assert.match(osintClient,/textContent/);
assert.doesNotMatch(osintClient,/fetch\s*\(/);
assert.equal((await go("/osint/health")).status,200);
assert.deepEqual(await (await go("/osint/health")).json(),{
  ok:true,service:"star-osint-viewer",read_only:true,local_only:true
});
assert.equal((await go("/osint/unknown")).status,404);
assert.equal((await go("/osint/",{method:"POST",body:"ignored"})).status,405);
assert.equal((await go("/osint/",{method:"HEAD"})).status,200);
assert.equal(forwarded.length,beforeOsintCalls,"OSINT viewer must never invoke private Core");

console.log("Unified Sentinel + iSH audit: layout, auth, origin, size, and chat proxy tests passed");
