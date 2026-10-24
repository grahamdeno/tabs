// The Road: core logic, Song sketch (Sing it, Strum it: chords that hold a melody) and Add the words.
// Re-exported from core.js, so other files import it from there.
import { chordModel } from "../core.js";
import { FLAT_KEYS, SECTION_RE, isChord, isChordLine } from "./chords.js";

// ---------- Song sketch: from a sung melody to chords ----------
// Sing a line, give its words; the melody's notes give the key, chords that
// hold those notes, and where each chord falls in the words. A first draft to
// adjust, not the one right answer: a melody fits more than one set of chords.
const NOTE_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };
export const midiOfHz = hz => 69 + 12 * Math.log2(hz / 440);

// Pitch frames ({ t: seconds, hz, -1 when nothing was heard }) into notes: a
// steady pitch held at least minDur, vibrato and scoops smoothed out.
export function melodyNotes(frames, { minDur = 0.09, tol = 0.7 } = {}) {
  if (!frames.length) return [];
  const step = median(frames.slice(1).map((f, i) => f.t - frames[i].t)) || 0.02;
  const v = frames.map(f => (f.hz > 0 ? midiOfHz(f.hz) : null));
  const sm = v.map((x, i) => {
    if (x === null) return null;
    return median(v.slice(Math.max(0, i - 2), i + 3).filter(y => y !== null));
  });
  const notes = [];
  let cur = null;
  const close = () => {
    if (cur && cur.end - cur.start + step >= minDur) notes.push({ midi: Math.round(median(cur.vals)), start: cur.start, dur: cur.end - cur.start + step });
    cur = null;
  };
  frames.forEach((f, i) => {
    const m = sm[i];
    if (m === null) return close();
    if (cur && Math.abs(m - median(cur.vals)) <= tol) { cur.vals.push(m); cur.end = f.t; }
    else { close(); cur = { start: f.t, end: f.t, vals: [m] }; }
  });
  close();
  return notes;
}

// The key that best fits the notes (Krumhansl-Kessler key profiles, weighted by
// how long each note is held; the last note leans toward home).
export const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
export const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const MAJOR_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR_NAMES = ["Cm", "C#m", "Dm", "Ebm", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "Bbm", "Bm"];
export function detectKey(notes) {
  const h = new Array(12).fill(0);
  notes.forEach(n => { h[((n.midi % 12) + 12) % 12] += n.dur; });
  const last = notes[notes.length - 1];
  if (!notes.length || !h.some(Boolean)) return null;
  const corr = (p, t) => {
    const r = i => p[(i - t + 12) % 12], mx = h.reduce((a, b) => a + b) / 12, mp = p.reduce((a, b) => a + b) / 12;
    let num = 0, dx = 0, dp = 0;
    for (let i = 0; i < 12; i++) { num += (h[i] - mx) * (r(i) - mp); dx += (h[i] - mx) ** 2; dp += (r(i) - mp) ** 2; }
    return dx && dp ? num / Math.sqrt(dx * dp) : 0;
  };
  const all = [];
  for (let t = 0; t < 12; t++) {
    const home = last && ((last.midi % 12) + 12) % 12 === t ? 0.08 : 0;
    all.push({ tonic: t, minor: false, name: MAJOR_NAMES[t], score: corr(MAJOR_PROFILE, t) + home });
    all.push({ tonic: t, minor: true, name: MINOR_NAMES[t], score: corr(MINOR_PROFILE, t) + home - 0.02 });
  }
  all.sort((a, b) => b.score - a.score);
  const margin = all[0].score - all[1].score;
  return { ...all[0], margin, sure: margin > 0.05 && all[0].score > 0.5 };
}

// Chords in the key: [semitones above the tonic, minor?]. Minor keys use a
// major V (it pulls home). The order follows how often songs use them.
const MAJOR_CHORDS = [[0, false], [5, false], [7, false], [9, true], [2, true], [4, true]];
const MINOR_CHORDS = [[0, true], [8, false], [3, false], [10, false], [7, false], [5, true]];
// How naturally one chord follows another (by degree in the lists above).
const MOVE = { "0>1": 0.3, "0>2": 0.3, "0>3": 0.25, "1>2": 0.3, "1>0": 0.25, "2>0": 0.4, "2>3": 0.2, "3>1": 0.3, "3>4": 0.2, "4>2": 0.35, "5>3": 0.2, "3>2": 0.1, "1>3": 0.1, "0>4": 0.1 };
export function chordName(pc, minor, flats) { return (flats ? NOTE_FLAT : NOTE_SHARP)[((pc % 12) + 12) % 12] + (minor ? "m" : ""); }

// The chords of a key, each with its tones (pitch classes).
function keyChords(key) {
  const flats = FLAT_KEYS.has(key.name);
  return (key.minor ? MINOR_CHORDS : MAJOR_CHORDS).map(([s, m], deg) => {
    const root = (key.tonic + s) % 12;
    return { deg, root, minor: m, tones: [root, (root + (m ? 3 : 4)) % 12, (root + 7) % 12], name: chordName(root, m, flats) };
  });
}
// How much of the sung time in a stretch is spent on each pitch class; a note
// starting the stretch counts a little extra (it's where the ear lands).
function weightsIn(ns, a, b) {
  const w = new Array(12).fill(0);
  ns.forEach((n, i) => {
    const over = Math.min(b, n.start + n.dur) - Math.max(a, n.start);
    if (over > 0) w[((n.midi % 12) + 12) % 12] += over + (n.start >= a - 0.01 && (i === 0 || ns[i - 1].start < a) ? 0.15 : 0);
  });
  return w;
}
// How well a chord holds the notes: chord tones count, others count against.
function fitOf(c, w) {
  const tot = w.reduce((x, y) => x + y, 0);
  if (!tot) return 0;
  let sc = 0;
  w.forEach((x, pc) => { if (x) sc += (c.tones.includes(pc) ? 1 : -0.6) * x + (pc === c.root ? 0.2 * x : 0); });
  return sc / tot;
}
// A line cut into 1 to 4 equal parts by length.
function slotsOf(ns) {
  if (!ns.length) return [{ at: 0, w: null }];
  const t0 = ns[0].start, t1 = ns[ns.length - 1].start + ns[ns.length - 1].dur;
  const k = Math.max(1, Math.min(4, Math.round((t1 - t0) / 2)));
  return Array.from({ length: k }, (_, j) => {
    const a = t0 + (t1 - t0) * j / k, b = t0 + (t1 - t0) * (j + 1) / k;
    return { at: a, end: b, w: weightsIn(ns, a, b), lineEnd: j === k - 1 };
  });
}
const moveScore = (p, c, sameLine) => (p.deg === c.deg ? (sameLine ? 0.05 : 0.15) : MOVE[`${p.deg}>${c.deg}`] || 0);

// Rich style: a chord gains a 7th or 9th the melody sings, and the V chord
// becomes a V7 (it leads home more strongly).
const SHARE = 0.15;
export function richName(c, w, key) {
  const tot = (w || []).reduce((x, y) => x + y, 0) || 1, has = s => (w ? w[(c.root + s) % 12] / tot : 0) >= SHARE;
  const isV = c.deg === (key.minor ? 4 : 2);
  if (c.minor) return c.name + (has(10) ? "7" : "");
  if (has(11) && !isV) return c.name + "maj7";
  if (has(10) || isV) return c.name + "7";
  if (has(2)) return c.name + "add9";
  return c.name;
}

// lines: [{ notes }] (note times from the start of that line). Each part of a
// line gets the chord whose notes it holds best, with smooth moves between
// chords preferred (a Viterbi path over the whole song). style: "simple" (the
// three-note chords) or "rich". Returns, per line, [{ chord, at }] in seconds.
export function harmonize(lines, key, { style = "simple" } = {}) {
  if (!key) return lines.map(() => []);
  const cands = keyChords(key);
  const slots = lines.flatMap((ln, li) => slotsOf(ln.notes || []).map(s => ({ ...s, li })));
  const N = slots.length, C = cands.length;
  const best = slots.map(() => new Array(C).fill(-Infinity)), from = slots.map(() => new Array(C).fill(0));
  slots.forEach((s, i) => cands.forEach((c, ci) => {
    let e = (s.w ? fitOf(c, s.w) : 0) - c.deg * 0.02;
    if (i === 0 && c.deg === 0) e += 0.4;
    if (i === N - 1 && c.deg === 0) e += 0.5;
    if (s.lineEnd && (c.deg === 0 || c.deg === 2)) e += 0.1;
    if (i === 0) { best[0][ci] = e; return; }
    cands.forEach((p, pi) => {
      const v = best[i - 1][pi] + e + moveScore(p, c, s.li === slots[i - 1].li);
      if (v > best[i][ci]) { best[i][ci] = v; from[i][ci] = pi; }
    });
  }));
  let ci = best[N - 1].indexOf(Math.max(...best[N - 1]));
  const path = new Array(N);
  for (let i = N - 1; i >= 0; i--) { path[i] = ci; ci = from[i][ci]; }
  const out = lines.map(() => []);
  slots.forEach((s, i) => {
    const c = cands[path[i]], name = style === "rich" ? richName(c, s.w, key) : c.name, row = out[s.li];
    if (!row.length || row[row.length - 1].chord !== name) row.push({ chord: name, at: s.at });
  });
  return out;
}

// Chords for a stretch of melody, best fit first: how well each holds the
// notes (0 to 1) and which of its notes were sung, longest first.
export function chordFit(notes, key) {
  if (!key || !notes.length) return [];
  const a = notes[0].start, b = notes[notes.length - 1].start + notes[notes.length - 1].dur;
  const w = weightsIn(notes, a, b), flats = FLAT_KEYS.has(key.name);
  return keyChords(key).map(c => ({
    chord: c.name,
    fit: Math.max(0, Math.min(1, (fitOf(c, w) + 0.2) / 1.4)),
    holds: c.tones.filter(t => w[t] > 0).sort((x, y) => w[y] - w[x]).map(t => (flats ? NOTE_FLAT : NOTE_SHARP)[t])
  })).sort((x, y) => y.fit - x.fit);
}

// Other ways to play one line: the best few chord paths through its parts
// (each part trying its three best-fitting chords), most natural first.
export function lineOptions(notes, key, { count = 3, style = "simple" } = {}) {
  if (!key || !notes.length) return [];
  const cands = keyChords(key), slots = slotsOf(notes);
  const tops = slots.map(s => cands.map(c => ({ c, e: fitOf(c, s.w) - c.deg * 0.02 + (s.lineEnd && (c.deg === 0 || c.deg === 2) ? 0.1 : 0) })).sort((x, y) => y.e - x.e).slice(0, 3));
  let paths = [{ list: [], score: 0 }];
  tops.forEach(opts => {
    paths = paths.flatMap(p => opts.map(o => ({ list: [...p.list, o.c], score: p.score + o.e + (p.list.length ? moveScore(p.list[p.list.length - 1], o.c, true) : 0) })));
  });
  const seen = new Set(), out = [];
  for (const p of paths.sort((x, y) => y.score - x.score)) {
    const changes = [];
    p.list.forEach((c, j) => { const name = style === "rich" ? richName(c, slots[j].w, key) : c.name; if (!changes.length || changes[changes.length - 1].chord !== name) changes.push({ chord: name, at: slots[j].at }); });
    const label = changes.map(x => x.chord).join(" · ");
    if (seen.has(label)) continue;
    seen.add(label); out.push({ changes, label });
    if (out.length === count) break;
  }
  return out;
}

// Rough syllables in a word (vowel groups, a silent final e dropped).
export function syllables(word) {
  const w = String(word).toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  const n = (w.replace(/e$/, "").match(/[aeiouy]+/g) || []).length;
  return Math.max(1, n);
}

// One line as a chord line over its words. Sung notes stand in for syllables:
// a chord that changes at the k-th note of n goes over the word holding the
// matching share of the line's syllables.
// Which word each chord change falls on (an index; past the last word when
// there are more chords than words).
export function chordWords(words, notes, changes) {
  const ws = String(words || "").trim().split(/\s+/).filter(Boolean);
  const syl = ws.map(syllables), total = syl.reduce((a, b) => a + b, 0) || ws.length;
  const wordAtSyl = s => { let acc = 0; for (let i = 0; i < ws.length; i++) { acc += syl[i] || 1; if (s < acc) return i; } return ws.length - 1; };
  const at = changes.map((c, i) => {
    if (i === 0) return 0;
    let k = notes.findIndex(n => n.start >= c.at - 0.05);
    if (k < 0) k = notes.length - 1;
    return wordAtSyl(Math.floor(k * total / Math.max(1, notes.length)));
  });
  for (let i = 1; i < at.length; i++) if (at[i] <= at[i - 1]) at[i] = at[i - 1] + 1;
  return at;
}
export function chordLine(words, notes, changes) {
  const ws = String(words || "").trim().split(/\s+/).filter(Boolean);
  if (!changes.length) return ws.join(" ");
  if (!ws.length) return changes.map(c => c.chord).join("   ");
  const at = chordWords(words, notes, changes);
  const lyric = ws.join(" ");
  const starts = []; let pos = 0;
  ws.forEach(w => { starts.push(pos); pos += w.length + 1; });
  let line = "";
  changes.forEach((c, i) => {
    if (at[i] >= ws.length) { line += (line ? " " : "") + c.chord; return; } /* more chords than words: they follow */
    const col = Math.max(starts[at[i]], line.length ? line.length + 1 : 0);
    line = line.padEnd(col, " ") + c.chord;
  });
  return line + "\n" + lyric;
}

// The whole sketch as a chord sheet, its key, and the sketch itself kept with
// the song (notes as [midi, start, length], to a hundredth of a second) so its
// chords can be restyled and swapped later.
const r2 = x => Math.round(x * 100) / 100;
export const packNotes = notes => notes.map(n => [n.midi, r2(n.start), r2(n.dur)]);
export const unpackNotes = packed => (packed || []).map(([midi, start, dur]) => ({ midi, start, dur }));
export function sketchSong(lines, { style = "simple" } = {}) {
  const all = lines.flatMap(l => l.notes || []);
  const key = detectKey(all);
  const changes = harmonize(lines, key, { style });
  const body = lines.map((l, i) => chordLine(l.words, l.notes || [], changes[i])).join("\n");
  return { key: key ? key.name : "", sure: !!key?.sure, body, sketch: { v: 1, key: key ? key.name : "", style, lines: lines.map(l => ({ n: packNotes(l.notes || []) })) } };
}
// The key object for a sketch's saved key name.
export function sketchKey(name) {
  const m = /^([A-G][#b]?)(m?)$/.exec(name || "");
  if (!m) return null;
  const tonic = (m[2] ? MINOR_NAMES : MAJOR_NAMES).indexOf(name);
  const pc = tonic >= 0 ? tonic : NOTE_SHARP.indexOf(m[1]) >= 0 ? NOTE_SHARP.indexOf(m[1]) : NOTE_FLAT.indexOf(m[1]);
  return { tonic: pc, minor: !!m[2], name };
}
// The song's lines that were sung, in order (with or without words), from its
// current text, so edits to the words are kept.
export function sungLines(body, count) {
  return chordModel(body).filter(l => l.kind === "lyric" || l.kind === "chords").slice(0, count);
}
// Replace sung line k's chords (and keep its words) in the body.
export function setSungLine(body, k, chordsText) {
  const lines = String(body || "").replace(/\r\n?/g, "\n").split("\n");
  const ln = sungLines(body, k + 1)[k];
  if (!ln) return body;
  const from = ln.kind === "lyric" && ln.chordLine >= 0 ? ln.chordLine : ln.i;
  lines.splice(from, ln.i - from + 1, ...chordsText.split("\n"));
  return lines.join("\n");
}
const lineWords = ln => (ln.kind === "lyric" ? ln.text : "");
// Every sung line re-chorded in a style, keeping the current words.
export function restyle(body, sketch, style) {
  const key = sketchKey(sketch?.key);
  if (!key) return body;
  const lines = sketch.lines.map(l => ({ notes: unpackNotes(l.n) }));
  const sung = sungLines(body, lines.length);
  const changes = harmonize(lines, key, { style });
  let out = body;
  for (let k = Math.min(sung.length, lines.length) - 1; k >= 0; k--) out = setSungLine(out, k, chordLine(lineWords(sung[k]), lines[k].notes, changes[k]));
  return out;
}
// The melody under one word of sung line k: from that word to the next chord
// change (or the line's end), by the same syllable estimate used to place chords.
export function notesUnder(body, sketch, k, pos) {
  const ln = sungLines(body, k + 1)[k], notes = unpackNotes(sketch?.lines?.[k]?.n);
  if (!ln || !notes.length) return notes;
  const ws = [...String(ln.text || "").matchAll(/\S+/g)];
  if (!ws.length) return notes;
  const syl = ws.map(m => syllables(m[0]) || 1), total = syl.reduce((a, b) => a + b, 0);
  const wordAt = p => { let w = 0; ws.forEach((m, i) => { if (m.index <= p) w = i; }); return w; };
  const sylBefore = w => syl.slice(0, w).reduce((a, b) => a + b, 0);
  const w0 = wordAt(pos), nextChord = (ln.chords || []).map(c => c.pos).filter(p => p > ws[w0].index).sort((a, b) => a - b)[0];
  const w1 = nextChord === undefined ? ws.length : Math.max(w0 + 1, wordAt(nextChord));
  const i0 = Math.floor(sylBefore(w0) * notes.length / total), i1 = Math.max(i0 + 1, Math.floor(sylBefore(w1) * notes.length / total));
  return notes.slice(i0, i1);
}

// ---- While sketching: how sure the key is, its chords, and a nudge per line ----
// Key confidence as 0 to 5 bars: how far the best key leads the next one, held
// back until enough has been sung.
export function keyConfidence(notes) {
  if (notes.length < 3) return { key: null, bars: 0, state: "listening" };
  const key = detectKey(notes);
  if (!key) return { key: null, bars: 0, state: "listening" };
  let bars = Math.max(1, Math.min(5, Math.round(key.margin / 0.03) + 1));
  if (notes.length < 8) bars = Math.min(bars, 3);
  if (notes.length < 5) bars = Math.min(bars, 2);
  return { key, bars, state: bars >= 5 ? "sure" : bars >= 2 ? "getting surer" : "listening" };
}
// The key's six chords: the three major (or minor) ones first, then their partners.
export const keyFamily = key => (key ? keyChords(key).map(c => c.name) : []);
// How much of the singing is on each pitch class (shares of the total time).
export function pitchShares(notes) {
  const w = new Array(12).fill(0);
  notes.forEach(n => { w[((n.midi % 12) + 12) % 12] += n.dur; });
  const tot = w.reduce((a, b) => a + b, 0) || 1;
  return w.map(x => x / tot);
}
// A nudge for one line: where a different chord holds the melody clearly better
// than the chosen one (the chosen path also weighs smooth moves, so they can
// differ). At most one per line: the clearest.
export function lineHint(words, notes, changes, key) {
  if (!key || !notes.length || !changes.length) return null;
  const ws = String(words || "").trim().split(/\s+/).filter(Boolean);
  const at = chordWords(words, notes, changes);
  let best = null;
  changes.forEach((c, j) => {
    const end = changes[j + 1]?.at ?? Infinity, seg = notes.filter(n => n.start >= c.at - 0.01 && n.start < end);
    if (seg.length < 2) return;
    const fits = chordFit(seg, key), top = fits[0], cur = fits.find(f => f.chord === c.chord.replace(/(maj7|7|add9)$/, ""));
    const gain = top.fit - (cur ? cur.fit : 0);
    if (top.chord !== c.chord && gain >= 0.12 && (!best || gain > best.gain)) {
      const w = at[j] < ws.length ? ws.slice(at[j], at[j] + 2).join(" ") : "";
      best = { j, chord: top.chord, gain, words: w, minor: /m$/.test(top.chord) && !/m$/.test(c.chord), major: !/m$/.test(top.chord) && /m$/.test(c.chord) };
    }
  });
  return best;
}

// ---------- Add the words: a chord chart's chords over lyrics you paste ----------
// A chart (from Chord chart) has sections of chords and no words. Your pasted
// lyrics come in stanzas (blank lines between them), with or without names
// like [Chorus] or "Verse 2:". Walking the chart in order, each sung section
// takes the next stanza (one of its kind, when the stanza is named); the
// section's chords run through its lines, two to a line, looping as the song
// does. Intros, solos and outros stay as chord lines. Stanzas left over go at
// the end with their kind's chords.
const KINDS = { verse: "verse", "pre-chorus": "pre", prechorus: "pre", chorus: "chorus", refrain: "chorus", hook: "chorus", bridge: "bridge", tag: "chorus", coda: "outro", outro: "outro", ending: "outro", intro: "intro", solo: "solo", interlude: "solo", instrumental: "solo", break: "solo", riff: "intro" };
const kindOf = name => KINDS[String(name || "").toLowerCase().replace(/\s*\d+$/, "").replace(/\s+/g, "-").replace(/^pre-?chorus$/, "pre-chorus")] || "";
const SUNG = new Set(["verse", "pre", "chorus", "bridge"]);
function chartSections(body) {
  const head = [], secs = [];
  let cur = null;
  for (const line of String(body || "").split("\n")) {
    const sec = line.match(SECTION_RE);
    if (sec) { const name = (sec[1] || sec[2] || "").replace(/\s*\(x\d+\)\s*$/i, "").trim(); cur = { name, kind: kindOf(name), chords: [] }; secs.push(cur); continue; }
    if (!line.trim()) continue;
    if (cur && isChordLine(line)) cur.chords.push(...line.trim().split(/\s+/).filter(isChord));
    else if (!cur) head.push(line);
  }
  return { head, secs: secs.filter(s => s.chords.length) };
}
/* The chart of a sheet you already have, for lining it up (4.65.0): sections and the chords each plays, in
   order, with no words and no columns. Lining up a song used to send its whole sheet as "the chord chart",
   so a guessed sheet (two chords a line, the second over the middle word) told the AI where the chords went,
   and it could hand the guess straight back. */
export function chartOfSheet(body) {
  const out = [];
  let cur = null;
  for (const line of String(body || "").replace(/\r\n?/g, "\n").split("\n")) {
    const sec = line.match(SECTION_RE);
    if (sec) { cur = { name: (sec[1] || sec[2] || "").trim(), chords: [] }; out.push(cur); continue; }
    if (!line.trim()) continue;
    if (!cur) { if (/^\s*(key|capo|tuning|tempo|bpm|strum)\b/i.test(line)) out.push({ head: line.trim() }); continue; }
    if (isChordLine(line)) cur.chords.push(...line.trim().split(/\s+/).map(t => t.replace(/^\(|\)$/g, "")).filter(isChord));
    else for (const m of line.matchAll(/\[([^\]]+)\]/g)) if (isChord(m[1])) cur.chords.push(m[1]);
  }
  /* 4.65.1: one pass of each section. A guessed sheet spreads the progression two a line ("F Am G F Am G F Am"),
     and sent like that it told the AI how many chords go on each line; the chord sites should say that. */
  const pass = cs => { for (let p = 1; p < cs.length; p++) if (cs.every((c, i) => c === cs[i % p])) return cs.slice(0, p); return cs; };
  return out.filter(x => x.head || x.chords.length).map(x => (x.head ? x.head : `[${x.name}]\n${pass(x.chords).join(" ")}`)).join("\n\n");
}
export function lyricStanzas(text) {
  const out = [];
  let cur = null;
  for (let raw of String(text || "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) { cur = null; continue; }
    const named = line.match(/^\[([^\]]+)\]$/) || line.match(/^\(?((?:intro|verse|pre-?chorus|chorus|bridge|outro|refrain|hook|tag)(?:\s*\d+)?)\)?\s*:?$/i);
    if (named) { cur = { name: named[1].replace(/\s*[x×]\s*\d+$/i, "").trim(), kind: kindOf(named[1].replace(/\s*[x×]\s*\d+$/i, "").replace(/\s*:\s*.*$/, "")), lines: [] }; out.push(cur); continue; }
    if (!cur) { cur = { name: "", kind: "", lines: [] }; out.push(cur); }
    cur.lines.push(line);
  }
  return out.filter(s => s.lines.length);
}
// One stanza under a progression: two chords a line (or one, for a one-chord
// progression), the second over the middle of the line, looping.
function stanzaLines(lines, chords) {
  const out = [];
  let at = 0;
  const per = chords.length === 1 ? 1 : 2;
  for (const line of lines) {
    const words = [...line.matchAll(/\S+/g)];
    const take = Array.from({ length: per }, () => chords[at++ % chords.length]);
    const cols = per === 1 || words.length < 2 ? [0] : [0, words[Math.floor(words.length / 2)].index];
    let row = "";
    take.slice(0, cols.length).forEach((c, i) => { row = row.padEnd(i ? Math.max(cols[i], row.length + 1) : 0, " ") + c; });
    if (cols.length < take.length) row += " " + take.slice(cols.length).join(" ");
    out.push(row, line);
  }
  return out;
}
export function mergeWords(chartBody, lyricsText) {
  const { head, secs } = chartSections(chartBody);
  const stanzas = lyricStanzas(lyricsText);
  if (!secs.length || !stanzas.length) return null;
  const out = [...head];
  if (head.length) out.push("");
  const byKind = k => secs.find(s => s.kind === k) || secs.find(s => SUNG.has(s.kind)) || secs[0];
  const left = [...stanzas];
  const emit = (name, lines) => { out.push(`[${name}]`, ...lines, ""); };
  for (const sec of secs) {
    if (!SUNG.has(sec.kind) && sec.kind) { emit(sec.name, [sec.chords.join("   ")]); continue; }
    const i = left.findIndex(st => !st.kind || st.kind === sec.kind);
    if (i < 0) continue;
    /* An unnamed stanza takes the next sung section; a named one waits for its kind. */
    if (left[i].kind === "" || i === 0 || left.slice(0, i).every(st => st.kind && st.kind !== sec.kind)) {
      const st = left.splice(i, 1)[0];
      emit(st.name || sec.name, stanzaLines(st.lines, sec.chords));
    }
  }
  for (const st of left) { const sec = byKind(st.kind); emit(st.name || sec.name, stanzaLines(st.lines, sec.chords)); }
  return out.join("\n").trim();
}

// ---------- Chords where the chord sites have them (4.41.0) ----------
// The AI reads the song's lyrics and the chord sites, and answers with positions only: for each numbered
// line, the chords that start on it as [word number, chord] (0 before the first word). It never writes
// the lyrics back; the phone builds the sheet here. numberLyrics gives the AI its numbered lines.
const wordsOf = line => [...String(line).matchAll(/\S+/g)].map(m => ({ at: m.index, w: m[0] }));
export function numberLyrics(text) {
  const stanzas = lyricStanzas(text), lines = [];
  stanzas.forEach((st, si) => st.lines.forEach(t => lines.push({ n: lines.length + 1, s: si + 1, text: t, words: wordsOf(t) })));
  const prompt = stanzas.map((st, si) => `Stanza ${si + 1}${st.name ? ` (${st.name})` : ""}\n` + lines.filter(l => l.s === si + 1)
    .map(l => `${l.n}| ${l.words.map((x, i) => `[${i + 1}]${x.w}`).join(" ")}`).join("\n")).join("\n\n");
  return { stanzas, lines, prompt };
}
/* The chart's own chord names (4.49.6): a chord the chart doesn't use is put back to the chart's chord
   with the same root and quality (D/F# to D, Dsus4 to D when only D is there) or dropped, so the
   placing step can't swap in chords the chart didn't pick. With no chart chords, anything goes. */
export function chartChord(name, allowed) {
  if (!allowed?.size || allowed.has(name)) return name;
  const bare = name.replace(/\/.*$/, "");
  if (allowed.has(bare)) return bare;
  const root = (bare.match(/^[A-G][#b]?m?(?!aj)/) || [""])[0];
  return root && allowed.has(root) ? root : "";
}
/* the AI's answer, checked: chords must be chords (the chart's), lines and stanzas must exist, words are
   clamped. Word 0 is before the singing and the word after the last is after it (4.49.6). A sung part may
   be part of a stanza (from and to, line numbers inside it), so a Pre-Chorus can be cut from its Chorus. */
export function cleanPlaced(j, num, allowed = null) {
  if (!j || typeof j !== "object" || j.found === false) return null;
  const byN = new Map(num.lines.map(l => [l.n, l]));
  const lines = {};
  for (const x of Array.isArray(j.lines) ? j.lines : []) {
    const l = byN.get(+x?.n);
    if (!l || !Array.isArray(x.c)) continue;
    const cs = x.c.map(p => [Math.max(0, Math.min(l.words.length + 1, Math.floor(+p?.[0] || 0))), chartChord(String(p?.[1] || "").trim(), allowed)]).filter(([, c]) => isChord(c));
    if (cs.length) lines[l.n] = cs.sort((p, q) => p[0] - q[0]).slice(0, 8);
  }
  const sheet = [];
  for (const it of Array.isArray(j.sheet) ? j.sheet : []) {
    const section = String(it?.section || "").replace(/[\[\]]/g, "").trim().slice(0, 30);
    if (+it?.stanza >= 1 && +it.stanza <= num.stanzas.length) {
      const st = num.lines.filter(l => l.s === +it.stanza).map(l => l.n);
      const from = st.includes(+it.from) ? +it.from : st[0], to = st.includes(+it.to) && +it.to >= from ? +it.to : st[st.length - 1];
      sheet.push({ section, stanza: +it.stanza, ...(from !== st[0] || to !== st[st.length - 1] ? { from, to } : {}) });
    } else if (typeof it?.chords === "string") {
      const ch = it.chords.trim().split(/\s+/).map(c => chartChord(c, allowed)).filter(isChord).slice(0, 32);
      const repeat = Math.max(1, Math.min(8, Math.floor(+it.repeat || 1)));
      if (ch.length && section) sheet.push({ section, chords: ch, ...(repeat > 1 ? { repeat } : {}) });
    }
  }
  if (Object.keys(lines).length < Math.min(3, num.lines.length) || !sheet.some(x => x.stanza)) return null;
  return { lines, sheet, confidence: ["high", "medium", "low"].includes(j.confidence) ? j.confidence : "" };
}
/* One chord row over a line, and the line under it: each chord at the column of the word it starts on.
   Chords before the singing (word 0) go first and the words move right past them, so the sheet shows
   the chords played while nobody sings, the way chord sites indent the words; a chord after the last
   word (the word number past the end) sits after the words. */
function placedPair(words, text, cs) {
  const lead = cs.filter(([w]) => w === 0).map(([, c]) => c).join(" ");
  const pad = lead ? lead.length + 2 : 0;
  let row = lead;
  for (const [w, c] of cs) {
    if (w === 0) continue;
    const col = pad + (!words.length ? 0 : w > words.length ? text.length + 2 : words[w - 1].at);
    row = row.length ? row.padEnd(Math.max(col, row.length + 1), " ") + c : " ".repeat(col) + c;
  }
  return [row, " ".repeat(pad) + text];
}
export function placedSheet(chartBody, lyricsText, placed) {
  const num = numberLyrics(lyricsText);
  if (!placed || !num.lines.length) return null;
  const { head } = chartSections(chartBody);
  const out = [...head];
  if (head.length) out.push("");
  const used = new Set();
  const part = (ls, name) => {
    if (!ls.length) return;
    out.push(`[${name || num.stanzas[ls[0].s - 1].name || "Verse"}]`);
    for (const l of ls) { used.add(l.n); const cs = placed.lines[l.n]; if (cs) out.push(...placedPair(l.words, l.text, cs)); else out.push(l.text); }
    out.push("");
  };
  for (const it of placed.sheet) {
    if (it.stanza) part(num.lines.filter(x => x.s === it.stanza && (!it.from || (x.n >= it.from && x.n <= it.to))), it.section);
    /* a part with no singing played more than once is written out each time, so it takes its time on the page */
    else out.push(`[${it.section}]`, ...Array.from({ length: Math.min(4, it.repeat || 1) }, () => it.chords.join("   ")), "");
  }
  /* nothing is ever dropped: lines the AI left out go at the end, with their stanza's name */
  num.stanzas.forEach((_, i) => part(num.lines.filter(x => x.s === i + 1 && !used.has(x.n)), ""));
  return out.join("\n").trim();
}
/* How the chords were placed: 2 since 4.49.6 (chords before and after the singing, parts cut from a
   stanza). A song placed the older way is lined up once more. */
export const SPOTS_V = 2;
/* Why a song should be lined up (again): "guess" for chords spread as a guess, "old" for chords placed
   before SPOTS_V, "" otherwise. Your own edits (spots "mine") are never touched. */
export function liningDue(song) {
  if (!song || song.format === "tab") return "";
  if (song.spots === "guess" || (!song.spots && song.ai === "chart" && looksGuessed(song.body))) return "guess";
  return song.spots === "placed" && !((song.spotsV || 0) >= SPOTS_V) ? "old" : "";
}
/* The lyrics of a sheet, by section, for lining up a song you already have (chord rows left out). */
export function lyricsOfSheet(body) {
  const out = [];
  for (const line of String(body || "").split("\n")) {
    const sec = line.match(SECTION_RE);
    if (sec) { out.push("", `[${(sec[1] || sec[2] || "").trim()}]`); continue; }
    if (!line.trim()) { if (out.length && out[out.length - 1] !== "") out.push(""); continue; }
    if (isChordLine(line)) continue;
    out.push(line.trim());
  }
  return out.join("\n").replace(/\[[^\]]*\]\n(?=\n|\[|$)/g, "").trim();
}
/* Chords over the words by the old guess (two a line, the second over the middle word): most chord rows
   sit only at the start of the line or over its middle word. Such a sheet can be lined up again, and in
   the Gig its changes are never counted as misses. */
export function looksGuessed(body) {
  const rows = String(body || "").split("\n");
  let pairs = 0, guess = 0;
  for (let i = 0; i < rows.length - 1; i++) {
    if (!isChordLine(rows[i]) || !rows[i + 1].trim() || isChordLine(rows[i + 1]) || SECTION_RE.test(rows[i + 1])) continue;
    pairs++;
    const ws = wordsOf(rows[i + 1]), mid = ws.length >= 2 ? ws[Math.floor(ws.length / 2)].at : 0;
    const cols = [...rows[i].matchAll(/\S+/g)].map(m => m.index);
    if (cols.length <= 2 && cols[0] === 0 && (cols.length === 1 || Math.abs(cols[1] - mid) <= 1)) guess++;
  }
  return pairs >= 4 && guess / pairs >= 0.9;
}

// ---- Get the song ----
// LRCLIB returns many recordings of a song (album, live, covers, karaoke).
// pickVersions ranks the ones that have words: the title and artist must match;
// then the one closest to the length the chart found (within 4 seconds); with
// no length, the length most versions share (the album cut is copied most);
// studio before live, covers or karaoke unless the title asks for them; timed
// words before plain. Duplicates (same album and length) are dropped.
const normT = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\(.*?\)|\[.*?\]/g, " ").replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
const ODD = /\b(live|karaoke|cover|tribute|remix|instrumental|drumless|backing|acapella|a cappella|sped up|slowed|demo|8 ?bit|lullaby|piano version|re ?recorded)\b/;
export function pickVersions(list, { title = "", artist = "", duration = 0 } = {}) {
  const t = normT(title), a = normT(artist);
  const ok = (list || []).filter(x => x && !x.instrumental && (x.plainLyrics || "").trim()
    && (!t || normT(x.trackName).includes(t) || t.includes(normT(x.trackName)))
    && (!a || normT(x.artistName).includes(a) || a.includes(normT(x.artistName))));
  const seen = new Set(), uniq = [];
  for (const x of ok) { const k = normT(x.albumName) + "|" + Math.round(x.duration || 0); if (!seen.has(k)) { seen.add(k); uniq.push(x); } }
  const counts = {};
  ok.forEach(x => { const d = Math.round(x.duration || 0); for (let k = d - 2; k <= d + 2; k++) counts[k] = (counts[k] || 0) + 1; });
  const common = +Object.keys(counts).sort((p, q) => counts[q] - counts[p] || p - q)[0] || 0;
  const want = duration > 0 ? duration : common;
  const low = v => String(v || "").toLowerCase();
  const odd = x => !ODD.test(low(title)) && ODD.test(low(x.albumName + " " + x.trackName));
  const score = x => (Math.abs((x.duration || 0) - want) <= 4 ? 0 : 1000 + Math.abs((x.duration || 0) - want)) + (odd(x) ? 500 : 0) + (x.syncedLyrics ? 0 : 5);
  return uniq.sort((p, q) => score(p) - score(q));
}
// The chart's tempo (from chord sites) against a measured one (GetSongBPM).
// They agree within 4%, or when one counts double time. The measured tempo
// wins when they disagree; in double time the chart's count stands.
export function tempoPick(chart, measured) {
  chart = +chart || 0; measured = +measured || 0;
  const near = (p, q) => Math.abs(p - q) <= q * 0.04;
  if (!measured) return { bpm: Math.round(chart), agree: false, measured: 0, chart };
  if (!chart) return { bpm: Math.round(measured), agree: false, measured, chart };
  if (near(chart, measured)) return { bpm: Math.round(measured), agree: true, measured, chart };
  if (near(chart, measured * 2) || near(chart, measured / 2)) return { bpm: Math.round(chart), agree: true, measured, chart };
  return { bpm: Math.round(measured), agree: false, measured, chart };
}
// Beats in a bar from a time signature like "3/4" (2 to 12; 4 otherwise).
export function beatsOf(sig) {
  const n = parseInt(String(sig || "").split("/")[0], 10);
  return n >= 2 && n <= 12 ? n : 4;
}
