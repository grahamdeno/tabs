// Trumpet (4.81.0): a B♭ trumpet reads a whole step above the sound, plays one note at a time, and reads
// best in flat keys. Everything the phone needs to write a guitar song for it: the written names, a part of
// chord tones within the player's range (Long notes and Hits), the valves for each note, how hard the key is,
// the capo that makes it easy when a guitar plays along, and hearing which note is played.
import { transposeChord, transposeKey } from "./chords.js";
import { catchOpen } from "./game.js";

export const TRUMPET = { shift: 2 };
export const INSTRUMENTS = [["guitar", "Guitar"], ["trumpet", "Trumpet"]];
export const isTrumpet = data => data?.settings?.instrument === "trumpet";
/* how long you've played: the written range of a part (midi) and the note it centres on */
export const TP_LEVELS = { start: { name: "Starting", lo: 60, hi: 72, mid: 65, hard: 2 }, two: { name: "2 years", lo: 60, hi: 77, mid: 67, hard: 3 }, four: { name: "4+ years", lo: 55, hi: 82, mid: 69, hard: 5 } };
export const tpLevel = data => TP_LEVELS[data?.settings?.tpLevel] ? data.settings.tpLevel : "two";
export const TP_PARTS = [["long", "Long notes"], ["hits", "Hits"], ["melody", "Melody"]];
/* how many half steps the page moves for the trumpet: a whole step, plus the guitar's capo when one is on */
export const tpShift = (song, capo = song?.tpCapo || 0) => TRUMPET.shift + (capo || 0);

const PC = { C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, F: 5, "E#": 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11 };
const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"], FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const BLACK = new Set([1, 3, 6, 8, 10]);
export const pcOf = name => PC[String(name || "").replace("♯", "#").replace("♭", "b")] ?? -1;
/* a note's name, sharps or flats, with the real signs for the screen */
export const tpName = (m, flats = false) => (flats ? FLATS : SHARPS)[((m % 12) + 12) % 12].replace("#", "♯").replace(/^([A-G])b$/, "$1♭");
export const tpPretty = s => String(s || "").replace(/#/g, "♯").replace(/([A-G])b/g, "$1♭");

/* The valves for each written note, low F♯ to high C: which of 1, 2, 3 are down ("" for open). */
const VALVES = { 54: "123", 55: "13", 56: "23", 57: "12", 58: "1", 59: "2", 60: "", 61: "123", 62: "13", 63: "23", 64: "12", 65: "1", 66: "2", 67: "",
  68: "23", 69: "12", 70: "1", 71: "2", 72: "", 73: "12", 74: "1", 75: "2", 76: "", 77: "1", 78: "2", 79: "", 80: "23", 81: "12", 82: "1", 83: "2", 84: "" };
export const valvesOf = m => VALVES[m] ?? null;
export const valvesSay = m => { const v = valvesOf(m); return v == null ? "" : v ? `valve${v.length > 1 ? "s" : ""} ${v.split("").join(v.length > 2 ? ", " : " and ").replace(/, (\d)$/, " and $1")}` : "open"; };

/* The notes of a chord, as pitch classes: root, third, fifth, then a seventh or sixth when it has one. */
export function chordTones(name) {
  const m = /^([A-G][#b]?)([^/]*)/.exec(String(name || "").replace("♯", "#").replace("♭", "b"));
  if (!m) return null;
  const r = PC[m[1]], q = m[2];
  if (r == null) return null;
  const minor = /^(m(?!aj)|min|-)/.test(q) || /dim|°/.test(q);
  const third = /sus2/.test(q) ? 2 : /sus/.test(q) ? 5 : /^5$/.test(q) ? null : minor ? 3 : 4;
  const fifth = /dim|°|b5/.test(q) ? 6 : /aug|\+|#5/.test(q) ? 8 : 7;
  const sev = /maj7|M7|Δ/.test(q) ? 11 : /dim7|°7/.test(q) ? 9 : /7|9|11|13/.test(q) ? 10 : /6/.test(q) ? 9 : null;
  return [0, third, fifth, sev].filter(x => x != null).map(x => (r + x) % 12);
}

/* How many sharps or flats a key has (the fewer of the two spellings). */
const ACC = [0, 5, 2, 3, 4, 1, 6, 1, 4, 3, 2, 5];
export function keyLoad(key) {
  const m = /^([A-G][#b]?)(m(?!aj)|min)?/.exec(String(key || ""));
  if (!m || PC[m[1]] == null) return null;
  return ACC[(PC[m[1]] + (m[2] ? 3 : 0)) % 12];
}
/* The key a trumpet reads in, for a song in `key` (as it sounds), with the guitar's capo when one is on */
export const tpKey = (key, capo = 0) => key ? transposeKey(key, TRUMPET.shift + capo) : "";
/* too many sharps or flats for how long you've played */
export const keyHard = (key, level = "two", capo = 0) => { const n = keyLoad(tpKey(key, capo)); return n != null && n > (TP_LEVELS[level] || TP_LEVELS.two).hard; };
/* The capo (1 to 5) on a guitar that puts the trumpet in the easiest key, when it is easier than none. Same chord
   shapes on the guitar, so the song sounds higher by the capo, and so does the trumpet's part. Only a capo that
   takes off two sharps or flats or more is worth it. */
export function capoFor(key) {
  const n0 = keyLoad(tpKey(key));
  if (n0 == null) return 0;
  let best = 0, bn = n0;
  for (let c = 1; c <= 5; c++) { const n = keyLoad(tpKey(key, c)); if (n < bn) { best = c; bn = n; } }
  return n0 - bn >= 2 ? best : 0;
}

/* The written chord a trumpet reads over a chord as it sounds */
export const tpChord = (name, capo = 0, flats = false) => transposeChord(name, TRUMPET.shift + capo, flats);

/* A part of chord tones for the written chords of a song, in order: one note for each chord, within your range,
   that moves as little as it can, stays on a note the next chord shares, and keeps to the notes without sharps or
   flats when it can. Long notes and Hits play the same notes (Hits as short punches on 2 and 4).
   Worked out over the whole song at once (each choice weighed against the next), so the part is easy to play. */
export function tpPart(chords, level = "two", flats = false) {
  const L = TP_LEVELS[level] || TP_LEVELS.two;
  const opts = chords.map(name => {
    const tones = chordTones(name);
    if (!tones) return [];
    const out = [];
    for (let m = L.lo; m <= L.hi; m++) {
      const k = tones.indexOf(((m % 12) + 12) % 12);
      if (k < 0) continue;
      out.push({ m, cost: (BLACK.has(m % 12) ? 1.5 : 0) + (k === 3 ? 1 : k === 2 ? 0.2 : 0) + Math.abs(m - L.mid) * 0.15 });
    }
    return out;
  });
  /* best path: moving costs its distance, a new note costs a little more than staying */
  const cost = [], from = [];
  opts.forEach((os, i) => {
    cost[i] = []; from[i] = [];
    const prevI = (() => { for (let j = i - 1; j >= 0; j--) if (opts[j].length) return j; return -1; })();
    os.forEach((o, a) => {
      if (prevI < 0) { cost[i][a] = o.cost; from[i][a] = -1; return; }
      let b = -1, c = Infinity;
      opts[prevI].forEach((p, k) => { const x = cost[prevI][k] + (p.m === o.m ? 0 : 0.5 + Math.abs(p.m - o.m) * 0.6); if (x < c) { c = x; b = k; } });
      cost[i][a] = c + o.cost; from[i][a] = b;
    });
  });
  const picks = chords.map(() => null);
  let i = opts.length - 1;
  while (i >= 0 && !opts[i].length) i--;
  if (i < 0) return picks;
  let a = cost[i].indexOf(Math.min(...cost[i]));
  while (i >= 0) {
    const m = opts[i][a].m;
    picks[i] = { m, name: tpName(m, flats), valves: valvesOf(m) };
    const b = from[i][a];
    let j = i - 1; while (j >= 0 && !opts[j].length) j--;
    i = j; a = b;
  }
  return picks;
}
/* the different notes a part uses, low to high */
export const partNotes = part => [...new Map(part.filter(Boolean).map(p => [p.m, p])).values()].sort((x, y) => x.m - y.m);

/* Which note is sounding: the pitch class with the most of the sound, and its share (a trumpet's tone sits on its
   own note: its overtones fall on the same note, the fifth above and, less, the third). */
export function loudestNote(chroma) {
  if (!chroma) return null;
  let pc = 0;
  for (let k = 1; k < 12; k++) if (chroma[k] > chroma[pc]) pc = k;
  return { pc, share: chroma[pc] };
}
export const NOTE_CLEAR = 0.3;
export const NOTE_STRONG = 0.5;
/* One reading for the Gig on trumpet, like catchHear for a strum: `ok(i)` gives the pitch classes (as they sound)
   that count for target i (the part's note, or any chord tone for a Melody). Two readings in a row on an open
   target catch it, or one strong reading; a note catches one target per attack (`opt.on`, `opt.since`), so a
   long note held across a change counts once until it is played again. Returns the target caught, or -1. */
export function noteHear(st, chroma, ok, opt = {}) {
  const fresh = opt.on == null || (opt.on !== st.lastOn && opt.since <= 0.8);
  const n = loudestNote(chroma);
  if (!n) { st.cand = -1; st.n = 0; return -1; }
  for (const i of [st.cur, st.cur + 1]) if (i < st.targets.length) st.heard[i] = true;
  if (n.share < NOTE_CLEAR || !fresh) { st.cand = -1; st.n = 0; return -1; }
  const best = catchOpen(st).find(i => ok(i)?.includes(n.pc)) ?? -1;
  if (best < 0) { st.cand = -1; st.n = 0; return -1; }
  st.n = best === st.cand ? st.n + 1 : 1; st.cand = best;
  if (st.n < 2 && n.share < NOTE_STRONG) return -1;
  st.caught[best] = true; st.cand = -1; st.n = 0; st.lastOn = opt.on;
  return best;
}
/* A tune found by ear on the trumpet for a song, the first time for that song (4.81.0) */
export const EAR_FANS = 25;
