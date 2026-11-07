const CACHE = "wormstar-sentinel-ui-v1";
const CORE = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const shell = url.pathname === "/" || url.pathname === "/index.html";
  const manifest = url.pathname === "/manifest.webmanifest";
  if (!shell && !manifest) return;

  // Network first: never lock iPhone users into a cached, broken JS build.
  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: "no-store" });
      if (response.ok && response.type === "basic") {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (shell) return (await caches.match("./index.html")) || Response.error();
      return Response.error();
    }
  })());
});
