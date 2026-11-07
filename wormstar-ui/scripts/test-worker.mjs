import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const { default: worker } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
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
assert.match(html, /const \$=s=>document.querySelector\(s\), \$\$=s=>Array\.from/);
assert.doesNotMatch(html, /Input received by the UI prototype only/);
assert.equal((await go("/api/health")).status, 200);

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

console.log("Sentinel worker: layout, auth, origin, size, and chat proxy tests passed");
