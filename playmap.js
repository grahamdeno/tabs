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
import { HEX_M, cellsOutline, coarseSpot, hexSpiral, pickNudge, playSongs, streakOf, takeoverPlan, territory } from "./core.js";
import { RIVAL_COLORS, cellCentre, offset, pressureLine, sceneFor } from "./scene.js";
import { app, esc, icon, layer, onLeave, toast } from "./ui.js";
import { data, go, mmss, playSong, songLength } from "./app.js";

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
      <div class="tm-top"><button class="ib" id="back" aria-label="Back">${icon("back")}</button><h1 class="title script">Tour Map</h1></div>
      <div class="tm-ctl">
        <button class="ib glass" id="tm-in" aria-label="Zoom in">${icon("plus")}</button>
        <button class="ib glass" id="tm-out" aria-label="Zoom out">${icon("minus")}</button>
        <button class="ib glass" id="tm-home" aria-label="Back to my spot">${icon("target")}</button>
      </div>
      <div class="tm-dock">
        <p class="tm-push" id="tm-push" hidden></p>
        <section class="tm-take" id="tm-take" hidden aria-label="Take over a rival hexagon"></section>
        ${spot ? "" : `<button class="btn tm-flag" id="tm-flag">${icon("flag")}Plant your flag on a real map</button>`}
        <div class="pf-plate" role="group" aria-label="Tour numbers">
          <div class="pf-read"><b id="tm-held">–</b><span>hexes held</span></div>
          <div class="pf-read"><b id="tm-rank">–</b><span>in your scene</span></div>
          <div class="pf-read"><b id="tm-avg">–</b><span>min a day</span></div>
        </div>
        <p class="tm-venue" id="tm-venue">&nbsp;</p>
      </div>
    </div>`;
  document.getElementById("back").onclick = () => history.length > 1 ? history.back() : go("#/");
  document.getElementById("tm-flag")?.addEventListener("click", () => plantSheet());
  let L, sc;
  try { [L, sc] = await Promise.all([loadLeaflet(), sceneFor(spot)]); } catch { toast("The map couldn't load. Try again with a connection."); return; }
  if (!document.getElementById("tm-map")) return; /* left while it loaded */
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("tm-held", sc.held); set("tm-rank", `#${sc.rank}/${sc.players}`); set("tm-avg", sc.avg >= 10 ? Math.round(sc.avg) : sc.avg);
  document.getElementById("tm-venue").innerHTML = `Now playing: <b>${esc(sc.venue.name)}</b> · ahead of ${Math.round(sc.pct * 100)}% of about ${sc.guitarists.toLocaleString()} guitarists near you${spot ? ` · <button class="linkish" id="tm-forget">Forget my spot</button>` : ""}`;
  document.getElementById("tm-forget")?.addEventListener("click", () => { forgetSpot(); toast("Spot forgotten. Your turf stays."); renderPlayMap(); });
  const push = pressureLine(sc);
  if (push) { const el = document.getElementById("tm-push"); el.textContent = push; el.hidden = false; }
  sc.plan = takeoverPlan({ plays: sc.plays, held: sc.held, lost: sc.lost, owner: sc.owner, rivals: sc.rivals });
  takeCard(sc);
  draw(L, sc);
}


/* The takeover prompt: the nearest rival hexagon, how many songs and minutes it
   takes, and which song to start with. Plays are credited when a song is played through. */
function takeCard(sc) {
  const el = document.getElementById("tm-take"), plan = sc.plan;
  if (!el || !plan || !data.songs.length) return;
  const n = plan.plays, byLen = [...data.songs].sort((a, b) => songLength(a) - songLength(b));
  const nudge = pickNudge({ songs: data.songs, mood: "", gigToday: false }), first = (nudge && data.songs.find(x => x.id === nudge.songId)) || byLen[0];
  const queue = [first, ...byLen.filter(x => x !== first)], run = Array.from({ length: Math.min(n, 12) }, (_, i) => queue[i % queue.length]);
  const secs = run.reduce((a, x) => a + songLength(x), 0) + (n > run.length ? (n - run.length) * songLength(byLen[0]) : 0), mins = Math.max(1, Math.round(secs / 60));
  const rv = plan.rival, today = streakOf(playSongs(data)).today, gap = rv.avg7 > sc.avg ? Math.ceil(rv.avg7) : 0;
  const count = n === 1 ? "One song" : `${n} songs`;
  const lamps = Array.from({ length: Math.min(n, 8) }, () => "<i></i>").join("");
  el.hidden = false;
  el.innerHTML = `<button class="tm-take-who" id="tm-find">Take over from ${esc(rv.name)}</button>
    <p class="tm-take-h">${count}, about ${mins} min</p>
    <span class="tm-take-dots" aria-hidden="true">${lamps}</span>
    <p class="tm-take-s">Start with <b>${esc(first.title)}</b> (${mmss(songLength(first))}). ${today ? "" : "It keeps your streak too."}${gap ? ` To hold it, aim for ${gap} min a day; ${esc(rv.name.split(" ")[0])} plays ${Math.round(rv.avg7)}.` : ""}</p>
    <button class="btn primary tm-take-go" id="tm-take-go">${icon("play")}Play ${esc(first.title)}</button>`;
  document.getElementById("tm-take-go").onclick = () => playSong(first.id);
  document.getElementById("tm-find").onclick = () => map?.flyTo(cellCentre(sc.at, plan.cell), Math.max(map.getZoom(), 15), { duration: 0.8 });
  requestAnimationFrame(() => {
    const dock = document.querySelector(".tm-dock"), page = document.querySelector(".tm-page");
    if (dock && page) page.style.setProperty("--dock-h", dock.offsetHeight + "px");
  });
}

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
  /* fog everywhere but your turf */
  L.polygon([world, ...yours.map(c => hex(c))], { stroke: false, fillColor: "#060608", fillOpacity: spot ? 0.55 : 0.9, interactive: false }).addTo(map);
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
  if (yours.length) L.polygon(yours.map(c => hex(c)), { stroke: false, fillColor: "#ffb24a", fillOpacity: 0.16, interactive: false }).addTo(map);
  if (next.length) L.polygon(next.map(c => hex(c, 0.9)), { color: "#b8935a", weight: 1.4, opacity: 0.55, dashArray: "3 6", fill: false, interactive: false }).addTo(map);
  if (sc.plan) L.polygon(hex(sc.plan.cell, 0.92), { color: "#ffc27a", weight: 2, dashArray: "2 5", fillColor: "#ffb24a", fillOpacity: 0.14, interactive: false, className: "tm-target" }).addTo(map);
  const seg = line(yours);
  if (seg.length) {
    L.polyline(seg, { color: "#ffc27a", weight: 10, opacity: 0.3, interactive: false, className: "tm-halo" }).addTo(map);
    L.polyline(seg, { color: "#ffc27a", weight: 2.4, opacity: 1, interactive: false }).addTo(map);
  }
  const pin = (c, html, cls) => L.marker(cellCentre(at, c), { icon: L.divIcon({ className: "tm-pin " + cls, html, iconSize: [30, 30] }), interactive: false, keyboard: false }).addTo(map);
  if (yours.length > 1) pin(yours.at(-1), sc.below > 0 ? `<i class="tm-lamp warn"></i>` : `<i class="tm-lamp"></i>`, "lamp");
  if (yours.length) pin(yours[0], icon("flag"), "badge");
  const mark = k => icon(VENUE_ICON[k] || "flame");
  for (let k = 1; k <= ring; k++) { const c = hexSpiral(1 + 3 * k * (k - 1) + 1).at(-1); if (yours.some(y => y[0] === c[0] && y[1] === c[1])) pin(c, mark(k), "badge"); }
  /* fit your turf and the ring beyond it; rivals are a drag away */
  const reach = HEX_M * (1.5 * (ring + 2) + 1) * 2.2; /* wide enough to see the rivals next door */
  const mine = L.latLngBounds([offset(at, -reach * 1.1, -reach), offset(at, reach * 1.1, reach)]);
  const fit = () => map.fitBounds(mine, { paddingTopLeft: [16, 90], paddingBottomRight: [16, (document.querySelector(".tm-dock")?.offsetHeight || 190) + 24] });
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
