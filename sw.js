// Tabs service worker
//
// Cache-first: the app opens from the saved copy straight away, with no wait on
// the network. Each release gets its own cache (named after the version), and
// the browser checks sw.js for changes on every launch. When it finds a new
// version, install saves the whole app shell fresh from the server in one go,
// so a release is never half old and half new. The page then offers a reload.
const CACHE = "tabs-v4.6.0";
const ART = "tabs-art";          // album art for covers, kept across releases
const VENDOR = "tabs-vendor";    // libraries loaded on first use (vendor/), kept across releases
const SHELL = ["./", "index.html", "styles.css", "app.js", "core.js", "ui.js", "store.js", "sets.js", "settings.js", "editor.js", "coach.js", "tuner.js", "findai.js", "german.js", "aitools.js", "crop.js", "sketch.js", "heads.js", "dial.js", "fold.js", "strum.js", "share.js", "listen.js", "profile.js", "playmap.js", "road.js", "hud.js", "gig.js", "tour.js", "charts.js", "practice.js", "drawer.js", "louie.js", "scene.js", "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/pick-512.png"];

self.addEventListener("install", e => {
  // Fetch every file fresh: cache: "reload" skips the phone's HTTP cache, and
  // the ?fresh= query skips a web cache that may still hold the last release's
  // copy for a few minutes after it changes. Each file is saved under its plain
  // address. If core.js isn't this release's (its VERSION differs), the install
  // fails and the phone tries again later, instead of keeping a mix of two
  // releases under one name (the library showed 2.5 parts with 2.6 styles).
  const v = CACHE.slice("tabs-v".length);
  e.waitUntil(caches.open(CACHE).then(cache => Promise.all(SHELL.map(async u => {
    const res = await fetch(new Request(`${u}${u.includes("?") ? "&" : "?"}fresh=${v}`, { cache: "reload" }));
    if (!res.ok) throw new Error(`${u}: ${res.status}`);
    if (u === "core.js" && !(await res.clone().text()).includes(`VERSION = "${v}"`)) throw new Error("core.js is from another release");
    await cache.put(u, res);
  }))));
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
      return Promise.all(ks.filter(k => k !== CACHE && k !== ART && k !== VENDOR && !keep.includes(k)).map(k => caches.delete(k)));
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
  // Libraries under vendor/ (Basic Pitch for Strum it, about 2 MB): fetched the
  // first time they're used and kept across releases. A new version of one
  // gets a new folder name, so a saved copy is never stale.
  if (url.pathname.includes("/vendor/")) {
    e.respondWith((async () => {
      const cache = await caches.open(VENDOR), key = url.origin + url.pathname;
      const hit = await cache.match(key);
      if (hit) return hit;
      try { const res = await fetch(key); if (res.ok) cache.put(key, res.clone()); return res; } catch { return Response.error(); }
    })());
    return;
  }
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
