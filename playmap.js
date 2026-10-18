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
import { HEX_M, coarseSpot, hexOutline, hexSpiral, lifetimePlays, playSongs, streakOf, territory, venueOf } from "./core.js";
import { app, esc, icon, layer, onLeave, toast } from "./ui.js";
import { data, go } from "./app.js";

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

/* Metres east and south of the spot, as lat/lon. */
const offset = (spot, east, south) => [spot.lat - south / 111320, spot.lon + east / (111320 * Math.cos(spot.lat * Math.PI / 180))];
/* a landmark for each venue: open mic, coffeehouse, club, theater, arena, stadium, festival */
const VENUE_ICON = [null, "mic", "cup", "note", "stage", "amp", "flame", "sun"];
const NOWHERE = { lat: 0, lon: 0 }; /* plain ground: the shape alone, nowhere in particular */

let map = null;
onLeave(r => { if (r.name !== "playmap") closeMap(); });
function closeMap() {
  map?.remove(); map = null;
  document.body.classList.remove("tm-open");
}

export async function renderPlayMap() {
  closeMap();
  const plays = lifetimePlays(data), t = territory(plays), v = venueOf(plays), spot = getSpot();
  const streak = streakOf(playSongs(data)).days;
  document.body.classList.add("tm-open");
  app.innerHTML = `
    <div class="tm-page">
      <div id="tm-map" class="tm-map" role="img" aria-label="Your Tour Map: ${t.cells} hexagon${t.cells === 1 ? "" : "s"} lit"></div>
      <div class="tm-top"><button class="ib" id="back" aria-label="Back">${icon("back")}</button><h1 class="title script">Tour Map</h1></div>
      <div class="tm-ctl">
        <button class="ib glass" id="tm-in" aria-label="Zoom in">${icon("plus")}</button>
        <button class="ib glass" id="tm-out" aria-label="Zoom out">${icon("minus")}</button>
        <button class="ib glass" id="tm-home" aria-label="Back to my spot">${icon("target")}</button>
      </div>
      <div class="tm-dock">
        ${spot ? "" : `<button class="btn tm-flag" id="tm-flag">${icon("flag")}Plant your flag on a real map</button>`}
        <div class="pf-plate" role="group" aria-label="Tour numbers">
          <div class="pf-read"><b>${t.cells}</b><span>${t.cells === 1 ? "hex" : "hexes"} lit</span></div>
          <div class="pf-read"><b>${v.toNext}</b><span>to ${esc(v.next)}</span></div>
          <div class="pf-read"><b>${streak}</b><span>day streak</span></div>
        </div>
        <p class="tm-venue">Now playing: <b>${esc(v.name)}</b>${spot ? ` · <button class="linkish" id="tm-forget">Forget my spot</button>` : ""}</p>
      </div>
    </div>`;
  document.getElementById("back").onclick = () => history.length > 1 ? history.back() : go("#/");
  document.getElementById("tm-flag")?.addEventListener("click", () => plantSheet());
  document.getElementById("tm-forget")?.addEventListener("click", () => { forgetSpot(); toast("Spot forgotten. Your turf stays."); renderPlayMap(); });
  let L;
  try { L = await loadLeaflet(); } catch { toast("The map couldn't load. Try again with a connection."); return; }
  if (!document.getElementById("tm-map")) return; /* left while it loaded */
  draw(L, spot, t.cells, plays);
}

function draw(L, spot, cells, plays) {
  const at = spot || NOWHERE;
  const el = document.getElementById("tm-map");
  el.classList.toggle("plain", !spot);
  map = L.map(el, { zoomControl: false, attributionControl: !!spot, zoomSnap: 0.25, minZoom: 11, maxZoom: 18, worldCopyJump: false });
  if (spot) {
    let failed = 0;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors", className: "tm-tiles" })
      .on("tileerror", () => { if (++failed === 3) toast("Map pictures aren't loading. Your turf is still here."); })
      .addTo(map);
    map.attributionControl.setPrefix(false);
  }
  /* geometry: cell centres and corners in metres from the spot */
  const R3 = Math.sqrt(3), cellAt = ([q, r]) => [HEX_M * R3 * (q + r / 2), HEX_M * 1.5 * r];
  const hex = ([q, r], scale = 1) => { const [x, y] = cellAt([q, r]); return [0, 1, 2, 3, 4, 5].map(k => { const a = Math.PI / 180 * (60 * k - 30); return offset(at, x + HEX_M * scale * Math.cos(a), y + HEX_M * scale * Math.sin(a)); }); };
  const lit = cells ? hexSpiral(cells) : [], ring = territory(plays).rings, next = hexSpiral(1 + 3 * (ring + 1) * (ring + 2)).slice(cells);
  const world = [[85, -180], [85, 180], [-85, 180], [-85, -180]];
  /* fog everywhere but your turf */
  L.polygon([world, ...lit.map(c => hex(c))], { stroke: false, fillColor: "#060608", fillOpacity: spot ? 0.58 : 0.92, interactive: false, className: "tm-fog" }).addTo(map);
  /* the warm glow inside */
  if (lit.length) L.polygon(lit.map(c => hex(c)), { stroke: false, fillColor: "#ffb24a", fillOpacity: 0.16, interactive: false, className: "tm-lit" }).addTo(map);
  /* the next cells to claim */
  if (next.length) L.polygon(next.map(c => hex(c, 0.9)), { color: "#b8935a", weight: 1.4, opacity: 0.55, dashArray: "3 6", fill: false, interactive: false }).addTo(map);
  /* the piped outline, with a soft halo */
  const seg = hexOutline(cells).map(([a, b]) => [offset(at, a[0] * HEX_M, a[1] * HEX_M), offset(at, b[0] * HEX_M, b[1] * HEX_M)]);
  if (seg.length) {
    L.polyline(seg, { color: "#ffc27a", weight: 10, opacity: 0.3, interactive: false, className: "tm-halo" }).addTo(map);
    L.polyline(seg, { color: "#ffc27a", weight: 2.4, opacity: 1, interactive: false }).addTo(map);
  }
  /* the newest cell's lamp, the flag at home, a venue mark on each ring reached and the next one dim */
  const pin = (c, html, cls) => L.marker(offset(at, ...cellAt(c)), { icon: L.divIcon({ className: "tm-pin " + cls, html, iconSize: [30, 30] }), interactive: false, keyboard: false }).addTo(map);
  if (lit.length > 1) pin(lit.at(-1), `<i class="tm-lamp"></i>`, "lamp");
  if (lit.length) pin(lit[0], icon("flag"), "badge");
  const mark = k => icon(VENUE_ICON[k] || "flame");
  for (let k = 1; k <= ring; k++) pin(hexSpiral(1 + 3 * k * (k - 1) + 1).at(-1), mark(k), "badge");
  if (next.length) pin(hexSpiral(1 + 3 * ring * (ring + 1) + 1).at(-1), mark(ring + 1), "badge dim");
  /* fit the turf and the next ring, then hand the controls their jobs */
  const reach = HEX_M * (1.5 * (ring + 2) + 1);
  const bounds = L.latLngBounds([offset(at, -reach * 1.1, -reach), offset(at, reach * 1.1, reach)]);
  const fit = () => map.fitBounds(bounds, { paddingTopLeft: [16, 90], paddingBottomRight: [16, 190] });
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
