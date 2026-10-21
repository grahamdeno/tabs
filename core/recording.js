// The Road: core logic, Following a linked recording: sync marks, line timing from synced lyrics, measuring the preview (3.13.0 to 3.18.0).
// Re-exported from core.js, so other files import it from there.
import { isObj } from "../core.js";
import { MAJOR_PROFILE, MINOR_PROFILE, syllables } from "./sketch.js";

// ---------- Recording sync (3.13.0) ----------
// A song's marks tie places on the sheet to times in its recording: [[where, seconds]], where
// "where" is how far down the sheet (0 to 1). With no marks the whole sheet crosses in the
// recording's length; each mark bends that line, and the ends stay fixed. Both directions
// interpolate between neighbours, so marks must rise together.
const num01 = v => Number.isFinite(v);
export function cleanSyncs(list, cap = 12) {
  const out = [];
  for (const m of (Array.isArray(list) ? list : []).slice(0, Math.max(40, cap))) {
    if (!Array.isArray(m) || !num01(m[0]) || !num01(m[1]) || m[0] <= 0 || m[0] >= 1 || m[1] <= 0) continue;
    out.push([Math.round(m[0] * 1e4) / 1e4, Math.round(m[1] * 10) / 10]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out.filter((m, i) => i === 0 || m[1] > out[i - 1][1]).slice(0, cap);
}
const syncLine = (marks, len) => [[0, 0], ...cleanSyncs(marks, 400).filter(m => m[1] < len), [1, len]];
function along(pts, v, from, to) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (v <= b[from] || i === pts.length - 1) {
      const span = b[from] - a[from];
      return span > 0 ? a[to] + (Math.min(Math.max(v, a[from]), b[from]) - a[from]) / span * (b[to] - a[to]) : a[to];
    }
  }
  return 0;
}
/* seconds into the recording for a place on the sheet, and back */
export const syncSeconds = (marks, where, len) => along(syncLine(marks, len), Math.min(1, Math.max(0, where)), 0, 1);
export const syncWhere = (marks, sec, len) => along(syncLine(marks, len), Math.min(len, Math.max(0, sec)), 1, 0);
/* a new mark replaces any close to it, and drops the ones that would cross it */
export function addSync(marks, where, sec, len) {
  if (!(len > 0) || where <= 0.01 || where >= 0.99 || sec <= 1 || sec >= len - 1) return cleanSyncs(marks);
  const keep = cleanSyncs(marks).filter(m => Math.abs(m[0] - where) > 0.02 && Math.abs(m[1] - sec) > 3 && (m[0] < where) === (m[1] < sec));
  return cleanSyncs([...keep, [where, sec]]);
}
/* The lines' own times (from the lyrics, 3.17.0) with your nudges on top: a nudge wins over the line
   times near it and any it would cross. */
export function mergeSyncs(auto, mine) {
  const you = cleanSyncs(mine);
  const keep = cleanSyncs(auto, 400).filter(a => you.every(m => Math.abs(m[0] - a[0]) > 0.015 && Math.abs(m[1] - a[1]) > 2 && (a[0] < m[0]) === (a[1] < m[1])));
  return cleanSyncs([...keep, ...you], 400);
}

// ---------- Line timing from synced lyrics (3.17.0) ----------
// LRCLIB's synced lyrics give each line's time in a recording. Only the times are kept: each sheet
// line that matches a timed line in order gets [line index, seconds]; the words themselves are
// compared here and dropped.
export function parseLrc(text) {
  const out = [];
  for (const row of String(text || "").split(/\r?\n/)) {
    const tags = [...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    /* enhanced LRC (3.22.0): <mm:ss.xx> before a word gives that word's own time */
    const wt = [...row.matchAll(/<(\d+):(\d+(?:\.\d+)?)>/g)].map(m => +m[1] * 60 + +m[2]);
    const words = row.replace(/\[[^\]]*\]/g, "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    if (!words) continue;
    for (const t of tags) out.push(wt.length >= 2 ? [+t[1] * 60 + +t[2], words, wt] : [+t[1] * 60 + +t[2], words]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}
/* When each word of a line starts (3.22.0): the line's own word times when the lyrics have them,
   otherwise the line's time shared out by syllables (the singing fills about 85% of the gap to the
   next line). With a tempo, each time lands on the nearest beat counted from the line's start, since
   chords change on the beat. */
export function wordTimes(words, start, end, { bpm = 0, given = null } = {}) {
  const n = words.length;
  if (!n) return [];
  let t;
  if (given?.length >= 2) t = words.map((_, k) => given[Math.min(given.length - 1, Math.round(k * (given.length - 1) / Math.max(1, n - 1)))]);
  else {
    const syl = words.map(w => Math.max(1, syllables(w))), all = syl.reduce((a, b) => a + b, 0), span = Math.max(0.5, (end - start) * 0.85);
    let acc = 0;
    t = syl.map(x => { const at = start + acc / all * span; acc += x; return at; });
  }
  if (bpm > 0) {
    const spb = 60 / bpm;
    t = t.map(x => Math.round((start + Math.round((x - start) / spb) * spb) * 100) / 100);
  }
  return t;
}
const lrcWords = t => String(t || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
function lineLike(a, b) {
  if (!a.length || !b.length) return 0;
  const B = new Set(b);
  let hit = 0;
  for (const w of new Set(a)) if (B.has(w)) hit++;
  return 2 * hit / (new Set(a).size + B.size);
}
/* sheet: [{ i, text }] in order; timed: [[seconds, text]]. The best in-order pairing (repeated
   choruses land on their own repeats), keeping pairs that share most of their words. */
export function matchLines(sheet, timed, min = 0.5) {
  const A = sheet.map(x => lrcWords(x.text)), B = timed.map(x => lrcWords(x[1]));
  const n = A.length, m = B.length;
  if (!n || !m) return [];
  const S = A.map(a => B.map(b => lineLike(a, b)));
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const s = S[i - 1][j - 1];
    D[i][j] = Math.max(D[i - 1][j], D[i][j - 1], s >= min ? D[i - 1][j - 1] + s : -1);
  }
  const out = [];
  for (let i = n, j = m; i > 0 && j > 0;) {
    const s = S[i - 1][j - 1];
    if (s >= min && D[i][j] === D[i - 1][j - 1] + s) { out.push([sheet[i - 1].i, Math.round(timed[j - 1][0] * 10) / 10, j - 1]); i--; j--; }
    else if (D[i][j] === D[i - 1][j]) i--;
    else j--;
  }
  return out.reverse();
}
/* A short fingerprint of a sheet's words, so line times are looked up again after an edit. */
export function bodyKey(body) {
  let h = 5381;
  for (const ch of String(body || "")) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
}
export function cleanTimed(t) {
  if (!isObj(t) || typeof t.h !== "string") return null;
  const out = { h: t.h.slice(0, 16) };
  if (t.none) { out.none = 1; return out; }
  if (Number.isInteger(t.id)) out.id = t.id;
  const at = [];
  for (const x of (Array.isArray(t.at) ? t.at : []).slice(0, 400)) {
    if (!Array.isArray(x) || !Number.isInteger(x[0]) || x[0] < 0 || !Number.isFinite(x[1]) || x[1] <= 0) continue;
    if (at.length && (x[0] <= at[at.length - 1][0] || x[1] <= at[at.length - 1][1])) continue;
    at.push([x[0], Math.round(x[1] * 10) / 10]);
  }
  if (!at.length) return null;
  out.at = at;
  /* word times for lines whose lyrics carry them: { "line": [seconds, ...] } */
  if (isObj(t.w)) {
    const w = {};
    for (const [k, v] of Object.entries(t.w).slice(0, 400)) {
      if (!/^\d{1,4}$/.test(k) || !Array.isArray(v)) continue;
      const ok = v.slice(0, 40).filter(Number.isFinite).map(x => Math.round(x * 100) / 100);
      if (ok.length >= 2 && ok.every((x, i) => !i || x >= ok[i - 1])) w[k] = ok;
    }
    if (Object.keys(w).length) out.w = w;
  }
  return out;
}

// ---------- Listening to the recording's preview (3.18.0) ----------
// Apple's 30-second preview isn't copy protected, so it can be measured: the tempo (how often the
// music's attacks repeat), the swing (where the off-beat eighth lands) and the key (which notes ring
// most). feelOf(samples, rate) -> { bpm, swing, key, sure } or null.
function fftInPlace(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const p = i + k, q = p + len / 2;
        const tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
/* MAJOR_PROFILE and MINOR_PROFILE (Krumhansl) are defined with the key finder further down */
const PC_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
function pearson(a, b) {
  const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length;
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? n / Math.sqrt(da * db) : 0;
}
/* the key that best fits twelve note strengths: { key: "E" | "F#m", fit } */
export function keyOfChroma(ch) {
  let best = { key: "", fit: -2 };
  for (let k = 0; k < 12; k++) {
    const rot = Array.from({ length: 12 }, (_, i) => ch[(i + k) % 12]);
    const ma = pearson(rot, MAJOR_PROFILE), mi = pearson(rot, MINOR_PROFILE);
    if (ma > best.fit) best = { key: PC_NAMES[k], fit: ma };
    if (mi > best.fit) best = { key: PC_NAMES[k] + "m", fit: mi };
  }
  return best;
}
export function feelOf(samples, rate) {
  const step = Math.max(1, Math.round(rate / 11025)), sr = rate / step;
  const n = Math.floor(samples.length / step);
  if (n < sr * 6) return null;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) { let v = 0; for (let k = 0; k < step; k++) v += samples[i * step + k] || 0; x[i] = v / step; }
  const N = 2048, hop = 256, bins = N / 2, win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  const pcOf = new Int8Array(bins).fill(-1);
  for (let b = 1; b < bins; b++) { const f = b * sr / N; if (f >= 60 && f <= 2000) pcOf[b] = ((Math.round(12 * Math.log2(f / 261.6256)) % 12) + 12) % 12; }
  const chroma = new Array(12).fill(0), flux = [];
  let prev = null;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let at = 0; at + N <= n; at += hop) {
    for (let i = 0; i < N; i++) { re[i] = x[at + i] * win[i]; im[i] = 0; }
    fftInPlace(re, im);
    const mag = new Float32Array(bins);
    let f = 0;
    for (let b = 1; b < bins; b++) {
      mag[b] = Math.log1p(1000 * Math.hypot(re[b], im[b]));
      if (prev) f += Math.max(0, mag[b] - prev[b]);
      if (pcOf[b] >= 0) chroma[pcOf[b]] += Math.hypot(re[b], im[b]);
    }
    if (prev) flux.push(f);
    prev = mag;
  }
  /* tempo: the onset curve's strongest repeat between 60 and 180 BPM, leaning toward 110 */
  const fr = sr / hop, mean = flux.reduce((a, b) => a + b, 0) / flux.length;
  const on = flux.map(v => Math.max(0, v - mean));
  const ac = lag => { let s = 0; for (let i = lag; i < on.length; i++) s += on[i] * on[i - lag]; return s / (on.length - lag); };
  const zero = ac(0) || 1;
  let best = { lag: 0, score: 0, raw: 0 };
  for (let lag = Math.floor(fr * 60 / 180); lag <= Math.ceil(fr * 60 / 60); lag++) {
    const raw = ac(lag), bpm = 60 * fr / lag, prior = Math.exp(-0.5 * (Math.log2(bpm / 110) / 0.9) ** 2);
    if (raw * prior > best.score) best = { lag, score: raw * prior, raw };
  }
  if (!best.lag) return null;
  const a = ac(best.lag - 1), b = ac(best.lag), c = ac(best.lag + 1), d = a - 2 * b + c;
  const lag = best.lag + (d < 0 ? 0.5 * (a - c) / d : 0);
  const bpm = Math.round(60 * fr / lag);
  /* swing: fold the onsets onto one beat; the downbeat is the strongest spot, and the off-beat
     eighth is the strongest spot in the middle stretch of the beat */
  const B = 24, fold = new Array(B).fill(0);
  on.forEach((v, i) => { fold[Math.floor(((i % lag) / lag) * B) % B] += v; });
  const down = fold.indexOf(Math.max(...fold));
  let off = 0, offV = -1;
  for (let k = Math.round(B * 0.4); k <= Math.round(B * 0.75); k++) { const v = fold[(down + k) % B]; if (v > offV) { offV = v; off = k; } }
  const r = off / B, swing = r < 0.56 ? "straight" : r < 0.635 ? "light" : "full";
  const k = keyOfChroma(chroma);
  return { bpm, swing, key: k.key, sure: Math.round(Math.max(0, Math.min(1, best.raw / zero)) * 100) / 100, keySure: Math.round(k.fit * 100) / 100 };
}
/* "F#m" -> { pc: 6, minor: true } */
export function keyParts(key) {
  const m = String(key || "").match(/^([A-G])([#b]?)(m?)$/);
  if (!m) return null;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  return { pc: (base + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12, minor: !!m[3] };
}
/* How many semitones the sheet's sounding key is from the recording's: 0 when they match (a key and its
   relative major or minor count as a match), else the shortest move, -5 to +6. null when unknown. */
export function keyGap(sheetKey, recKey) {
  const s = keyParts(sheetKey), r = keyParts(recKey);
  if (!s || !r) return null;
  const tonic = k => k.minor ? (k.pc + 3) % 12 : k.pc; /* compare as the major of the same notes */
  let d = ((tonic(r) - tonic(s)) % 12 + 12) % 12;
  if (d > 6) d -= 12;
  return d;
}
export function cleanFeel(f) {
  if (!isObj(f)) return null;
  const out = {};
  if (Number.isFinite(f.bpm) && f.bpm >= 40 && f.bpm <= 240) out.bpm = Math.round(f.bpm);
  if (["straight", "light", "full"].includes(f.swing)) out.swing = f.swing;
  if (keyParts(f.key)) out.key = f.key;
  for (const k of ["sure", "keySure"]) if (Number.isFinite(f[k])) out[k] = Math.round(Math.max(-1, Math.min(1, f[k])) * 100) / 100;
  if (f.none) out.none = 1;
  return Object.keys(out).length ? out : null;
}
