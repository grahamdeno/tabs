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
  return { kind: take.chords.length === 1 ? "chord" : "switch", chords: take.chords, player: take.player || "", guitar: take.guitar || "", body: take.body || "", amp: take.amp || "", list: take.list || "", voicing: take.voicing ? `${take.voicing.frets} (${take.voicing.at})` : "", place: take.place || "", strum: take.strum || "",
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
/* 4.93.1 (Graham): grouped by setup, so the phone moves and the pick goes down once each: everything on the stand
   with a pick, then the table, then the thumb. The ids stay the same, so takes already kept stay kept. */
const chordStep = (c, n) => ({ list: "main", id: `c:${c}:${n}`, chords: [c], take: n, of: 3, place: n === 3 ? "table" : "stand", strum: "pick", seconds: BOOTH_SECS.chord });
export const BOOTH_PLAN = [
  ...BOOTH_CHORDS.flatMap(c => [chordStep(c, 1), chordStep(c, 2)]),
  ...BOOTH_SWITCHES.map(([a, b]) => ({ list: "main", id: `s:${a}-${b}`, chords: [a, b], take: 1, of: 1, place: "stand", strum: "pick", seconds: BOOTH_SECS.switch })),
  ...BOOTH_CHORDS.map(c => chordStep(c, 3)),
  ...BOOTH_THUMB.map(c => ({ list: "main", id: `t:${c}`, chords: [c], take: 1, of: 1, place: "stand", strum: "thumb", seconds: BOOTH_SECS.chord })),
  { list: "main", id: "ts:G-C", chords: ["G", "C"], take: 1, of: 1, place: "stand", strum: "thumb", seconds: BOOTH_SECS.switch }
];
/* the next step not done or skipped, and how far along you are */
export function boothNext(done = [], plan = BOOTH_PLAN) {
  const d = new Set(done), i = plan.findIndex(s => !d.has(s.id));
  return { step: i < 0 ? null : plan[i], at: i < 0 ? plan.length : i, of: plan.length, left: plan.filter(s => !d.has(s.id)).length };
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
/* the setup a step needs: where the phone is and what you strum with (4.93.1: said on its own, in bold) */
export const boothSetupKey = step => `${step.place}:${step.strum}`;
export function boothSetup(step) {
  const where = step.place === "table" ? "Phone flat on the table" : "Phone on its stand";
  return `${where}, ${step.strum === "thumb" ? "thumb, no pick" : "with a pick"}`;
}
/* what changes from one setup to the next, as instructions (the first step says the whole setup) */
export function boothChange(from, to) {
  const out = [];
  if (!from || from.place !== to.place) out.push(to.place === "table" ? "Lay the phone flat on a table or desk near you." : "Put the phone on its stand, where it sits when you play.");
  if (!from || from.strum !== to.strum) out.push(to.strum === "thumb" ? "Put the pick down. Strum with your thumb from here on." : "Pick up your pick. Use it for these takes.");
  return out;
}
/* the directions for a step, in plain words */
export function boothSteps(step) {
  if (step.voicing) return `Play ${step.chords[0]} up the neck, at the ${step.voicing.at}, the shape shown. Strum it every second or two. I'll count you in and stop by myself after ${step.seconds} seconds.`;
  if (step.chords.length === 1) return `Hold ${step.chords[0]} and strum it every second or two, like you're playing a song. I'll count you in and stop by myself after ${step.seconds} seconds.`;
  return `Switch between ${step.chords[0]} and ${step.chords[1]}, back and forth, at your own pace: strum each one once or twice, then change. I'll count you in and stop after ${step.seconds} seconds.`;
}

/* ---- More chords (4.94.0, Graham: harder chords and chords up the neck), two takes each on the stand with a pick ---- */
/* `voicing`: a shape up the neck, drawn from its frets; the chord's name stays what it sounds as */
export const BOOTH_MORE_CHORDS = [
  ["F"], ["Bm"], ["B"], ["F#m"], ["Cm"], ["Gm"], ["Bb"],
  ["A7"], ["D7"], ["E7"], ["G7"], ["C7"], ["B7"],
  ["Cmaj7"], ["Fmaj7"], ["Dmaj7"], ["Am7"], ["Em7"], ["Dm7"],
  ["Dsus2"], ["Dsus4"], ["Asus2"], ["Asus4"],
  ["G", { at: "3rd fret", frets: "355433", fingers: "134211" }],
  ["C", { at: "3rd fret", frets: "x35553", fingers: "013331" }],
  ["D", { at: "5th fret", frets: "x57775", fingers: "013331" }],
  ["A", { at: "5th fret", frets: "577655", fingers: "134211" }],
  ["Am", { at: "5th fret", frets: "577555", fingers: "134111" }],
  ["Dm", { at: "5th fret", frets: "x57765", fingers: "013421" }],
  ["E", { at: "7th fret", frets: "x79997", fingers: "013331" }]
];
export const BOOTH_MORE_SWITCHES = [["F", "C"], ["Am", "F"], ["G", "Bm"], ["E7", "A"]];
const vid = v => v ? `@${v.frets}` : "";
export const BOOTH_MORE = [
  ...BOOTH_MORE_CHORDS.flatMap(([c, v]) => [1, 2].map(n => ({ list: "more", id: `m:${c}${vid(v)}:${n}`, chords: [c], take: n, of: 2, place: "stand", strum: "pick", seconds: BOOTH_SECS.chord, ...(v ? { voicing: v } : {}) }))),
  ...BOOTH_MORE_SWITCHES.map(([a, b]) => ({ list: "more", id: `ms:${a}-${b}`, chords: [a, b], take: 1, of: 1, place: "stand", strum: "pick", seconds: BOOTH_SECS.switch }))
];
export const BOOTH_LISTS = { main: { name: "Main list", plan: BOOTH_PLAN }, more: { name: "More chords", plan: BOOTH_MORE } };

/* ---- guitars (4.94.0): each guitar does the lists on its own, with its own progress ---- */
export const BOOTH_BODIES = ["acoustic", "electric"];
export const BOOTH_AMPS = ["unplugged", "clean amp"];
const cleanName = x => String(x || "").replace(/\s+/g, " ").trim().slice(0, 40);
/* the booth's saved state, tidied: guitars, the one in hand, the list, and what each guitar has done.
   Before 4.94.0 `done` was one list of ids for the one guitar named in `guitar`. */
export function boothState(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  const guitars = (Array.isArray(p.guitars) ? p.guitars : []).map(g => ({ name: cleanName(g?.name), body: BOOTH_BODIES.includes(g?.body) ? g.body : "acoustic", amp: BOOTH_AMPS.includes(g?.amp) ? g.amp : "unplugged" })).filter(g => g.name);
  const legacy = cleanName(p.guitar);
  if (legacy && !guitars.some(g => g.name === legacy)) guitars.unshift({ name: legacy, body: "acoustic", amp: "unplugged" });
  const ids = new Set([...BOOTH_PLAN, ...BOOTH_MORE].map(s => s.id)), done = {};
  if (Array.isArray(p.done)) { if (legacy) done[legacy] = p.done.filter(x => ids.has(x)); }
  else if (p.done && typeof p.done === "object") for (const [g, list] of Object.entries(p.done)) if (Array.isArray(list)) done[cleanName(g)] = [...new Set(list.filter(x => ids.has(x)))];
  const guitar = guitars.some(g => g.name === legacy) ? legacy : guitars[0]?.name || "";
  return { ...p, guitars, guitar, list: BOOTH_LISTS[p.list] ? p.list : "main", done, player: cleanName(p.player).slice(0, 30) };
}
/* add or update a guitar and make it the one in hand */
export function boothGuitar(state, g) {
  const name = cleanName(g.name);
  if (!name) return state;
  const gs = state.guitars.filter(x => x.name !== name);
  gs.push({ name, body: BOOTH_BODIES.includes(g.body) ? g.body : "acoustic", amp: g.body === "electric" && BOOTH_AMPS.includes(g.amp) ? g.amp : "unplugged" });
  return { ...state, guitars: gs, guitar: name, setup: "" };
}
/* the setup line for an electric: how it's being heard */
export const boothAmpLine = g => g?.body === "electric" ? (g.amp === "clean amp" ? "Electric through a clean amp, no distortion, no effects." : "Electric, unplugged.") : "";
