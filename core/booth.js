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
  return { kind: take.chords.length === 1 ? "chord" : "switch", chords: take.chords, guitar: take.guitar || "", place: take.place || "", strum: take.strum || "",
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

/* ---- the guided session (4.92.0): the list Graham records, one take at a time ---- */
/* With a pick (4.92.1, Graham: a pick reads lower than a thumb, and most people strum with one): 11 chords, three
   takes each (two with the phone on its stand, one on the table), then five switches. Then a few with the thumb,
   no pick, to measure the difference. */
export const BOOTH_CHORDS = ["Am", "C", "D", "Em", "F", "G", "A", "E", "Dm", "Cadd9", "Bm"];
export const BOOTH_SWITCHES = [["G", "C"], ["C", "Am"], ["Em", "G"], ["D", "A"], ["Am", "C"]];
export const BOOTH_SECS = { chord: 10, switch: 30 };
export const BOOTH_THUMB = ["Am", "C", "G"];
export const BOOTH_STRUMS = ["pick", "thumb"];
export const BOOTH_PLAN = [
  ...BOOTH_CHORDS.flatMap(c => [1, 2, 3].map(n => ({ id: `c:${c}:${n}`, chords: [c], take: n, of: 3, place: n === 3 ? "table" : "stand", strum: "pick", seconds: BOOTH_SECS.chord }))),
  ...BOOTH_SWITCHES.map(([a, b]) => ({ id: `s:${a}-${b}`, chords: [a, b], take: 1, of: 1, place: "stand", strum: "pick", seconds: BOOTH_SECS.switch })),
  ...BOOTH_THUMB.map(c => ({ id: `t:${c}`, chords: [c], take: 1, of: 1, place: "stand", strum: "thumb", seconds: BOOTH_SECS.chord })),
  { id: "ts:G-C", chords: ["G", "C"], take: 1, of: 1, place: "stand", strum: "thumb", seconds: BOOTH_SECS.switch }
];
/* the next step not done or skipped, and how far along you are */
export function boothNext(done = []) {
  const d = new Set(done), i = BOOTH_PLAN.findIndex(s => !d.has(s.id));
  return { step: i < 0 ? null : BOOTH_PLAN[i], at: i < 0 ? BOOTH_PLAN.length : i, of: BOOTH_PLAN.length, left: BOOTH_PLAN.filter(s => !d.has(s.id)).length };
}
/* what to tell you after a take: keep it, or try again (and why) */
export function boothVerdict(sum, chords) {
  if (!sum || sum.reads < 20) return { keep: false, say: "I barely heard anything. Try again a little louder, or with the phone closer." };
  const pc = n => Math.round(n / sum.reads * 100);
  if (chords.length === 1) {
    const [c] = chords, top = Object.entries(sum.by || {}).sort((x, y) => y[1] - x[1])[0];
    if (sum.right / sum.reads >= 0.6) return { keep: true, say: `Got it. I heard ${c} on ${pc(sum.right)}% of it.` };
    if (top && top[1] > sum.right) return { keep: true, maybe: true, say: `I heard ${top[0]} more than ${c} (${c} on ${pc(sum.right)}%). That's exactly what I need to see, so I'll keep it. If you played something else by mistake, try again.` };
    return { keep: true, maybe: true, say: `I only heard ${c} on ${pc(sum.right)}% of it. I'll keep it; that helps too. Try again if the strums were soft or muted.` };
  }
  if (sum.switches < 4) return { keep: false, maybe: true, say: `I only heard ${sum.switches} change${sum.switches === 1 ? "" : "s"}. Keep going back and forth for the whole 30 seconds. Try again?` };
  return { keep: true, say: `Got it. ${sum.switches} changes heard.` };
}
/* the directions for a step, in plain words */
export function boothSteps(step) {
  const where = (step.place === "table" ? "Lay the phone flat on a table or desk near you." : "Put the phone where it sits when you play, on its stand.") + (step.strum === "thumb" ? " Put the pick down and strum with your thumb." : " Use your pick.");
  if (step.chords.length === 1) return `${where} Hold ${step.chords[0]} and strum it every second or two, like you're playing a song. I'll count you in and stop by myself after ${step.seconds} seconds.`;
  return `${where} Switch between ${step.chords[0]} and ${step.chords[1]}, back and forth, at your own pace: strum each one once or twice, then change. I'll count you in and stop after ${step.seconds} seconds.`;
}
