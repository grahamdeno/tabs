// Tabs service worker
//
// Cache-first: the app opens from the saved copy straight away, with no wait on
// the network. Each release gets its own cache (named after the version), and
// the browser checks sw.js for changes on every launch. When it finds a new
// version, install saves the whole app shell fresh from the server in one go,
// so a release is never half old and half new. The page then offers a reload.
const CACHE = "tabs-v4.119.0";
const ART = "tabs-art";          // album art for covers, kept across releases
const VENDOR = "tabs-vendor";    // libraries loaded on first use (vendor/), kept across releases
const SHELL = ["./", "index.html", "styles.css", "app.js", "library.js", "audio.js", "aihelp.js", "core.js", "core/chords.js", "core/game.js", "core/groove.js", "core/neck.js", "core/booth.js", "core/youtube.js", "core/playing.js", "core/recording.js", "core/sketch.js", "core/turf.js", "ui.js", "store.js", "sets.js", "settings.js", "editor.js", "coach.js", "tuner.js", "findai.js", "german.js", "aitools.js", "crop.js", "sketch.js", "heads.js", "dial.js", "fold.js", "strum.js", "share.js", "listen.js", "profile.js", "playmap.js", "road.js", "fretboard.js", "hud.js", "gig.js", "stage.js", "tour.js", "charts.js", "band.js", "friends.js", "duel.js", "merch.js", "buildart.js", "builder.js", "support.js", "opening.js", "practice.js", "booth.js", "youtube.js", "drawer.js", "louie.js", "guitarist.js", "gstand.js", "maker.js", "selfie.js", "portrait.js", "rock.js", "scene.js", "callout.js", "tuneup.js", "art/guitarist.js", "art/guitarist-poster.js", "art/guitarist-poster/grain.webp", "art/guitars/pics.js", "art/road-neck/neck-rosewood.webp", "art/road-neck/neck-rosewood-v2.webp", "art/road-neck/nut.webp", "art/road-neck/nut-v2.webp", "art/road-neck/fret-gold.webp", "art/road-neck/check.webp", "art/road-neck/lock.webp", "art/road-neck/inlays/pick.webp", "art/road-neck/inlays/star.webp", "art/road-neck/inlays/crown.webp", "art/road-neck/inlays/flame.webp", "art/road-neck/inlays/bolt.webp", "art/road-neck/inlays/block.webp", "art/road-neck/inlays/fin.webp", "art/road-neck/inlays/vine.webp", "art/road-neck/inlays/moon.webp", "art/road-neck/inlays/diamond.webp", "art/road-neck/check-v2.webp", "art/road-neck/lock-v2.webp", "art/road-neck/inlays/fin-v2.webp", "art/road-neck/inlays/vine-v2.webp", "art/road-neck/inlays/moon-v2.webp", "art/guitars/arrowhead-road.webp", "art/guitars/barebones-road.webp", "art/guitars/clubslab-road.webp", "art/guitars/comet-road.webp", "art/guitars/cornerstone-road.webp", "art/guitars/flyerwall-road.webp", "art/guitars/ghostspalt-road.webp", "art/guitars/highline-road.webp", "art/guitars/hollowhill-road.webp", "art/guitars/islander-road.webp", "art/guitars/koaarc-road.webp", "art/guitars/nova-road.webp", "art/guitars/porch-road.webp", "art/guitars/razorwing-road.webp", "art/guitars/redwoodhollow-road.webp", "art/guitars/spraycancrack-road.webp", "art/guitars/stickerriot-road.webp", "art/guitars/swing-road.webp", "art/guitars/tartanpin-road.webp", "art/guitars/toxicchecker-road.webp", "art/guitars/velvetcrown-road.webp", "art/guitars/walnuthall-road.webp", "art/guitars/ziricotegrand-road.webp", "art/guitars/parlor-head.webp", "art/guitars/parlor-body.webp", "art/guitars/parlor-small.webp", "art/guitars/cutaway-head.webp", "art/guitars/cutaway-body.webp", "art/guitars/cutaway-small.webp", "art/guitars/cutaway-sunburst-body.webp", "art/guitars/cutaway-sunburst-head.webp", "art/guitars/cutaway-sunburst-small.webp", "art/surfaces/tolex-dark.webp", "art/surfaces/tolex-cream.webp", "art/tabbar/grille-dark.webp", "art/tabbar/grille-light.webp", "art/tabbar/knob-off.webp", "art/tabbar/knob-lit.webp", "art/tabbar/knob-lit-teal.webp", "art/case/velvet-slot.webp", "art/case/latch.webp", "art/case/guitar-stand-back.webp", "art/case/guitar-stand-front.webp", "art/guitars/solid-head.webp", "art/guitars/solid-body.webp", "art/guitars/solid-small.webp", "art/guitars/hollow-head.webp", "art/guitars/hollow-body.webp", "art/guitars/hollow-small.webp", "art/guitars/single-head.webp", "art/guitars/single-body.webp", "art/guitars/single-small.webp", "art/guitars/classical-head.webp", "art/guitars/classical-body.webp", "art/guitars/classical-small.webp", "art/guitars/headliner-head.webp", "art/guitars/headliner-body.webp", "art/guitars/headliner-small.webp", "art/guitars/porch-head.webp", "art/guitars/porch-body.webp", "art/guitars/porch-small.webp", "art/guitars/clubslab-head.webp", "art/guitars/clubslab-body.webp", "art/guitars/clubslab-small.webp", "art/guitars/swing-head.webp", "art/guitars/swing-body.webp", "art/guitars/swing-small.webp", "art/guitars/comet-head.webp", "art/guitars/comet-body.webp", "art/guitars/comet-small.webp", "art/guitars/highline-head.webp", "art/guitars/highline-body.webp", "art/guitars/highline-small.webp", "art/guitars/ghostspalt-head.webp", "art/guitars/ghostspalt-body.webp", "art/guitars/ghostspalt-small.webp", "art/guitars/razorwing-head.webp", "art/guitars/razorwing-body.webp", "art/guitars/razorwing-small.webp", "art/guitars/arrowhead-head.webp", "art/guitars/arrowhead-body.webp", "art/guitars/arrowhead-small.webp", "art/guitars/walnuthall-head.webp", "art/guitars/walnuthall-body.webp", "art/guitars/walnuthall-small.webp", "art/guitars/stickerriot-head.webp", "art/guitars/stickerriot-body.webp", "art/guitars/stickerriot-small.webp", "art/guitars/tartanpin-head.webp", "art/guitars/tartanpin-body.webp", "art/guitars/tartanpin-small.webp", "art/guitars/barebones-head.webp", "art/guitars/barebones-body.webp", "art/guitars/barebones-small.webp", "art/guitars/cornerstone-head.webp", "art/guitars/cornerstone-body.webp", "art/guitars/cornerstone-small.webp", "art/guitars/hollowhill-head.webp", "art/guitars/hollowhill-body.webp", "art/guitars/hollowhill-small.webp", "art/guitars/koaarc-head.webp", "art/guitars/koaarc-body.webp", "art/guitars/koaarc-small.webp", "art/guitars/velvetcrown-head.webp", "art/guitars/velvetcrown-body.webp", "art/guitars/velvetcrown-small.webp", "art/guitars/redwoodhollow-head.webp", "art/guitars/redwoodhollow-body.webp", "art/guitars/redwoodhollow-small.webp", "art/guitars/nova-head.webp", "art/guitars/nova-body.webp", "art/guitars/nova-small.webp", "art/guitars/ziricotegrand-head.webp", "art/guitars/ziricotegrand-body.webp", "art/guitars/ziricotegrand-small.webp", "art/guitars/islander-head.webp", "art/guitars/islander-body.webp", "art/guitars/islander-small.webp", "art/guitars/spraycancrack-head.webp", "art/guitars/spraycancrack-body.webp", "art/guitars/spraycancrack-small.webp", "art/guitars/toxicchecker-head.webp", "art/guitars/toxicchecker-body.webp", "art/guitars/toxicchecker-small.webp", "art/guitars/flyerwall-head.webp", "art/guitars/flyerwall-body.webp", "art/guitars/flyerwall-small.webp", "art/louie/v4/louie-cheer.webp", "art/louie/v4/louie-horns.webp", "art/louie/v4/louie-idle.webp", "art/louie/v4/louie-listen.webp", "art/louie/v4/louie-point.webp", "art/louie/v4/louie-proud.webp", "art/louie/v4/louie-sleepy.webp", "art/louie/v4/louie-thumb.webp", "art/louie/v4/louie-wave.webp", "art/louie/v4/louie-face-badge.webp", "art/show/case-open-dark.webp", "art/show/case-open-light.webp", "art/show/case-beater-dark.webp", "art/show/case-beater-light.webp", "art/show/case-cutaway-dark.webp", "art/show/case-cutaway-light.webp", "art/show/case-solid-dark.webp", "art/show/case-solid-light.webp", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/splash/light-launch-1125x2436.png", "icons/splash/light-launch-1170x2532.png", "icons/splash/light-launch-1179x2556.png", "icons/splash/light-launch-1206x2622.png", "icons/splash/light-launch-1284x2778.png", "icons/splash/light-launch-1290x2796.png", "icons/splash/light-launch-1320x2868.png", "icons/splash/light-launch-750x1334.png", "icons/splash/light-launch-828x1792.png", "art/guitars/builder/manifest.json", "art/guitars/builder/porch/burst.webp", "art/guitars/builder/porch/grain.webp", "art/guitars/builder/porch/guard.webp", "art/guitars/builder/porch/light.webp", "art/guitars/builder/porch/metal.webp", "art/guitars/builder/porch/paint.webp", "art/guitars/builder/porch/strings-long.webp", "art/guitars/builder/porch/top.webp", "art/guitars/builder/porch/wear-played.webp", "art/guitars/builder/porch/wear-worn.webp", "art/guitars/builder/cornerstone/burst.webp", "art/guitars/builder/cornerstone/grain.webp", "art/guitars/builder/cornerstone/guard.webp", "art/guitars/builder/cornerstone/light.webp", "art/guitars/builder/cornerstone/metal.webp", "art/guitars/builder/cornerstone/paint.webp", "art/guitars/builder/cornerstone/strings-long.webp", "art/guitars/builder/cornerstone/top.webp", "art/guitars/builder/cornerstone/wear-played.webp", "art/guitars/builder/cornerstone/wear-worn.webp", "art/guitars/builder/clubslab/burst.webp", "art/guitars/builder/clubslab/grain.webp", "art/guitars/builder/clubslab/guard.webp", "art/guitars/builder/clubslab/light.webp", "art/guitars/builder/clubslab/metal.webp", "art/guitars/builder/clubslab/paint.webp", "art/guitars/builder/clubslab/strings-long.webp", "art/guitars/builder/clubslab/top.webp", "art/guitars/builder/clubslab/wear-played.webp", "art/guitars/builder/clubslab/wear-worn.webp", "art/guitars/builder/hollowhill/burst.webp", "art/guitars/builder/hollowhill/grain.webp", "art/guitars/builder/hollowhill/light.webp", "art/guitars/builder/hollowhill/metal.webp", "art/guitars/builder/hollowhill/paint.webp", "art/guitars/builder/hollowhill/strings-long.webp", "art/guitars/builder/hollowhill/top.webp", "art/guitars/builder/hollowhill/wear-played.webp", "art/guitars/builder/hollowhill/wear-worn.webp", "art/guitars/builder/swing/burst.webp", "art/guitars/builder/swing/grain.webp", "art/guitars/builder/swing/light.webp", "art/guitars/builder/swing/metal.webp", "art/guitars/builder/swing/paint.webp", "art/guitars/builder/swing/strings-long.webp", "art/guitars/builder/swing/top.webp", "art/guitars/builder/swing/wear-played.webp", "art/guitars/builder/swing/wear-worn.webp", "art/guitars/builder/koaarc/burst.webp", "art/guitars/builder/koaarc/grain.webp", "art/guitars/builder/koaarc/light.webp", "art/guitars/builder/koaarc/metal.webp", "art/guitars/builder/koaarc/paint.webp", "art/guitars/builder/koaarc/strings-long.webp", "art/guitars/builder/koaarc/top.webp", "art/guitars/builder/koaarc/wear-played.webp", "art/guitars/builder/koaarc/wear-worn.webp", "art/guitars/builder/comet/burst.webp", "art/guitars/builder/comet/grain.webp", "art/guitars/builder/comet/guard.webp", "art/guitars/builder/comet/light.webp", "art/guitars/builder/comet/metal.webp", "art/guitars/builder/comet/paint.webp", "art/guitars/builder/comet/strings-long.webp", "art/guitars/builder/comet/top.webp", "art/guitars/builder/comet/wear-played.webp", "art/guitars/builder/comet/wear-worn.webp"];

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
