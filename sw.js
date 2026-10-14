// Tabs service worker
//
// Cache-first: the app opens from the saved copy straight away, with no wait on
// the network. Each release gets its own cache (named after the version), and
// the browser checks sw.js for changes on every launch. When it finds a new
// version, install saves the whole app shell fresh from the server in one go,
// so a release is never half old and half new. The page then offers a reload.
const CACHE = "tabs-v2.4.3";
const ART = "tabs-art";          // album art for covers, kept across releases
const SHELL = ["./", "index.html", "styles.css", "app.js", "core.js", "ui.js", "store.js", "sets.js", "settings.js", "editor.js", "coach.js", "tuner.js", "findai.js", "aitools.js", "crop.js", "sketch.js", "heads.js", "dial.js", "ring.js", "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  // cache: "reload" skips the browser's HTTP cache so the new release is fetched in full.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))));
  self.skipWaiting();
});

// The release just before this one is kept, so an app that is still open on
// it can load its remaining parts (see "Same release" below). Older ones go.
const ver = k => k.slice(6).split(".").map(Number);
const newer = (a, b) => { const x = ver(a), y = ver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return (x[i] || 0) - (y[i] || 0); return 0; };
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(ks => {
      const old = ks.filter(k => k.startsWith("tabs-v") && k !== CACHE).sort(newer);
      const keep = old.filter(k => newer(k, CACHE) < 0).slice(-1);
      return Promise.all(ks.filter(k => k !== CACHE && k !== ART && !keep.includes(k)).map(k => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

// Same release: the app asks for its parts as tuner.js?v=1.2.3, and those parts
// ask for theirs (heads.js) with that address as referrer. Both are answered
// from that release's cache when it isn't the current one.
function releaseOf(req, url) {
  let v = url.searchParams.get("v");
  if (!v && req.referrer) { try { v = new URL(req.referrer).searchParams.get("v"); } catch { /* no referrer */ } }
  return v && /^[\d.]+$/.test(v) ? "tabs-v" + v : null;
}

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
  const release = page ? null : releaseOf(req, url);
  e.respondWith((async () => {
    if (release && release !== CACHE && await caches.has(release)) {
      const hit = await (await caches.open(release)).match(req, { ignoreSearch: true });
      if (hit) return hit;
    }
    const cache = await caches.open(CACHE);
    const hit = await cache.match(page ? "index.html" : req, { ignoreSearch: page || !!release });
    if (hit) return hit;
    // Not saved yet (first visit, or a launch image): fetch it and keep a copy.
    try {
      const res = await fetch(req);
      if (res.ok && (!release || release === CACHE)) cache.put(release ? url.origin + url.pathname : req, res.clone());
      return res;
    } catch {
      return Response.error();
    }
  })());
});
