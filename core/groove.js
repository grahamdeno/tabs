// The Road: core logic, Drum beats, drums that fit the song, the bass line and a song's groove.
// Re-exported from core.js, so other files import it from there.
import { bodyCapo, isObj } from "../core.js";
import { CHORD_RE, NOTE_INDEX } from "./chords.js";

// ---------- Drum beats ----------
// The metronome's drum patterns. A pattern is a rule for what hits on each
// pulse (a beat; an eighth note in 6/8), so the audio code only plays hits.
export const DRUM_BEATS = [["auto", "Auto"], ["rock", "Rock"], ["half", "Half time"], ["ballad", "Ballad"], ["four", "Four on the floor"]];
export const DRUM_SWING = { straight: 0.5, light: 0.58, full: 0.667 };
export const drumBeatName = style => ({ six8: "6/8", waltz: "Waltz" }[style] || DRUM_BEATS.find(([k]) => k === style)?.[1] || "Rock");
/* Which pattern plays. 6 and 12 beats are compound time and 3, 5, 7 and 9 are
   odd, and those keep their own patterns whatever is picked. Auto goes by the
   song: fingerpicked and slow gets the ballad, slow gets half time, fast gets
   four on the floor. Half time and the ballad need four beats. */
export function drumStyle(pick, { bpm = 90, beats = 4, body = "" } = {}) {
  if (beats === 6 || beats === 12) return "six8";
  if (beats % 2) return "waltz";
  let s = DRUM_BEATS.some(([k]) => k === pick && k !== "auto") ? pick : "auto";
  if (s === "auto") {
    const finger = /finger/i.test(String(body).slice(0, 200));
    s = finger && bpm < 110 ? "ballad" : bpm < 80 ? "half" : bpm >= 125 ? "four" : "rock";
  }
  return (s === "half" || s === "ballad") && beats !== 4 ? "rock" : s;
}
/* The hits on pulse b of a bar: { k: kind, at: where in the pulse (0 to 1),
   v: how hard }. swing is where the off-beat eighth lands (0.5 is straight). */
export function drumHits(style, b, beats = 4, swing = 0.5) {
  const hits = [], hit = (k, at, v) => hits.push({ k, at, v });
  if (style === "six8") {
    if (b % 3 === 0) hit((b / 3) % 2 === 0 ? "kick" : "snare", 0, (b / 3) % 2 === 0 ? 1 : 0.9);
    hit("hat", 0, b % 3 === 0 ? 0.9 : 0.5);
  } else if (style === "ballad") {
    if (b === 0) hit("kick", 0, 0.8);
    else if (b % 2 === 1) hit("stick", 0, 0.8);
    hit("hat", 0, 0.45);
  } else if (style === "four") {
    hit("kick", 0, b === 0 ? 1 : 0.85);
    if (beats === 4 && b % 2 === 1) hit("snare", 0, 0.55);
    hit("open", swing, 0.7);
  } else {
    const even = beats % 2 === 0;
    if (style === "half") { if (b === 0) hit("kick", 0, 1); else if (b === 2) hit("snare", 0, 1); }
    else if (b === 0 || (even && b === beats / 2)) hit("kick", 0, b === 0 ? 1 : 0.85);
    else hit("snare", 0, even ? 1 : 0.7);
    hit("hat", 0, b === 0 ? 1 : 0.8);
    hit("hat", swing, 0.55);
  }
  return hits;
}

// ---------- Drums that fit the song (3.23.0) ----------
// The AI writes one bar of 4/4 per kind of section (intro, verse, pre-chorus, chorus, bridge, solo,
// outro) and a fill, each part 16 sixteenth notes: "." rest, "x" hit, "X" accent, "o" soft (a ghost
// note), and on the hi-hat "O" for an open hat. The section on screen picks the bar; the bar before a
// new section plays the fill. Busier and Simpler change the bar, kept per song.
export const DRUM_PARTS = ["intro", "verse", "prechorus", "chorus", "bridge", "solo", "outro"];
export function partOf(name) {
  const n = String(name || "").toLowerCase();
  if (/pre.?chorus|build/.test(n)) return "prechorus";
  if (/chorus|refrain|hook/.test(n)) return "chorus";
  if (/bridge|middle/.test(n)) return "bridge";
  if (/solo|instrumental|interlude|break/.test(n)) return "solo";
  if (/intro/.test(n)) return "intro";
  if (/outro|ending|coda|tag/.test(n)) return "outro";
  return "verse";
}
const DRUM_ROW = { kick: /^[.xXo]{16}$/, snare: /^[.xXo]{16}$/, hat: /^[.xXoO]{16}$/ };
export function cleanDrums(raw) {
  if (!isObj(raw)) return null;
  const out = {};
  for (const part of [...DRUM_PARTS, "fill"]) {
    const p = raw[part];
    if (!isObj(p)) continue;
    const bar = {};
    for (const [k, re] of Object.entries(DRUM_ROW)) bar[k] = re.test(String(p[k] || "")) ? String(p[k]) : ".".repeat(16);
    if (Object.values(bar).some(r => /[^.]/.test(r))) out[part] = bar;
  }
  if (!out.verse && !out.chorus) return null;
  if (raw.level === -1 || raw.level === 1) out.level = raw.level;
  out.src = "ai";
  return out;
}
/* Simpler (-1): quarter-note hat, no ghost notes, the kick only where it is strong. Busier (+1): the
   hat fills to sixteenths (softly) and a ghost snare leads into beats 2 and 4. */
export function drumLevelBar(bar, level = 0) {
  if (!bar || !level) return bar;
  const map = (row, f) => [...row].map(f).join("");
  if (level < 0) return {
    kick: map(bar.kick, (c, i) => c === "X" || (c !== "." && i % 8 === 0) ? "x" : "."),
    snare: map(bar.snare, c => c === "o" ? "." : c),
    hat: map(bar.hat, (c, i) => i % 4 === 0 ? (c === "." ? "x" : c === "O" ? "x" : c) : ".")
  };
  return {
    kick: bar.kick,
    snare: map(bar.snare, (c, i) => c === "." && (i === 3 || i === 11) ? "o" : c),
    hat: map(bar.hat, c => c === "." ? "o" : c)
  };
}
/* The hits on pulse b (a quarter note) of a bar: { k, at (0 to 1 of the pulse), v }. The off-beat
   eighth moves with swing; the sixteenths around it follow. */
export function barHits(bar, b, swing = 0.5) {
  const hits = [], at = [0, swing / 2, swing, swing + (1 - swing) / 2];
  const vel = { x: 0.8, X: 1, o: 0.35, O: 0.7 };
  for (let j = 0; j < 4; j++) {
    const i = b * 4 + j;
    for (const k of ["kick", "snare", "hat"]) {
      const c = bar?.[k]?.[i];
      if (!c || c === ".") continue;
      hits.push({ k: k === "hat" && c === "O" ? "open" : k, at: at[j], v: k === "hat" ? vel[c] * 0.75 : vel[c] });
    }
  }
  return hits;
}

// ---------- Bass line ----------
// A bass that plays the root of each chord under the song. Everything here is
// pure: the app asks which chord the bass is on and what to play on each pulse.
export const BASS_STYLES = [["auto", "Auto"], ["root", "Root"], ["fifth", "Root and fifth"], ["pulse", "Pulse"], ["walk", "Walking"]];
/* How many semitones the sheet's chords sit below what you hear: the chart's
   capo while it is on, plus the capo from Make it easier. */
export const soundOffset = song => (song?.easier?.on ? song.easier.capo || 0 : 0) + (song?.capoOff ? 0 : bodyCapo(song?.body));
const BASS_LO = 38; /* D2: the bass sits between D2 and C#3, with room above for fifths */
const bassPitch = (pc, lo = BASS_LO) => lo + ((((pc - lo) % 12) + 12) % 12);
/* A chord's bass facts as pitch classes (0 to 11): the root, the note the bass
   plays (a slash chord names its own), and the third, fifth and sixth as
   semitones above the root. offset moves the shape to the sound. */
export function chordBass(name, offset = 0) {
  const m = String(name || "").match(CHORD_RE);
  if (!m) return null;
  const [, root, q, slash] = m;
  const r = ((NOTE_INDEX[root] + offset) % 12 + 12) % 12;
  const b = slash ? ((NOTE_INDEX[slash] + offset) % 12 + 12) % 12 : r;
  const minor = /^(m(?!aj)|min|-|dim|°|ø)/.test(q);
  const third = /^sus/.test(q) || q === "5" ? null : minor ? 3 : 4;
  const fifth = /^(dim|°|ø)|b5/.test(q) ? 6 : /^(aug|\+)|#5/.test(q) ? 8 : 7;
  const sixth = minor || (/7/.test(q) && !/maj7|M7/.test(q)) ? 10 : 9;
  return { root: r, bass: b, third, fifth, sixth };
}
/* Which pattern plays. A pick wins; Auto follows the drum beat, and a full
   swing walks. Walking needs four beats. */
export function bassStyle(pick, drum, beats = 4, swing = "straight", riff = "") {
  if (pick === "riff") return beats === 4 ? (validRiff(riff) ? "riff" : "pulse") : "fifth"; /* a riff is a bar of four beats */
  let s = BASS_STYLES.some(([k]) => k === pick && k !== "auto") ? pick : "auto";
  if (s === "auto") s = swing === "full" && beats === 4 ? "walk" : drum === "ballad" || drum === "half" ? "root" : drum === "six8" || drum === "waltz" ? "fifth" : "pulse";
  return s === "walk" && beats !== 4 ? "fifth" : s;
}
/* The notes on pulse b of a bar: { m: midi note, at: where in the pulse (0 to 1),
   len: how long, in pulses, v: how hard }. cur and next come from chordBass;
   next is the chord after this one (for the walk's approach note). */
export function bassHits(style, cur, next, b, beats = 4, swing = 0.5, riff = "") {
  if (!cur) return [];
  const hits = [], hit = (m, at, len, v) => hits.push({ m, at, len, v });
  const low = bassPitch(cur.bass), rootP = bassPitch(cur.root), fifthP = rootP + cur.fifth > 52 ? rootP + cur.fifth - 12 : rootP + cur.fifth;
  const compound = beats >= 6 && beats % 3 === 0, even = beats % 2 === 0 && !compound;
  if (style === "riff" && validRiff(riff) && beats === 4) {
    /* Each character is a sixteenth. The eighth-note off-beat moves with swing,
       and a note rings until the next one. */
    const pitch = { 1: low, 3: rootP + (cur.third ?? cur.fifth), 5: rootP + cur.fifth, 7: rootP + 10, 8: rootP + 12 };
    const at = i => (i < 2 ? i * swing / 2 : swing + (i - 2) * (1 - swing) / 2);
    for (let i = 0; i < 4; i++) {
      const k = b * 4 + i, c = riff[k];
      if (c === ".") continue;
      let n = k + 1;
      while (n < 16 && riff[n] === ".") n++;
      hit(pitch[c], at(i), Math.max(0.15, (n - k) / 4 * 0.9), i === 0 ? (b === 0 ? 1 : 0.9) : i === 2 ? 0.8 : 0.65);
    }
    return hits;
  }
  if (style === "walk") {
    if (b === 0) hit(low, 0, 0.9, 1);
    else if (b === 1) hit(rootP + (cur.third ?? cur.fifth), 0, 0.9, 0.75);
    else if (b === 2) hit(rootP + cur.fifth, 0, 0.9, 0.8);
    else if (b === 3) {
      if (!next || next.bass === cur.bass) hit(rootP + cur.sixth, 0, 0.9, 0.75);
      else {
        const prev = rootP + cur.fifth;
        let tgt = bassPitch(next.bass);
        for (let p = tgt; p <= 57; p += 12) if (Math.abs(p - prev) < Math.abs(tgt - prev)) tgt = p;
        const from = [tgt - 1, tgt + 1].sort((x, y) => Math.abs(x - prev) - Math.abs(y - prev) || x - y)[0];
        hit(from, 0, 0.9, 0.75);
      }
    }
  } else if (style === "pulse") {
    if (even) {
      hit(low, 0, 0.45, b === 0 ? 1 : 0.75);
      hit(low, swing, 0.4, 0.55);
    } else hit(low, 0, 0.5, b === 0 ? 1 : compound && b % 3 === 0 ? 0.8 : 0.6);
  } else if (style === "fifth") {
    if (compound) { if (b % 3 === 0) hit(b % 6 === 0 ? low : fifthP, 0, 2.7, b % 6 === 0 ? 1 : 0.8); }
    else if (even) { if (b === 0) hit(low, 0, beats / 2 * 0.9, 1); else if (b === beats / 2) hit(fifthP, 0, beats / 2 * 0.9, 0.8); }
    else hit(b === 0 ? low : fifthP, 0, 0.9, b === 0 ? 1 : 0.75);
  } else { /* root */
    if (b === 0) hit(low, 0, beats * 0.9, 1);
    else if (even && beats >= 4 && b === beats / 2) hit(low, 0, beats / 2 * 0.9, 0.6);
  }
  return hits;
}
/* Which chord the bass is on. rows are the sheet's chord rows, top to bottom:
   { lo, hi: their first and last chord, kind, r0, r1: where they sit on the
   page }, and L is the reading line on the same scale. Over lyrics ("line")
   the bass goes by how far the page has moved through the row, so a row's
   chords take turns. On a chord-only row ("bar") each chord gets a bar and
   the bass moves on by itself; the page only brings it back when it has drifted
   more than a row away, as after a loop or a scroll back. */
export function bassWhere(idx, rows, L, onBar) {
  if (!rows.length) return null;
  let at = 0;
  for (let i = 0; i < rows.length; i++) if (rows[i].r0 <= L) at = i;
  const row = rows[at];
  if (row.kind === "line") {
    const span = Math.max(1, (rows[at + 1] ? rows[at + 1].r0 : row.r1) - row.r0);
    return row.lo + Math.floor(Math.max(0, Math.min(0.999, (L - row.r0) / span)) * (row.hi - row.lo + 1));
  }
  if (idx == null || idx < (rows[at - 1] || row).lo || idx > (rows[at + 1] || row).hi) return row.lo;
  return onBar ? Math.min(idx + 1, rows[rows.length - 1].hi) : idx;
}

// ---------- A song's groove ----------
// What the drums and bass do for one song, found by the AI (or set in Edit) and
// kept on the song as song.groove = { beat, swing, bass, src }. Each part is
// optional: a part a song doesn't have comes from Settings. src is "ai" for
// what was found and "you" once you have changed it (a groove with only src
// "you" means: keep the defaults, don't look it up again).
export const GROOVE = { beat: ["rock", "half", "ballad", "four"], swing: ["straight", "light", "full"], bass: ["root", "fifth", "pulse", "walk", "riff"] };
/* A riff is one bar of a bass part in sixteenth notes, 16 characters, in
   degrees of whatever chord it is played on: "." no new note, 1 root, 3 third,
   5 fifth, 7 flat seventh, 8 root an octave up. */
export const RIFF_STEPS = [".", "1", "3", "5", "7", "8"];
export const validRiff = r => typeof r === "string" && /^[.13578]{16}$/.test(r) && /[13578]/.test(r);
export function cleanGroove(raw, src = raw?.src) {
  if (!isObj(raw)) return null;
  const g = { src: src === "ai" ? "ai" : "you" };
  for (const k of Object.keys(GROOVE)) if (GROOVE[k].includes(raw[k])) g[k] = raw[k];
  if (validRiff(raw.riff)) g.riff = raw.riff;
  if (g.bass === "riff" && !g.riff) delete g.bass; /* a riff style needs a riff */
  return g;
}
/* The settings a song plays with: its own groove first, then Settings. */
export function grooveOf(song, settings = {}) {
  const g = song?.groove || {};
  return { beat: g.beat || settings.metroBeat || "auto", swing: g.swing || song?.listen?.feel?.swing || settings.metroSwing || "straight", bass: g.bass || settings.bassStyle || "auto", riff: g.riff || "" };
}
const BASS_WORDS = { root: "root bass", fifth: "root and fifth bass", pulse: "pulse bass", walk: "walking bass", riff: "a bass riff" };
/* "Half time, light swing, walking bass": what a groove says, for a toast. */
export function grooveText(g) {
  return [g?.beat && drumBeatName(g.beat), (g?.swing === "light" || g?.swing === "full") && `${g.swing} swing`, g?.bass && BASS_WORDS[g.bass]].filter(Boolean).join(", ") || "the defaults";
}
