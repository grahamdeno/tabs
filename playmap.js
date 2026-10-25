// Tour Map (#/playmap): the ground your plays have lit, on a real map.
//
// Every credited play lights one more hexagon (250 m across) around your
// practice spot. Rings grow with the square root of your plays (territory in
// core.js) and each ring is a venue (venueOf). Lit cells glow warm on a dark
// map, the outline of your turf is piped in amber, the newest cell carries a
// lamp, and the next cells to claim are dashed.
//
// The map is Leaflet (vendor/leaflet-1.9.4, cached for offline use after the
// first visit), so pinch and drag work. The page itself is locked while the map
// is open: nothing else scrolls or zooms underneath your fingers.
//
// Location is opt-in. Until you plant your flag the turf is drawn on plain
// ground and no map pictures are loaded. Planting asks the phone for its
// position once and keeps it no finer than about a kilometre, in its own key on
// this phone (tabs.spot.v1), outside the library and every backup. Map pictures
// come from OpenStreetMap, which sees the area shown, never your plays.
import { HEX_M, cellsOutline, coarseSpot, hexSpiral, pickNudge, playsForCells, takeoverPlan, territory } from "./core.js";
import { RIVAL_COLORS, cellCentre, offset, pressureLine, sceneFor } from "./scene.js";
import { app, esc, icon, layer, onLeave, toast } from "./ui.js";
import { data, go, mmss, playSong, songLength } from "./app.js";
import { makeDrawer } from "./drawer.js";

const SPOT = "tabs.spot.v1";
export function getSpot() { try { return coarseSpot(...Object.values(JSON.parse(localStorage.getItem(SPOT) || "null") || {})); } catch { return null; } }
function setSpot(spot) { try { spot ? localStorage.setItem(SPOT, JSON.stringify(spot)) : localStorage.removeItem(SPOT); } catch {} }
export function forgetSpot() { setSpot(null); }

function whereAmI() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("none"));
    navigator.geolocation.getCurrentPosition(p => resolve(coarseSpot(p.coords.latitude, p.coords.longitude)), reject, { enableHighAccuracy: false, maximumAge: 600000, timeout: 12000 });
  });
}

/* Leaflet, loaded the first time the map opens. */
let leaflet;
function loadLeaflet() {
  if (leaflet) return leaflet;
  const base = new URL("./vendor/leaflet-1.9.4/", import.meta.url).href;
  if (!document.getElementById("leaflet-css")) {
    const link = document.createElement("link");
    link.id = "leaflet-css"; link.rel = "stylesheet"; link.href = base + "leaflet.css";
    document.head.appendChild(link);
  }
  leaflet = import(base + "leaflet.js").then(() => window.L).catch(e => { leaflet = null; throw e; });
  return leaflet;
}

/* a landmark for each venue: open mic, coffeehouse, club, theater, arena, stadium, festival */
const VENUE_ICON = [null, "mic", "cup", "note", "stage", "amp", "flame", "sun"];

let map = null;
onLeave(r => { if (r.name !== "playmap") closeMap(); });
function closeMap() {
  map?.remove(); map = null;
  document.body.classList.remove("tm-open");
}

export async function renderPlayMap() {
  closeMap();
  const spot = getSpot();
  document.body.classList.add("tm-open");
  app.innerHTML = `
    <div class="tm-page">
      <div id="tm-map" class="tm-map" role="img" aria-label="Your Tour Map"></div>
      <div class="tm-top"><button class="ib glass" id="back" aria-label="Back">${icon("back")}</button><h1 class="title script">Tour Map</h1><button class="ib glass tm-info" id="tm-info" aria-label="About the map">${icon("info")}</button></div>
      <div class="tm-ctl">
        <button class="ib glass" id="tm-in" aria-label="Zoom in">${icon("plus")}</button>
        <button class="ib glass" id="tm-out" aria-label="Zoom out">${icon("minus")}</button>
        <button class="ib glass" id="tm-home" aria-label="Back to my spot">${icon("target")}</button>
      </div>
      <div class="tm-scrim" id="tm-scrim"></div>
      <div class="tm-above" id="tm-above">
        ${spot ? "" : `<button class="btn tm-flag" id="tm-flag">${icon("flag")}Plant your flag on a real map</button>`}
      </div>
      <section class="tm-sheet" id="tm-sheet" aria-label="Your scene">
        <div class="tm-sizer"></div>
        <div class="tm-sh" id="tm-sh"><i class="rd-grab" data-grab aria-hidden="true"></i><div class="tm-sh-row" id="tm-take"><span class="tm-sh-t"><b>Your scene</b><span>Loading…</span></span></div></div>
        <div class="tm-sbody" id="tm-sbody"></div>
      </section>
    </div>`;
  document.getElementById("back").onclick = () => history.length > 1 ? history.back() : go("#/");
  document.getElementById("tm-flag")?.addEventListener("click", () => plantSheet());
  let L, sc;
  try { [L, sc] = await Promise.all([loadLeaflet(), sceneFor(spot)]); } catch { toast("The map couldn't load. Try again with a connection."); return; }
  if (!document.getElementById("tm-map")) return; /* left while it loaded */
  sc.plan = takeoverPlan({ plays: sc.plays, held: sc.held, lost: sc.lost, owner: sc.owner, rivals: sc.rivals });
  sceneSheet(sc);
  draw(L, sc);
}


/* The bottom of the Tour Map: the venue line, and a sheet with the next takeover
   (how many songs and minutes win the nearest rival hexagon, and a Play button).
   Pull it up for the details and your scene this week, ranked by minutes a day. */
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
function takeover(sc) {
  const plan = sc.plan;
  if (!plan || !data.songs.length) return null;
  const n = plan.plays, byLen = [...data.songs].sort((a, b) => songLength(a) - songLength(b));
  const nudge = pickNudge({ songs: data.songs, mood: "", gigToday: false }), first = (nudge && data.songs.find(x => x.id === nudge.songId)) || byLen[0];
  const queue = [first, ...byLen.filter(x => x !== first)], run = Array.from({ length: Math.min(n, 12) }, (_, i) => queue[i % queue.length]);
  const secs = run.reduce((a, x) => a + songLength(x), 0) + (n > run.length ? (n - run.length) * songLength(byLen[0]) : 0);
  return { n, first, mins: Math.max(1, Math.round(secs / 60)), rival: plan.rival, color: RIVAL_COLORS[sc.rivals.indexOf(plan.rival) % RIVAL_COLORS.length] };
}
function sceneSheet(sc) {
  const $ = id => document.getElementById(id);
  const t = takeover(sc), v = sc.venue;
  const initials = name => name.split(" ").map(w => w[0]).join("").slice(0, 2);
  /* 4.18.0: collapsed, one goal in one unit (minutes of playing), how far along you are, and Play.
     Pull up for your scene this week (minutes a day) and your turf. The fine print sits behind the info button. */
  if (t) {
    const from = playsForCells(sc.earned), to = playsForCells(sc.plan.index + 1 + sc.lost);
    const done = Math.max(0, Math.min(1, to > from ? (sc.plays - from) / (to - from) : 0));
    $("tm-take").classList.add("tm-goalrow");
    $("tm-take").innerHTML = `
      <div class="tm-goal"><button class="tm-badge" id="tm-find" style="--c:${t.color}" aria-label="Show ${esc(t.rival.name)}'s hexagon on the map">${esc(initials(t.rival.name))}</button>
        <span class="tm-sh-t" data-grab><small>NEXT CORNER TO TAKE</small><b>${esc(t.rival.name)}'s corner</b></span></div>
      <div class="tm-prog" data-grab><span>About <b>${t.mins} min</b> of playing takes it</span><i style="--w:${Math.max(4, Math.round(done * 100))}%;--c:${t.color}" role="img" aria-label="${Math.round(done * 100)}% of the way"></i></div>
      <div class="tm-start"><span><small>START WITH</small><b>${esc(t.first.title)}</b> · ${mmss(songLength(t.first))}</span>
        <button class="btn primary tm-go" id="tm-take-go" aria-label="Play ${esc(t.first.title)}">${icon("play")}Play</button></div>
      <p class="tm-pull" data-grab>Pull up for your scene</p>`;
  } else $("tm-take").innerHTML = `<span class="tm-sh-t" data-grab><b>Your scene</b><span>${ordinal(sc.rank)} of ${sc.players} players nearby</span></span>`;
  /* the scene this week: everyone ranked by minutes a day, you always shown, the next corner marked */
  const board = [...sc.rivals.map((r, i) => ({ id: r.id, name: r.name, avg: r.avg7, c: RIVAL_COLORS[i % RIVAL_COLORS.length] })), { name: "You", avg: sc.avg, you: true }].sort((a, b) => b.avg - a.avg);
  const me = board.findIndex(b => b.you);
  const row = (b, i) => `<div class="tm-bd${b.you ? " you" : ""}${t && b.id === t.rival.id ? " next" : ""}"><span>${i + 1}</span><span class="tm-av" style="--c:${b.c || "var(--accent)"}">${b.you ? "YOU" : esc(initials(b.name))}</span><span>${esc(b.name)}${t && b.id === t.rival.id ? " <small>NEXT</small>" : ""}</span><b>${b.avg >= 10 ? Math.round(b.avg) : Math.round(b.avg * 10) / 10}</b></div>`;
  /* the top three, the next corner's owner and you, in order */
  const keep = new Set([0, 1, 2, me, t ? board.findIndex(b => b.id === t.rival.id) : -1]);
  const shown = board.map((b, i) => keep.has(i) ? row(b, i) : "").filter(Boolean);
  const push = pressureLine(sc);
  $("tm-sbody").innerHTML = `
    ${push ? `<p class="tm-push">${esc(push)}</p>` : ""}
    <h2 class="tm-lab"><span>Your scene this week</span><span>min a day</span></h2>
    <div class="tm-board">${shown.join("")}</div>
    <div class="tm-stats"><div><b>${sc.held}</b><small>HEXAGON${sc.held === 1 ? "" : "S"} YOU HOLD</small></div><div><b>${sc.taken}</b><small>CORNER${sc.taken === 1 ? "" : "S"} TAKEN</small></div></div>`;
  $("tm-info").onclick = () => mapInfo(sc, v);
  const sheet = $("tm-sheet"), head = $("tm-sh"), page = document.querySelector(".tm-page");
  const size = () => {
    const peek = head.offsetHeight + parseFloat(getComputedStyle(sheet).paddingBottom || "0");
    sheet.querySelector(".tm-sizer").style.height = peek + "px";
    page.style.setProperty("--tm-peek", peek + "px");
    page.style.setProperty("--dock-h", peek + 8 + $("tm-above").offsetHeight + "px");
  };
  size();
  const drawer = makeDrawer({ root: sheet, head, body: $("tm-sbody"), sizer: sheet.querySelector(".tm-sizer"), scrim: $("tm-scrim") });
  if (t) {
    $("tm-take-go").onclick = () => playSong(t.first.id);
    $("tm-find").onclick = () => { drawer.close(); map?.flyTo(cellCentre(sc.at, sc.plan.cell), Math.max(map.getZoom(), 15), { duration: 0.8 }); };
  }
}
/* About the map: your venue, how the other players work, and forgetting your spot */
function mapInfo(sc, v) {
  layer.innerHTML = `<div class="scrim" id="mi-scrim"></div><div class="panel card" role="dialog" aria-label="About the map">
    <h2>About the map</h2>
    <p class="tm-line"><b>${esc(v.name)}</b>: ${plural(v.toNext, "play")} to the ${esc(v.next)}. Each song you play through lights one more hexagon.</p>
    <p class="tm-line">The other players are simulated from your area's population: about ${sc.guitarists.toLocaleString()} guitarists live around your turf.</p>
    ${sc.spot ? `<p class="tm-line">Your spot is kept on this phone, rounded to about a kilometre.</p>` : ""}
    <div class="actions">${sc.spot ? `<button class="btn" id="tm-forget">Forget my spot</button>` : ""}<button class="btn primary" id="mi-x">Done</button></div></div>`;
  const close = () => { layer.innerHTML = ""; };
  document.getElementById("mi-scrim").onclick = close; document.getElementById("mi-x").onclick = close;
  document.getElementById("tm-forget")?.addEventListener("click", () => { close(); forgetSpot(); toast("Spot forgotten. Your turf stays."); renderPlayMap(); });
}
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");

function draw(L, sc) {
  const { spot, at } = sc;
  const el = document.getElementById("tm-map");
  el.classList.toggle("plain", !spot);
  map = L.map(el, { zoomControl: false, attributionControl: !!spot, zoomSnap: 0.25, minZoom: 10, maxZoom: 18 });
  if (spot) {
    let failed = 0;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors", className: "tm-tiles" })
      .on("tileerror", () => { if (++failed === 3) toast("Map pictures aren't loading. Your turf is still here."); })
      .addTo(map);
    map.attributionControl.setPrefix(false);
  }
  const hex = (c, k = 1) => { const [la, lo] = cellCentre(at, c), [x0, y0] = [0, 0]; return [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 180 * (60 * i - 30); return [la - (y0 + HEX_M * k * Math.sin(a)) / 111320, lo + (x0 + HEX_M * k * Math.cos(a)) / (111320 * Math.cos(at.lat * Math.PI / 180))]; }); };
  const line = cells => cellsOutline(cells).map(([a, b]) => [offset(at, a[0] * HEX_M, a[1] * HEX_M), offset(at, b[0] * HEX_M, b[1] * HEX_M)]);
  const yours = sc.yours, ring = territory(sc.plays).rings;
  const next = hexSpiral(1 + 3 * (ring + 1) * (ring + 2)).slice(yours.length).filter(c => !sc.owner.has(c[0] + "," + c[1]));
  const world = [[85, -180], [85, 180], [-85, 180], [-85, -180]];
  /* 4.0.1: the turf takes the palette's colours: the ground for the fog, go colour for your turf, the streak colour for the next takeover */
  const css = (n, d) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || d;
  const FOG = css("--bg", "#060608"), MINE = css("--accent", "#ffb24a"), EDGE = css("--accent-deep", "#ffc27a"), NEXT = css("--muted", "#b8935a"), AIM = css("--streak", "#ffc27a");
  /* fog everywhere but your turf */
  L.polygon([world, ...yours.map(c => hex(c))], { stroke: false, fillColor: FOG, fillOpacity: spot ? 0.55 : 0.9, interactive: false }).addTo(map);
  /* rivals: their turf in their colour, a badge at home; tap for who they are */
  sc.rivals.forEach((rv, i) => {
    const cells = sc.turf[rv.id] || [], col = RIVAL_COLORS[i % RIVAL_COLORS.length];
    if (!cells.length) return;
    const quiet = rv.avg7 === 0;
    L.polygon(cells.map(c => hex(c)), { stroke: false, fillColor: col, fillOpacity: quiet ? 0.1 : 0.22, interactive: false }).addTo(map);
    L.polyline(line(cells), { color: col, weight: 2, opacity: quiet ? 0.45 : 0.9, dashArray: quiet ? "4 5" : null, interactive: false }).addTo(map);
    const home = cells.find(c => c[0] === rv.home[0] && c[1] === rv.home[1]) || cells[0];
    const initials = rv.name.split(" ").map(w => w[0]).join("").slice(0, 2);
    const last = rv.lastPlayed === null ? "hasn't played yet" : rv.lastPlayed === 0 ? "played today" : rv.lastPlayed === 1 ? "played yesterday" : `last played ${rv.lastPlayed} days ago`;
    L.marker(cellCentre(at, home), { icon: L.divIcon({ className: "tm-rival" + (quiet ? " quiet" : ""), html: `<b style="--c:${col}">${esc(initials)}</b>`, iconSize: [30, 30] }), keyboard: false, title: rv.name })
      .bindPopup(`<div class="tm-pop"><b>${esc(rv.name)}</b><span>${esc(rv.label)} · ${last}</span><span>${rv.avg7} min a day this week · ${cells.length} hex${cells.length === 1 ? "" : "es"}</span><small>Simulated player</small></div>`, { closeButton: false, className: "tm-popwrap" })
      .addTo(map);
  });
  /* your turf: the warm glow, the next cells, the piped outline */
  if (yours.length) L.polygon(yours.map(c => hex(c)), { stroke: false, fillColor: MINE, fillOpacity: 0.22, interactive: false }).addTo(map);
  if (next.length) L.polygon(next.map(c => hex(c, 0.9)), { color: NEXT, weight: 1.6, opacity: 0.6, dashArray: "3 6", fill: false, interactive: false }).addTo(map);
  if (sc.plan) L.polygon(hex(sc.plan.cell, 0.92), { color: AIM, weight: 2.4, dashArray: "2 5", fillColor: AIM, fillOpacity: 0.16, interactive: false, className: "tm-target" }).addTo(map);
  const seg = line(yours);
  if (seg.length) {
    L.polyline(seg, { color: MINE, weight: 10, opacity: 0.3, interactive: false, className: "tm-halo" }).addTo(map);
    L.polyline(seg, { color: EDGE, weight: 3, opacity: 1, interactive: false }).addTo(map);
  }
  const pin = (c, html, cls) => L.marker(cellCentre(at, c), { icon: L.divIcon({ className: "tm-pin " + cls, html, iconSize: [30, 30] }), interactive: false, keyboard: false }).addTo(map);
  if (yours.length > 1) pin(yours.at(-1), sc.below > 0 ? `<i class="tm-lamp warn"></i>` : `<i class="tm-lamp"></i>`, "lamp");
  if (yours.length) pin(yours[0], icon("flag"), "badge");
  const mark = k => icon(VENUE_ICON[k] || "flame");
  for (let k = 1; k <= ring; k++) { const c = hexSpiral(1 + 3 * k * (k - 1) + 1).at(-1); if (yours.some(y => y[0] === c[0] && y[1] === c[1])) pin(c, mark(k), "badge"); }
  /* fit your turf and the ring beyond it; rivals are a drag away */
  const reach = HEX_M * (1.5 * (ring + 2) + 1) * 2.2; /* wide enough to see the rivals next door */
  const mine = L.latLngBounds([offset(at, -reach * 1.1, -reach), offset(at, reach * 1.1, reach)]);
  const fit = () => map.fitBounds(mine, { paddingTopLeft: [16, 90], paddingBottomRight: [16, (parseFloat(getComputedStyle(document.querySelector(".tm-page")).getPropertyValue("--dock-h")) || 190) + 16] });
  map.invalidateSize(); fit();
  requestAnimationFrame(() => { if (map) { map.invalidateSize(); fit(); } });
  document.getElementById("tm-in").onclick = () => map.zoomIn();
  document.getElementById("tm-out").onclick = () => map.zoomOut();
  document.getElementById("tm-home").onclick = fit;
}

/* Plant your flag: the explanation first; the phone is asked only on the button. */
function plantSheet() {
  layer.innerHTML = `<div class="scrim" id="pf-scrim"></div><div class="panel card" role="dialog" aria-label="Plant your flag">
    <div class="pc-head">${icon("flag")}<span>Tour Map</span></div>
    <p class="tm-sheet-t">Plant your flag where you play</p>
    <p class="pf-line">Every song you play through lights a hexagon around this spot, on a real map.</p>
    <p class="tm-fine">Your phone shares its position once. The Road keeps it to about a kilometre, on this phone only, never in a backup. Map pictures come from OpenStreetMap, which sees the area shown, not your plays.</p>
    <div class="tm-btns"><button class="btn" id="pf-no">Not now</button><button class="btn primary" id="pf-go">${icon("flag")}Plant my flag</button></div>
  </div>`;
  const close = () => { layer.innerHTML = ""; };
  document.getElementById("pf-scrim").onclick = close;
  document.getElementById("pf-no").onclick = close;
  document.getElementById("pf-go").onclick = async () => {
    try {
      const spot = await whereAmI();
      if (!spot) throw new Error("bad");
      setSpot(spot); close(); renderPlayMap();
    } catch {
      toast("Couldn't get a location. Your turf stays on plain ground.");
    }
  };
}
