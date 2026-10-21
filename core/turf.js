// The Road: core logic, The Tour Map: play map, venues, your scene and its rival players.
// Re-exported from core.js, so other files import it from there.
import { DAY, dayKey, isObj } from "../core.js";
import { PRACTICE_PLAY, journalOf, playedSecs } from "./playing.js";

// ---------- Play map ----------
// Credited plays grow a territory of hexagons around your practice spot. The
// rings grow with the square root of your plays (ring k arrives at 4 k squared
// plays), and the next ring fills in a cell at a time, so every play shows.
export function territory(plays) {
  plays = Math.max(0, Math.floor(+plays || 0));
  const k = Math.floor(Math.sqrt(plays) / 2), lo = 4 * k * k, hi = 4 * (k + 1) * (k + 1);
  const extra = Math.floor((plays - lo) / (hi - lo) * 6 * (k + 1));
  return { plays, rings: k, cells: plays ? 1 + 3 * k * (k + 1) + extra : 0, nextAt: hi, toNext: hi - plays };
}
/* The first n cells of the territory as axial hex coordinates: the centre, then
   ring after ring, each starting on the same side. */
export function hexSpiral(n) {
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]], out = [[0, 0]];
  for (let k = 1; out.length < n; k++) {
    let q = -k, r = k;
    for (let i = 0; i < 6; i++) for (let j = 0; j < k; j++) { out.push([q, r]); q += dirs[i][0]; r += dirs[i][1]; }
  }
  return out.slice(0, Math.max(0, n));
}
/* A practice spot, kept no finer than about a kilometre. */
export function coarseSpot(lat, lon) {
  lat = +lat; lon = +lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };
}
/* The territory on a real map: each hexagon is HEX_M metres from centre to corner. */
export const HEX_M = 250;
/* Credited plays over all time: the journal counts one each time a song is played through. */
export const lifetimePlays = data => Object.values(journalOf(data).months).reduce((n, m) => n + (m.plays || 0) + Math.floor((m.psecs || 0) / PRACTICE_PLAY), 0);

// ---------- Venues ----------
// Each ring of the Tour Map is a bigger room. Ring k arrives at 4 k squared
// plays (territory above), so the venue is just the ring's name.
export const VENUES = ["Garage", "Open mic", "Coffeehouse", "Club", "Theater", "Arena", "Stadium", "Festival headliner"];
export const venueName = ring => VENUES[ring] || `World tour, leg ${ring - VENUES.length + 2}`;
export function venueOf(plays) {
  const t = territory(plays);
  return { ring: t.rings, name: venueName(t.rings), next: venueName(t.rings + 1), nextAt: t.nextAt, toNext: t.toNext };
}
/* The outline of a set of cells, as segments in units of one cell's corner radius
   (pointy-topped, centre of cell 0 at 0,0, y down). Edges two lit cells share are
   left out, so the territory reads as one shape. */
export function cellsOutline(cells) {
  const R3 = Math.sqrt(3), seen = new Map();
  for (const [q, r] of cells) {
    const cx = R3 * (q + r / 2), cy = 1.5 * r;
    const pts = [0, 1, 2, 3, 4, 5].map(k => { const a = Math.PI / 180 * (60 * k - 30); return [cx + Math.cos(a), cy + Math.sin(a)]; });
    for (let k = 0; k < 6; k++) {
      const a = pts[k], b = pts[(k + 1) % 6];
      const key = [a, b].map(p => p.map(v => Math.round(v * 1000)).join(",")).sort().join("|");
      seen.set(key, seen.has(key) ? null : [a, b]);
    }
  }
  return [...seen.values()].filter(Boolean);
}

// ---------- Your scene: the local guitarists and the rival players ----------
// Nobody else uses this app, so the competition is simulated, honestly and
// from real numbers where there are any:
//   people      a population estimate for each hexagon, from Natural Earth's
//               populated places: each place spreads its people in a bell around
//               its centre, on top of a thin rural floor.
//   guitarists  GUITAR_SHARE of those people (an assumption; YouGov 2022 found
//               about two in five who learned guitar still play).
//   minutes     how much local guitarists practise a day: a log-normal spread
//               around PRACTICE_MEDIAN minutes (an assumption).
//   rivals      a handful of simulated players seeded from your area, each with
//               a habit (daily, weekends, casual, new, lapsed, back again),
//               simulated day by day, with turf that grows like yours.
// A hexagon's local bar is the practice it takes to out-play most of the
// guitarists living in it; busy places take more. Your edge is held while your
// daily average keeps up with the strongest pressure on it (the local bar or a
// stronger rival next door); 7 days in a row below it and the edge is lost.
export const HEX_KM2 = 3 * Math.sqrt(3) / 2 * (HEX_M / 1000) ** 2;
export const PRACTICE_MEDIAN = 10;
export const GUITAR_SHARE = 0.06;
export const PRACTICE_SPREAD = 0.9;
export const HOLD_DAYS = 7;
const RURAL = 15; /* people per km² away from any listed place */
const DEFAULT_DENSITY = 300; /* plain ground, no spot: a typical suburb */
export function densityAt(lat, lon, places) {
  if (!Array.isArray(places) || !places.length || !Number.isFinite(lat)) return DEFAULT_DENSITY;
  const kx = 111.32 * Math.cos(lat * Math.PI / 180);
  let d = RURAL;
  for (const [plat, plon, pop] of places) {
    if (Math.abs(plat - lat) > 1.5) continue;
    const s = Math.min(40, Math.max(1.5, 0.02 * Math.sqrt(pop)));
    const dy = (plat - lat) * 111.32, dx = (plon - lon) * kx, r2 = dx * dx + dy * dy;
    if (r2 > 16 * s * s) continue;
    d += pop / (2 * Math.PI * s * s) * Math.exp(-r2 / (2 * s * s));
  }
  return d;
}
/* the inverse of the standard normal (Acklam's approximation) */
export function zOf(p) {
  p = Math.min(1 - 1e-9, Math.max(1e-9, p));
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const q = Math.min(p, 1 - p), t = Math.sqrt(-2 * Math.log(q));
  const z = q < 0.02425 ? (((((c[0] * t + c[1]) * t + c[2]) * t + c[3]) * t + c[4]) * t + c[5]) / ((((d[0] * t + d[1]) * t + d[2]) * t + d[3]) * t + 1)
    : (() => { const u = p - 0.5, r = u * u; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * u / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); })();
  return q < 0.02425 ? (p < 0.5 ? z : -z) : z;
}
const phi = z => 0.5 * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z ** 3)));
/* minutes a day it takes to hold a hexagon with n guitarists in it */
export function localBar(n) {
  const p = Math.min(0.9, 0.5 + 0.1 * Math.log10(Math.max(0, n) + 1));
  return Math.round(PRACTICE_MEDIAN * Math.exp(PRACTICE_SPREAD * zOf(p)) * 10) / 10;
}
/* the share of local guitarists you out-practise at this daily average */
export const percentileOf = minutes => minutes > 0 ? phi(Math.log(minutes / PRACTICE_MEDIAN) / PRACTICE_SPREAD) : 0;

/* A small seeded random source, so the scene is the same every time it is drawn. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function seedOf(text) { let h = 2166136261; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

const FIRST = ["Rusty", "Midnight", "Velvet", "Gravel", "Neon", "Lonesome", "Copper", "Southpaw", "Static", "Saltwater", "Back Porch", "Low E", "Whiskey", "Dusty", "Electric", "Sunday", "Broken String", "Barefoot", "Tin Roof", "Ramblin'"];
const LAST = ["Pick", "Strummer", "Drifter", "Capo", "Riff", "Kid", "Picker", "Slide", "Jangle", "Hollowbody", "Fretboard", "Troubadour", "Twang", "Busker", "Bender", "Rambler"];
/* habits: chance of playing on each weekday (Sun..Sat), and the minutes on a day played */
const HABITS = {
  daily: { days: [0.8, 0.85, 0.85, 0.85, 0.85, 0.8, 0.8], mins: 30, label: "plays most days" },
  weekend: { days: [0.85, 0.1, 0.1, 0.15, 0.2, 0.7, 0.9], mins: 45, label: "plays on weekends" },
  casual: { days: [0.4, 0.3, 0.3, 0.3, 0.3, 0.35, 0.4], mins: 15, label: "plays now and then" },
  newcomer: { days: [0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6], mins: 18, label: "new, and keen" },
  lapsed: { days: [0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6], mins: 25, label: "has gone quiet" },
  comeback: { days: [0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7], mins: 22, label: "back at it" }
};
const HABIT_MIX = ["daily", "weekend", "casual", "casual", "weekend", "newcomer", "lapsed", "daily", "comeback", "casual", "weekend", "newcomer"];
/* The rival players around a spot. Each is simulated a day at a time from
   `history` days ago to today; the same seed and day give the same result. */
export function simulateRivals({ seed, guitarists = 0, now = Date.now(), history = 60, userRings = 1 }) {
  const r = rng(seed), count = Math.max(4, Math.min(12, 4 + Math.floor(2.5 * Math.log10(guitarists + 1))));
  const today = Math.floor(now / DAY), names = new Set(), homes = [];
  const out = [];
  for (let i = 0; i < count; i++) {
    let name; do { name = `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`; } while (names.has(name)); names.add(name);
    const habit = HABIT_MIX[i % HABIT_MIX.length], h = HABITS[habit];
    const skill = Math.exp((r() - 0.5) * 0.8); /* some practise longer than others with the same habit */
    const joined = today - (habit === "newcomer" ? 3 + Math.floor(r() * 18) : 14 + Math.floor(r() * 36));
    const a0 = r(), a1 = r(), spread = r();
    const stopped = habit === "lapsed" || habit === "comeback" ? today - 10 - Math.floor(r() * 30) : null;
    const resumed = habit === "comeback" ? today - 3 - Math.floor(r() * 8) : null;
    let plays = 0, last = null; const minutes = [];
    for (let day = Math.max(joined, today - history); day <= today; day++) {
      const dr = rng(seed ^ Math.imul(i + 1, 2654435761) ^ day);
      const off = stopped !== null && day >= stopped && !(resumed !== null && day >= resumed);
      const ramp = habit === "newcomer" ? Math.min(1, 0.4 + (day - joined) / 30) : 1;
      const dow = (day + 4) % 7; /* day 0 was a Thursday */
      let m = 0;
      if (!off && dr() < h.days[dow] * ramp) m = Math.round(h.mins * skill * Math.exp((dr() - 0.5) * 0.9));
      if (m) { plays += Math.max(1, Math.round(m / 6)); last = day; }
      if (day > today - 7) minutes.push(m);
    }
    const avg7 = Math.round(minutes.reduce((a, b) => a + b, 0) / 7 * 10) / 10;
    /* home: just beyond your patch and their own reach, so turf borders rather than swallows */
    const t = territory(plays), dist = (userRings + 1) + (t.rings + 1) + Math.floor(spread * 5);
    let home = null;
    for (let tries = 0; tries < 24 && !home; tries++) {
      const ang = (a0 + tries * 0.137) * Math.PI * 2, q = Math.round(dist * Math.cos(ang)), rr = Math.round(dist * Math.sin(ang) - q / 2);
      if (homes.every(([x, y, k]) => Math.max(Math.abs(x - q), Math.abs(y - rr), Math.abs(x + y - q - rr)) >= k + t.rings + 1)) home = [q, rr];
    }
    if (!home) home = [Math.round((dist + 4) * Math.cos(a1 * 6.283)), Math.round((dist + 4) * Math.sin(a1 * 6.283))];
    homes.push([...home, t.rings]);
    out.push({ id: "r" + i, name, habit, label: h.label, home, plays, avg7, cells: t.cells, lastPlayed: last === null ? null : (today - last) });
  }
  return out;
}
/* The cells a player claims: their own spiral, centred on their home cell. */
export const claimCells = (home, n) => hexSpiral(n).map(([q, r]) => [q + home[0], r + home[1]]);
const cellKey = ([q, r]) => q + "," + r;
export const hexNeighbours = ([q, r]) => [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]].map(([a, b]) => [q + a, r + b]);
/* Who holds what: your cells are yours; each rival keeps what nobody stronger has. */
export function sceneMap(userCells, rivals) {
  const owner = new Map(userCells.map(c => [cellKey(c), "you"]));
  const turf = {};
  for (const rv of [...rivals].sort((a, b) => b.avg7 - a.avg7)) {
    turf[rv.id] = claimCells(rv.home, rv.cells).filter(c => !owner.has(cellKey(c)));
    turf[rv.id].forEach(c => owner.set(cellKey(c), rv.id));
  }
  return { owner, turf };
}
/* The pressure on your outermost cell: the local bar there, or a stronger rival
   whose turf touches it. Returns { bar, by } (by = a rival's id, or "scene"). */
export function edgePressure(edge, rivals, sceneTurf, guitaristsAt) {
  let bar = localBar(guitaristsAt(edge)), by = "scene";
  const near = new Set(hexNeighbours(edge).map(cellKey));
  for (const rv of rivals) {
    const touches = (sceneTurf[rv.id] || []).some(c => near.has(cellKey(c)) || cellKey(c) === cellKey(edge));
    if (touches && rv.avg7 > bar) { bar = rv.avg7; by = rv.id; }
  }
  return { bar, by };
}
/* Your daily average over the last 7 days. Each day counts the time recorded while a song
   scrolled, or, if more, the length of the songs played through that day (so plays from
   before time was recorded, and a song closed early, still count). */
export function userAvg7(data, now = Date.now()) {
  const days = journalOf(data, now).days || {};
  let s = 0;
  for (let i = 0; i < 7; i++) {
    const k = dayKey(now - i * DAY);
    let est = 0;
    for (const song of data.songs || []) est += (song.playLog?.days?.[k] || 0) * playedSecs(song);
    est += (data.kept?.days?.[k] || 0) * 210;
    s += Math.max(days[k] || 0, est);
  }
  return Math.round(s / 60 / 7 * 10) / 10;
}
/* Once a day: count the days your average sat below the pressure on your edge,
   and lose the edge cell after HOLD_DAYS in a row. data.tour = { lost, below, checked }. */
export function tourDay(data, pressureBar, earnedCells, now = Date.now()) {
  const t = data.tour && typeof data.tour === "object" ? data.tour : (data.tour = { lost: 0, below: 0, checked: "" });
  const today = dayKey(now);
  if (t.checked === today) return t;
  t.lost = Math.max(0, Math.min(+t.lost || 0, Math.max(0, earnedCells - 1)));
  const from = data.journal?.daysFrom; /* no edge is lost until a week of daily minutes is known */
  if (!from || from > dayKey(now - 6 * DAY)) { t.checked = today; t.below = 0; return t; }
  if (userAvg7(data, now) < pressureBar && earnedCells - t.lost > 1) {
    t.below = (+t.below || 0) + 1;
    if (t.below >= HOLD_DAYS) { t.lost++; t.below = 0; }
  } else t.below = 0;
  t.checked = today;
  return t;
}

/* The fewest credited plays that light n hexagons. */
export function playsForCells(n) {
  for (let p = n > 0 ? 1 : 0; p < 20000; p++) if (territory(p).cells >= n) return p;
  return Infinity;
}
/* The nearest rival hexagon your territory will grow into: how many more plays
   take it, whose it is, and where. null when no rival is within reach. */
export function takeoverPlan({ plays, held, lost = 0, owner, rivals }) {
  const reach = 1 + 3 * (territory(plays).rings + 5) * (territory(plays).rings + 6);
  const cells = hexSpiral(reach);
  for (let i = Math.max(0, held); i < cells.length; i++) {
    const who = owner.get(cellKey(cells[i]));
    const rival = who && who !== "you" && rivals.find(r => r.id === who);
    if (rival) return { rival, cell: cells[i], index: i, plays: Math.max(1, playsForCells(i + 1 + lost) - plays) };
  }
  return null;
}

export function cleanTour(raw) {
  if (!isObj(raw)) return null;
  return { lost: Math.max(0, Math.floor(+raw.lost || 0)), below: Math.max(0, Math.min(HOLD_DAYS, Math.floor(+raw.below || 0))), checked: /^\d{4}-\d{2}-\d{2}$/.test(raw.checked) ? raw.checked : "" };
}
