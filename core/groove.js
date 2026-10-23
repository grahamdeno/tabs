// The Road: core logic, Drum beats, drums that fit the song and a song's groove.
// Re-exported from core.js, so other files import it from there.
import { bodyCapo, isObj } from "../core.js";

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

// How many semitones the sheet's chords sit below what you hear: the chart's
// capo while it is on, plus the capo from Make it easier.
export const soundOffset = song => (song?.easier?.on ? song.easier.capo || 0 : 0) + (song?.capoOff ? 0 : bodyCapo(song?.body));

// ---------- A song's groove ----------
// What the drums do for one song, found by the AI (or set in Edit) and kept on the song as
// song.groove = { beat, swing, src }. Each part is optional: a part a song doesn't have comes from
// Settings. src is "ai" for what was found and "you" once you have changed it (a groove with only src
// "you" means: keep the defaults, don't look it up again). The bass (and its riff) went in 4.42.0;
// a stored bass or riff is dropped when it loads.
export const GROOVE = { beat: ["rock", "half", "ballad", "four"], swing: ["straight", "light", "full"] };
export function cleanGroove(raw, src = raw?.src) {
  if (!isObj(raw)) return null;
  const g = { src: src === "ai" ? "ai" : "you" };
  for (const k of Object.keys(GROOVE)) if (GROOVE[k].includes(raw[k])) g[k] = raw[k];
  return g;
}
/* The settings a song plays with: its own groove first, then Settings. */
export function grooveOf(song, settings = {}) {
  const g = song?.groove || {};
  return { beat: g.beat || settings.metroBeat || "auto", swing: g.swing || song?.listen?.feel?.swing || settings.metroSwing || "straight" };
}
/* "Half time, light swing": what a groove says, for a toast. */
export function grooveText(g) {
  return [g?.beat && drumBeatName(g.beat), (g?.swing === "light" || g?.swing === "full") && `${g.swing} swing`].filter(Boolean).join(", ") || "the defaults";
}
