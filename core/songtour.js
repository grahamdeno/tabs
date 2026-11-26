// Song tours (5.9.0): the Tour's neck built from one real song, learned one new chord at a time.
// Re-exported from core.js, so other files import it from there.
// A song tour comes after each skill tour that has chord steps (Open chords, Chord switches), and never blocks the
// next skill tour. Its stops: play the song now with stand-in chords, then for each new chord a chord lesson, a switch
// drill and a replay where that chord is real, then the headline: the whole song, every chord real.
// Stored as data.songTour = { v: 1, legs: { open: { pick, song, skipped, done, solid }, ... } }. See docs/DATA.md.
// The saved song is never changed: stand-ins are worked out when the sheet is drawn, only while a song tour stop plays.
import { isObj } from "../core.js";
import { chordShape } from "./chords.js";
import { knownChords, relativeOf, roadPath, sheetChords } from "./game.js";

export const TOUR_NEW = [2, 4];
const CH = /^[A-G][#b]?[A-Za-z0-9#+()-]{0,7}(\/[A-G][#b]?)?$/;
const DONE_ID = /^[a-z]:[A-Za-z0-9#:-]{1,24}$/;

/* The plain chord: no extension, no slash bass. D7, Dsus4, Dadd9 are D; Gmaj7 is G; Am7 is Am; G/B is G. */
export function plainChord(name) {
  const m = /^([A-G][#b]?)(m(?!aj))?/.exec(String(name || "").split("/")[0]);
  return m ? m[1] + (m[2] || "") : "";
}
/* The chord to play in place of `chord` ("" when it is played as written). `have` holds the chords you can play, `prev` is
   the chord played just before, `first` the one to use when nothing came before. Rules, in order: the plain chord; a minor
   you don't know becomes its relative major if you know it, a major its relative minor; otherwise the bars repeat the
   chord before them. */
export function standInFor(chord, have, prev = "", first = "") {
  if (have.has(chord)) return "";
  const base = plainChord(chord);
  if (base && have.has(base)) return base;
  const rel = base ? relativeOf(base) : "";
  if (rel && have.has(rel)) return rel;
  return prev || first || "";
}
/* A song's chords in playing order (repeats kept) with the stand-in for each: [{ chord, as }], as "" when real. */
export function standInPlan(seq, have) {
  const first = seq.find(c => have.has(c)) || [...have][0] || "";
  const out = [];
  let prev = "";
  for (const chord of seq) {
    const as = standInFor(chord, have, prev, first);
    out.push({ chord, as });
    prev = as || chord;
  }
  return out;
}
const nameOf = text => String(text || "").split(/\s+/)[0].replace(/^\(|\)$/g, "");
/* Put the stand-ins into parsed blocks (parseBlocks), each marked with the chord it replaces: a part gets `was`, a chord line
   gets `was[i]`. Works on the blocks, never on the saved song. Returns how many chords were replaced. */
export function standInBlocks(blocks, have) {
  const slots = [];
  for (const b of blocks) {
    if (b.kind === "pair") for (const w of b.words || []) for (const p of w.parts || []) { if (p.chord && chordShape(nameOf(p.chord))) slots.push({ get: () => nameOf(p.chord), set: (to, was) => { p.chord = String(p.chord).replace(nameOf(p.chord), to); p.was = was; } }); }
    else if (b.kind === "chords") b.items.forEach((it, i) => { if (chordShape(nameOf(it))) slots.push({ get: () => nameOf(b.items[i]), set: (to, was) => { b.items[i] = String(it).replace(nameOf(it), to); (b.was || (b.was = []))[i] = was; } }); });
  }
  const plan = standInPlan(slots.map(s => s.get()), have);
  let n = 0;
  plan.forEach((x, i) => { if (x.as && x.as !== x.chord) { slots[i].set(x.as, x.chord); n++; } });
  return n;
}
/* The chords a song needs that you can't play, in the order they first appear: plain chords, unique. */
export function newChords(chords, have) {
  const out = [];
  for (const c of chords) { const b = plainChord(c); if (b && !have.has(c) && !have.has(b) && !out.includes(b)) out.push(b); }
  return out;
}
/* Does a song suit a song tour: 2 to 4 new chords, all with a shape, and at least one chord you can play. */
export function tourFit(chords, have) {
  const nw = newChords(chords, have);
  const ok = nw.length >= TOUR_NEW[0] && nw.length <= TOUR_NEW[1] && nw.every(c => chordShape(c)) && chords.some(c => have.has(c) || have.has(plainChord(c)));
  return { ok, new: nw };
}
export const pickKey = p => `${String(p?.title || "").trim().toLowerCase()}|${String(p?.artist || "").trim().toLowerCase()}`;

// ---------- Stored progress ----------
const cleanPick = raw => {
  if (!isObj(raw) || typeof raw.title !== "string" || !raw.title.trim()) return null;
  const list = v => (Array.isArray(v) ? v : []).filter(c => typeof c === "string" && CH.test(c)).slice(0, 14);
  const nw = list(raw.new).slice(0, TOUR_NEW[1]);
  return { title: raw.title.slice(0, 80), artist: String(raw.artist || "").slice(0, 60), chords: list(raw.chords), new: nw };
};
export function cleanSongTour(raw) {
  if (!isObj(raw) || !isObj(raw.legs)) return null;
  const legs = {};
  for (const [id, t] of Object.entries(raw.legs).slice(0, 6)) {
    if (!/^[a-z]{2,12}$/.test(id) || !isObj(t)) continue;
    legs[id] = {
      pick: cleanPick(t.pick),
      song: typeof t.song === "string" && /^[\w.-]{1,64}$/.test(t.song) ? t.song : "",
      skipped: (Array.isArray(t.skipped) ? t.skipped : []).filter(x => typeof x === "string").slice(-40).map(x => x.slice(0, 150)),
      done: [...new Set((Array.isArray(t.done) ? t.done : []).filter(x => typeof x === "string" && DONE_ID.test(x)))].slice(0, 40),
      ...(t.solid === true ? { solid: true } : {})
    };
  }
  return Object.keys(legs).length ? { v: 1, legs } : null;
}
const entry = (data, id, make = false) => {
  const st = data.songTour || (make ? (data.songTour = { v: 1, legs: {} }) : null);
  return st ? (st.legs[id] || (make ? (st.legs[id] = { pick: null, song: "", skipped: [], done: [] }) : null)) : null;
};

/* The Songbook's pick when there is no key: a song you have, not played through yet as a tour, that suits a song tour. */
export function songbookPick(data, legId, now = Date.now()) {
  const have = knownChords(data, now), t = entry(data, legId), skip = new Set(t?.skipped || []);
  const taken = new Set(Object.values(data.songTour?.legs || {}).map(x => x.song).filter(Boolean));
  for (const s of data.songs || []) {
    if (s.format === "tab" || taken.has(s.id) || skip.has(pickKey(s))) continue;
    const fit = tourFit(sheetChords(s.body), have);
    if (fit.ok) return { song: s, pick: { title: s.title, artist: s.artist || "", chords: sheetChords(s.body).slice(0, 14), new: fit.new } };
  }
  return null;
}
/* Make sure each finished skill tour has its song tour entry: a pick from the Songbook when there is no key, a song that was
   deleted resets the tour to a new pick. Returns the leg ids that still need an AI pick. Mutates data; the caller saves. */
export function tourSeed(data, { key = false, now = Date.now() } = {}) {
  const need = [];
  let changed = false;
  for (const id of tourLegIds(roadPath(data, now).legs)) {
    let t = entry(data, id);
    if (t?.song && !(data.songs || []).some(s => s.id === t.song)) {
      t.skipped = [...t.skipped, pickKey(t.pick)].slice(-40); t.pick = null; t.song = ""; t.done = t.done.filter(x => !/^[ph]:/.test(x)); delete t.solid; changed = true;
    }
    if (t?.pick) continue;
    if (key) { if (!t) { entry(data, id, true); changed = true; } need.push(id); continue; }
    const sb = songbookPick(data, id, now);
    if (sb) { t = entry(data, id, true); t.pick = sb.pick; t.song = sb.song.id; changed = true; }
  }
  return { need, changed };
}
/* The skill tours with a song tour after them: those with chord steps that are finished. */
export function tourLegIds(legs) {
  return (legs || []).filter(l => !l.song && l.done && l.stops.some(s => s.kind === "chord" || s.kind === "switch")).map(l => l.id);
}

// ---------- The tour's stops ----------
/* The new chords the tour teaches and the stand-in set for replay k (the first k new chords are real, the rest are not). */
export const haveFor = (known, news, k) => new Set([...known].filter(c => !news.includes(c) && !news.includes(plainChord(c))).concat(news.slice(0, k)));

export function songTourStops(data, legId, now = Date.now()) {
  const t = entry(data, legId);
  if (!t?.pick) return [];
  const known = knownChords(data, now), song = (data.songs || []).find(s => s.id === t.song);
  const chords = song ? sheetChords(song.body) : t.pick.chords, news = t.pick.new;
  const done = id => t.done.includes(id), lesson = id => !!data.skills?.done?.[id];
  const rows = [{ id: `p:${legId}-0`, kind: "play", name: "Play it now", k: 0, ok: done(`p:${legId}-0`) }];
  news.forEach((c, j) => {
    const at = chords.findIndex(x => plainChord(x) === c), pick = at > 0 ? plainChord(chords[at - 1]) : plainChord(chords[at + 1] || "");
    rows.push({ id: `c:${c}`, kind: "chord", chord: c, name: c, ok: known.has(c) || lesson(`c:${c}`) });
    if (pick && pick !== c && chordShape(pick)) rows.push({ id: `s:${pick}-${c}`, kind: "switch", a: pick, b: c, to: 80, name: `${pick} to ${c}`, ok: lesson(`s:${pick}-${c}`) });
    rows.push({ id: `p:${legId}-${j + 1}`, kind: "play", name: `Play with ${c}`, k: j + 1, ok: done(`p:${legId}-${j + 1}`) });
  });
  rows.push({ id: `h:${legId}`, kind: "headline", name: "Headline show", ok: done(`h:${legId}`), chords: [...new Set(chords)], song: t.song });
  let now1 = false;
  return rows.map(({ ok, ...r }) => {
    const state = ok ? "done" : now1 ? "locked" : "now";
    if (!ok) now1 = true;
    return { ...r, state, leg: `song:${legId}`, tour: legId, ...(r.kind === "play" ? { have: [...haveFor(known, news, r.k)] } : {}) };
  });
}
/* One song tour as a leg the Road draws like any other (id song:open). A tour with no pick yet has no stops: `finding`. */
export function songTourLeg(data, legId, now = Date.now()) {
  const t = entry(data, legId);
  if (!t) return null;
  const stops = songTourStops(data, legId, now);
  return { id: `song:${legId}`, tour: legId, song: true, n: 0, name: "Song tour", note: t.pick ? `${t.pick.title}${t.pick.artist ? `, ${t.pick.artist}` : ""}` : "Louie is picking a song", stops, done: !!stops.length && stops.every(s => s.state === "done"), pick: t.pick, songId: t.song, finding: !t.pick };
}
/* The Tour as the Road draws it: the skill tours from roadPath, each finished one followed by its song tour. The song tour's
   next stop is the current one unless a merch box is waiting, and never holds the next skill tour back (its stops stay open). */
export function roadTour(data, road, now = Date.now()) {
  const ids = new Set(tourLegIds(road.legs)), legs = [];
  for (const l of road.legs) {
    legs.push(l);
    if (ids.has(l.id)) { const sl = songTourLeg(data, l.id, now); if (sl && (sl.stops.length || sl.finding)) legs.push(sl); }
  }
  let current = road.current;
  if (!current || current.kind !== "box") {
    const own = legs.find(l => l.song && l.stops.length && !l.done), at = own ? own.stops.find(s => s.state === "now") : null;
    if (at) current = at;
  }
  if (current !== road.current) {
    /* a skill stop that was the current one stays open for play */
    for (let i = 0; i < legs.length; i++) if (!legs[i].song && legs[i].stops.some(s => s === road.current)) legs[i] = { ...legs[i], stops: legs[i].stops.map(s => s === road.current ? { ...s, state: "open" } : s) };
  }
  const leg = legs.find(l => l.stops.some(s => s.id === current?.id)) || road.leg;
  return { legs, current: current === road.current ? current : legs.flatMap(l => l.stops).find(s => s.id === current.id), leg, coming: road.coming };
}

// ---------- Moving the tour on ----------
/* Take a pick for a tour: from the AI, or the Songbook. */
export function tourPicked(data, legId, pick, songId = "") {
  const t = entry(data, legId, true);
  t.pick = cleanPick(pick); t.song = songId || ""; t.done = []; delete t.solid;
  return t;
}
/* Swap: the pick goes into the skipped list and the tour waits for a new one. */
export function tourSwap(data, legId) {
  const t = entry(data, legId, true);
  if (t.pick) t.skipped = [...t.skipped, pickKey(t.pick)].slice(-40);
  t.pick = null; t.song = ""; t.done = []; delete t.solid;
  return t;
}
/* The pick's song is in the Songbook now (Get the song saved it as Learning); the new chords are the song's own. */
export function tourAttach(data, legId, song, now = Date.now()) {
  const t = entry(data, legId);
  if (!t?.pick || !song) return { ok: false };
  const fit = tourFit(sheetChords(song.body), knownChords(data, now));
  if (!fit.ok) return { ok: false, new: fit.new };
  t.song = song.id; t.pick = { ...t.pick, chords: sheetChords(song.body).slice(0, 14), new: fit.new };
  return { ok: true, new: fit.new };
}
/* Which stop of which song tour a played song counts for: the song tour's current stop when it is a play stop or the headline. */
export function tourStopFor(data, songId, now = Date.now()) {
  for (const id of Object.keys(data.songTour?.legs || {})) {
    if (data.songTour.legs[id].song !== songId) continue;
    const s = songTourStops(data, id, now).find(x => x.state === "now");
    if (s && (s.kind === "play" || s.kind === "headline")) return s;
  }
  return null;
}
/* A song tour stop played to the end: it is done; the headline makes the song Solid. Returns what happened for the show's card. */
export function tourPlayed(data, stop, now = Date.now()) {
  const t = entry(data, stop.tour);
  if (!t || t.done.includes(stop.id)) return null;
  const cur = songTourStops(data, stop.tour, now).find(x => x.state === "now");
  if (!cur || cur.id !== stop.id) return null;
  t.done = [...t.done, stop.id];
  if (stop.kind === "headline") {
    t.solid = true;
    const song = (data.songs || []).find(s => s.id === t.song);
    if (song && song.status !== "got") song.status = "solid";
  }
  return { id: stop.id, kind: stop.kind, name: stop.name, finished: stop.kind === "headline", title: t.pick?.title || "" };
}
/* The run in progress: which song tour stop is being played (the sheet draws its stand-ins while this matches the song). */
export const TOUR_RUN = { cur: null };
