// The Road: core logic, The neck: lessons, listening numbers (HEAR) and scales.
// Re-exported from core.js, so other files import it from there.
import { TUNINGS, isObj, nearestNote, noteFreq } from "../core.js";
import { chordShape } from "./chords.js";

// ---------- The neck: practice lessons (3.6.0) ----------
// A ladder of lessons. Each fret is one lesson: a chord to ring clean string by
// string, or a switch between two chords to land on the beat. The inlay after a
// group is a level check: play a real song from your library through.
// Strumming, picking and fingerstyle are on the ladder as "coming".
const SW = (a, b, to = 80) => ({ id: `s:${a}-${b}`, kind: "switch", a, b, to });
const CH = c => ({ id: `c:${c}`, kind: "chord", chord: c });
const SC = id => ({ id: `x:${id}`, kind: "scale", scale: id });
export const SKILL_LEVELS = [
  { id: "open", name: "Open chords", note: "Ring every string clean.", steps: ["G", "C", "D", "Em", "Am", "E", "A"].map(CH).concat([{ id: "k:open", kind: "check", chords: ["G", "C", "D", "Em", "Am", "E", "A"] }]) },
  { id: "switch", name: "Chord switches", note: "Land the change on the beat.", steps: [SW("G", "C"), SW("C", "D"), SW("G", "D"), SW("Em", "Am"), SW("Am", "C"), SW("D", "A"), SW("A", "E"), SW("Em", "C", 70), { id: "k:switch", kind: "check", chords: ["G", "C", "D", "Em", "Am", "E", "A"] }] },
  { id: "scales", name: "Scales", note: "Up and back down, one note at a time.", own: true, steps: ["Ampent", "Gpent", "Cmajor", "Aminor", "Ablues"].map(SC) },
  { id: "strum", name: "Strumming", note: "Down, up, and keeping time.", soon: true, steps: [] },
  { id: "pick", name: "Picking", note: "One string at a time.", soon: true, steps: [] },
  { id: "finger", name: "Fingerstyle and barre", note: "The big shapes.", soon: true, steps: [] }
];
/* Practice mode (3.21.0): on for a song you're learning unless you turned it off, or when you turned it on. */
export const practicing = song => song?.practice?.on ?? song?.status === "learning";
export const practiceRate = song => practicing(song) ? Math.min(1, Math.max(0.5, song.practice?.rate || 1)) : 1;

// ---------- Scales (3.21.0) ----------
// Five scales a guitarist uses most, in the order they pay off: the minor pentatonic box for lead
// and blues, the open major pentatonic, the open C major scale, the A natural minor, and the blues
// scale (the pentatonic plus the flat five). Each is [string, fret] pairs going up (string 0 is the
// low E). A lesson plays them up and back down; each note is heard before the next is asked for.
export const SCALES = {
  Ampent: { short: "Am pent", name: "A minor pentatonic", where: "Box one at the 5th fret", tip: "Index finger on fret 5, ring or pinky on 7 and 8.", notes: [[0, 5], [0, 8], [1, 5], [1, 7], [2, 5], [2, 7], [3, 5], [3, 7], [4, 5], [4, 8], [5, 5], [5, 8]] },
  Gpent: { short: "G pent", name: "G major pentatonic", where: "Open position", tip: "Open strings and frets 2 and 3: the sound of country and folk.", notes: [[0, 0], [0, 3], [1, 0], [1, 2], [2, 0], [2, 2], [3, 0], [3, 2], [4, 0], [4, 3], [5, 0], [5, 3]] },
  Cmajor: { short: "C major", name: "C major scale", where: "Open position, one octave", tip: "Do re mi: the scale every melody is measured against.", notes: [[1, 3], [2, 0], [2, 2], [2, 3], [3, 0], [3, 2], [4, 0], [4, 1]] },
  Aminor: { short: "A minor", name: "A natural minor", where: "5th position, one octave", tip: "The sad sister of C major: same notes, starting on A.", notes: [[0, 5], [0, 7], [0, 8], [1, 5], [1, 7], [1, 8], [2, 5], [2, 7]] },
  Ablues: { short: "A blues", name: "A blues scale", where: "Box one at the 5th fret", tip: "The minor pentatonic plus the flat five, the blue note.", notes: [[0, 5], [0, 8], [1, 5], [1, 6], [1, 7], [2, 5], [2, 7], [3, 5], [3, 7], [3, 8], [4, 5], [4, 8], [5, 5], [5, 8]] }
};
/* A scale lesson's notes in playing order (up, then back down): { i, fret, hz, note, openHz }. */
export function scaleTargets(id, a4 = 440) {
  const sc = SCALES[id];
  if (!sc) return [];
  const open = TUNINGS.standard.notes;
  const up = sc.notes.map(([i, fret]) => {
    const openHz = noteFreq(open[i], a4), hz = openHz * 2 ** (fret / 12), nn = nearestNote(hz, a4);
    return { i, fret, hz, openHz, note: nn.name, octave: nn.octave };
  });
  return up.concat(up.slice(0, -1).reverse());
}

export const cleanSkills = raw => {
  if (!isObj(raw)) return null;
  const done = {};
  for (const [id, x] of Object.entries(isObj(raw.done) ? raw.done : {}).slice(0, 200)) {
    if (!/^[a-z]:[A-Za-z0-9#-]{1,12}$/.test(id) || !isObj(x)) continue;
    done[id] = { n: Math.max(1, Math.min(9999, Math.floor(+x.n || 1))), best: Math.max(0, Math.min(300, Math.floor(+x.best || 0))), at: Math.max(0, Math.floor(+x.at || 0)) };
  }
  const last = Math.max(0, Math.floor(+raw.last || 0));
  return Object.keys(done).length || last ? { done, last } : null;
};
/* Where every lesson stands. A chord you have already played in songs five times counts as known. */
export function skillState(data, now = Date.now()) {
  const done = data.skills?.done || {}, chords = data.journal?.chords || {};
  const known = st => st.kind === "chord" && (chords[st.chord]?.n || 0) >= 5;
  const songFor = st => (data.songs || []).filter(sg => { const c = songChordNames(sg.body); return c.length >= 2 && c.every(n => st.chords.includes(n)); }).sort((a, b) => (b.playLog?.last || 0) - (a.playLog?.last || 0))[0] || null;
  let cur = null, prevAt = 0;
  const levels = SKILL_LEVELS.map(lv => {
    /* Scales are their own track (3.21.0): open from the start, one after another. */
    if (lv.own) {
      let mine = null;
      return { ...lv, steps: lv.steps.map(st => {
        const state = done[st.id] ? "done" : mine ? "locked" : "now";
        if (state === "now") mine = st;
        return { ...st, state, name: SCALES[st.scale]?.short || st.scale, n: done[st.id]?.n || 0, best: 0 };
      }) };
    }
    return { ...lv, steps: lv.steps.map(st => {
    let state;
    if (st.kind === "check") {
      const sg = songFor(st), ok = done[st.id] || (sg && (sg.playLog?.last || 0) > prevAt && !cur);
      state = ok ? "done" : cur ? "locked" : "now";
      if (state === "now") cur = cur || { ...st, state, level: lv.id };
      return { ...st, state, song: sg ? sg.id : "", name: "Level check" };
    }
    state = done[st.id] ? "done" : known(st) ? "done" : cur ? "locked" : "now";
    if (state === "now") cur = { ...st, state, level: lv.id };
    if (state === "done") prevAt = Math.max(prevAt, done[st.id]?.at || 1);
    return { ...st, state, name: st.kind === "chord" ? st.chord : `${st.a} to ${st.b}`, n: done[st.id]?.n || 0, best: done[st.id]?.best || 0 };
  }) };
  });
  const last = data.skills?.last || 0, n = new Date(now), l = new Date(last);
  const today = !!last && n.getFullYear() === l.getFullYear() && n.getMonth() === l.getMonth() && n.getDate() === l.getDate();
  return { levels, next: cur, today };
}
const songChordNames = body => { const out = []; for (const m of String(body || "").matchAll(/\[([A-G][#b]?[^\]\s/]*)(?:\/[^\]\s]*)?\]/g)) if (!out.includes(m[1])) out.push(m[1]); return out; };
/* A lesson finished (or a clean round): keep the count and the best tempo. */
export function skillDone(data, id, best = 0, now = Date.now()) {
  const sk = data.skills || (data.skills = { done: {}, last: 0 }), x = sk.done[id] || (sk.done[id] = { n: 0, best: 0, at: 0 });
  x.n++; x.best = Math.max(x.best, Math.floor(best) || 0); x.at = now; sk.last = now;
}
/* What each string should sound like for a chord: a frequency, or null for a string left out. */
export function chordTargets(name, tuning = "standard", a4 = 440) {
  const sh = chordShape(name), notes = (TUNINGS[tuning] || TUNINGS.standard).notes;
  if (!sh) return null;
  return sh.frets.map((f, i) => {
    if (f < 0) return { i, hz: 0 };
    const hz = noteFreq(notes[i], a4) * 2 ** (f / 12);
    return { i, hz, fret: f, note: nearestNote(hz, a4).name, openHz: noteFreq(notes[i], a4) };
  });
}
/* How the neck listens. One set of numbers for the lessons and for What I hear, so a
   reading taken on What I hear says exactly what a lesson would do with it. Like the
   tuner, every line sits a little above the room's own noise (the floor), so a guitar
   at playing distance is heard on a phone whose microphone picks up very little
   (3.8.1: fixed lines missed nearly everything on Graham's iPhone).
   clarity    how clear a pitch must be (lower is stricter; the tuner's 0.4)
   pitchX     a pitch is tried on sounds this many times the floor (kept 0.0007 to 0.01)
   buzzX      a sound this many times the floor with no clear pitch is buzzy or muted
   strumX     a strum is this many times the floor at the least (and 0.004 at the least)
   overBleed  and this many times louder than the drums in the mic
   rise       and this many times louder than the quietest moment in the last 80 ms
   gap        seconds between two strums at the least */
export const HEAR = { clarity: 0.4, pitchX: 2, buzzX: 10, strumX: 6, overBleed: 1.5, rise: 1.6, gap: 0.18 };
/* The room's noise: drifts down quickly and up slowly, so a ringing string never counts as background (the tuner's rule).
   Moments of digital silence (an iPhone sends some) are skipped, or the floor sinks to nothing (3.8.3). */
export const trackFloor = (floor, lvl) => lvl < 0.00002 ? floor : floor == null ? Math.min(lvl, 0.004) : lvl < floor ? floor * 0.7 + lvl * 0.3 : floor * 0.995 + Math.min(lvl, floor * 3) * 0.005;
/* How the beat leaks into the microphone, moment by moment after each hit (10 ms steps, half a second),
   kept apart for the 1 and the other beats. Measured during a quiet bar; the strum line rises only
   where the beat is, so between hits a strum counts as it would with no beat at all (3.8.3). */
export function bleedProfile() {
  const bins = { one: new Float32Array(50), rest: new Float32Array(50) };
  const at = (since, one) => {
    if (!(since >= 0) || since >= 0.5) return 0;
    const b = bins[one ? "one" : "rest"], i = Math.floor(since / 0.01);
    return Math.max(b[i], b[i - 1] || 0, b[i + 1] || 0); /* a little slack for timing jitter */
  };
  return {
    add(since, one, rms) { if (since >= 0 && since < 0.5) { const b = bins[one ? "one" : "rest"], i = Math.floor(since / 0.01); b[i] = Math.max(b[i], rms); } },
    at,
    peak: () => Math.max(...bins.one, ...bins.rest)
  };
}
export const pitchRms = (floor, h = HEAR) => Math.min(0.01, Math.max(0.0007, (floor || 0) * h.pitchX));
export const buzzRms = (floor, h = HEAR) => Math.max(0.006, (floor || 0) * h.buzzX);
export const strumLine = (floor, bleed = 0, h = HEAR) => Math.max(0.004, (floor || 0) * h.strumX, bleed * h.overBleed);
/* A strum: the level jumps above the strum line. Feed it levels in order, every 10 ms or so. */
export function strumDetector(h = HEAR) {
  const recent = [];
  let last = -Infinity, floor = null;
  const hear = (rms, now, bleed = 0) => {
    floor = trackFloor(floor, rms);
    while (recent.length && now - recent[0][0] > 0.08) recent.shift();
    const low = recent.length ? Math.min(...recent.map(r => r[1])) : rms;
    recent.push([now, rms]);
    const hit = rms > strumLine(floor, bleed, h) && rms > low * h.rise && now - last > h.gap;
    if (hit) last = now;
    return hit;
  };
  hear.floor = () => floor;
  return hear;
}
/* One string at a time, the way the tuner works: the pitch is read only near the string expected
   (range), so a note heard an octave low can't be credited to another string (3.8.4). What a
   heard pitch means for that string: "ring", "open" (the finger isn't pressing), "low", "high", or null. */
export const stringRange = t => [t.hz * 0.7, t.hz * 1.42];
export function judgeTarget(hz, t) {
  if (!(hz > 0) || !t?.hz) return null;
  const c = f => 1200 * Math.log2(hz / f);
  for (const m of [1, 2, 0.5]) {
    const x = c(t.hz) + 1200 * Math.log2(m);
    if (Math.abs(x) <= 35) return "ring";
    if (t.fret > 0 && Math.abs(c(t.openHz) + 1200 * Math.log2(m)) <= 35) return "open";
    if (Math.abs(x + 100) <= 35) return "low";
    if (Math.abs(x - 100) <= 35) return "high";
  }
  return null;
}
/* Switch drill: when you played against when the chord was due. `due` and `onsets` are in seconds;
   `spb` is seconds per beat. Early or late by more than a quarter beat is not on the beat. */
export function gradeSwitches(due, onsets, spb) {
  let on = 0, late = 0, early = 0, miss = 0;
  for (const d of due) {
    /* the strum nearest the beat counts, so the strums of a pattern around it don't (3.8.4) */
    const near = onsets.filter(o => o >= d - 0.6 * spb && o <= d + 1.2 * spb);
    const hit = near.length ? near.reduce((a, o) => Math.abs(o - d) < Math.abs(a - d) ? o : a) : undefined;
    if (hit === undefined) { miss++; continue; }
    const dt = hit - d;
    if (Math.abs(dt) <= 0.25 * spb) on++; else if (dt > 0) late++; else early++;
  }
  return { on, late, early, miss, clean: on >= Math.ceil(due.length * 0.75) };
}

// ---------- Chord test (trial on the words-first branch) ----------
// Can the phone tell which chord you're strumming? The scoring idea (right chord, in order)
// only works if it can, so this measures it first. The mic's spectrum folds into 12 pitch
// classes (a chroma); each chord has a template of its notes; a frame is "heard" when the
// chord we expect fits at least as well as any plain major or minor chord and clearly better
// than the chord before it. Close relatives count: a plain F is a hit for Fmaj7/A.
export const CHORD_HEAR = { lo: 90, hi: 2200, frames: 3, margin: 0.03, prevMargin: 0.04, minFit: 0.6, wait: 6 };
const NOTE_PC = { C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11 };
const PC_NAME = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const CHORD_PARTS = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/;

// The notes of a chord as intervals over its root, plus its bass note's pitch class (or -1).
export function chordNotes(name) {
  const m = CHORD_PARTS.exec(String(name || "").trim());
  if (!m || NOTE_PC[m[1]] == null) return null;
  const root = NOTE_PC[m[1]], q = m[2] || "";
  const minor = /^(m(?!aj)|min|-)/.test(q), dim = /dim|°/.test(q), aug = /aug|\+/.test(q);
  let iv = [0, minor || dim ? 3 : 4, dim ? 6 : aug ? 8 : 7];
  if (/sus2/.test(q)) iv[1] = 2; else if (/sus/.test(q)) iv[1] = 5;
  if (/^5$/.test(q)) iv = [0, 7];
  if (/maj7|M7|Δ/.test(q)) iv.push(11); else if (/7|9|11|13/.test(q) && !/add/.test(q)) iv.push(dim && /dim7/.test(q) ? 9 : 10);
  if (/6/.test(q) && !/\/6/.test(q)) iv.push(9);
  if (/9/.test(q)) iv.push(2);
  const bass = m[3] && NOTE_PC[m[3]] != null ? NOTE_PC[m[3]] : -1;
  return { root, iv: [...new Set(iv)], bass, minor: minor && !dim };
}

// A 12-number template: the root and fifth strongest, the third next, colour notes softer,
// a slash bass added. Normalised to length 1.
export function chordTemplate(name) {
  const c = chordNotes(name); if (!c) return null;
  const t = new Array(12).fill(0);
  c.iv.forEach((v, k) => { t[(c.root + v) % 12] += k === 0 ? 1 : v === 7 || v === 6 || v === 8 ? 0.85 : k < 3 ? 0.8 : 0.5; });
  if (c.bass >= 0) t[c.bass] += 0.6;
  const n = Math.hypot(...t);
  return t.map(v => v / n);
}

// The chord itself, or a plainer chord that still counts for it (Fmaj7/A -> F, E7 -> E, Asus4 -> A).
export function closeChords(name) {
  const c = chordNotes(name); if (!c) return [];
  const root = /^[A-G][#b]?/.exec(name)[0], out = new Set([name, name.split("/")[0]]);
  out.add(root + (c.minor ? "m" : ""));
  return [...out];
}

// Frequency data from an AnalyserNode (dB per bin) folded into 12 pitch classes, normalised.
export function chromaOf(db, rate, fftSize, h = CHORD_HEAR) {
  const ch = new Array(12).fill(0), hz = rate / fftSize;
  const lo = Math.max(1, Math.floor(h.lo / hz)), hi = Math.min(db.length - 2, Math.ceil(h.hi / hz));
  for (let b = lo; b <= hi; b++) {
    if (!(db[b] > db[b - 1] && db[b] >= db[b + 1])) continue; /* peaks only, so a smear doesn't count twice */
    const a = Math.pow(10, db[b] / 20); if (!(a > 0)) continue;
    const midi = 69 + 12 * Math.log2((b * hz) / 440);
    const near = Math.round(midi); if (Math.abs(midi - near) > 0.4) continue;
    ch[((near % 12) + 12) % 12] += Math.sqrt(a) * (1 - Math.abs(midi - near));
  }
  const n = Math.hypot(...ch);
  return n > 0 ? ch.map(v => v / n) : ch;
}

const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const PLAIN = PC_NAME.flatMap(n => [n, n + "m"]);
const PLAIN_T = new Map(PLAIN.map(n => [n, chordTemplate(n)]));

// How well each plain chord fits a chroma, best first.
export function chordGuesses(chroma, count = 3) {
  return PLAIN.map(n => ({ name: n, fit: dot(chroma, PLAIN_T.get(n)) })).sort((a, b) => b.fit - a.fit).slice(0, count);
}

// One frame: is it the chord we expect (or a close relative), rather than the one before it?
export function judgeChord(chroma, expected, previous = "", h = CHORD_HEAR) {
  const ok = closeChords(expected), prevOk = previous ? closeChords(previous) : [];
  const same = (a, b) => { const x = chordNotes(a), y = chordNotes(b); return x && y && x.root === y.root && x.minor === y.minor; };
  const fitOf = name => { const t = chordTemplate(name); return t ? dot(chroma, t) : 0; };
  const exp = Math.max(...ok.map(fitOf)), prev = prevOk.length ? Math.max(...prevOk.map(fitOf)) : 0;
  const rival = chordGuesses(chroma, 24).find(g => !ok.some(o => same(o, g.name)));
  const sharesRoot = previous && ok.some(o => prevOk.some(p => same(o, p)));
  const hit = exp >= h.minFit && exp >= (rival?.fit || 0) - h.margin && (!previous || sharesRoot || exp >= prev + h.prevMargin);
  return { hit, exp, prev, rival: rival?.name || "", rivalFit: rival?.fit || 0, stillPrev: !!previous && !sharesRoot && prev > exp };
}

// The chords to test: a song's chords in order, a chord repeated in a row only once.
export function chordRun(chords, max = 16) {
  const out = [];
  for (const c of chords) if (chordNotes(c) && c !== out[out.length - 1]) out.push(c);
  return out.slice(0, max);
}

// The summary of a test: each step is { chord, prev, heard, strumAt, heardAt, stillPrev, rivals }.
export function chordTestReport(steps) {
  const done = steps.filter(s => s.tried);
  const heard = done.filter(s => s.heard);
  const lat = heard.filter(s => s.strumAt != null).map(s => s.heardAt - s.strumAt).sort((a, b) => a - b);
  const med = lat.length ? lat[Math.floor(lat.length / 2)] : null;
  const fooled = done.filter(s => s.stillPrev >= 3).length;
  const by = {};
  for (const s of done) {
    const b = by[s.chord] || (by[s.chord] = { chord: s.chord, of: 0, heard: 0, rivals: {} });
    b.of++; if (s.heard) b.heard++;
    for (const [n, k] of Object.entries(s.rivals || {})) b.rivals[n] = (b.rivals[n] || 0) + k;
  }
  const chords = Object.values(by).map(b => ({ ...b, mixed: Object.entries(b.rivals).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([n]) => n) }));
  return { of: done.length, heard: heard.length, median: med, fooled, chords };
}
