// Tabs service worker
//
// Cache-first: the app opens from the saved copy straight away, with no wait on
// the network. Each release gets its own cache (named after the version), and
// the browser checks sw.js for changes on every launch. When it finds a new
// version, install saves the whole app shell fresh from the server in one go,
// so a release is never half old and half new. The page then offers a reload.
const CACHE = "tabs-v1.35.17";
const ART = "tabs-art";          // album art for covers, kept across releases
const SHELL = ["./", "index.html", "styles.css", "app.js", "core.js", "tuner.js", "findai.js", "aitools.js", "crop.js", "heads.js", "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  // cache: "reload" skips the browser's HTTP cache so the new release is fetched in full.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== ART).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname === "api.anthropic.com") return; // never cache AI calls
  // Album art used for set covers: keep a copy so covers still show offline.
  // (Kept across releases; images only, from Apple's artwork servers.)
  if (/(^|\.)mzstatic\.com$/.test(url.hostname) && req.destination === "image") {
    e.respondWith((async () => {
      const cache = await caches.open(ART);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === "opaque") cache.put(req, res.clone());
        return res;
      } catch { return Response.error(); }
    })());
    return;
  }
  if (url.origin !== self.location.origin) return;  // other sites go straight to the network
  const page = req.mode === "navigate";
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(page ? "index.html" : req, { ignoreSearch: page });
    if (hit) return hit;
    // Not saved yet (first visit, or a launch image): fetch it and keep a copy.
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      return Response.error();
    }
  })());
});
