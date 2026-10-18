// Play map (#/playmap): the territory your plays have won, drawn as hexagons.
// Each credited play adds ground. The rings grow with the square root of your
// plays (territory in core.js), so the first plays show at once and a big
// library still has somewhere to go. With a practice spot the hexagons sit on a
// real map (OpenStreetMap tiles, loaded as pictures, no key needed). Without one,
// or with no connection, the shape alone is drawn on a plain ground.
//
// It is opt-in (Settings > Playing > Play map, off by default). Continuing
// asks the phone for its position once and keeps it no finer than about a
// kilometre, in its own key on this phone, outside the library and any backup.
// Tiles are fetched from OpenStreetMap, which sees the area shown (not your plays).
// "Without a location" gives the drawn map and makes no map requests.
import { Tabs, territory, hexSpiral, hexCentre, mercator, fitZoom, lifetimePlays, coarseSpot, spotLabel } from "./core.js";
import { app, esc, icon, toast } from "./ui.js";
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

/* The territory as an SVG: pointy-topped hexagons from the centre outward. */
function drawMap(cells, fresh) {
  const S = 20, W3 = Math.sqrt(3);
  const pts = hexSpiral(cells).map(([q, r]) => [S * W3 * (q + r / 2), S * 1.5 * r]);
  if (!pts.length) return "";
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const pad = S * 1.4, x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
  const w = Math.max(...xs) - Math.min(...xs) + pad * 2, h = Math.max(...ys) - Math.min(...ys) + pad * 2;
  const hex = (cx, cy) => Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 180 * (60 * i - 30); return `${(cx + (S - 1.5) * Math.cos(a)).toFixed(1)},${(cy + (S - 1.5) * Math.sin(a)).toFixed(1)}`; }).join(" ");
  const shapes = pts.map(([x, y], i) => `<polygon class="pm-cell${i >= fresh ? " new" : ""}${i === 0 ? " home" : ""}" style="--d:${Math.max(0, i - fresh) * 90}ms" points="${hex(x, y)}"/>`).join("");
  return `<svg class="pm-map" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" role="img" aria-label="Your territory: ${cells} hexagon${cells === 1 ? "" : "s"}">${shapes}<circle class="pm-pin" cx="0" cy="0" r="4"/></svg>`;
}

/* Tiles under the hexagons. zoom is the fitted zoom plus the reader's own steps. */
let zoomStep = 0;
function realMap(spot, cells, fresh) {
  const wrap = app.clientWidth ? Math.min(app.clientWidth - 62, 520) : 340, w = Math.round(wrap), h = Math.round(Math.min(w, innerHeight * 0.5));
  const z = Math.max(3, Math.min(17, fitZoom(spot.lat, cells, w, h) + zoomStep));
  const [cx, cy] = mercator(spot.lat, spot.lon, z), left = cx - w / 2, top = cy - h / 2;
  const n = 2 ** z;
  let tiles = "";
  for (let ty = Math.floor(top / 256); ty <= Math.floor((top + h) / 256); ty++) for (let tx = Math.floor(left / 256); tx <= Math.floor((left + w) / 256); tx++) {
    if (ty < 0 || ty >= n) continue;
    const x = ((tx % n) + n) % n;
    tiles += `<img class="pm-tile" alt="" draggable="false" src="https://tile.openstreetmap.org/${z}/${x}/${ty}.png" style="left:${Math.round(tx * 256 - left)}px;top:${Math.round(ty * 256 - top)}px">`;
  }
  const hexes = hexSpiral(cells).map(([q, r], i) => {
    const c = hexCentre(spot, [q, r]), pts = Array.from({ length: 6 }, (_, k) => {
      const a = Math.PI / 180 * (60 * k - 30), v = hexCornerOf(c, a);
      const [px, py] = mercator(v.lat, v.lon, z); return `${(px - left).toFixed(1)},${(py - top).toFixed(1)}`;
    }).join(" ");
    return `<polygon class="pm-cell${i >= fresh ? " new" : ""}${i === 0 ? " home" : ""}" style="--d:${Math.max(0, i - fresh) * 90}ms" points="${pts}"/>`;
  }).join("");
  return `<div class="pm-real" style="width:${w}px;height:${h}px" role="img" aria-label="Your territory on a map: ${cells} hexagon${cells === 1 ? "" : "s"}">${tiles}
    <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${hexes}<circle class="pm-pin" cx="${(cx - left).toFixed(1)}" cy="${(cy - top).toFixed(1)}" r="4"/></svg>
    <div class="pm-zoom"><button class="ib glass" id="pm-in" aria-label="Zoom in">${icon("plus")}</button><button class="ib glass" id="pm-out" aria-label="Zoom out">${icon("minus")}</button></div>
    <small class="pm-credit">© OpenStreetMap contributors</small></div>`;
}
/* A corner of a hexagon 250 m across, as lat/lon. */
function hexCornerOf(c, a) {
  const R = 248; /* a hair under the spacing, so the hexagons keep a thin gap */
  return { lat: c.lat + R * Math.sin(-a) / 111320, lon: c.lon + R * Math.cos(a) / (111320 * Math.cos(c.lat * Math.PI / 180)) };
}

export function renderPlayMap() {
  const s = data.settings;
  if (!s.playMap) return renderInvite();
  const plays = lifetimePlays(data), t = territory(plays), spot = getSpot();
  const fresh = Math.min(t.cells, Math.max(0, s.playSeen || 0));
  app.innerHTML = `
    <div class="head"><button class="ib glass" id="back" aria-label="Back">${icon("back")}</button></div>
    <h1 class="title" style="margin:14px 2px 2px">Play map</h1>
    <p class="pf-since">${spot ? esc(spotLabel(spot)) : "No practice spot"}</p>
    ${t.cells ? `<div class="pm-wrap">${spot ? realMap(spot, t.cells, fresh) : drawMap(t.cells, fresh)}</div>` : `<p class="pf-empty">Play a song through to the end and your territory starts here.</p>`}
    <div class="pf-plate" role="group" aria-label="Territory numbers">
      <div class="pf-read"><b>${plays.toLocaleString()}</b><span>play${plays === 1 ? "" : "s"}</span></div>
      <div class="pf-read"><b>${t.rings}</b><span>ring${t.rings === 1 ? "" : "s"}</span></div>
      <div class="pf-read"><b>${t.toNext.toLocaleString()}</b><span>to next ring</span></div>
    </div>
    <p class="foot">A play counts when a song is played through. Rings grow with the square root of your plays, so ring ${t.rings + 1} arrives at ${t.nextAt.toLocaleString()}. ${spot ? "Your spot is kept to about a kilometre, on this phone only, and is never in a backup. The map pictures come from OpenStreetMap, which sees the area shown and your address, not your plays." : "No location is kept and no map is loaded."}</p>
    <div class="s-dock pf-dock">
      ${spot ? `<button class="btn" id="pm-forget">Forget my spot</button>` : `<button class="btn" id="pm-spot">Add my practice spot</button>`}
    </div>`;
  if (t.cells !== s.playSeen) { s.playSeen = t.cells; Tabs.save(data); }
  document.getElementById("back").onclick = () => go("#/you");
  const zoomBy = d => { zoomStep = Math.max(-3, Math.min(3, zoomStep + d)); s.playSeen = t.cells; renderPlayMap(); };
  document.getElementById("pm-in")?.addEventListener("click", () => zoomBy(1));
  document.getElementById("pm-out")?.addEventListener("click", () => zoomBy(-1));
  document.getElementById("pm-forget")?.addEventListener("click", () => { forgetSpot(); toast("Spot forgotten"); renderPlayMap(); });
  document.getElementById("pm-spot")?.addEventListener("click", () => renderInvite(true));
}

/* The explanation comes first. The phone is asked for its position only after Continue. */
function renderInvite(spotOnly = false) {
  app.innerHTML = `
    <div class="head"><button class="ib glass" id="back" aria-label="Back">${icon("back")}</button></div>
    <h1 class="title" style="margin:14px 2px 2px">Play map</h1>
    <p class="pf-line" style="margin:10px 2px">Every song you play through adds ground to a territory of hexagons around your practice spot, shown on a real map.</p>
    <section class="pf-card"><h2>What is kept</h2>
      <p class="pf-line">${spotOnly ? "" : "Nothing, until you continue. "}If you continue, Tabs asks the phone for its position once and keeps it to about a kilometre, in its own place on this phone. It is not in your library, so it is not in a backup or a shared link. To show the map, the phone loads map pictures from OpenStreetMap, so its servers see the area you are looking at and your network address. It never sees your plays. You can forget the spot at any time. Without a location, the territory is drawn on a plain ground and no map is loaded.</p></section>
    <div class="s-dock pf-dock">
      <button class="btn primary" id="pm-go">${icon("focus")}Continue and share my location</button>
      ${spotOnly ? "" : `<button class="btn" id="pm-none">Without a location</button>`}
      <button class="btn" id="pm-no">Not now</button>
    </div>`;
  const back = () => go(spotOnly ? "#/playmap" : "#/you");
  document.getElementById("back").onclick = back;
  document.getElementById("pm-no").onclick = back;
  document.getElementById("pm-none")?.addEventListener("click", () => { data.settings.playMap = true; Tabs.save(data); renderPlayMap(); });
  document.getElementById("pm-go").onclick = async () => {
    try {
      const spot = await whereAmI();
      if (!spot) throw new Error("bad");
      setSpot(spot);
      data.settings.playMap = true; Tabs.save(data);
      renderPlayMap();
    } catch {
      toast("Couldn't get a location. The map works without one.");
    }
  };
}
