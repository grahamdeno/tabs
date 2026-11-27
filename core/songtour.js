// Song tours (5.9.0), play-along rounds (5.10.0): the Tour's neck built from one real song, learned one chord at a time.
// Re-exported from core.js, so other files import it from there.
// A song tour comes after each skill tour that has chord steps (Open chords, Chord switches), and never blocks the
// next skill tour. Its stops: a chord lesson for each chord of the song's part that you can't play yet, placed just
// before the first round that uses it; Round 1 plays the part with only its most used chord (the other bars are rests),
// one more round adds each further chord in the order it first appears, and the headline plays the whole song.
// Stored as data.songTour = { v: 1, legs: { open: { pick, song, skipped, done, solid }, ... } }. See docs/DATA.md.
import { isObj, rewardsOn } from "../core.js";
import { chordShape, parseBlocks } from "./chords.js";
import { knownChords, roadPath, sheetChords } from "./game.js";

export const TOUR_NEW = [2, 4];
const CH = /^[A-G][#b]?[A-Za-z0-9#+()-]{0,7}(\/[A-G][#b]?)?$/;
const DONE_ID = /^[a-z]:[A-Za-z0-9#:-]{1,24}$/;

/* The plain chord: no extension, no slash bass. D7, Dsus4, Dadd9 are D; Gmaj7 is G; Am7 is Am; G/B is G. */
export function plainChord(name) {
  const m = /^([A-G][#b]?)(m(?!aj))?/.exec(String(name || "").split("/")[0]);
  return m ? m[1] + (m[2] || "") : "";
}
const nameOf = text => String(text || "").split(/\s+/)[0].replace(/^\(|\)$/g, "");
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
  for (const [id, t] of Object.entries(raw.legs).slice(0, 12)) {
    if (!/^([a-z]{2,12}|t\d{1,2})$/.test(id) || !isObj(t)) continue;
    legs[id] = {
      pick: cleanPick(t.pick),
      song: typeof t.song === "string" && /^[\w.-]{1,64}$/.test(t.song) ? t.song : "",
      skipped: (Array.isArray(t.skipped) ? t.skipped : []).filter(x => typeof x === "string").slice(-40).map(x => x.slice(0, 150)),
      /* 5.10.0: the p: ids of 5.9.0 play stops mean nothing now; rounds are r:<tour>-<n> */
      done: [...new Set((Array.isArray(t.done) ? t.done : []).filter(x => typeof x === "string" && DONE_ID.test(x) && !x.startsWith("p:")))].slice(0, 40),
      ...(t.solid === true ? { solid: true } : {}),
      /* 5.18.0: a tour's own song (t1 to t4): the capo fret it is played at and whether it is the simplified version */
      ...(Number.isInteger(t.capo) && t.capo >= 0 && t.capo <= 5 ? { capo: t.capo } : {}),
      ...(t.simplified === true ? { simplified: true } : {})
    };
  }
  return Object.keys(legs).length ? { v: 1, legs } : null;
}
export const tourEntry = (data, id) => data.songTour?.legs?.[id] || null;
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
      t.skipped = [...t.skipped, pickKey(t.pick)].slice(-40); t.pick = null; t.song = ""; t.done = t.done.filter(x => !/^[rph]:/.test(x)); delete t.solid; changed = true;
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

// ---------- The part and the rounds ----------
export const PART_SECS = 45;
export const DEFAULT_BPM = 100;
/* Every chord of a sheet in playing order (repeats kept): { chord, block, sec, secName }. `block` is the line's index in
   parseBlocks (the same index the recording's line times use), `sec` the section it sits in (-1 before the first label). */
export function chordSpots(blocks) {
  const out = [];
  let sec = -1, secName = "";
  blocks.forEach((b, block) => {
    if (b.kind === "section") { sec++; secName = String(b.text || ""); return; }
    const raw = b.kind === "pair" ? (b.words || []).flatMap(w => w.parts || []).map(p => p.chord).filter(Boolean) : b.kind === "chords" ? b.items : [];
    for (const r of raw) { const chord = nameOf(r); if (chordShape(chord)) out.push({ chord, block, sec, secName, n: out.length }); }
  });
  return out;
}
const distinct = list => [...new Set(list)];
/* The chord played most often in a list of chords (the first to appear wins a tie). */
export function mostUsed(chords) {
  const n = new Map();
  for (const c of chords) n.set(c, (n.get(c) || 0) + 1);
  let best = "", top = 0;
  for (const [c, k] of n) if (k > top) { best = c; top = k; }
  return best;
}
/* The part of a song a round plays: its first chorus (a section named Chorus), else the section with the most different
   chords, else the first 8 bars when the sheet has no sections; one chord is one bar, and the part is cut to PART_SECS at
   the song's tempo. { name, bars: [slot], chords (distinct, in order), main (the most used), secs } or null. */
export function songPart(body, { bpm = DEFAULT_BPM, beats = 4 } = {}) {
  const slots = chordSpots(parseBlocks(body || ""));
  if (!slots.length) return null;
  const groups = new Map();
  for (const s of slots) if (s.sec >= 0) groups.set(s.sec, [...(groups.get(s.sec) || []), s]);
  const secs = [...groups.values()];
  let pick, name;
  const chorus = secs.find(g => /^chorus\b/i.test(g[0].secName.trim()));
  if (chorus) { pick = chorus; name = "Chorus"; }
  else if (secs.length) {
    pick = secs.reduce((a, g) => distinct(g.map(x => x.chord)).length > distinct(a.map(x => x.chord)).length ? g : a);
    name = pick[0].secName.trim() || "Verse";
  } else { pick = slots.slice(0, 8); name = "The first bars"; }
  const barSecs = beats * 60 / Math.max(30, bpm || DEFAULT_BPM), most = Math.max(2, Math.floor(PART_SECS / barSecs));
  const bars = pick.slice(0, most);
  const chords = distinct(bars.map(b => b.chord));
  return { name, bars, chords, main: mostUsed(bars.map(b => b.chord)), secs: bars.length * barSecs };
}
/* The whole song as one part, for the headline. */
export function wholeSong(body, { bpm = DEFAULT_BPM, beats = 4 } = {}) {
  const bars = chordSpots(parseBlocks(body || ""));
  if (!bars.length) return null;
  const chords = distinct(bars.map(b => b.chord));
  return { name: "The whole song", bars, chords, main: mostUsed(bars.map(b => b.chord)), secs: bars.length * beats * 60 / Math.max(30, bpm || DEFAULT_BPM) };
}
/* The chords each round plays: the most used first, then the others in the order they first appear. Round k plays the first k. */
export function roundSets(part) {
  if (!part) return [];
  const order = [part.main, ...part.chords.filter(c => c !== part.main)];
  return order.map((_, i) => order.slice(0, i + 1));
}
/* What a round is called: "Just G", "G to C", "G, C and D". */
export const roundName = chords => chords.length === 1 ? `Just ${chords[0]}` : chords.length === 2 ? `${chords[0]} to ${chords[1]}` : `${chords.slice(0, -1).join(", ")} and ${chords[chords.length - 1]}`;
/* When each chord of a sheet falls in the linked recording, in seconds, from the line times LRCLIB gave (song.timed): a
   chord takes its share of its line's time, and chords between timed lines fall in between. null when nothing is timed. */
export function slotTimes(song, slots) {
  const at = song?.timed?.at;
  if (!at?.length || !slots.length) return null;
  const when = new Map(at), order = at.map(x => x[0]).sort((a, b) => a - b), per = new Map(), seen = new Map();
  for (const s of slots) per.set(s.block, (per.get(s.block) || 0) + 1);
  const times = slots.map(s => {
    const k = seen.get(s.block) || 0; seen.set(s.block, k + 1);
    if (!when.has(s.block)) return null;
    const start = when.get(s.block), nx = order.find(i => i > s.block);
    const end = Math.min(nx !== undefined ? when.get(nx) : start + 8, start + 12);
    return start + (end - start) * k / per.get(s.block);
  });
  const known = times.map((t, i) => t != null ? i : -1).filter(i => i >= 0);
  if (!known.length) return null;
  for (let n = 0; n + 1 < known.length; n++) { const p = known[n], q = known[n + 1]; for (let i = p + 1; i < q; i++) times[i] = times[p] + (times[q] - times[p]) * (i - p) / (q - p); }
  for (let i = 1; i < times.length; i++) if (times[i] != null && times[i - 1] != null && times[i] <= times[i - 1]) times[i] = times[i - 1] + 0.05;
  return times;
}
/* One round laid out: the bars (a bar is one chord) and a strum on each beat of the bars with your chords. Times are in
   seconds from the first bar. Band time is even (the song's tempo, scaled by `rate`); with `times` (a recording's) a bar
   runs to the next chord and its strums divide it. Rests are the bars whose chord isn't in `mine`. */
export function roundPlan(bars, mine, { bpm = DEFAULT_BPM, beats = 4, rate = 1, times = null } = {}) {
  const spb = 60 / (Math.max(30, bpm || DEFAULT_BPM) * rate);
  const usable = times && bars.length && bars.every(b => Number.isFinite(times[b.n]));
  const t0 = usable ? times[bars[0].n] : 0;
  const out = bars.map((b, i) => {
    /* a lined-up recording plays at `rate` too (5.16.0, slowed YouTube), so its times stretch by 1 / rate */
    const t = usable ? (times[b.n] - t0) / rate : i * beats * spb;
    const next = i + 1 < bars.length ? (usable ? (times[bars[i + 1].n] - t0) / rate : (i + 1) * beats * spb) : t + beats * spb;
    return { i, chord: b.chord, n: b.n, mine: mine.includes(b.chord), t, dur: Math.max(0.2, next - t) };
  });
  const strums = [];
  for (const b of out) if (b.mine) for (let k = 0; k < beats; k++) strums.push({ id: strums.length, bar: b.i, k, chord: b.chord, t: b.t + k * b.dur / beats });
  const last = out[out.length - 1];
  return { spb, beats, bars: out, strums, secs: last ? last.t + last.dur : 0, recorded: !!usable, start: usable ? t0 : 0 };
}
/* Which marked strum a heard strum belongs to: the nearest one from half a beat before it to one beat after, not yet
   taken. Timing is never graded: this only says which strum to check the chord against. -1 when none is near. */
export function nearStrum(strums, t, spb, taken = new Set()) {
  let best = -1, gap = Infinity;
  for (const s of strums) {
    if (taken.has(s.id)) continue;
    const d = t - s.t;
    if (d < -0.5 * spb || d > spb) continue;
    if (Math.abs(d) < gap) { gap = Math.abs(d); best = s.id; }
  }
  return best;
}
/* Did the round pass: Louie heard at least 3 in 4 of the strums. */
export const roundPassed = (heard, total) => total > 0 && heard >= Math.ceil(total * 0.75);
/* What VoiceOver hears once per bar: the chord, or a rest, and what is next. */
export const roundSay = (bars, i, beats = 4) => bars[i] ? `${bars[i].mine ? bars[i].chord : `Rest for ${bars[i].chord}`}. ${roundNext(bars, i, 0, beats)}` : "";
/* The line under the neck: what is coming ("Next: C in 2 beats", "Rest for C, back on G in 3"). `beat` is the beat of the bar. */
export function roundNext(bars, i, beat = 0, beats = 4) {
  const b = bars[i];
  if (!b) return "";
  const left = beats - beat, nx = bars[i + 1];
  if (b.mine) {
    if (!nx) return "Last bar";
    if (nx.mine) return `Next: ${nx.chord} in ${left} beat${left === 1 ? "" : "s"}`;
    const back = bars.findIndex((x, j) => j > i && x.mine);
    return back < 0 ? `Then rest to the end` : `Next: rest for ${nx.chord}, back on ${bars[back].chord} in ${left + (back - i - 1) * beats}`;
  }
  const back = bars.findIndex((x, j) => j > i && x.mine), n = left + (back < 0 ? 0 : (back - i - 1) * beats);
  return back < 0 ? `Rest for ${b.chord} to the end` : `Rest for ${b.chord}, back on ${bars[back].chord} in ${n}`;
}

// ---------- The tour's stops ----------
/* The chords of a part or song that you can't play yet, plain, in the order they first appear. */
const unknownIn = (chords, have) => newChords(chords, have);

export function songTourStops(data, legId, now = Date.now()) {
  const t = entry(data, legId);
  if (!t?.pick) return [];
  const known = knownChords(data, now), song = (data.songs || []).find(s => s.id === t.song);
  const bpm = song?.bpm || song?.listen?.feel?.bpm || DEFAULT_BPM, beats = song?.beats || 4;
  /* before the song is in the Songbook the pick's chords stand in for it */
  const part = song ? songPart(song.body, { bpm, beats }) : t.pick.chords.length ? { name: "Chorus", bars: t.pick.chords.map((chord, n) => ({ chord, n })), chords: t.pick.chords, main: t.pick.chords[0], secs: 0 } : null;
  const whole = song ? wholeSong(song.body, { bpm, beats }) : null;
  const sets = roundSets(part), all = distinct([...(whole?.chords || []), ...t.pick.chords]);
  const finished = t.solid === true, done = id => finished || t.done.includes(id), lesson = id => !!data.skills?.done?.[id];
  const rows = [], taught = new Set();
  const teach = chords => {
    for (const c of unknownIn(chords, known)) if (!taught.has(c)) { taught.add(c); rows.push({ id: `c:${c}`, kind: "chord", chord: c, name: c, ok: finished || known.has(c) || lesson(`c:${c}`) }); }
  };
  sets.forEach((set, i) => {
    teach(set);
    rows.push({ id: `r:${legId}-${i + 1}`, kind: "round", n: i + 1, of: sets.length + 1, name: `Round ${i + 1}`, sub: roundName(set), chords: set, ok: done(`r:${legId}-${i + 1}`) });
  });
  teach(all);
  rows.push({ id: `h:${legId}`, kind: "headline", name: "Headline show", sub: "The whole song", n: sets.length + 1, of: sets.length + 1, ok: done(`h:${legId}`), chords: all, song: t.song });
  let now1 = false;
  return rows.map(({ ok, ...r }) => {
    const state = ok ? "done" : now1 ? "locked" : "now";
    if (!ok) now1 = true;
    return { ...r, state, leg: `song:${legId}`, tour: legId };
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
/* A round (or the headline) that passed: it is done; the headline makes the song Solid. Returns what happened for the show's card. */
export function tourPlayed(data, stop, now = Date.now()) {
  if (!rewardsOn(data)) return null; /* Unlock all tours (5.17.0): play it, mark nothing */
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

/* A change drill on the neck (5.16.0): two bars of each chord, then a bar each, then switching every two beats, one strum
   on each beat. Every bar is yours (no rests). The same shape as roundPlan, with each bar's own beat count. */
export function drillPlan(a, b, { bpm = 60 } = {}) {
  const spb = 60 / Math.max(30, bpm || 60), seq = [[a, 4], [a, 4], [b, 4], [b, 4], [a, 4], [b, 4], [a, 4], [b, 4], [a, 2], [b, 2], [a, 2], [b, 2]];
  const bars = [], strums = [];
  let t = 0;
  seq.forEach(([chord, n], i) => {
    bars.push({ i, chord, n: i, mine: true, t, dur: n * spb, beats: n });
    for (let k = 0; k < n; k++) strums.push({ id: strums.length, bar: i, k, chord, t: t + k * spb });
    t += n * spb;
  });
  return { spb, beats: 4, bars, strums, secs: t, recorded: false, start: 0 };
}
/* The tempos a drill steps through: from 50 BPM to the target, every 10 (the target always last). */
export const drillTempos = to => { const out = []; for (let v = 50; v < to; v += 10) out.push(v); out.push(Math.max(50, to)); return [...new Set(out)]; };
