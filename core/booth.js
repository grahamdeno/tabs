// The Listening booth (4.90.0): what the engine makes of a take, and the take as a file.
// Graham records labelled chords and switches in the app; the takes go to the repo so the engine can be
// measured and tuned on real playing (docs/NO-CATCH-PLAN.md). Pure, so it's unit tested.
import { CHORD_FIT, chordLead, chordLeadOver, chordNotes, strumFit } from "./neck.js";

/* the chords a single-chord take is weighed against, so "called wrong" means something */
export const BOOTH_RIVALS = ["G", "C", "D", "Em", "Am", "E", "A", "F", "Dm"];
export const BOOTH_RATE = 22050; /* the engine reads nothing above 1.3 kHz */
export const BOOTH_MAX = 30; /* seconds in one take */
export const BOOTH_PLACES = ["stand", "table", "hand"];

/* One 50 ms reading. A chord take: "right" (it fits and nothing clearly fits better), "wrong" (another
   chord fits better), or null (not enough of any chord). A switch take: the chord of the two it calls, or null.
   `by` names what it heard instead, when it's wrong. */
export function boothCall(chroma, chords) {
  if (!chroma || !chords?.length) return { call: null };
  if (chords.length === 1) {
    const [c] = chords, f = strumFit(chroma, c);
    if (f === null) return { call: null };
    const rivals = BOOTH_RIVALS.filter(r => r !== c);
    const { lead, by } = chordLeadOver(chroma, c, rivals);
    if (f >= CHORD_FIT && lead > 0) return { call: "right" };
    if (f >= CHORD_FIT) return { call: "wrong", by };
    const other = rivals.find(r => (strumFit(chroma, r) ?? 0) >= CHORD_FIT && (chordLead(chroma, r, c) ?? 0) > 0);
    return other ? { call: "wrong", by: other } : { call: null };
  }
  const [a, b] = chords, fa = strumFit(chroma, a) ?? 0, fb = strumFit(chroma, b) ?? 0;
  if (Math.max(fa, fb) < CHORD_FIT) return { call: null };
  const l = chordLead(chroma, a, b);
  /* the same notes under two names (C6 and Am7) are one sound: it's the first one, the chord you're asked for */
  return { call: l === null || l > 0 ? a : b };
}

/* A take's readings, summed up. For a switch, a change counts when the call settles (3 readings in a row,
   150 ms) on the other chord. */
export function boothSummary(calls, chords) {
  const reads = calls.filter(c => c.call).length;
  if (chords.length === 1) {
    const right = calls.filter(c => c.call === "right").length, wrong = calls.filter(c => c.call === "wrong").length;
    const by = {};
    for (const c of calls) if (c.call === "wrong" && c.by) by[c.by] = (by[c.by] || 0) + 1;
    return { reads, right, wrong, by };
  }
  let held = null, run = 0, last = null, switches = 0;
  const per = Object.fromEntries(chords.map(c => [c, 0]));
  for (const c of calls) {
    if (!c.call) continue;
    per[c.call] = (per[c.call] || 0) + 1;
    run = c.call === last ? run + 1 : 1; last = c.call;
    if (run === 3 && c.call !== held) { if (held) switches++; held = c.call; }
  }
  return { reads, per, switches };
}

/* What the booth says after a take, in plain words */
export function boothSay(sum, chords) {
  if (!sum.reads) return "I didn't hear a chord in that one. Strum a little louder, closer to the phone.";
  const pc = n => `${Math.round(n / sum.reads * 100)}%`;
  if (chords.length === 1) {
    const top = Object.entries(sum.by).sort((x, y) => y[1] - x[1])[0];
    return `${chords[0]} on ${pc(sum.right)} of what I heard${sum.wrong ? `, something else on ${pc(sum.wrong)}${top ? ` (mostly ${top[0]})` : ""}` : ""}.`;
  }
  return `${sum.switches} change${sum.switches === 1 ? "" : "s"} heard. ${chords.map(c => `${c} ${pc(sum.per[c] || 0)}`).join(", ")}.`;
}

/* a chord the booth can judge: one with a known shape */
export const boothChord = name => !!chordNotes(name);

/* The take's file names in the repo: booth/<day>/<chords>-<id>.wav and .json */
export function boothPath(take) {
  const day = new Date(take.at).toISOString().slice(0, 10);
  const what = take.chords.map(c => c.replace(/#/g, "s").replace(/\//g, "-").replace(/[^\w-]/g, "")).join("-to-");
  return `booth/${day}/${what}-${take.id}`;
}
/* The label that sits beside the recording, so the measuring knows what was played. No key, nothing personal. */
export function boothLabel(take) {
  return { kind: take.chords.length === 1 ? "chord" : "switch", chords: take.chords, guitar: take.guitar || "", place: take.place || "",
    note: take.note || "", rate: take.rate, seconds: Math.round(take.seconds * 10) / 10, version: take.version, at: new Date(take.at).toISOString(), heard: take.heard || null };
}

/* Mono samples (-1..1) as a 16-bit PCM WAV file */
export function wavBytes(samples, rate) {
  const n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const text = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  text(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); text(8, "WAVE");
  text(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  text(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, samples[i] || 0)); v.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true); }
  return new Uint8Array(buf);
}
/* Fewer samples a second, averaging what falls in each new sample (enough for a low-pass this far under the cut) */
export function downsample(samples, from, to) {
  if (!(from > to)) return samples;
  const k = from / to, out = new Float32Array(Math.floor(samples.length * to / from + 1e-6));
  for (let i = 0; i < out.length; i++) { const a = Math.floor(i * k), b = Math.min(samples.length, Math.floor((i + 1) * k)); let s = 0; for (let j = a; j < b; j++) s += samples[j]; out[i] = s / Math.max(1, b - a); }
  return out;
}
/* bytes as base64, in chunks so a 1 MB take doesn't overflow the call stack */
export function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
