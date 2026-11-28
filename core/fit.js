// Fitting a song to a tour (5.18.0, B2): can the song be played with the chords the tour allows, after a capo and a few
// simpler chords? Pure numbers, re-exported from core.js. Topic files must not read other files' values while loading.
// The rule (audit 4, decision 12):
//   - no root change: a simpler chord keeps its root (G/B plays as G, D6/9 as D, Am7 as Am); the only shift is the capo;
//   - the capo is at fret 5 or lower;
//   - about one bar in four: at most a quarter of the song's chords are swapped for a simpler one;
//   - the chorus has no more chords you don't know yet than the tour allows.
// A song that fits with swaps is "simplified": it plays that way, and the real chart stays one tap away.
import { CHORD_RE, chordShape, isChord, parseBlocks, transposeChord } from "./chords.js";
import { allowedChords, TOURS, stopsOf } from "./curriculum.js";
import { songPart } from "./songtour.js";

export const MAX_CAPO = 5;
export const SWAP_RATIO = 0.25;

/* The simpler chord: the root and minor only. Keeps the root. */
export function simplifyChord(name) {
  const m = CHORD_RE.exec(String(name || "").split("/")[0]);
  if (!m) return "";
  const [, root, q] = m;
  if (/^dim|^°/.test(q)) return root + "dim"; /* Bdim stays Bdim: it is not a major chord */
  return root + (/^m(?!aj)|^min/.test(q) ? "m" : "");
}
/* Tour 1's easy shapes (audit 4, decision 12): the full chord is played as an easier one. These swaps do not count against the
   one bar in four, and Tour 1 is the only tour that uses them. */
export const EASY_SWAP = { C: "Cmaj7", D: "D6/9", A: "Asus2" };
const EASY_OK = ["Em", "Em7", "Asus2", "A7", "Cmaj7", "D6/9"];
/* Every chord in the song in order, each time it is written (not unique). */
export function chordRuns(body) {
  const out = [];
  for (const b of parseBlocks(body || "")) {
    const raw = b.kind === "pair" ? b.words.flatMap(w => w.parts || []).map(p => p.chord).filter(Boolean) : b.kind === "chords" ? b.items : [];
    for (const r of raw) { const n = String(r).split(/\s+/)[0].replace(/^\(|\)$/g, ""); if (isChord(n) && chordShape(n)) out.push(n); }
  }
  return out;
}
/* One chord under a capo and a tour's set: { shape, swapped } or null when it cannot be played. A chord already in the set stays. */
function place(name, capo, allowed, easy = false) {
  const shape = transposeChord(name, -capo);
  if (allowed.has(shape)) return { shape, swapped: false };
  if (easy) { /* Tour 1: the easy shapes, free of the swap count */
    if (EASY_OK.includes(shape)) return { shape, swapped: false };
    if (EASY_SWAP[shape]) return { shape: EASY_SWAP[shape], swapped: false, easy: true };
  }
  const plain = simplifyChord(shape);
  if (plain && allowed.has(plain)) return { shape: plain, swapped: true };
  return null;
}
/* Do these chords (every one as written, in order) and the chorus's chords fit a set? Tries no capo first, then frets 1 to 5, and
   takes the first that works. opts.known: the chords you can play already (the chorus may bring in at most opts.maxNew others). */
export function fitRuns(runs, chorus, allowed, { known = null, maxNew = Infinity, easy = false } = {}) {
  const set = new Set(allowed);
  if (!runs.length) return { ok: false, why: "empty" };
  for (let capo = 0; capo <= MAX_CAPO; capo++) {
    const placed = runs.map(c => place(c, capo, set, easy));
    if (placed.some(p => !p)) continue;
    const swapped = placed.filter(p => p.swapped).length;
    if (swapped / runs.length > SWAP_RATIO) continue;
    const shapes = [...new Set(placed.map(p => p.shape))];
    const fresh = known ? [...new Set(chorus.map(c => place(c, capo, set, easy)?.shape).filter(Boolean))].filter(x => !known.has(x)) : [];
    if (known && fresh.length > maxNew) continue;
    return { ok: true, capo, swapped, total: runs.length, simplified: swapped > 0 || placed.some(p => p.easy), shapes, new: fresh };
  }
  return { ok: false, why: "no fit" };
}
export const fitSong = (body, allowed, opts = {}) => fitRuns(chordRuns(body), songPart(body)?.chords || [], allowed, opts);
/* The chords a tour allows: everything taught up to the end of its last stop. */
export const tourAllowed = n => { const last = stopsOf(`t${n}`).at(-1); return last ? allowedChords(last.id) : []; };
/* The first tour (1 to 4 here) whose chords play the song, or null. "Not yet: this opens at Tour N". */
export function opensAt(body, limit = 4) {
  for (let n = 1; n <= Math.min(limit, TOURS.length); n++) if (fitSong(body, tourAllowed(n), { easy: n === 1 }).ok) return n;
  return null;
}
/* The body written for the fit: every chord under the capo, swapped where it was simplified. The words stay. */
export function simplifyBody(body, capo, allowed, easy = false) {
  const set = new Set(allowed), fix = c => place(c, capo, set, easy)?.shape || c;
  return String(body || "").split("\n").map(line => {
    if (/\[[A-G][^\]]*\]/.test(line)) return line.replace(/\[([A-G][^\]\s]*)\]/g, (m, c) => isChord(c) ? `[${fix(c)}]` : m);
    const toks = line.trim().split(/\s+/).filter(Boolean);
    if (!toks.length || !toks.every(t => isChord(t) || /^(\||\|\||[x×]\d+|\d+[x×]|N\.?C\.?|[-–—]+|%)$/i.test(t))) return line;
    return line.replace(/\S+/g, t => isChord(t) ? fix(t) : t);
  }).join("\n");
}

/* ---------- A tour's own song ---------- */
const tourNo = id => +String(id).replace(/^t/, "") || 0;
/* The chords a tour adds, at least two: how many the chorus of its song may bring that you don't know yet. */
export const tourNewMax = n => Math.max(2, stopsOf(`t${n}`).reduce((k, s) => k + s.chords.length, 0));
/* The chords you know before a tour: what the earlier tours allowed (Tour 1: none). */
export const tourKnown = n => new Set(n > 1 ? tourAllowed(n - 1) : []);
/* Fit one song to one tour: { ok, capo, simplified, ... } or { ok: false, opens } where opens is the tour that does play it. */
export function fitTour(body, tourId) {
  const n = tourNo(tourId), r = fitSong(body, tourAllowed(n), { known: tourKnown(n), maxNew: tourNewMax(n), easy: n === 1 });
  return r.ok ? r : { ...r, opens: opensAt(body) };
}
/* The Songbook's song for a tour: a song you have, not tab, not taken by another tour, not skipped, that fits. Unsimplified first. */
export function songbookFor(data, tourId) {
  const t = data.songTour?.legs?.[tourId], skip = new Set(t?.skipped || []);
  const taken = new Set(Object.entries(data.songTour?.legs || {}).filter(([k, x]) => k !== tourId && x.song).map(([, x]) => x.song));
  let best = null;
  for (const sg of data.songs || []) {
    if (sg.format === "tab" || taken.has(sg.id) || skip.has(`${sg.title}|${sg.artist || ""}`.toLowerCase())) continue;
    const f = fitTour(sg.body, tourId);
    if (f.ok && (!best || (best.fit.simplified && !f.simplified))) best = { song: sg, fit: f };
    if (best && !best.fit.simplified) break;
  }
  return best;
}
/* The player takes a song for a tour (a pick, or one they chose): stored with the capo it needs and whether it is simplified.
   { ok: true, capo, simplified } or { ok: false, opens } ("Not yet: this opens at Tour N"). Mutates data; the caller saves. */
export function tourSetSong(data, tourId, song) {
  const f = fitTour(song.body, tourId);
  if (!f.ok) return { ok: false, opens: f.opens || null };
  const st = data.songTour || (data.songTour = { v: 1, legs: {} });
  const t = st.legs[tourId] || (st.legs[tourId] = { pick: null, song: "", skipped: [], done: [] });
  t.song = song.id; t.capo = f.capo; t.simplified = f.simplified;
  t.pick = { title: song.title, artist: song.artist || "", chords: f.shapes.slice(0, 14), new: f.new.slice(0, 4) };
  return { ok: true, capo: f.capo, simplified: f.simplified };
}
