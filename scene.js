// Your scene: the local guitarists and the simulated rival players around your
// spot, worked out from core.js (densityAt, simulateRivals, sceneMap,
// edgePressure, tourDay). Shared by the Tour Map and Tonight.
//
// Population comes from vendor/natural-earth-5/places.json (Natural Earth
// populated places, public domain), loaded once and kept for offline use.
// Everything is worked out on the phone; nothing about your scene is sent.
import { GUITAR_SHARE, HEX_KM2, HEX_M, Tabs, claimCells, densityAt, edgePressure, hexSpiral, lifetimePlays, percentileOf, sceneMap, seedOf, simulateRivals, territory, tourDay, userAvg7, venueOf } from "./core.js";
import { data } from "./app.js";

let places = null;
export function loadPlaces() {
  if (places) return places;
  places = fetch(new URL("./vendor/natural-earth-5/places.json", import.meta.url)).then(r => r.ok ? r.json() : []).catch(() => { places = null; return []; });
  return places;
}
/* metres east and south of a spot, as [lat, lon] */
export const offset = (spot, east, south) => [spot.lat - south / 111320, spot.lon + east / (111320 * Math.cos(spot.lat * Math.PI / 180))];
export const cellCentre = (at, [q, r]) => offset(at, HEX_M * Math.sqrt(3) * (q + r / 2), HEX_M * 1.5 * r);

export const RIVAL_COLORS = ["#6fb3c8", "#b48ad6", "#e07a8c", "#8fbf6a", "#7f9cd9", "#e39a6b", "#c9b36a", "#6cc7a8", "#d78bc0", "#9aa7b3", "#a9b85a", "#e0b08a"];

/* The whole scene for a spot (null = plain ground). Runs the once-a-day edge check. */
export async function sceneFor(spot, now = Date.now()) {
  const pl = await loadPlaces();
  const at = spot || { lat: 0, lon: 0 };
  const dens = new Map();
  const guitaristsAt = c => {
    const k = c[0] + "," + c[1];
    if (!dens.has(k)) { const [lat, lon] = cellCentre(at, c); dens.set(k, spot ? densityAt(lat, lon, pl) : densityAt(NaN, NaN, null)); }
    return Math.round(dens.get(k) * HEX_KM2 * GUITAR_SHARE * 10) / 10;
  };
  const plays = lifetimePlays(data), earned = territory(plays).cells;
  const t0 = data.tour || { lost: 0, below: 0 };
  const held = Math.max(earned ? 1 : 0, earned - (+t0.lost || 0));
  const yours = hexSpiral(held);
  /* the fan base: everyone living in your turf and the ring beyond it */
  const reach = territory(plays).rings + 1, area = hexSpiral(1 + 3 * reach * (reach + 1));
  const guitarists = Math.round(area.reduce((n, c) => n + guitaristsAt(c), 0));
  const people = Math.round(guitarists / GUITAR_SHARE);
  const rivals = simulateRivals({ seed: seedOf(spot ? `${spot.lat},${spot.lon}` : "plain ground"), guitarists: Math.max(guitarists, 40), now, userRings: territory(plays).rings });
  const { owner, turf } = sceneMap(yours, rivals);
  const edge = yours.at(-1) || [0, 0];
  const pressure = edgePressure(edge, rivals, turf, guitaristsAt);
  if (earned) { const before = JSON.stringify(data.tour || {}); tourDay(data, pressure.bar, earned, now); if (JSON.stringify(data.tour) !== before) Tabs.save(data); }
  const tour = data.tour || { lost: 0, below: 0 };
  if (tour.lost !== (+t0.lost || 0)) Object.assign(turf, sceneMap(hexSpiral(Math.max(1, earned - tour.lost)), rivals).turf);
  const avg = userAvg7(data, now), pct = percentileOf(avg);
  const board = [...rivals.map(r => ({ id: r.id, avg: r.avg7 })), { id: "you", avg }].sort((a, b) => b.avg - a.avg);
  return {
    at, spot, plays, earned, held: Math.max(earned ? 1 : 0, earned - tour.lost), lost: tour.lost, below: tour.below,
    yours: hexSpiral(Math.max(earned ? 1 : 0, earned - tour.lost)), rivals, owner, turf, pressure,
    pusher: pressure.by === "scene" ? null : rivals.find(r => r.id === pressure.by),
    people, guitarists, avg, pct, rank: board.findIndex(b => b.id === "you") + 1, players: board.length,
    venue: venueOf(plays), guitaristsAt, claimCells
  };
}
/* A line about the pressure on your edge, or "" when it is safe. */
export function pressureLine(sc) {
  if (!sc.earned || sc.below <= 0) return "";
  const who = sc.pusher ? sc.pusher.name : "The local scene";
  return `${who} is pushing on your edge: ${sc.below} of 7 days. Average ${Math.ceil(sc.pressure.bar)} minutes a day to hold it.`;
}
