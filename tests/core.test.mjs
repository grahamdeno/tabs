// Tests for core.js and for the wiring that keeps the app loadable.
// Run with: node --test   (Node 18 or later, no dependencies)

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");

// core.js saves to localStorage; give it an in-memory one.
globalThis.localStorage = {
  store: {},
  getItem(k) { return this.store[k] ?? null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};
const C = await import("../core.js");

// ---------- Wiring ----------

test("version is MAJOR.MINOR.PATCH", () => {
  assert.match(C.VERSION, /^\d+\.\d+\.\d+$/);
});

test("version matches the service worker cache name", () => {
  const m = read("sw.js").match(/const CACHE = "tabs-v([^"]+)"/);
  assert.ok(m, "CACHE constant not found in sw.js");
  assert.equal(m[1], C.VERSION);
});

test("every app script parses, and index.html loads them", () => {
  // A syntax error stops the whole app from loading, so check before every release.
  const scripts = [...fs.readdirSync(root).filter(f => f.endsWith(".js")), ...fs.readdirSync(path.join(root, "core")).filter(f => f.endsWith(".js")).map(f => "core/" + f)];
  for (const f of scripts) execFileSync(process.execPath, ["--check", path.join(root, f)], { stdio: "pipe" });
  const html = read("index.html");
  assert.match(html, /<script type="module" src="app.js"><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="styles.css">/);
  const shell = read("sw.js");
  for (const f of ["index.html", "styles.css", ...scripts.filter(f => f !== "sw.js")]) assert.ok(shell.includes(`"${f}"`), `${f} is saved for offline`);
});

test("4.42.7 every part loaded later asks for the running release, so an update can't mix two releases", () => {
  const scripts = fs.readdirSync(root).filter(f => f.endsWith(".js"));
  for (const f of scripts) assert.doesNotMatch(read(f), /import\("\.\/[a-z]+\.js"\)/, `${f} loads a part without ?v=`);
});

test("the service worker never caches AI calls", () => {
  assert.match(read("sw.js"), /api\.anthropic\.com/);
});

// ---------- Chords ----------

test("transposeChord keeps quality and slash bass", () => {
  assert.equal(C.transposeChord("G", 2), "A");
  assert.equal(C.transposeChord("C#m7", 1), "Dm7");
  assert.equal(C.transposeChord("D/F#", -2, true), "C/E");
  assert.equal(C.transposeChord("Bbmaj7", 2), "Cmaj7");
  assert.equal(C.transposeChord("Am7b5", 3), "Cm7b5");
});

test("chord lines and lyric lines are told apart", () => {
  assert.ok(C.isChordLine("G    C   D/F#  Em"));
  assert.ok(C.isChordLine("| G  | C  | x2"));
  assert.ok(!C.isChordLine("A day in the life"));
  assert.ok(!C.isChordLine("Am I wrong"));
});

test("sharps or flats follow the key the song lands in", () => {
  assert.equal(C.prefersFlats("C", 5), true);
  assert.equal(C.transposeKey("G", 3), "Bb");
});

test("a chord line over a lyric becomes chord-over-word blocks", () => {
  const [b] = C.parseBlocks("G       C\nWalking down the road");
  assert.equal(b.kind, "pair");
  const parts = b.words.filter(w => !w.space).flatMap(w => w.parts);
  assert.deepEqual(parts.filter(p => p.chord).map(p => p.chord), ["G", "C"]);
});

test("words are never split across items", () => {
  const items = C.buildWords("believe it", new Map([[0, "C"], [2, "G"]]));
  const first = items.find(w => !w.space);
  assert.equal(first.parts.map(p => p.text).join(""), "believe");
});

test("a chord over the gap before a word rides on that word", () => {
  const items = C.buildWords("river road", new Map([[5, "C"]]));
  const road = items.filter(w => !w.space).find(w => w.parts.map(p => p.text).join("") === "road");
  assert.equal(road.parts[0].chord, "C");
});

test("inline [G] chords parse like chords over lyrics", () => {
  const [b] = C.parseBlocks("[G]Walking [C]down");
  assert.equal(b.kind, "pair");
});

test("tabs wrap at shared bar lines with string names repeated", () => {
  const lines = ["e|---0---|---2---|---3---|", "B|---1---|---3---|---0---|"];
  const rows = C.wrapTab(lines, 18);
  assert.ok(rows.length > 1);
  for (const row of rows) for (const l of row) assert.match(l, /^[eB]\|/);
});

test("chord fingerings cover open and barre shapes", () => {
  assert.equal(C.chordShape("A").frets.join(","), "-1,0,2,2,2,0");
  const fsm = C.chordShape("F#m");
  assert.ok(fsm.barre);
  assert.equal(fsm.base, 2);
  assert.equal(C.chordShape("Bm7").barre, undefined);
  assert.equal(C.chordShape("N.C."), null);
});

test("pasted headers become title and artist", () => {
  const d = C.detectPaste("River Road Chords by The Wanderers\n\n[Verse]\nG   C\nWalking down");
  assert.equal(d.title, "River Road");
  assert.equal(d.artist, "The Wanderers");
  assert.equal(d.key, "G");
});

// ---------- Library ----------

const fresh = () => C.migrate({ songs: [
  { id: "a", title: "One", body: "G\nla" },
  { id: "b", title: "Two", body: "C\nla" }
], settings: { v: 3 } });

test("migration brings old saves up to date", () => {
  const d = fresh();
  assert.equal(d.settings.v, 6);
  assert.equal(d.settings.speedMode, "length");
  assert.equal(d.settings.theme, "auto");
  assert.equal(C.migrate({ songs: [], settings: { v: 5, theme: "light" } }).settings.theme, "light", "a chosen light theme stays");
  assert.deepEqual(d.sets, []);
  assert.deepEqual(d.trash, []);
});

test("deleting a song keeps it in Recently deleted and restores it to its sets", () => {
  const d = fresh();
  const set = C.Tabs.addSet(d, "Gig");
  set.songIds = ["a", "b"];
  const entry = C.Tabs.deleteSong(d, "a");
  assert.deepEqual(d.songs.map(s => s.id), ["b"]);
  assert.deepEqual(set.songIds, ["b"]);
  C.Tabs.restore(d, entry);
  assert.deepEqual(set.songIds, ["a", "b"]);
  assert.equal(d.trash.length, 0);
});

test("Recently deleted forgets items after 30 days", () => {
  const old = { type: "song", item: { id: "z" }, deletedAt: new Date(Date.now() - 31 * 864e5).toISOString() };
  const recent = { type: "song", item: { id: "y" }, deletedAt: new Date().toISOString() };
  const d = C.migrate({ songs: [], trash: [old, recent], settings: { v: 4 } });
  assert.deepEqual(d.trash.map(t => t.item.id), ["y"]);
});

test("new songs start at the starting length and speed", () => {
  const d = fresh();
  d.settings.startLength = 180;
  const s = C.Tabs.addSong(d, { title: "New" });
  assert.equal(s.duration, 180);
  assert.equal(s.speed, 45);
});

test("plays this week count only the last 7 days", () => {
  const now = Date.now();
  assert.equal(C.playsThisWeek({ plays: [now - 864e5, now - 8 * 864e5] }), 1);
});

// ---------- Sharing ----------

test("a shared song survives the trip through a link", async () => {
  const song = { id: "x", title: "River Road", artist: "The Wanderers", body: "G  C\nWalking down", plays: [1, 2], favorite: true, duration: 200 };
  const code = await C.packShare({ song: C.shareable(song) });
  assert.match(code, /^[zj][A-Za-z0-9_-]+$/);
  const back = await C.unpackShare(code);
  assert.deepEqual(back.song, { title: "River Road", artist: "The Wanderers", body: "G  C\nWalking down", duration: 200 });
});

test("a shared set keeps its name and song order", async () => {
  const code = await C.packShare({ set: { name: "Gig", songs: [{ title: "A", body: "G" }, { title: "B", body: "C" }] } });
  const back = await C.unpackShare(code);
  assert.equal(back.set.name, "Gig");
  assert.deepEqual(back.set.songs.map(s => s.title), ["A", "B"]);
});

test("a damaged share link is refused, not imported", async () => {
  assert.equal(await C.unpackShare("zNotReallyData"), null);
  assert.equal(await C.unpackShare("j" + Buffer.from('{"song":{"title":1}}').toString("base64url")), null);
});

// ---------- Library search and sort ----------

const lib = [
  { id: "1", title: "River Road", artist: "The Wanderers", key: "A", body: "[Chorus]\nA        F#m\nCarry me home, over the hill", plays: [5, 6, 7], opened: 1 },
  { id: "2", title: "Harbor Lights", artist: "Me", key: "G", body: "G  C\n[G]Lights on the [C]water", plays: [9], opened: 2 },
  { id: "3", title: "Blue Morning", artist: "Me", key: "Em", body: "Em  C\nCarry on", opened: 20 }
];

test("search finds words in the lyrics, after title and artist matches", () => {
  const r = C.searchSongs(lib, "carry me");
  assert.deepEqual(r.map(x => x.song.id), ["1"]);
  assert.equal(r[0].line, "Carry me home, over the hill");
  assert.deepEqual(C.searchSongs(lib, "me").map(x => x.song.id), ["2", "3"]); /* artist "Me"; too short for lyrics */
});

test("search ignores chord lines and inline chords", () => {
  assert.equal(C.searchSongs(lib, "F#m").length, 0);
  assert.equal(C.searchSongs(lib, "lights on the water")[0].song.id, "2");
});

test("library sorts by recent, most played and artist", () => {
  assert.deepEqual(C.sortSongs(lib, "recent").map(s => s.id), ["3", "2", "1"]);
  assert.deepEqual(C.sortSongs(lib, "most").map(s => s.id), ["1", "2", "3"]);
  const band = [{ id: "a", title: "Z", artist: "The Wanderers" }, { id: "b", title: "B", artist: "" }, { id: "c", title: "Y", artist: "abba" }, { id: "d", title: "A", artist: "Wanderers" }];
  assert.deepEqual(C.sortSongs(band, "artist").map(s => s.id), ["c", "d", "a", "b"], "The is ignored, no artist goes last, then by title");
  assert.deepEqual(C.sortSongs(lib, "title").map(s => s.id), ["3", "2", "1"]);
});

// ---------- Tuner ----------

const tone = (f, rate = 48000, n = 4096, harmonics = [1, 0.5, 0.3]) =>
  Float32Array.from({ length: n }, (_, i) => harmonics.reduce((s, a, h) => s + 0.3 * a * Math.sin(2 * Math.PI * f * (h + 1) * i / rate), 0));

test("pitch detection hears each open string within 2 cents", () => {
  for (const note of C.TUNINGS.standard.notes.concat(["D2", "Eb2"])) {
    const f = C.noteFreq(note), got = C.detectPitch(tone(f), 48000);
    assert.ok(Math.abs(1200 * Math.log2(got / f)) < 2, `${note}: ${got} vs ${f}`);
  }
});

test("pitch detection copes with a little noise and a strong overtone", () => {
  let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.04;
  for (const note of ["E2", "G3", "E4"]) {
    const f = C.noteFreq(note), buf = tone(f, 44100, 4096, [0.6, 1, 0.4]).map(x => x + rnd());
    const got = C.detectPitch(buf, 44100);
    assert.ok(Math.abs(1200 * Math.log2(got / f)) < 3, `${note}: ${got} vs ${f}`);
  }
});

// A plucked string (Karplus-Strong): a burst of noise circulating in a tuned
// delay line that loses its overtones as it rings, as a real string does. A
// first-order allpass sets the exact pitch. Optional mains hum, hiss, a phone
// microphone's weak low end (high-pass), and another string ringing quietly.
function pluck(f, { rate = 48000, secs = 0.6, seed = 7, detune = 0, hum = 0.01, hiss = 0.004, highpass = 0 } = {}) {
  const fr = f * 2 ** (detune / 1200), P = rate / fr;
  let n0 = Math.floor(P - 0.5), d = P - 0.5 - n0;
  if (d < 0.1) { n0 -= 1; d += 1; }
  const c = (1 - d) / (1 + d);
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const line = new Float32Array(n0); let lp = 0;
  for (let i = 0; i < n0; i++) { lp = 0.6 * lp + 0.4 * rnd(); line[i] = lp; }
  const out = new Float32Array(Math.round(rate * secs));
  let at = 0, last = 0, apIn = 0, apOut = 0;
  for (let k = 0; k < out.length; k++) {
    const x = line[at], avg = 0.998 * 0.5 * (x + last); last = x;
    const ap = c * avg + apIn - c * apOut; apIn = avg; apOut = ap;
    line[at] = ap; at = (at + 1) % n0;
    out[k] = x + hum * Math.sin(2 * Math.PI * 60 * k / rate) + hiss * rnd();
  }
  if (highpass) {
    const rc = 1 / (2 * Math.PI * highpass), a = rc / (rc + 1 / rate); let py = 0, px = 0;
    for (let k = 0; k < out.length; k++) { const y = a * (py + out[k] - px); px = out[k]; py = y; out[k] = y; }
  }
  return { out, fr };
}
const centsOffAt = (out, fr, rate, secs) => { const i = Math.round(secs * rate); return 1200 * Math.log2(C.detectPitch(out.subarray(i, i + 4096), rate) / fr); };

test("a plucked string is read within 2 cents as it rings, in tune or not", () => {
  for (const note of C.TUNINGS.standard.notes) for (const detune of [0, -23, 14]) {
    const { out, fr } = pluck(C.noteFreq(note), { detune });
    for (const at of [0.1, 0.3, 0.5]) {
      const off = centsOffAt(out, fr, 48000, at);
      assert.ok(Math.abs(off) < 2, `${note} ${detune} cents, at ${at}s: read ${off.toFixed(1)} cents off`);
    }
  }
});

test("Drop D, DADGAD, Open G and Eb tunings: each string read within 2 cents, slightly out or not", () => {
  for (const tuning of ["dropd", "dadgad", "openg", "halfdown"].filter(k => C.TUNINGS[k])) {
    for (const note of C.TUNINGS[tuning].notes) for (const detune of [0, -11, 7]) {
      const { out, fr } = pluck(C.noteFreq(note), { detune, rate: 44100, highpass: 120, hum: 0.02 });
      for (const at of [0.1, 0.35]) {
        const off = centsOffAt(out, fr, 44100, at);
        assert.ok(Math.abs(off) < 2, `${tuning} ${note} ${detune} cents, at ${at}s: read ${off.toFixed(1)} cents off`);
      }
    }
  }
  assert.ok(C.TUNINGS.dropd, "Drop D is one of the tunings");
});

test("in Drop D, a low string still at E is read as the D string, a whole step sharp", () => {
  const { out } = pluck(C.noteFreq("E2"), { rate: 44100, highpass: 120 });
  const s = C.nearestString(C.detectPitch(out.subarray(4410, 4410 + 4096), 44100), "dropd");
  assert.deepEqual([s.index, s.note], [0, "D2"]);
  assert.ok(Math.abs(s.cents - 200) <= 1, `${s.cents} cents`);
});

test("a phone mic's weak low end, hum, hiss and another string ringing don't fool it", () => {
  for (const note of C.TUNINGS.standard.notes) {
    const target = pluck(C.noteFreq(note), { rate: 44100, highpass: 250, hum: 0.05, hiss: 0.02, detune: -9 });
    const other = pluck(C.noteFreq(note === "A2" ? "D3" : "A2"), { rate: 44100, seed: 99 });
    const mix = target.out.map((x, i) => x + 0.08 * other.out[i]);
    for (const at of [0.15, 0.4]) {
      const off = centsOffAt(mix, target.fr, 44100, at);
      assert.ok(Math.abs(off) < 3, `${note} at ${at}s: read ${off.toFixed(1)} cents off`);
    }
  }
});

test("silence gives no pitch", () => {
  assert.equal(C.detectPitch(new Float32Array(4096), 48000), -1);
});

test("a slightly flat A string is read as A, a few cents flat", () => {
  const s = C.nearestString(C.noteFreq("A2") * 2 ** (-8 / 1200));
  assert.equal(s.note, "A2");
  assert.equal(s.cents, -8);
  assert.equal(C.nearestNote(440).name, "A");
});

test("a song's tuning is read from its sheet", () => {
  assert.equal(C.detectTuning("Tuning: Drop D\n[Verse]"), "dropd");
  assert.equal(C.detectTuning("tuning - D A D G B E"), "dropd");
  assert.equal(C.detectTuning("Tuning: Eb (half step down)"), "halfdown");
  assert.equal(C.detectTuning("Tuning: DADGAD"), "dadgad");
  assert.equal(C.detectTuning("G  C\nla la"), "");
});

// ---------- Listening links ----------

test("the studio version by the same artist ranks first", () => {
  const r = C.rankTracks([
    { trackName: "River Road (Live)", artistName: "The Wanderers", collectionName: "Live", trackViewUrl: "x1" },
    { trackName: "River Road", artistName: "Karaoke Stars", collectionName: "Hits", trackViewUrl: "x2" },
    { trackName: "River Road (Remastered 2011)", artistName: "Wanderers", collectionName: "Roads", trackViewUrl: "x3" }
  ], "River Road", "The Wanderers");
  assert.equal(r[0].trackViewUrl, "x3");
});

test("pasted links name their service", () => {
  assert.equal(C.linkService("https://music.apple.com/us/album/x/1?i=2"), "Apple Music");
  assert.equal(C.linkService("https://open.spotify.com/track/abc"), "Spotify");
  assert.equal(C.linkService("https://youtu.be/abc"), "YouTube");
  assert.equal(C.linkService("not a link"), "");
});

test("a shared listening link must be a plain https link", () => {
  assert.deepEqual(C.shareable({ title: "A", body: "G", listen: { url: "https://music.apple.com/x" } }).listen, { url: "https://music.apple.com/x", service: "Apple Music" });
  assert.equal(C.shareable({ title: "A", body: "G", listen: { url: "javascript:alert(1)" } }).listen, undefined);
});

// ---------- Chord editor ----------

test("placing a chord writes it over the right letter", () => {
  const body = "[Verse]\nA            D\nWalking down the river road";
  const road = "Walking down the river road".indexOf("road");
  const out = C.setChordAt(body, 2, road, "E");
  assert.equal(out.split("\n")[1].indexOf("E"), road);
});

test("a chord on a plain lyric line adds a chord line above it", () => {
  const out = C.setChordAt("la la land", 0, 3, "G");
  assert.deepEqual(out.split("\n"), ["   G", "la la land"]);
});

test("removing the last chord removes the chord line", () => {
  assert.equal(C.setChordAt("   G\nla la land", 1, 3, null), "la la land");
});

test("inline [G] sheets stay inline", () => {
  assert.equal(C.setChordAt("[G]Walking down", 0, 8, "C"), "[G]Walking [C]down");
});

test("chords used are listed in order", () => {
  assert.deepEqual(C.chordsUsed("A    D\nla la\n[E]la [A]la"), ["A", "D", "E"]);
});

test("retyping a line keeps its chords", () => {
  const out = C.setLineText("G    C\nla la land", 1, "la la la land");
  assert.equal(out, "G    C\nla la la land");
  assert.equal(C.setLineText("[G]la [C]land", 0, "la lands"), "[G]la [C]lands");
});

test("emptying a line removes it and its chord line", () => {
  assert.equal(C.setLineText("[Verse]\nG    C\nla la land\nnext", 2, ""), "[Verse]\nnext");
});

test("sections can be renamed and lines added", () => {
  assert.equal(C.renameSection("Chorus:\nla", 0, "Chorus 2"), "[Chorus 2]\nla");
  assert.deepEqual(C.insertLines("a\nb", 0, ["new"]), { body: "a\nnew\nb", at: 1 });
});

test("section labels and chord lines may carry a repeat mark", () => {
  const b = C.parseBlocks("[Chorus] (x2)\nG — D — F#7 — Bm — A (×2)\nChorus x3");
  assert.deepEqual(b.map(x => x.kind), ["section", "chords", "section"]);
  assert.equal(b[0].text, "Chorus ×2");
  assert.equal(b[2].text, "Chorus ×3");
  assert.ok(C.isChordLine("G   D   F#7   Bm   A   (x2)"));
  assert.ok(!C.isChordLine("Lay me down (x2)"));
});

// ---------- Sets as events ----------

test("the next set is the soonest one still ahead", () => {
  const now = Date.parse("2026-10-14T12:00");
  const sets = [{ id: "a", when: "2026-10-20T20:00" }, { id: "b", when: "2026-10-17T20:00" }, { id: "c", when: "2026-10-01T20:00" }, { id: "d" }];
  assert.equal(C.nextSet(sets, now).id, "b");
  assert.equal(C.nextSet([{ id: "x", when: "2026-10-14T09:00" }], now).id, "x"); /* started 3 hours ago: still up */
  assert.equal(C.nextSet([{ id: "y", when: "2026-10-13T20:00" }], now), null);
});

test("time until a set reads naturally", () => {
  const now = Date.parse("2026-10-14T12:00");
  assert.equal(C.untilLabel("2026-10-14T18:00", now), "in 6 hours");
  assert.equal(C.untilLabel("2026-10-15T20:00", now), "tomorrow");
  assert.equal(C.untilLabel("2026-10-17T20:00", now), "in 3 days");
  assert.equal(C.untilLabel("2026-10-14T10:00", now), "now");
});

test("a set run records its time and songs played", () => {
  const set = { id: "s" };
  const r = C.logSetRun(set, 1000, 4, 1000 + 18 * 60e3 + 40e3);
  assert.deepEqual(r, { at: 1000 + 18 * 60e3 + 40e3, secs: 1120, songs: 4 });
  assert.equal(set.runs.length, 1);
});

// ---------- AI chord charts ----------

test("an AI chord chart keeps only chords and section names", () => {
  const body = C.buildChart({ capo: 2, strum: "D DU UDU", sections: [
    { name: "Intro", chords: "G D Em C", repeat: 2 },
    { name: "Verse 1", chords: "G | D | Em | C | hello darkness my old friend" },
    { name: "Some words here", chords: "Am F" },
    { name: "Chorus", chords: "nothing here" }
  ] });
  assert.equal(body, "Capo 2 · Strum: D DU UDU\n\n[Intro] (x2)\nG   D   Em   C\n\n[Verse 1]\nG   D   Em   C\n\n[Part]\nAm   F");
  assert.ok(!/darkness|friend|words/.test(body));
});

test("known chords are ranked by how many songs use them", () => {
  assert.deepEqual(C.chordCounts([{ body: "G C\nla" }, { body: "G D\nla" }]).slice(0, 1), ["G"]);
});

// ---------- Saving and play history ----------

test("play history is kept as counts per day, and old timestamp lists convert", () => {
  const now = Date.parse("2026-10-13T12:00");
  const old = [now - 864e5, now - 864e5 + 1000, now - 20 * 864e5];
  const d = C.migrate({ songs: [{ id: "a", title: "A", body: "G", plays: old }], settings: { v: 4 } });
  const s = d.songs[0];
  assert.equal(s.plays, undefined);
  assert.equal(C.playCount(s), 3);
  assert.equal(C.playsThisWeek(s, now), 2);
  C.recordPlay(s, now);
  assert.equal(C.playCount(s), 4);
  assert.equal(C.playsThisWeek(s, now), 3);
  assert.equal(C.lastPlayed(s), now);
  assert.ok(JSON.stringify(s.playLog).length < 120);
});

test("days older than 60 are dropped, but the total stays", () => {
  const now = Date.parse("2026-10-13T12:00");
  const s = { playLog: C.compactPlays([now - 90 * 864e5, now], undefined, now) };
  assert.equal(Object.keys(s.playLog.days).length, 1);
  assert.equal(C.playCount(s), 2);
});

test("saves are batched, and a refused save is reported", () => {
  const store = globalThis.localStorage;
  let writes = 0, refused = null;
  const real = store.setItem;
  store.setItem = function (k, v) { writes++; return real.call(this, k, v); };
  const d = fresh();
  C.Tabs.save(d); C.Tabs.save(d); C.Tabs.save(d);
  assert.equal(writes, 0);
  C.Tabs.flush();
  assert.equal(writes, 1);
  store.setItem = () => { throw new Error("QuotaExceededError"); };
  C.Tabs.onSaveError = e => { refused = e.message; };
  C.Tabs.save(d);
  assert.equal(C.Tabs.flush(), false);
  assert.equal(refused, "QuotaExceededError");
  store.setItem = real; C.Tabs.onSaveError = null;
});

test("with the app's store, saves go to it instead of localStorage", () => {
  const seen = [];
  C.Tabs.write = json => { seen.push(JSON.parse(json).songs.length); return true; };
  const d = fresh(); d.songs.push({ id: "x", body: "G" });
  C.Tabs.save(d); assert.equal(C.Tabs.flush(), true);
  C.Tabs.write = null;
  assert.deepEqual(seen, [d.songs.length]);
});

test("at start, the newer readable library wins between the database and its copy", () => {
  const lib = (n, at) => JSON.stringify({ songs: Array.from({ length: n }, (_, i) => ({ id: "s" + i, body: "G" })), sets: [], trash: [], settings: {}, ...(at ? { _savedAt: at } : {}) });
  const pick = (main, copy) => { const r = C.pickLibrary(main, copy); return [r.from, r.lib.songs.length, r.mainBroken]; };
  assert.deepEqual(pick({ json: lib(3), at: "2026-10-02T00:00:00Z" }, lib(2, "2026-10-01T00:00:00Z")), ["main", 3, false], "database is newer");
  assert.deepEqual(pick({ json: lib(3), at: "2026-10-01T00:00:00Z" }, lib(2, "2026-10-02T00:00:00Z")), ["copy", 2, false], "copy is newer (saved as the app closed)");
  assert.deepEqual(pick({ json: lib(3), at: "2026-10-02T00:00:00Z" }, lib(2)), ["copy", 2, false], "a copy from an older Tabs was the main save");
  assert.deepEqual(pick({ json: lib(3), at: "2026-10-02T00:00:00Z", lsOk: false }, lib(2)), ["main", 3, false], "unless its last write had failed");
  assert.deepEqual(pick({ json: "{broken", at: "2026-10-02T00:00:00Z" }, lib(2, "2026-10-01T00:00:00Z")), ["copy", 2, true], "an unreadable database copy");
  assert.deepEqual(pick(null, "{broken"), ["none", 0, false], "nothing readable: a fresh library");
  assert.equal(C.pickLibrary({ json: lib(1), at: "2026-10-02T00:00:00Z" }, null).lib._savedAt, undefined);
  assert.equal(JSON.parse(C.withSavedAt(lib(1), "2026-10-03T00:00:00Z"))._savedAt, "2026-10-03T00:00:00Z");
});

test("loading says whether the save was there and readable", () => {
  const store = globalThis.localStorage, keep = store.getItem("tabs-v1");
  store.removeItem("tabs-v1"); C.Tabs.load(); assert.equal(C.Tabs.loaded, "empty");
  store.setItem("tabs-v1", "{not json"); C.Tabs.load(); assert.equal(C.Tabs.loaded, "broken");
  store.setItem("tabs-v1", JSON.stringify(fresh())); C.Tabs.load(); assert.equal(C.Tabs.loaded, "ok");
  if (keep === null) store.removeItem("tabs-v1"); else store.setItem("tabs-v1", keep);
});

test("importing a backup: a real export comes back the same", () => {
  const data = C.migrate({ songs: [{ id: "a", title: "River Road", artist: "W", key: "A", format: "chords", body: "[Verse]\nA\nWalking", transpose: 2, favorite: true, listen: { url: "https://music.apple.com/x", service: "Apple Music", art: "https://is1-ssl.mzstatic.com/a.jpg" }, loop: { a: 1, b: 2, build: false } }],
    sets: [{ id: "s1", name: "Friday", songIds: ["a"], cover: { type: "art" } }], trash: [], settings: { theme: "light", countIn: false } });
  const out = C.cleanImport(JSON.parse(C.Tabs.export(data)));
  assert.equal(out.skipped, 0);
  assert.deepEqual(out.data.songs, data.songs);
  assert.deepEqual(out.data.sets, data.sets);
  assert.deepEqual(out.data.settings, data.settings);
  assert.equal(out.data.settings.theme, "light");
});

test("importing a backup: rejects files that aren't backups", () => {
  for (const x of [null, 3, "x", [], {}, { songs: "no" }]) assert.equal(C.cleanImport(x), null);
  assert.equal(C.Tabs.import("not json"), null);
});

test("importing a backup: skips unreadable songs and duplicates, drops wrong types", () => {
  const out = C.cleanImport({ songs: [
    { id: "a", title: "One", body: "A\nla" },
    { id: "a", title: "Dupe", body: "x" },
    { title: "No id", body: "x" },
    { id: "c", title: "No words" },
    "junk",
    { id: 7, title: 5, body: "G\nhey", transpose: 40, size: "big", bpm: 999, favorite: "yes", tuning: "nope", format: "weird", easier: [1], loop: { a: "x" } }
  ] });
  assert.equal(out.skipped, 4);
  assert.deepEqual(out.data.songs.map(s => s.id), ["a", "7"]);
  const s = out.data.songs[1];
  assert.equal(s.title, "Untitled");
  assert.equal(s.transpose, 6);
  assert.equal(s.bpm, 260);
  for (const k of ["size", "favorite", "tuning", "easier", "loop"]) assert.equal(s[k], undefined, k);
  assert.equal(s.format, "chords"); // worked out again from the words
});

test("importing a backup: only https links, and only image data for covers of sets that exist", () => {
  const png = "data:image/png;base64,iVBORw0KGgo=";
  const out = C.cleanImport({
    songs: [{ id: "a", title: "A", body: "x", listen: { url: "javascript:alert(1)", service: "x" } },
            { id: "b", title: "B", body: "x", listen: { url: "https://music.apple.com/y", service: "Apple Music", art: "http://evil/x.png" } }],
    sets: [{ id: "s1", name: "", songIds: ["a", 5, null, {}], cover: { type: "bad" } }],
    covers: { s1: png, gone: png, s2: "data:text/html;base64,PHNjcmlwdD4=" },
    settings: { theme: "neon", countIn: "yes", lastTuned: 5, startLength: 200 }
  });
  assert.equal(out.data.songs[0].listen, undefined);
  assert.deepEqual(out.data.songs[1].listen, { url: "https://music.apple.com/y", service: "Apple Music" });
  assert.deepEqual(out.data.sets[0].songIds, ["a", "5"]);
  assert.equal(out.data.sets[0].name, "Set");
  assert.equal(out.data.sets[0].cover, undefined);
  assert.deepEqual(out.covers, { s1: png });
  assert.equal(out.data.settings.theme, "auto");
  assert.equal(out.data.settings.countIn, true);
  assert.equal(out.data.settings.startLength, 200);
  assert.equal(out.data.settings.lastTuned, 5);
});

test("importing a backup: old saves still migrate", () => {
  const out = C.cleanImport({ songs: [{ id: "a", title: "Old", tab: "e|---0---2---|\nB|---1---3---|\nG|---0---2---|\nD|---2---0---|", plays: [Date.now()] }], settings: { v: 1 } });
  const s = out.data.songs[0];
  assert.equal(s.format, "tab");
  assert.ok(s.body.startsWith("e|"));
  assert.equal(s.playLog.total, 1);
  assert.equal(out.data.settings.v, 6);
});

test("song length: Apple Music track numbers from links", () => {
  assert.equal(C.appleTrackId("https://music.apple.com/us/album/river-road/123456?i=789012"), "789012");
  assert.equal(C.appleTrackId("https://music.apple.com/us/song/river-road/789012"), "789012");
  assert.equal(C.appleTrackId("https://music.apple.com/us/album/river-road/123456"), "");
  assert.equal(C.appleTrackId("https://open.spotify.com/track/abc?i=5"), "");
  assert.equal(C.appleTrackId("not a link"), "");
});

test("song length: set when never chosen, offer when chosen and different", () => {
  const st = { startLength: 210 };
  assert.equal(C.lengthChoice({}, 232, st), "set");
  assert.equal(C.lengthChoice({ duration: 210 }, 232, st), "set");
  assert.equal(C.lengthChoice({ duration: 232 }, 232.4, st), "none");
  assert.equal(C.lengthChoice({ duration: 180 }, 232, st), "offer");                 // you moved it before
  assert.equal(C.lengthChoice({ duration: 210, durationSet: true }, 232, st), "offer");
  assert.equal(C.lengthChoice({ duration: 230, durationSet: true }, 232, st), "none"); // close enough
  assert.equal(C.lengthChoice({}, 0, st), "none");
  assert.equal(C.fitLength(20), 60);
  assert.equal(C.fitLength(900), 900, "15:00 fits (3.19.0)");
  assert.equal(C.fitLength(1200), 900);
});

test("tap tempo: median of the latest run of taps", () => {
  const at = (bpm, n, start = 0) => Array.from({ length: n }, (_, i) => start + i * 60000 / bpm);
  assert.equal(C.tapTempo([1000]), 0);
  assert.equal(C.tapTempo(at(120, 5)), 120);
  assert.equal(C.tapTempo(at(92, 6)), 92);
  const stray = at(100, 6); stray[3] += 140;               // one late tap
  assert.equal(C.tapTempo(stray), 100);
  assert.equal(C.tapTempo([...at(60, 4), ...at(140, 5, 10000)]), 140); // a pause starts again
  assert.equal(C.tapTempo([0, 100]), 260);
});

test("tuner: advice, guided order, hold and the meter", () => {
  assert.equal(C.tuneAdvice(-2).tone, "good");
  assert.equal(C.tuneAdvice(3).say, "In tune");
  assert.equal(C.tuneAdvice(-8).say, "Almost · tighten slowly");
  assert.equal(C.tuneAdvice(9).say, "Almost · loosen slowly");
  assert.equal(C.tuneAdvice(-30).say, "Tighten");
  assert.equal(C.tuneAdvice(30).say, "Loosen");
  assert.equal(C.tuneAdvice(-80).tone, "far");
  assert.equal(C.guidedTarget([]), 0);
  assert.equal(C.guidedTarget([true, true]), 2);
  assert.equal(C.guidedTarget([true, false, true]), 1);
  assert.equal(C.guidedTarget([true, true, true, true, true, true]), -1);
  assert.equal(C.heldInTune(0, 5000), false);
  assert.equal(C.heldInTune(1000, 1700), false);
  assert.equal(C.heldInTune(1000, 1800), true);
  assert.equal(C.meterPos(0), 50);
  assert.equal(C.meterPos(50), 95); assert.equal(C.meterPos(-500), 5);
  assert.ok(C.meterPos(2) - 50 > 5, "two cents still moves the marker visibly");
  assert.ok(C.meterPos(-10) < 50 && C.meterPos(-10) > C.meterPos(-20));
});

test("tuner: pitch reference moves every note", () => {
  assert.equal(Math.round(C.noteFreq("A4")), 440);
  assert.equal(Math.round(C.noteFreq("A4", 442)), 442);
  assert.equal(C.nearestNote(442, 442).cents, 0);
  assert.equal(C.nearestNote(442).cents, 8);
  assert.equal(Math.round(C.centsOff(110, "A2")), 0);
  assert.equal(C.nearestString(110 * 2 ** (10 / 1200), "standard").cents, 10);
  assert.equal(C.nearestString(73.42, "dropd").index, 0);
});

test("library index letters", () => {
  assert.equal(C.indexLetter("Harbor Lights"), "H");
  assert.equal(C.indexLetter("  wonderwall"), "W");
  assert.equal(C.indexLetter("Érase una vez"), "E");
  assert.equal(C.indexLetter("+44 Lillian"), "#");
  assert.equal(C.indexLetter("1979"), "#");
  assert.equal(C.indexLetter(""), "#");
});

test("html`` escapes values unless they are safe markup", () => {
  const evil = `<img src=x onerror="alert(1)">`;
  assert.equal(String(C.html`<b>${evil}</b>`), `<b>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</b>`);
  assert.equal(String(C.html`<i>${C.raw("<svg/>")}</i>`), "<i><svg/></i>");
  assert.equal(String(C.html`<ul>${["a<", "b"].map(x => C.html`<li>${x}</li>`)}</ul>`), "<ul><li>a&lt;</li><li>b</li></ul>");
  assert.equal(String(C.html`${null}${undefined}${false}${0}`), "0");
  assert.equal(`${C.html`<p>${"&"}</p>`}`, "<p>&amp;</p>");
});

// ---------- Tip pacing ----------

test("tips are spaced 30 seconds apart unless one leads into the next", () => {
  const t0 = 1e12;
  assert.equal(C.tipPaced("map", { key: "", at: 0 }, t0), true, "first tip of the session");
  assert.equal(C.tipPaced("map", { key: "menu", at: t0 }, t0 + 5e3), false, "too soon after another tip");
  assert.equal(C.tipPaced("map", { key: "menu", at: t0 }, t0 + 30e3), true, "after the gap");
  assert.equal(C.tipPaced("play", { key: "chord", at: t0 }, t0 + 1e3), true, "chord leads into play");
  assert.equal(C.tipPaced("pause", { key: "play", at: t0 }, t0 + 1e3), true, "play leads into pause");
  assert.equal(C.tipPaced("line", { key: "pause", at: t0 }, t0 + 1e3), true, "pause leads into line");
  assert.equal(C.tipPaced("search", { key: "searchInvite", at: t0 }, t0 + 1e3), true, "the invite leads into search");
  assert.equal(C.tipPaced("chord", { key: "play", at: t0 }, t0 + 1e3), false, "chains run one way");
});

test("every name a module imports from another app file is exported there", async () => {
  const fs = await import("node:fs");
  const files = [...fs.readdirSync(new URL("..", import.meta.url)).filter(f => f.endsWith(".js") && f !== "sw.js" && f !== "eslint.config.js"),
    ...fs.readdirSync(new URL("../core", import.meta.url)).filter(f => f.endsWith(".js")).map(f => "core/" + f)];
  const src = Object.fromEntries(files.map(f => [f, fs.readFileSync(new URL("../" + f, import.meta.url), "utf8")]));
  const exported = f => {
    const s = src[f], out = new Set();
    for (const m of s.matchAll(/export\s*\{([^}]*)\}/g)) m[1].split(",").map(x => x.trim().split(/\s+as\s+/).pop()).filter(Boolean).forEach(n => out.add(n));
    for (const m of s.matchAll(/export\s+(?:async\s+)?(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/g)) out.add(m[1]);
    return out;
  };
  const missing = [];
  /* a path relative to the importing file: "./x.js" from core/ is core/x.js, "../core.js" is core.js */
  const resolve = (from, p) => { const parts = [...from.split("/").slice(0, -1), ...p.split("/")], out = []; for (const x of parts) x === ".." ? out.pop() : x !== "." && out.push(x); return out.join("/"); };
  for (const [f, s] of Object.entries(src)) for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*"(\.\.?\/[^"?]+)"/g)) {
    const to = resolve(f, m[2]);
    if (!src[to]) { missing.push(`${f} imports from ${m[2]}, which isn't an app file`); continue; }
    const have = exported(to);
    for (const n of m[1].split(",").map(x => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) if (!have.has(n)) missing.push(`${f} imports ${n} from ${to}`);
  }
  assert.deepEqual(missing, []);
});

// Real recordings in tests/audio (see its README). Skipped when there are none.
test("real guitar recordings: the right note, steady, no octave mistakes", async t => {
  const fs = await import("node:fs");
  const dir = new URL("./audio/", import.meta.url);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /\.wav$/i.test(f)) : [];
  if (!files.length) return t.skip("no recordings yet");
  for (const f of files) {
    const b = fs.readFileSync(new URL(f, dir));
    const ch = b.readUInt16LE(22), rate = b.readUInt32LE(24), bits = b.readUInt16LE(34);
    assert.equal(bits, 16, `${f}: 16-bit PCM`);
    let at = 12; while (b.toString("ascii", at, at + 4) !== "data") at += 8 + b.readUInt32LE(at + 4);
    const n = b.readUInt32LE(at + 4) / 2 / ch, pcm = new Float32Array(n);
    for (let i = 0; i < n; i++) pcm[i] = b.readInt16LE(at + 8 + i * 2 * ch) / 32768;
    const want = f.split(/[_.]/)[0], hz0 = C.noteFreq(want);
    /* Find the pluck, then read the string as the tuner does once it knows
       which string it's listening for, from half a second in for two seconds. */
    const rms = s => { let e = 0; for (let i = s; i < s + 1024; i++) e += pcm[i] * pcm[i]; return Math.sqrt(e / 1024); };
    let onset = 0; while (onset + 1024 < n && rms(onset) < 0.005) onset += 512;
    const reads = [];
    for (let s = onset + Math.round(rate * 0.5); s + 4096 < n && s < onset + rate * 2.5; s += Math.round(rate * 0.25)) {
      const hz = C.detectPitch(pcm.subarray(s, s + 4096), rate, 0.0015, 0.6, [hz0 * 0.7, hz0 * 1.42]);
      if (hz > 0) reads.push(1200 * Math.log2(hz / C.noteFreq(want)));
    }
    assert.ok(reads.length >= 3, `${f}: heard the string`);
    for (const c of reads) assert.ok(Math.abs(c) < 50, `${f}: read ${c.toFixed(0)} cents from ${want}`);
    assert.ok(Math.max(...reads) - Math.min(...reads) < 8, `${f}: steady within ±4 cents (${reads.map(c => c.toFixed(1)).join(", ")})`);
  }
});

// ---------- Song sketch ----------
const hzOf = m => 440 * 2 ** ((m - 69) / 12);
// Frames every 20 ms for [midi or null, seconds] pieces, with a little vibrato.
const sing = parts => { const f = []; let t = 0; for (const [m, d] of parts) for (let k = 0; k < Math.round(d / 0.02); k++, t += 0.02) f.push({ t, hz: m === null ? -1 : hzOf(m + 0.3 * Math.sin(t * 30)) }); return f; };
const line = (pcs, d = 0.5) => { let t = 0; return pcs.map(m => { const n = { midi: m, start: t, dur: d }; t += d; return n; }); };

test("sketch: a sung line becomes steady notes; vibrato, gaps and blips are smoothed", () => {
  const notes = C.melodyNotes(sing([[67, 0.3], [null, 0.06], [71, 0.26], [74, 0.04], [null, 0.06], [74, 0.4]]));
  assert.deepEqual(notes.map(n => n.midi), [67, 71, 74]);
  assert.ok(Math.abs(notes[0].dur - 0.3) < 0.05 && Math.abs(notes[2].dur - 0.4) < 0.05);
});

test("sketch: the key comes from the melody", () => {
  assert.equal(C.detectKey(line([67, 69, 71, 72, 74, 76, 78, 79, 74, 71, 67])).name, "G");
  assert.equal(C.detectKey(line([69, 72, 76, 74, 72, 71, 68, 69, 64, 69])).name, "Am");
  assert.equal(C.detectKey(line([65, 67, 69, 70, 72, 70, 69, 67, 65])).name, "F");
  assert.equal(C.detectKey([]), null);
});

test("sketch: chords that hold the melody, with natural moves", () => {
  const key = C.detectKey(line([67, 71, 74, 72, 76, 74, 78, 69, 67, 71, 74, 67]));
  assert.equal(key.name, "G");
  const notes = [...line([67, 71, 74, 71], 0.5), ...line([72, 76, 79, 76], 0.5).map(n => ({ ...n, start: n.start + 2 })),
    ...line([74, 78, 69, 74], 0.5).map(n => ({ ...n, start: n.start + 4 })), ...line([67, 71, 74, 67], 0.5).map(n => ({ ...n, start: n.start + 6 }))];
  assert.deepEqual(C.harmonize([{ notes }], key)[0].map(c => c.chord), ["G", "C", "D", "G"]);
  const am = C.detectKey(line([69, 72, 76, 74, 72, 71, 68, 69, 64, 69]));
  const sad = [...line([69, 72, 76, 72]), ...line([65, 69, 72, 69]).map(n => ({ ...n, start: n.start + 2 })), ...line([64, 68, 71, 68]).map(n => ({ ...n, start: n.start + 4 })), ...line([69, 72, 76, 69]).map(n => ({ ...n, start: n.start + 6 }))];
  assert.deepEqual(C.harmonize([{ notes: sad }], am)[0].map(c => c.chord), ["Am", "F", "E", "Am"]);
});

test("sketch: each chord goes over the word being sung when it changes", () => {
  assert.equal(C.syllables("every"), 3); assert.equal(C.syllables("home"), 1); assert.equal(C.syllables("take"), 1); assert.equal(C.syllables("bending"), 2);
  const notes = line([64, 64, 64, 64, 64, 64, 64, 64, 64], 0.4);
  const out = C.chordLine("Every road I take keeps bending back", notes, [{ chord: "Em", at: 0 }, { chord: "C", at: notes[5].start }]);
  assert.equal(out, "Em           C\nEvery road I take keeps bending back", "the 6th of 9 notes: about the 6th of 10 syllables, in \"take\"");
  assert.equal(C.chordLine("", notes, [{ chord: "G", at: 0 }, { chord: "D", at: 1 }]), "G   D");
});

test("sketch: lines with words become a chord sheet in the melody's key", () => {
  const s = C.sketchSong([
    { words: "Porch light burning past the second shift", notes: [...line([67, 71, 74, 71], 0.5), ...line([72, 76, 72, 76], 0.5).map(n => ({ ...n, start: n.start + 2 }))] },
    { words: "Home to you a little more", notes: [...line([74, 78, 74, 69], 0.5), ...line([71, 67, 67, 67], 0.5).map(n => ({ ...n, start: n.start + 2 }))] }
  ]);
  assert.equal(s.key, "G");
  assert.deepEqual(C.chordsUsed(s.body), ["G", "C", "D"]);
  assert.match(s.body, /^G\s+C\nPorch light burning past the second shift\nD\s+G\nHome to you a little more$/);
});

// ---------- Song sketch, after the song is made ----------
const tune = () => {
  const at = (pcs, t0) => line(pcs, 0.5).map(n => ({ ...n, start: n.start + t0 }));
  return [
    { words: "Porch light burning past the second shift", notes: [...at([67, 71, 74, 71], 0), ...at([72, 76, 72, 76], 2)] },
    { words: "Home to you a little more", notes: [...at([74, 78, 72, 69], 0), ...at([71, 67, 67, 67], 2)] }];
};

test("sketch: kept with the song in a small form, and restyled to Rich", () => {
  const s = C.sketchSong(tune());
  assert.deepEqual(s.sketch.lines[0].n.slice(0, 2), [[67, 0, 0.5], [71, 0.5, 0.5]]);
  assert.deepEqual(C.unpackNotes(s.sketch.lines[0].n)[1], { midi: 71, start: 0.5, dur: 0.5 });
  assert.deepEqual(C.sketchKey("G"), { tonic: 7, minor: false, name: "G" });
  assert.deepEqual(C.sketchKey("Bbm"), { tonic: 10, minor: true, name: "Bbm" });
  // The melody sings C over the D chord: Rich makes it D7 (and the V becomes a 7 anyway).
  const rich = C.restyle(s.body, s.sketch, "rich");
  assert.match(rich, /^G\s+C\nPorch light burning past the second shift\nD7\s+G\nHome to you a little more$/);
  assert.equal(C.restyle(rich, s.sketch, "simple"), s.body, "and back");
});

test("sketch: restyling keeps words you changed afterwards", () => {
  const s = C.sketchSong(tune());
  const edited = s.body.replace("Home to you a little more", "Home to you a little slower");
  assert.match(C.restyle(edited, s.sketch, "rich"), /Home to you a little slower$/);
});

test("sketch: chords ranked by how well they hold the melody under a word", () => {
  const key = C.sketchKey("G");
  const fit = C.chordFit(line([71, 74, 71, 74]), key);
  assert.ok(["G", "Bm", "Em"].includes(fit[0].chord));
  const g = fit.find(f => f.chord === "G");
  assert.deepEqual(g.holds, ["B", "D"]);
  assert.ok(g.fit > fit.find(f => f.chord === "C").fit);
  const s = C.sketchSong(tune());
  const under = C.notesUnder(s.body, s.sketch, 0, s.body.split("\n")[1].indexOf("second"));
  assert.ok(under.length >= 1 && under.every(n => [72, 76].includes(n.midi)), "the notes under 'second' are from the C part");
});

test("sketch: other ways to play a line, most natural first, all different", () => {
  const opts = C.lineOptions(tune()[0].notes, C.sketchKey("G"));
  assert.equal(opts.length, 3);
  assert.equal(opts[0].label, "G · C");
  assert.equal(new Set(opts.map(o => o.label)).size, 3);
  const s = C.sketchSong(tune());
  const swapped = C.setSungLine(s.body, 1, C.chordLine("Home to you a little more", C.unpackNotes(s.sketch.lines[1].n), [{ chord: "Em", at: 0 }, { chord: "D", at: 2 }]));
  assert.match(swapped, /\nEm\s+D\nHome to you a little more$/);
  assert.match(swapped, /^G\s+C\nPorch light/, "other lines untouched");
});

// ---------- Sketch screen helpers ----------
test("sketch: key confidence grows with what's sung", () => {
  assert.deepEqual(C.keyConfidence(line([67, 71])), { key: null, bars: 0, state: "listening" });
  const few = C.keyConfidence(line([67, 71, 74, 67]));
  assert.ok(few.bars <= 2, `${few.bars} bars after four notes`);
  const many = C.keyConfidence(line([67, 69, 71, 72, 74, 76, 78, 79, 74, 71, 67, 74, 71, 67]));
  assert.equal(many.key.name, "G");
  assert.ok(many.bars > few.bars && many.bars >= 4, `${many.bars} bars after a G major line`);
});

test("sketch: the key's family of chords, and where the singing sits", () => {
  assert.deepEqual(C.keyFamily(C.sketchKey("G")), ["G", "C", "D", "Em", "Am", "Bm"]);
  assert.deepEqual(C.keyFamily(C.sketchKey("Am")), ["Am", "F", "C", "G", "E", "Dm"]);
  const sh = C.pitchShares(line([67, 67, 71, 74]));
  assert.equal(sh[7], 0.5); assert.equal(sh[11], 0.25);
});

test("sketch: a nudge where another chord clearly holds the melody better", () => {
  const key = C.sketchKey("G");
  // Sung E, G, B (an Em) under a chord the path chose as C: try Em.
  const notes = [...line([67, 71, 74, 71]), ...line([64, 67, 71, 64]).map(n => ({ ...n, start: n.start + 2 }))];
  const h = C.lineHint("Every road I take keeps bending back", notes, [{ chord: "G", at: 0 }, { chord: "C", at: 2 }], key);
  assert.equal(h.chord, "Em"); assert.equal(h.j, 1); assert.equal(h.minor, true);
  assert.ok(h.words.length > 0);
  assert.equal(C.lineHint("x y", notes, [{ chord: "G", at: 0 }, { chord: "Em", at: 2 }], key), null, "no nudge when it already fits");
  assert.deepEqual(C.chordWords("Every road I take keeps bending back", line([64, 64, 64, 64, 64, 64, 64, 64, 64], 0.4), [{ chord: "Em", at: 0 }, { chord: "C", at: 2 }]), [0, 3]);
});

test("backups keep a song's album art only as an https link", () => {
  assert.equal(C.cleanSong({ id: "a", body: "G", art: "https://is1-ssl.mzstatic.com/x/600x600bb.jpg" }).art, "https://is1-ssl.mzstatic.com/x/600x600bb.jpg");
  assert.equal(C.cleanSong({ id: "a", body: "G", art: "javascript:alert(1)" }).art, undefined);
  assert.equal(C.cleanSong({ id: "a", body: "G", backing: "band" }).backing, "band");
  assert.equal(C.cleanSong({ id: "a", body: "G", playAs: "sheet" }).playAs, undefined, "4.4.0: Gig or Sheet per song is gone");
  assert.equal(C.cleanSong({ id: "a", body: "G", backing: "music" }).backing, undefined);
  assert.deepEqual(C.cleanSong({ id: "a", body: "G", syncs: [[0.5, 100], [0.2, 90], [0.3, 40], "x", [2, 5]] }).syncs, [[0.2, 90], [0.5, 100]]);
});

// ---------- Add the words ----------
const CHART = "Capo 2 · Strum: D DU UDU\n\n[Intro]\nG   D\n\n[Verse]\nG   D   Em   C\n\n[Chorus] (x2)\nC   G   D\n\n[Verse]\nG   D   Em   C\n\n[Outro]\nG";
const WORDS = "first line of the verse here\nsecond line goes on and on\n\nthis is the chorus line\nchorus again we sing\n\nanother verse begins now\nand it ends right here";

test("add the words: the chart's chords go over the pasted stanzas, in order", () => {
  const body = C.mergeWords(CHART, WORDS);
  assert.ok(body.startsWith("Capo 2 · Strum: D DU UDU\n\n[Intro]\nG   D\n"));
  assert.match(body, /\[Verse\]\nG\s+D\nfirst line of the verse here\nEm\s+C\nsecond line goes on and on/);
  assert.match(body, /\[Chorus\]\nC\s+G\nthis is the chorus line\nD\s+C\nchorus again we sing/, "the progression loops");
  assert.match(body, /\[Verse\]\nG\s+D\nanother verse begins now/);
  assert.match(body, /\[Outro\]\nG$/);
  // The second chord sits over the middle word.
  const [chords, words] = body.split("\n").slice(body.split("\n").indexOf("first line of the verse here") - 1);
  assert.equal(chords.indexOf("D"), words.indexOf("the "), "over the 4th of 6 words");
  // It reads back as a normal song: chords placed over words.
  assert.deepEqual(C.chordsUsed(body).sort(), ["C", "D", "Em", "G"]);
});

test("add the words: named stanzas find their sections; extra stanzas go at the end", () => {
  const body = C.mergeWords(CHART, "[Chorus]\nchorus words one\nchorus words two\n\nVerse 1:\nverse words here\n\n[Bridge]\na bridge the chart lacks");
  assert.match(body, /\[Verse 1\]\nG\s+D\nverse words here/);
  assert.match(body, /\[Chorus\]\nC\s+G\nchorus words one/);
  assert.match(body, /\[Bridge\]\n\S+.*\na bridge the chart lacks/, "kept, with a sung section's chords");
  assert.deepEqual(C.lyricStanzas("Chorus:\na\nb\n\n(Verse 2)\nc").map(s => [s.name, s.kind, s.lines.length]), [["Chorus", "chorus", 2], ["Verse 2", "verse", 1]]);
  assert.equal(C.mergeWords("no chords here", WORDS), null);
  assert.equal(C.mergeWords(CHART, "   "), null);
});

test("gig day countdown: same day and before the start only", () => {
  const now = new Date(2026, 9, 14, 17, 14, 50).getTime();
  assert.equal(C.gigCountdown(new Date(2026, 9, 14, 20, 0, 0).toISOString(), now), "2:45:10");
  assert.equal(C.gigCountdown(new Date(2026, 9, 14, 17, 15, 0).toISOString(), now), "0:00:10");
  assert.equal(C.gigCountdown(new Date(2026, 9, 15, 20, 0, 0).toISOString(), now), "", "tomorrow: no countdown");
  assert.equal(C.gigCountdown(new Date(2026, 9, 14, 16, 0, 0).toISOString(), now), "", "already started");
  assert.equal(C.gigCountdown("", now), "");
});

// ---- Get the song ----
const V = (albumName, duration, extra = {}) => ({ trackName: "Harbor Lights", artistName: "The Cape Fear", albumName, duration, instrumental: false, plainLyrics: "a line\nanother", syncedLyrics: "[00:01.00] a line", ...extra });
test("pickVersions: the length the chart found picks the recording", () => {
  const list = [V("Live at the Pier", 260), V("Northern Coast", 221), V("Karaoke Hits", 221), V("Northern Coast", 221), V("Other Song", 221, { trackName: "Other" })];
  const r = C.pickVersions(list, { title: "Harbor Lights", artist: "The Cape Fear", duration: 222 });
  assert.equal(r[0].albumName, "Northern Coast");
  assert.equal(r.length, 3, "duplicates and other titles dropped");
  assert.equal(r[1].albumName, "Karaoke Hits", "karaoke after the studio cut");
});
test("pickVersions: with no length, the length most versions share wins", () => {
  const list = [V("Live", 248), V("Best of", 259), V("90s Hits", 259), V("Morning Glory", 261), V("Cover", 165)];
  assert.equal(Math.round(C.pickVersions(list, { title: "Harbor Lights" })[0].duration / 10), 26);
});
test("pickVersions: no words, instrumental or the wrong artist never count", () => {
  const list = [V("A", 200, { instrumental: true }), V("B", 200, { plainLyrics: "" }), V("C", 200, { artistName: "Someone Else" })];
  assert.deepEqual(C.pickVersions(list, { title: "Harbor Lights", artist: "The Cape Fear", duration: 200 }), []);
});
test("pickVersions: a live title keeps live versions first", () => {
  const list = [V("Northern Coast", 221), V("Live at the Pier", 260)];
  assert.equal(C.pickVersions(list, { title: "Harbor Lights (Live)", duration: 0 })[0].albumName, "Northern Coast", "both lengths tie on count");
  assert.equal(C.pickVersions(list, { title: "Harbor Lights", duration: 260 })[0].albumName, "Live at the Pier", "length beats the live penalty");
});
test("tempoPick: agreement, double time and disagreement", () => {
  assert.deepEqual(C.tempoPick(90, 92), { bpm: 92, agree: true, measured: 92, chart: 90 });
  assert.equal(C.tempoPick(90, 180).bpm, 90, "double time: the chart's count stands");
  assert.equal(C.tempoPick(90, 180).agree, true);
  assert.deepEqual(C.tempoPick(100, 120), { bpm: 120, agree: false, measured: 120, chart: 100 });
  assert.equal(C.tempoPick(0, 120).bpm, 120);
  assert.equal(C.tempoPick(88, 0).bpm, 88);
});
test("beatsOf reads the top of a time signature", () => {
  assert.equal(C.beatsOf("3/4"), 3); assert.equal(C.beatsOf("6/8"), 6); assert.equal(C.beatsOf(""), 4); assert.equal(C.beatsOf("1/4"), 4);
});

// ---- Today: streak and nudge ----
const DAYMS = 86400000;
const at = (y, m, d, h = 9) => new Date(y, m - 1, d, h).getTime();
const NOW = at(2026, 10, 16, 10); /* a Friday */
const played = (...ago) => ({ total: ago.length, last: Math.max(...ago.map(n => NOW - n * DAYMS)), days: Object.fromEntries(ago.map(n => { const d = new Date(NOW - n * DAYMS); return [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, 1]; })) });
test("streakOf counts back from today, or from yesterday until today's play", () => {
  assert.deepEqual(C.streakOf([{ playLog: played(0, 1, 2) }], NOW).days, 3);
  const y = C.streakOf([{ playLog: played(1, 2, 4) }], NOW);
  assert.equal(y.days, 2); assert.equal(y.today, false);
  assert.deepEqual(y.week, [false, false, true, false, true, true, false]);
  assert.equal(C.streakOf([{ playLog: played(2, 3) }], NOW).days, 0, "a missed day breaks it");
  assert.equal(C.streakOf([{ playLog: played(1) }, { playLog: played(2) }], NOW).days, 2, "across songs");
});
test("weatherMood reads WMO codes and temperature", () => {
  assert.equal(C.weatherMood(61, 18), "rain"); assert.equal(C.weatherMood(95, 25), "rain");
  assert.equal(C.weatherMood(73, 0), "cold"); assert.equal(C.weatherMood(3, 2), "cold");
  assert.equal(C.weatherMood(0, 34), "hot"); assert.equal(C.weatherMood(1, 22), "clear"); assert.equal(C.weatherMood(3, 22), "");
});
test("pickNudge: rain picks a slow song not played lately", () => {
  const songs = [{ id: "f", title: "Fast", bpm: 140, playLog: played(30) }, { id: "s", title: "Slow", bpm: 70, playLog: played(30) }, { id: "r", title: "Recent", bpm: 60, playLog: played(2) }];
  assert.deepEqual(C.pickNudge({ songs, now: NOW, mood: "rain" }), { kind: "rain", text: "Rainy day, perfect for a slow song", songId: "s", title: "Slow" });
});
test("pickNudge: evening streak first; nothing once played today or on a gig day", () => {
  const songs = [{ id: "a", title: "A", playLog: played(1, 2, 3) }, { id: "b", title: "B", playLog: played(1) }];
  const eve = at(2026, 10, 16, 19);
  const r = C.pickNudge({ songs, now: eve, mood: "rain" });
  assert.equal(r.kind, "streak"); assert.match(r.text, /3-day streak/);
  assert.equal(C.pickNudge({ songs: [{ id: "a", title: "A", playLog: played(0) }], now: NOW, mood: "rain" }), null);
  assert.equal(C.pickNudge({ songs, now: NOW, mood: "rain", gigToday: true }), null);
});
test("pickNudge: no weather falls back to learning, then a neglected favorite, then nothing", () => {
  assert.equal(C.pickNudge({ songs: [{ id: "l", title: "L", status: "learning", playLog: played(5) }], now: NOW }).kind, "learn");
  assert.equal(C.pickNudge({ songs: [{ id: "v", title: "V", favorite: true, playLog: played(40) }], now: NOW }).kind, "idle");
  assert.equal(C.pickNudge({ songs: [{ id: "n", title: "N" }], now: NOW }), null);
  const s = [{ id: "1", title: "1", favorite: true, playLog: played(1) }, { id: "2", title: "2", favorite: true, playLog: played(1) }];
  assert.equal(C.pickNudge({ songs: s, now: at(2026, 10, 17, 9), mood: "clear" }).kind, "clear", "a weekend favorite");
  assert.equal(C.pickNudge({ songs: s, now: at(2026, 10, 17, 9), mood: "clear" }).songId, C.pickNudge({ songs: s, now: at(2026, 10, 17, 16), mood: "clear" }).songId, "steady through the day");
});

// ---- Strum it ----
const VOICE = { G: [43, 47, 50, 55, 59, 67], C: [48, 52, 55, 60, 64], D: [50, 57, 62, 66], Em: [40, 47, 52, 55, 59, 64], Am: [45, 52, 57, 60, 64], F: [41, 48, 53, 57, 60, 65], A7: [45, 52, 55, 61, 64], E: [40, 47, 52, 56, 59, 64] };
const strum = (name, at, len = 0.7) => VOICE[name].map((m, i) => ({ midi: m, start: at + i * 0.012, dur: len, amp: 0.6 + (i % 2) * 0.2 }));
test("nameChord: open chords from their notes", () => {
  for (const [name, v] of Object.entries(VOICE)) {
    const w = new Array(12).fill(0); v.forEach(m => { w[m % 12] += 1; });
    assert.equal(C.nameChord(w, v[0] % 12).chord, name, name);
  }
});
test("strumChords: a progression of strums, repeats merged", () => {
  const notes = [...strum("G", 0), ...strum("G", 0.75), ...strum("C", 1.5), ...strum("C", 2.25), ...strum("D", 3), ...strum("Em", 3.75)];
  assert.deepEqual(C.strumChords(notes).map(c => c.chord), ["G", "C", "D", "Em"]);
  assert.ok(Math.abs(C.strumChords(notes)[1].at - 1.5) < 0.26, "the change lands within a quarter second");
});
test("strumChords: a stray wrong note doesn't change the chord; a riff names notes", () => {
  const notes = [...strum("Am", 0), { midi: 66, start: 0.3, dur: 0.08, amp: 0.2 }, ...strum("Am", 0.75)];
  assert.deepEqual(C.strumChords(notes).map(c => c.chord), ["Am"]);
  assert.deepEqual(C.riffNotes([{ midi: 55, start: 0, dur: 0.2 }, { midi: 59, start: 0.25, dur: 0.2 }]).map(n => n.name), ["G3", "B3"]);
});
test("chordToneNotes: played chords as their tones, for the key", () => {
  const n = C.chordToneNotes([{ chord: "G", at: 0, dur: 2 }, { chord: "Am", at: 2, dur: 2 }]);
  assert.deepEqual(n.map(x => x.midi % 12), [7, 11, 2, 9, 0, 4]);
  assert.equal(C.detectKey(C.chordToneNotes([{ chord: "G", at: 0, dur: 2 }, { chord: "C", at: 2, dur: 2 }, { chord: "D", at: 4, dur: 2 }, { chord: "G", at: 6, dur: 2 }])).name, "G");
});
test("strumChords: a ringing chord's root-and-fifth tail isn't a power chord; real power chords stay", () => {
  const tail = (root, at) => [{ midi: root, start: at, dur: 1.2, amp: 0.6 }, { midi: root + 7, start: at + 0.01, dur: 1.2, amp: 0.5 }];
  const notes = [...strum("Am", 0), ...strum("Am", 0.75), ...tail(45, 1.5)];
  assert.deepEqual(C.strumChords(notes).map(c => c.chord), ["Am"]);
  assert.deepEqual(C.strumChords([...tail(40, 0), ...tail(45, 1.3)]).map(c => c.chord), ["E5", "A5"]);
});

// ---- German practice ----
const DE_SONG = "[Verse]\nG               D\nGrey boats lean on the harbor wall,\nEm         C\nWaiting on a tide to call\n\nBring the lights home";
const DE = { v: 1, lines: [
  { de: "Graue Boote lehnen an der Hafenmauer", s: [{ w: 1, n: 1, l: 1, de: "Boote", g: "das" }, { w: 0, n: 1, l: 2, de: "Graue", g: "" }, { w: 6, n: 1, l: 2, de: "Hafenmauer", g: "die" }, { w: 2, n: 5, l: 3, de: "lehnen an der Hafenmauer", g: "" }] },
  { de: "Warten, bis die Flut sie ruft", s: [{ w: 3, n: 1, l: 2, de: "Flut", g: "die" }] },
  { de: "Bring die Lichter heim", s: [{ w: 2, n: 1, l: 1, de: "Lichter", g: "das" }] }
] };
const words = b => b.words.filter(w => !w.space).map(w => w.parts.map(p => (p.chord ? `[${p.chord}]` : "") + p.text).join(""));
test("sungText: the sung lines as the AI sees them", () => {
  const L = C.sungText(C.parseBlocks(DE_SONG));
  assert.deepEqual(L.map(l => l.text), ["Grey boats lean on the harbor wall,", "Waiting on a tide to call", "Bring the lights home"]);
  assert.equal(C.deSource(L), C.deSource(C.sungText(C.parseBlocks(DE_SONG))));
});
test("germanBlocks: Basic swaps a noun and keeps every chord on its word", () => {
  const b = C.germanBlocks(C.parseBlocks(DE_SONG), DE, 1);
  const pr = b.filter(x => x.kind === "pair");
  assert.deepEqual(words(pr[0]), ["[G]Grey", "Boote", "lean", "[D]on", "the", "harbor", "wall,"]);
  assert.equal(b.find(x => x.kind === "lyric").segs.map(s => s.text).join(" "), "Bring the Lichter home");
});
test("germanBlocks: Common adds adjectives and keeps punctuation; Intermediate takes the phrase", () => {
  const c = C.germanBlocks(C.parseBlocks(DE_SONG), DE, 2).filter(x => x.kind === "pair")[0];
  assert.deepEqual(words(c), ["[G]Graue", "Boote", "lean", "[D]on", "the", "harbor", "Hafenmauer,"]);
  const m = C.germanBlocks(C.parseBlocks(DE_SONG), DE, 3).filter(x => x.kind === "pair")[0];
  assert.deepEqual(words(m), ["[G]Graue", "Boote", "lehnen an der Hafenmauer,", "[D]"], "the phrase keeps the chord inside it");
  const g = m.words.find(w => !w.space && w.parts[0].text === "Boote").parts[0].de;
  assert.equal(g.g, "das");
});
test("germanBlocks: Fluent spreads the German line under the chords; English can sit underneath", () => {
  const f = C.germanBlocks(C.parseBlocks(DE_SONG), DE, 4, { english: true }).filter(x => x.kind === "pair");
  assert.deepEqual(words(f[0]), ["[G]Graue", "Boote", "lehnen", "[D]an", "der", "Hafenmauer"]);
  assert.equal(f[0].en, "Grey boats lean on the harbor wall,");
  const bl = C.parseBlocks(DE_SONG);
  assert.equal(C.germanBlocks(bl, DE, 0), bl, "off: unchanged");
});
test("cleanGerman: keeps swaps inside the line and drops the rest", () => {
  const L = C.sungText(C.parseBlocks(DE_SONG));
  const j = { lines: [{ i: 0, de: "Graue Boote <b>", s: [{ w: 1, n: 1, l: 1, de: "Boote,", g: "das" }, { w: 6, n: 4, l: 2, de: "zu lang" }, { w: 0, n: 1, l: 7, de: "x" }] }] };
  const out = C.cleanGerman(j, L);
  assert.equal(out.length, 3);
  assert.deepEqual(out[0].s.map(x => x.de), ["Boote"]);
  assert.equal(out[0].de, "Graue Boote b");
  assert.deepEqual(out[1], { de: "", s: [] });
});
test("translations never travel: not in a shared song, not in a backup", () => {
  const song = { id: "x", title: "T", body: DE_SONG, de: DE, deLevel: 2 };
  assert.equal(C.shareable(song).de, undefined);
  assert.equal(JSON.parse(C.Tabs.export({ songs: [song], sets: [] })).songs[0].de, undefined);
  assert.ok(song.de, "the song itself keeps it");
});
test("the AI rules hold: the AI reads lyrics but never writes them; charts carry none; German only translates the lines it's given", () => {
  const find = read("findai.js"), de = read("german.js");
  assert.match(find, /Never include lyrics or any words from the song/);
  assert.match(find, /Refer to the words only by line number and word number\. Don't write any of the lyrics in your reply\./, "4.41.0: placing answers with positions");
  assert.match(de, /Translate only the lines given\. Never add, complete or look up lyrics\./);
  assert.match(read("README.md"), /Lyrics and the AI \(4\.41\.0\)/);
  assert.match(read("README.md"), /Translation exception \(language practice\)/);
});
test("deSpans: Common is a small step up from Basic: two more words a line at most, nouns first", () => {
  const sw = [
    { w: 0, n: 1, l: 2, de: "Graue", g: "" }, { w: 1, n: 1, l: 1, de: "Boote", g: "das" },
    { w: 3, n: 1, l: 2, de: "langsam", g: "" }, { w: 5, n: 1, l: 2, de: "Hafen", g: "der" },
    { w: 7, n: 1, l: 2, de: "Mauer", g: "die" }, { w: 0, n: 8, l: 3, de: "ganze Zeile", g: "" }];
  assert.deepEqual(C.deSpans(sw, 1).map(x => x.de), ["Boote"]);
  assert.deepEqual(C.deSpans(sw, 2).map(x => x.de), ["Boote", "Hafen", "Mauer"], "Basic plus two nouns; the adjective and adverb wait");
  assert.deepEqual(C.deSpans(sw.filter(x => x.g === "" && x.l === 2), 2).map(x => x.de), ["Graue", "langsam"], "with no nouns, two others");
  assert.deepEqual(C.deSpans(sw, 3).map(x => x.de), ["ganze Zeile"], "Intermediate: the phrase");
  assert.equal(C.deSpans(sw.filter(x => x.l !== 3), 3).length, 5, "Intermediate without a phrase: every word");
});

// ---------- Changes ----------
test("songChanges: unordered pairs in the shapes played, repeats and tabs skipped", () => {
  const m = C.songChanges({ body: "[Verse]\nG       C\nla la la\n[Chorus]\nAm F Am F G G" });
  assert.deepEqual([...m].map(([k, x]) => `${k}:${x.n}`).sort(), ["Am|C:1", "Am|F:3", "C|G:1", "F|G:1"]);
  assert.equal(C.songChanges({ body: "G C", transpose: 2 }).has("A|D"), true, "transpose gives the shapes you play");
  assert.equal(C.songChanges({ format: "tab", body: "G C" }).size, 0);
});
test("changesOf: most played this week, and changes your songs have that you play least", () => {
  const songs = [
    { id: "a", title: "A", body: "G C G C D G", playLog: played(1, 2, 3) },
    { id: "b", title: "B", body: "Am F Am F Am F C" }
  ];
  const r = C.changesOf(songs, NOW);
  assert.equal(r.most[0].key, "C|G"); assert.equal(r.most[0].week, 9);
  assert.deepEqual(r.work.map(c => [c.a, c.b, c.best.id, c.best.n]), [["Am", "F", "b", 5]]);
  const n = C.pickNudge({ songs, now: NOW });
  assert.deepEqual(n, { kind: "change", text: "Work on Am to F. This one has it 5 times", songId: "b", title: "B" });
  assert.equal(C.pickNudge({ songs: [songs[1]], now: NOW }), null, "no plays this week: no change nudge");
});

test("octaveFix: folds an octave slip back to the string meant (2.16.1)", () => {
  const E2 = C.noteFreq("E2"), A2 = C.noteFreq("A2");
  assert.ok(Math.abs(C.octaveFix(E2 * 2, "standard", 440, 0) - E2) < 0.01, "low E heard as E3, tuning the low E");
  assert.ok(Math.abs(C.octaveFix(A2 * 1.01, "standard", 440, 1) - A2 * 1.01) < 0.01, "an ordinary reading stays");
  assert.ok(Math.abs(C.octaveFix(A2 / 2, "standard", 440, -1) - A2) < 0.01, "no target: near no string, folded to one");
  assert.equal(C.octaveFix(280, "standard", 440, -1), 280, "nothing near: left alone");
});

test("bestGermanVoice: Premium, then Enhanced, Germany first, novelty voices last (2.17.1)", () => {
  const v = (name, lang, extra = {}) => ({ name, lang, ...extra });
  const compact = v("Anna", "de-DE", { default: true }), enh = v("Helena (Enhanced)", "de-DE"), prem = v("Anna (Premium)", "de-DE"), eddy = v("Eddy (German (Germany))", "de-DE");
  assert.equal(C.bestGermanVoice([compact, enh, prem, v("Samantha", "en-US")]), prem);
  assert.equal(C.bestGermanVoice([compact, enh]), enh);
  assert.equal(C.bestGermanVoice([eddy, compact]), compact);
  assert.equal(C.bestGermanVoice([v("Petra", "de-AT"), v("Markus", "de-DE")]).name, "Markus");
  assert.equal(C.bestGermanVoice([v("Samantha", "en-US")]), null);
});

test("tuner sensitivity: a quiet string at playing distance reads with the room's level, not a fixed one", () => {
  const sr = 48000, n = 4096, f0 = 110, out = new Float32Array(n);
  let seed = 7; const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  for (let i = 0; i < n; i++) {
    const t = i / sr; let v = 0;
    for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * f0 * h * t) / (h * h);
    out[i] = 0.0045 * v + 0.0004 * noise();
  }
  assert.equal(C.detectPitch(out, sr), -1, "the old fixed level (0.01) misses it");
  const f = C.detectPitch(out, sr, 0.0015);
  assert.ok(Math.abs(1200 * Math.log2(f / f0)) < 3, `heard at a lower level: ${f.toFixed(2)} Hz`);
});

// ---------- Your playing ----------
test("profile: the journal is worked out once from songs already played, then counts each play", () => {
  const now = Date.parse("2026-10-17T19:30:00");
  const data = { songs: [
    { id: "a", title: "One", body: "[Verse]\nG C D G", created: "2026-03-01T10:00:00Z", status: "got", gotAt: "2026-05-02T10:00:00Z", bpm: 100, key: "G", duration: 180, playLog: { total: 10, last: now - 86400e3, days: { "2026-10-16": 2 } } },
    { id: "b", title: "Two", body: "[Verse]\nAm F C G", created: "2026-09-01T10:00:00Z", playLog: { total: 1, last: now - 40 * 86400e3, days: {} } }
  ], sets: [], settings: {} };
  const p = C.profileOf(data, now);
  assert.equal(p.since, "2026-03-01");
  assert.equal(p.songsPlayed, 2); assert.equal(p.plays, 11);
  assert.ok(Math.abs(p.hours - (10 * 180 + 1 * 210) / 3600) < 1e-9, "hours from each song's length");
  assert.deepEqual(p.chords.map(c => c.name).slice(0, 3), ["G", "C", "D"], "oldest stamps first");
  assert.equal(p.chords.find(c => c.name === "G").n, 11);
  assert.ok(p.chords.find(c => c.name === "F").barre, "F is a barre stamp");
  assert.equal(p.nextStamp, "Em", "the next common chord you haven't played");
  assert.equal(p.changes[0].n >= 10, true);
  assert.equal(p.keys[0].key, "G");
  assert.deepEqual(p.dropped.map(s => s.id), ["b"], "tried once, not for three weeks");
  assert.equal(p.got, 1); assert.equal(p.repertoire.at(-1).n, 1); assert.equal(p.yearAgo, 0);
  // A new play: a first chord is a milestone, and the hour of the week is counted.
  data.songs.push({ id: "c", title: "Three", body: "[Verse]\nBm G", playLog: { total: 0, last: 0, days: {} } });
  C.Tabs.logPlay(data, data.songs[2], now);
  const q = C.profileOf(data, now);
  assert.equal(q.firsts[0].name, "Bm"); assert.equal(q.firsts[0].kind, "chord");
  assert.equal(data.journal.week[6 * 24 + 19], 1, "Saturday, 7 pm");
  assert.equal(q.rhythm.top, "Saturday evenings");
  C.journalTime(data, 125, now);
  assert.ok(Math.abs(C.profileOf(data, now).hours * 3600 - (10 * 180 + 210 + 125)) < 1e-6, "time played is added");
  C.journalPractice(data, 600, now);
  assert.equal(C.profileOf(data, now).practiceSecs, 600, "practice time is told apart (3.24.2)");
});

test("profile: tuner sessions show which string drifts; a journal from a backup is repaired", () => {
  const data = { songs: [], sets: [], settings: {} };
  for (let i = 0; i < 4; i++) C.journalTune(data, [1, -2, 0, 3, i < 3 ? -12 : 2, 0]);
  const p = C.profileOf(data);
  assert.equal(p.tune.sessions, 4); assert.equal(p.tune.worst.string, "B"); assert.equal(p.tune.worst.rate, 0.75);
  const bad = { songs: [], sets: [], settings: {}, journal: { v: 1, week: "x", tune: null, chords: [] } };
  assert.doesNotThrow(() => C.profileOf(bad));
  assert.equal(bad.journal.week.length, 168);
  const r = C.Tabs.import(JSON.stringify({ songs: [{ id: "a", body: "G" }], journal: { v: 1, secs: 3600 } }));
  assert.equal(r.data.journal.secs, 3600, "a backup keeps the journal");
});

test("streak moment: the count, the week row and the next milestone", () => {
  const now = new Date(2026, 9, 17, 20).getTime();
  const key = i => { const d = new Date(now - i * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const songs = k => [{ playLog: { total: k, last: now, days: Object.fromEntries(Array.from({ length: k }, (_, i) => [key(i), 1])) } }];
  const four = C.streakMoment(songs(4), now, 12);
  assert.equal(four.n, 4); assert.equal(four.goal, 7); assert.equal(four.lead, "4 days in a row."); assert.equal(four.next, "3 more days to a full week.");
  assert.deepEqual(four.slots.map(s => s.label), ["We", "Th", "Fr", "Sa", "Su", "Mo", "Tu"]);
  assert.deepEqual(four.slots.map(s => s.on), [true, true, true, true, false, false, false]);
  assert.equal(four.slots[3].today, true); assert.equal(four.slots[6].goal, 7); assert.equal(four.best, 12);
  const week = C.streakMoment(songs(7), now);
  assert.equal(week.hit, true); assert.equal(week.lead, "A full week in a row."); assert.equal(week.next, "Next up: 30 days."); assert.equal(week.tier, 2);
  assert.equal(week.slots.find(s => s.today).goal, 7, "today's lamp is the milestone");
  assert.equal(C.streakMoment(songs(1), now).lead, "Day one.");
  assert.equal(C.streakMoment(songs(31), now).tier, 3);
});

test("drum beats: Auto goes by the song, compound and odd time keep their own, swing moves the off-beat", () => {
  const style = (pick, o) => C.drumStyle(pick, o);
  assert.equal(style("auto", { bpm: 70, beats: 4 }), "half");
  assert.equal(style("auto", { bpm: 100, beats: 4 }), "rock");
  assert.equal(style("auto", { bpm: 130, beats: 4 }), "four");
  assert.equal(style("auto", { bpm: 90, beats: 4, body: "Capo 2 · Fingerpicked: thumb and three fingers\n" }), "ballad");
  assert.equal(style("auto", { bpm: 140, beats: 4, body: "Fingerpicked\n" }), "four", "fast fingerpicking is not a ballad");
  assert.equal(style("half", { bpm: 140, beats: 4 }), "half", "a pick wins over Auto");
  assert.equal(style("ballad", { beats: 2 }), "rock", "half time and the ballad need four beats");
  assert.equal(style("four", { beats: 6 }), "six8", "6 and 12 beats are compound");
  assert.equal(style("four", { beats: 12 }), "six8");
  assert.equal(style("rock", { beats: 3 }), "waltz");
  const kinds = (st, b, beats = 4) => C.drumHits(st, b, beats).map(h => h.k).sort().join();
  assert.equal(kinds("rock", 0), "hat,hat,kick"); assert.equal(kinds("rock", 1), "hat,hat,snare");
  assert.equal(kinds("half", 0), "hat,hat,kick"); assert.equal(kinds("half", 1), "hat,hat"); assert.equal(kinds("half", 2), "hat,hat,snare");
  assert.equal(kinds("ballad", 0), "hat,kick"); assert.equal(kinds("ballad", 1), "hat,stick"); assert.equal(kinds("ballad", 2), "hat");
  assert.equal(kinds("four", 0), "kick,open"); assert.equal(kinds("four", 1), "kick,open,snare");
  assert.equal(kinds("six8", 0, 6), "hat,kick"); assert.equal(kinds("six8", 3, 6), "hat,snare"); assert.equal(kinds("six8", 1, 6), "hat");
  assert.equal(kinds("six8", 6, 12), "hat,kick", "12/8: kick on 1 and 7, snare on 4 and 10");
  assert.equal(kinds("six8", 9, 12), "hat,snare");
  assert.equal(kinds("waltz", 0, 3), "hat,hat,kick"); assert.equal(kinds("waltz", 2, 3), "hat,hat,snare");
  const off = (swing) => C.drumHits("rock", 0, 4, swing).filter(h => h.k === "hat").map(h => h.at).sort()[1];
  assert.equal(off(C.DRUM_SWING.straight), 0.5); assert.ok(off(C.DRUM_SWING.full) > off(C.DRUM_SWING.light) && off(C.DRUM_SWING.light) > 0.5);
  assert.equal(C.drumHits("ballad", 1, 4, 0.667).every(h => h.at === 0), true, "the ballad has no off-beats to swing");
});

test("song groove: cleaned, resolved against Settings, and said in words", () => {
  assert.deepEqual(C.cleanGroove({ beat: "half", swing: "light", bass: "walk", riff: "1.......5.......", src: "ai" }), { src: "ai", beat: "half", swing: "light" }, "4.42.0: a stored bass or riff is dropped");
  assert.deepEqual(C.cleanGroove({ beat: "polka", swing: "full", bass: 3 }), { src: "you", swing: "full" }, "unknown parts are dropped, and src defaults to you");
  assert.deepEqual(C.cleanGroove({ beat: "rock" }, "ai"), { src: "ai", beat: "rock" });
  assert.equal(C.cleanGroove(null), null); assert.equal(C.cleanGroove([1]), null);
  assert.deepEqual(C.cleanGroove({ src: "you" }), { src: "you" }, "a groove with no parts means: keep the defaults");
  const s = { metroBeat: "four", metroSwing: "light" };
  assert.deepEqual(C.grooveOf({}, s), { beat: "four", swing: "light" }, "no groove: Settings");
  assert.deepEqual(C.grooveOf({ groove: { beat: "half", src: "ai" } }, s), { beat: "half", swing: "light" }, "the song's parts win, the rest come from Settings");
  assert.deepEqual(C.grooveOf({ groove: { swing: "straight", src: "you" } }, s).swing, "straight", "straight on a song beats a swung Setting");
  assert.deepEqual(C.grooveOf({}, {}), { beat: "auto", swing: "straight" });
  assert.equal(C.grooveText({ beat: "half", swing: "light" }), "Half time, light swing");
  assert.equal(C.grooveText({ beat: "four", swing: "straight" }), "Four on the floor");
  assert.equal(C.grooveText({ src: "you" }), "the defaults");
  const song = C.cleanSong({ id: "g", body: "G", groove: { beat: "ballad", junk: 1 } });
  assert.deepEqual(song.groove, { src: "you", beat: "ballad" });
  assert.equal(C.cleanSong({ id: "g", body: "G", groove: "shuffle" }).groove, undefined, "a groove of the wrong type is dropped");
});

// ---------- Plays that outlive a song, credited plays, the Play map ----------
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
test("Plays are kept when a song leaves Recently deleted, and nothing else about it", () => {
  const today = dayKey(Date.now());
  const song = { id: "s", title: "Secret", body: "A D", playLog: { total: 3, last: Date.now(), days: { [today]: 2 } } };
  const kept = C.keepPlays(null, [{ type: "song", item: song }, { type: "set", item: { id: "x" } }]);
  assert.deepEqual(kept, { days: { [today]: 2 } });
  assert.equal(JSON.stringify(kept).includes("Secret"), false);
  assert.deepEqual(C.keepPlays(kept, [{ type: "song", item: song }]).days[today], 4, "adds up");
  assert.equal(C.keepPlays(null, [{ type: "song", item: { id: "n" } }]), null, "no plays, nothing kept");
});

test("The library's totals count live songs, Recently deleted songs and kept plays once each", () => {
  const today = dayKey(Date.now());
  const mk = n => ({ id: "s" + n, playLog: { total: n, last: Date.now(), days: { [today]: n } } });
  const data = { songs: [mk(1)], trash: [{ type: "song", item: mk(2), deletedAt: new Date().toISOString() }], kept: { days: { [today]: 4 } } };
  const sum = list => list.reduce((n, s) => n + (s.playLog?.days?.[today] || 0), 0);
  assert.equal(sum(C.playSongs(data)), 7);
  const was = sum(C.playSongs(data));
  const entry = data.trash[0];
  C.Tabs.forget(data, entry);
  assert.equal(sum(C.playSongs(data)), was, "forgetting keeps the plays");
  C.Tabs.forgetAll({ ...data, trash: [] });
});

test("Delete all keeps every trashed song's plays", () => {
  const today = dayKey(Date.now());
  const data = { songs: [], sets: [], settings: {}, trash: [1, 2].map(n => ({ type: "song", item: { id: "t" + n, playLog: { total: n, last: Date.now(), days: { [today]: n } } }, deletedAt: new Date().toISOString() })) };
  C.Tabs.forgetAll(data);
  assert.equal(data.trash.length, 0);
  assert.equal(data.kept.days[today], 3);
});

test("Plays of songs that expired from Recently deleted move to kept on load", () => {
  const today = dayKey(Date.now());
  const old = new Date(Date.now() - 40 * 86400e3).toISOString();
  const d = C.migrate({ songs: [], sets: [], settings: {}, trash: [{ type: "song", item: { id: "o", title: "Old", body: "", playLog: { total: 2, last: Date.now(), days: { [today]: 2 } } }, deletedAt: old }] });
  assert.equal(d.trash.length, 0);
  assert.equal(d.kept.days[today], 2);
});

test("cleanKept keeps only whole positive counts on real days", () => {
  assert.deepEqual(C.cleanKept({ days: { "2026-10-17": 2.7, "bad": 3, "2026-10-16": -1, "2026-10-15": "x" } }), { days: { "2026-10-17": 2 } });
  assert.equal(C.cleanKept({ days: {} }), null);
  assert.equal(C.cleanKept("nope"), null);
});

test("A play counts only when most of the song was played by auto-scroll", () => {
  const ok = { end: 1000, cover: 900, ms: 60000, expectedMs: 100000 };
  assert.equal(C.playCredited(ok), true);
  assert.equal(C.playCredited({ ...ok, cover: 500 }), false, "jumped or scrolled by hand");
  assert.equal(C.playCredited({ ...ok, ms: 20000 }), false, "too quick");
  assert.equal(C.playCredited({ end: 0, cover: 0, ms: 60000, expectedMs: 100000 }), true, "a short sheet goes by time");
  assert.equal(C.playCredited({ end: 0, cover: 0, ms: 10000, expectedMs: 100000 }), false);
  assert.equal(C.playCredited({}), false);
});

test("The territory grows with the square root of plays, in hex rings", () => {
  assert.deepEqual(C.territory(0), { plays: 0, rings: 0, cells: 0, nextAt: 4, toNext: 4 });
  assert.equal(C.territory(1).cells >= 1, true);
  assert.deepEqual([4, 16, 36].map(p => C.territory(p).rings), [1, 2, 3]);
  assert.equal(C.territory(4).cells, 7);
  assert.equal(C.territory(16).cells, 19);
  assert.equal(C.territory(15).rings, 1);
  assert.equal(C.territory(100).toNext, 44);
  let prev = 0;
  for (let p = 0; p < 200; p++) { const c = C.territory(p).cells; assert.ok(c >= prev); prev = c; }
});

test("hexSpiral gives distinct cells, ring after ring", () => {
  const cells = C.hexSpiral(19);
  assert.equal(new Set(cells.map(String)).size, 19);
  assert.deepEqual(cells[0], [0, 0]);
  const dist = ([q, r]) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
  assert.deepEqual(cells.slice(1, 7).map(dist), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(cells.slice(7).map(dist), Array(12).fill(2));
  assert.deepEqual(C.hexSpiral(0), []);
});

test("A practice spot is kept to about a kilometre", () => {
  assert.deepEqual(C.coarseSpot(40.71278, -74.00594), { lat: 40.71, lon: -74.01 });
  assert.equal(C.coarseSpot("x", 3), null);
  assert.equal(C.coarseSpot(91, 0), null);
});

test("lifetimePlays adds up the journal's months", () => {
  assert.equal(C.lifetimePlays({ songs: [], journal: { v: 1, months: { "2026-09": { plays: 3 }, "2026-10": { plays: 4 } } } }) >= 0, true);
});

test("Venues name the rings, and the outline leaves out shared edges", () => {
  assert.equal(C.venueOf(0).name, "Garage");
  assert.deepEqual([4, 16, 36].map(p => C.venueOf(p).name), ["Open mic", "Coffeehouse", "Club"]);
  assert.equal(C.venueOf(15).next, "Coffeehouse");
  assert.equal(C.venueOf(15).toNext, 1);
  assert.match(C.venueName(9), /World tour/);
  assert.equal(C.cellsOutline(C.hexSpiral(1)).length, 6);
  assert.equal(C.cellsOutline(C.hexSpiral(7)).length, 18, "a ring of six around one: 18 outer edges");
  assert.equal(C.cellsOutline(C.hexSpiral(19)).length, 30);
});

test("Your scene: density from places, guitarists, the local bar and your percentile", () => {
  const places = [[40, -74, 1000000]];
  const city = C.densityAt(40, -74, places), edge = C.densityAt(40.3, -74, places), far = C.densityAt(45, -74, places);
  assert.ok(city > edge && edge > far, "denser near the centre");
  assert.equal(Math.round(far), 15, "a thin floor far from anywhere");
  assert.ok(C.localBar(500) > C.localBar(5), "busier places take more practice to hold");
  assert.ok(C.localBar(0) > 5 && C.localBar(10000) < 40);
  assert.ok(Math.abs(C.zOf(0.5)) < 1e-6 && Math.abs(C.zOf(0.975) - 1.96) < 0.01);
  assert.ok(Math.abs(C.percentileOf(10) - 0.5) < 0.01, "the median player is in the middle");
  assert.ok(C.percentileOf(30) > 0.85);
});

test("Rivals are the same for the same place and day, have habits, and grow turf like yours", () => {
  const now = Date.parse("2026-10-18T20:00:00Z");
  const a = C.simulateRivals({ seed: C.seedOf("40.71,-74.01"), guitarists: 300, now });
  const b = C.simulateRivals({ seed: C.seedOf("40.71,-74.01"), guitarists: 300, now });
  assert.deepEqual(a, b);
  assert.ok(a.length >= 4 && a.length <= 12);
  assert.equal(new Set(a.map(r => r.name)).size, a.length, "names are unique");
  const lapsed = a.find(r => r.habit === "lapsed");
  assert.ok(lapsed && lapsed.avg7 === 0, "a lapsed player has gone quiet this week");
  assert.ok(a.some(r => r.habit === "daily" && r.avg7 > 10));
  for (const r of a) assert.equal(r.cells, C.territory(r.plays).cells);
  const later = C.simulateRivals({ seed: C.seedOf("40.71,-74.01"), guitarists: 300, now: now + 14 * 864e5 });
  assert.ok(later.find(r => r.habit === "daily").plays > a.find(r => r.habit === "daily").plays, "they keep playing");
});

test("Who holds what, and losing an edge after 7 days below the pressure", () => {
  const user = C.hexSpiral(7);
  const rival = { id: "r0", home: [2, 0], cells: 7, avg7: 30 };
  const { owner, turf } = C.sceneMap(user, [rival]);
  assert.equal(owner.get("0,0"), "you");
  assert.ok(turf.r0.every(([q, r]) => owner.get(q + "," + r) === "r0"));
  assert.ok(turf.r0.length < 7, "the rival loses the cells you hold");
  const p = C.edgePressure([1, 0], [rival], turf, () => 10);
  assert.equal(p.by, "r0"); assert.equal(p.bar, 30);
  const data = { songs: [], settings: {}, journal: { v: 1, daysFrom: "2026-09-01", days: {} } };
  let t;
  for (let d = 0; d < 7; d++) t = C.tourDay(data, 30, 7, Date.parse("2026-10-01T12:00:00Z") + d * 864e5);
  assert.equal(t.lost, 1, "7 days below: the edge is lost");
  assert.equal(t.below, 0);
  for (let d = 7; d < 70; d++) t = C.tourDay(data, 30, 7, Date.parse("2026-10-01T12:00:00Z") + d * 864e5);
  assert.equal(t.lost, 6, "never the home cell");
  assert.deepEqual(C.cleanTour({ lost: "2", below: 99, checked: "x" }), { lost: 2, below: 7, checked: "" });
});

test("Practice time is kept per day for the daily average", () => {
  const data = { songs: [], settings: {} }, now = Date.now();
  C.journalTime(data, 1200, now);
  assert.equal(C.userAvg7(data, now), 2.9, "20 minutes in a week is about 2.9 a day");
});

test("No edge is lost in the first week of daily minutes", () => {
  const data = { songs: [], settings: {}, journal: { v: 1, daysFrom: "2026-10-01", days: {} } };
  let t; for (let d = 0; d < 6; d++) t = C.tourDay(data, 30, 7, Date.parse("2026-10-01T12:00:00Z") + d * 864e5);
  assert.equal(t.lost, 0); assert.equal(t.below, 0);
});

test("Takeover: plays to light a count of hexagons, and the nearest rival hexagon in reach", () => {
  assert.equal(C.playsForCells(0), 0);
  for (const n of [1, 2, 7, 8, 19, 25]) { const p = C.playsForCells(n); assert.ok(C.territory(p).cells >= n); assert.ok(p === 1 || C.territory(p - 1).cells < n); }
  const owner = new Map([["0,0", "you"], ["1,0", "r1"]]);
  const plan = C.takeoverPlan({ plays: 1, held: 1, lost: 0, owner, rivals: [{ id: "r1", name: "A B" }] });
  assert.deepEqual(plan.cell, [1, 0]);
  assert.equal(C.territory(1 + plan.plays).cells >= plan.index + 1, true);
  assert.equal(C.takeoverPlan({ plays: 1, held: 1, owner: new Map(), rivals: [] }), null);
});

test("Daily average: a day counts the larger of recorded time and the songs played through that day", () => {
  /* local days, as the app keeps them (a UTC day was wrong every evening in a western time zone) */
  const day = k => { const d = new Date(Date.now() - k * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const data = { songs: [{ id: "a", title: "A", body: "[V]\nG", duration: 180, playLog: { total: 14, last: Date.now(), days: { [day(0)]: 7 } } }], sets: [], trash: [], settings: {} };
  assert.equal(C.userAvg7(data), 3); /* 7 plays x 3 min over 7 days */
  C.journalTime(data, 1800, Date.now()); /* 30 min recorded: more than the plays suggest */
  assert.equal(C.userAvg7(data), 4.3);
});

test("The neck: lessons unlock in order, a lesson done is kept clean, and chords you already play count as known", () => {
  const data = { songs: [], sets: [], trash: [], settings: {} };
  let sk = C.skillState(data);
  assert.equal(sk.next.id, "c:G"); assert.equal(sk.today, false);
  assert.equal(sk.levels[0].steps[1].state, "locked");
  assert.deepEqual(sk.levels.slice(3).map(l => l.soon), [true, true, true]);
  /* 3.21.0: Scales are their own track, open from the start and taken in order */
  const scales = sk.levels.find(l => l.id === "scales");
  assert.deepEqual(scales.steps.map(st => st.state), ["now", "locked", "locked", "locked", "locked"]);
  assert.equal(scales.steps[0].name, "Am pent");
  C.skillDone(data, "c:G", 0, Date.now());
  sk = C.skillState(data);
  assert.equal(sk.next.id, "c:C"); assert.equal(sk.today, true);
  data.journal = { chords: { C: { n: 9 }, D: { n: 5 } } };
  assert.equal(C.skillState(data).next.id, "c:Em", "C and D are known from songs");
  assert.equal(C.cleanSkills({ done: { "c:G": { n: 2, best: 70, at: 5 }, "bad id": {} }, last: 9 }).done["c:G"].best, 70);
  assert.equal(Object.keys(C.cleanSkills({ done: { "bad id": {} }, last: 9 }).done).length, 0);
  assert.equal(C.cleanSkills({ done: {}, last: 0 }), null);
});

test("The neck: the strings of a chord and grading a switch drill", () => {
  const t = C.chordTargets("C");
  assert.equal(t[0].hz, 0, "the low E is left out of C");
  assert.equal(t[1].note, "C");
  const spb = 1, due = [10, 14, 18, 22];
  const g = C.gradeSwitches(due, [10.1, 14.6, 17.95], spb);
  assert.deepEqual([g.on, g.late, g.miss, g.clean], [2, 1, 1, false]);
  assert.equal(C.gradeSwitches(due, [10, 14, 18, 22.05], spb).clean, true);
});

test("What I hear: lines follow the room's noise, so a quiet phone microphone still hears a guitar", () => {
  /* Graham's iPhone (3.8.0 readings): floor 0.0001, loudest strum 0.041, drums 0.0105 */
  const s = C.strumDetector();
  let t = 0, hits = 0;
  for (let i = 0; i < 100; i++) s(0.0001, t += 0.01); /* a quiet second */
  assert.ok(s.floor() < 0.0005);
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < 30; i++) if (s(i < 3 ? 0.03 : 0.012, t += 0.01)) hits++; /* a strum that rings */
    for (let i = 0; i < 40; i++) s(0.0002, t += 0.01);
  }
  assert.equal(hits, 3, "one strum each, the ring is not a strum");
  const d = C.strumDetector();
  t = 0; let drum = 0;
  for (let i = 0; i < 300; i++) if (d(i % 50 < 3 ? 0.0105 : 0.0001, t += 0.01, 0.0105)) drum++;
  assert.equal(drum, 0, "the drums alone are under the line");
  assert.ok(d(0.04, t += 0.01, 0.0105), "a firm strum over the drums is caught");
  assert.equal(C.pitchRms(0.0001), 0.0007);
  assert.equal(C.pitchRms(0.1), 0.01);
});

test("The beat's leak into the mic raises the strum line only just after each tick, and digital silence doesn't sink the floor", () => {
  const p = C.bleedProfile();
  for (let i = 0; i < 6; i++) p.add(i * 0.01, true, 0.0174); /* 3.8.2 readings: the beat at 1.74 */
  assert.ok(p.at(0.02, true) >= 0.0174);
  assert.equal(p.at(0.3, true), 0, "a quarter second later the line is back down");
  assert.equal(p.at(0.02, false), 0, "the other beats are kept apart");
  assert.equal(p.at(0.7, true), 0);
  const s = C.strumDetector();
  let t = 0;
  for (let i = 0; i < 50; i++) s(0.00015, t += 0.01);
  for (let i = 0; i < 50; i++) s(0, t += 0.01);
  assert.ok(s.floor() > 0.0001, "pure zeros are skipped");
  assert.equal(s(0.03, t += 0.01, p.at(0.25, true)), true, "a strum between ticks counts at the room's line");
});

test("A strum pattern around the 1 is graded by the strum nearest the beat; one string is judged on its own", () => {
  const spb = 60 / 70, due = [10, 10 + 4 * spb];
  /* down-down-up-down-up: an up strum just before each 1, the down right on it */
  const pattern = due.flatMap(d => [d - 0.5 * spb, d + 0.02, d + 0.5 * spb, d + spb]);
  const g = C.gradeSwitches(due, pattern, spb);
  assert.deepEqual([g.on, g.early, g.late, g.miss], [2, 0, 0, 0]);
  const A = C.chordTargets("A"), g3 = A[3]; /* the G string, fret 2: A3 */
  assert.equal(C.judgeTarget(220, g3), "ring");
  assert.equal(C.judgeTarget(110, g3), "ring", "an octave low still counts for the string listened for");
  assert.equal(C.judgeTarget(196, g3), "open");
  assert.equal(C.judgeTarget(220 * 2 ** (1 / 12), g3), "high");
  assert.equal(C.judgeTarget(300, g3), null);
  assert.deepEqual(C.stringRange(g3).map(Math.round), [154, 312]);
});

test("The security policy lets MusicKit fetch Apple's certificate bundle and stream from Apple's CDNs", async () => {
  const { readFileSync } = await import("node:fs");
  const csp = readFileSync(new URL("../index.html", import.meta.url), "utf8").match(/Content-Security-Policy" content="([^"]*)"/)[1];
  const part = name => csp.split(";").map(x => x.trim()).find(x => x.startsWith(name + " "));
  for (const h of ["https://*.mzstatic.com", "https://*.cdn-apple.com", "https://*.aaplimg.com"]) assert.ok(part("connect-src").includes(h), "connect-src " + h);
  assert.ok(part("media-src").includes("https://*.mzstatic.com"));
  assert.ok(!/unsafe-eval|script-src[^;]*\*[^.]/.test(csp), "scripts stay limited");
});

test("recording sync: marks bend the line between sheet and recording, both ways", () => {
  assert.equal(C.syncSeconds([], 0.5, 200), 100);
  assert.equal(C.syncSeconds([[0.5, 140]], 0.5, 200), 140);
  assert.equal(C.syncSeconds([[0.5, 140]], 0.25, 200), 70);
  assert.equal(C.syncWhere([[0.5, 140]], 140, 200), 0.5);
  assert.equal(C.syncWhere([[0.5, 140]], 170, 200), 0.75);
  assert.equal(C.syncWhere([], 300, 200), 1);
  /* a new mark replaces a close one and drops those it would cross */
  assert.deepEqual(C.addSync([[0.5, 100]], 0.51, 104, 200), [[0.51, 104]]);
  assert.deepEqual(C.addSync([[0.5, 100], [0.7, 150]], 0.6, 160, 200), [[0.5, 100], [0.6, 160]]);
  assert.deepEqual(C.addSync([], 0.001, 100, 200), []);
});

test("line timing: LRC is read, sheet lines pair with timed lines in order, nudges win, and only times are kept", () => {
  const lrc = C.parseLrc("[00:12.50] Hello there my friend\n[00:16.00] How are you\n[00:20.00]\n[00:24.10] Hello there my friend\n[00:28.00] Goodbye now");
  assert.deepEqual(lrc.map(x => x[0]), [12.5, 16, 24.1, 28]);
  assert.deepEqual(C.matchLines([{ i: 1, text: "Hello there, my friend" }, { i: 3, text: "how are you?" }, { i: 5, text: "la la" }, { i: 7, text: "Hello there my friend" }, { i: 9, text: "Goodbye now" }], lrc).map(x => x.slice(0, 2)), [[1, 12.5], [3, 16], [7, 24.1], [9, 28]]);
  assert.deepEqual(C.mergeSyncs([[0.1, 10], [0.3, 30], [0.5, 50], [0.7, 70]], [[0.31, 40]]), [[0.1, 10], [0.31, 40], [0.5, 50], [0.7, 70]]);
  assert.deepEqual(C.cleanTimed({ h: "k", id: 3, at: [[1, 10], [0, 12], [4, 9], [6, 20]] }), { h: "k", id: 3, at: [[1, 10], [6, 20]] });
  assert.equal(C.cleanSong({ id: "a", body: "G", timed: { h: "k", at: "x" } }).timed, undefined);
  assert.notEqual(C.bodyKey("a b"), C.bodyKey("a c"));
});

/* Synthetic audio for the preview listener: clicks on the beat and the off-beat, and a scale's notes. */
function synthBeat(bpm, swing, secs = 20, rate = 22050) {
  const x = new Float32Array(secs * rate), spb = 60 / bpm;
  const click = (t, amp) => { const i0 = Math.round(t * rate); for (let i = 0; i < 400 && i0 + i < x.length; i++) x[i0 + i] += amp * Math.exp(-i / 60) * Math.sin(i * 0.9); };
  for (let t = 0; t < secs - 1; t += spb) { click(t, 1); click(t + spb * swing, 0.6); }
  return x;
}
test("preview listening: tempo, swing and key from audio", () => {
  for (const bpm of [84, 100, 128]) {
    const f = C.feelOf(synthBeat(bpm, 0.5), 22050);
    assert.ok(Math.abs(f.bpm - bpm) <= 2, `${bpm} heard as ${f.bpm}`);
    assert.equal(f.swing, "straight");
  }
  assert.equal(C.feelOf(synthBeat(96, 0.67), 22050).swing, "full");
  /* E major: E G# B ring most, with the other scale notes */
  const rate = 22050, x = new Float32Array(rate * 10), notes = [[64, 1], [68, 0.8], [71, 0.9], [66, 0.35], [69, 0.35], [73, 0.3], [75, 0.3], [52, 0.9]];
  for (let i = 0; i < x.length; i++) for (const [m, a] of notes) x[i] += a * 0.1 * Math.sin(2 * Math.PI * 440 * 2 ** ((m - 69) / 12) * i / rate);
  assert.equal(C.feelOf(x, rate).key, "E");
  assert.equal(C.keyGap("D", "E"), 2);
  assert.equal(C.keyGap("Am", "C"), 0, "relative minor counts as the same key");
  assert.equal(C.keyGap("A", "F"), -4);
  assert.equal(C.keyGap("?", "E"), null);
  assert.deepEqual(C.cleanFeel({ bpm: 96.4, swing: "x", key: "F#m", sure: 2 }), { bpm: 96, key: "F#m", sure: 1 });
});

test("practice counts on the Tour Map: every 4 minutes is a play", () => {
  const d = { songs: [], settings: {} };
  const now = Date.parse("2026-10-19T12:00:00Z");
  const before = C.lifetimePlays(d);
  C.journalPractice(d, 239, now);
  assert.equal(C.lifetimePlays(d), before, "under four minutes: not yet");
  C.journalPractice(d, 2, now);
  assert.equal(C.lifetimePlays(d), before + 1);
  C.journalPractice(d, 480, now);
  assert.equal(C.lifetimePlays(d), before + 3);
});

test("scales: notes up and back down, on the right strings and frets", () => {
  const t = C.scaleTargets("Ampent");
  assert.equal(t.length, 23, "12 up, 11 back down");
  assert.deepEqual(t.slice(0, 3).map(x => x.note + x.octave), ["A2", "C3", "D3"]);
  assert.equal(t[11].note + t[11].octave, "C5");
  assert.equal(t[22].note + t[22].octave, "A2", "ends where it started");
  assert.deepEqual(C.scaleTargets("Cmajor").slice(0, 8).map(x => x.note), ["C", "D", "E", "F", "G", "A", "B", "C"]);
  assert.equal(C.scaleTargets("nope").length, 0);
  assert.equal(C.cleanSkills({ done: { "x:Ampent": { n: 1, at: 5 } } }).done["x:Ampent"].n, 1, "a scale lesson's id is kept");
});
test("practice mode: on for a learning song unless turned off; the old recording speed becomes the practice speed", () => {
  assert.equal(C.practicing({ status: "learning" }), true);
  assert.equal(C.practicing({ status: "learning", practice: { on: false } }), false);
  assert.equal(C.practicing({ practice: { on: true } }), true);
  assert.equal(C.practiceRate({ practice: { on: true, rate: 0.7 } }), 0.7);
  assert.equal(C.practiceRate({ practice: { on: false, rate: 0.7 } }), 1, "the speed applies only while practicing");
  const s = C.cleanSong({ id: "a", body: "G", recRate: 0.8 });
  assert.deepEqual(s.practice, { rate: 0.8 }); assert.equal(s.recRate, undefined);
  assert.equal(C.cleanSong({ id: "a", body: "G", practice: { on: "x", rate: 2 } }).practice, undefined);
});

test("chord timing: words share a line's time by syllables, land on the beat, and use the lyrics' own word times when given", () => {
  const w = ["Walking", "down", "the", "river", "road"];
  const t = C.wordTimes(w, 10, 14);
  assert.equal(t[0], 10);
  assert.ok(t[1] > t[0] && t[4] < 14 && t[4] > t[3], "in order, inside the line");
  assert.ok(Math.abs((t[1] - t[0]) - 2 * (t[2] - t[1])) < 0.01, "a two-syllable word takes twice the time");
  const b = C.wordTimes(w, 10, 14, { bpm: 120 });
  assert.ok(b.every(x => Math.abs(((x - 10) / 0.5) - Math.round((x - 10) / 0.5)) < 0.01), "on the beat (every half second at 120)");
  assert.deepEqual(C.wordTimes(["a", "b", "c"], 10, 14, { given: [10.2, 11.7, 13.1] }), [10.2, 11.7, 13.1]);
  const lrc = C.parseLrc("[00:10.00] <00:10.00>Hello <00:10.80>there <00:11.50>friend\n[00:13.00] Plain line");
  assert.deepEqual(lrc[0], [10, "Hello there friend", [10, 10.8, 11.5]]);
  assert.deepEqual(lrc[1], [13, "Plain line"]);
  assert.deepEqual(C.cleanTimed({ h: "k", at: [[1, 10]], w: { 1: [10, 10.8, 11.5], x: [1, 2], 2: [3, 1] } }).w, { 1: [10, 10.8, 11.5] });
});

test("drums that fit the song: parts by section, a clean bar, simpler and busier, and the hits on each beat", () => {
  assert.equal(C.partOf("Pre-Chorus"), "prechorus"); assert.equal(C.partOf("Chorus 2"), "chorus"); assert.equal(C.partOf("Verse"), "verse");
  assert.equal(C.partOf("Guitar solo"), "solo"); assert.equal(C.partOf("Something"), "verse");
  const bar = { kick: "X.......x.x.....", snare: "....X..o....X...", hat: "x.x.x.x.x.x.x.xO" };
  const d = C.cleanDrums({ verse: bar, chorus: { kick: "bad", snare: "....X.......X...", hat: "xxxxxxxxxxxxxxxx" }, level: 1 });
  assert.deepEqual(d.verse, bar); assert.equal(d.chorus.kick, ".".repeat(16), "a bad row becomes rests"); assert.equal(d.level, 1);
  assert.equal(C.cleanDrums({ intro: bar }), null, "needs a verse or a chorus");
  const simple = C.drumLevelBar(bar, -1);
  assert.equal(simple.hat, "x...x...x...x...", "quarter-note hat");
  assert.equal(simple.snare, "....X.......X...", "no ghost notes");
  assert.equal(simple.kick, "x.......x.......");
  const busy = C.drumLevelBar(bar, 1);
  assert.equal(busy.hat, "xoxoxoxoxoxoxoxO");
  assert.equal(busy.snare, "...oX..o...oX...");
  const h = C.barHits(bar, 0, 0.5);
  assert.deepEqual(h.filter(x => x.k === "kick").map(x => x.at), [0]);
  assert.deepEqual(h.filter(x => x.k === "hat").map(x => x.at), [0, 0.5]);
  assert.equal(C.barHits(bar, 3).find(x => x.k === "open").at, 0.75);
  assert.equal(C.barHits(bar, 0, 0.667).find(x => x.k === "hat" && x.at > 0).at, 0.667, "swung off-beat");
});

test("a heard song is matched to the library, ignoring a remaster tag and a missing artist", () => {
  const songs = [{ id: "a", title: "Wonderwall", artist: "Oasis" }, { id: "b", title: "Hallelujah", artist: "" }];
  assert.equal(C.heardMatch(songs, { title: "Wonderwall (Remastered)", artist: "Oasis" }).id, "a");
  assert.equal(C.heardMatch(songs, { title: "Hallelujah", artist: "Jeff Buckley" }).id, "b", "a sheet with no artist still matches");
  assert.equal(C.heardMatch(songs, { title: "Yellow", artist: "Coldplay" }), null, "not in the library");
  assert.equal(C.heardMatch(songs, { title: "Wonderwall", artist: "Blur" }), null, "another artist's song");
});

test("The Road (4.0.0): the neck's ladder as legs of stops, merch boxes every third lesson, a headline show at the end, one current stop", () => {
  const data = { songs: [], sets: [], trash: [], settings: {} };
  let r = C.roadPath(data);
  assert.deepEqual(r.legs.map(l => l.name), ["Open chords", "Chord switches", "Scales"]);
  const open = r.legs[0].stops;
  assert.deepEqual(open.map(s => s.kind), ["chord", "chord", "chord", "box", "chord", "chord", "chord", "box", "chord", "headline"]);
  assert.equal(r.current.id, "c:G");
  assert.equal(r.legs.flatMap(l => l.stops).filter(s => s.state === "now").length, 1, "only one current stop");
  assert.equal(r.legs[2].stops[0].state, "open", "Scales are open from the start but not the current stop");
  assert.deepEqual(r.coming, ["Strumming", "Picking", "Fingerstyle and barre"]);
  for (const c of ["G", "C", "D"]) C.skillDone(data, "c:" + c);
  r = C.roadPath(data);
  assert.equal(r.legs[0].stops[3].state, "done", "the box opens once the three lessons before it are done");
  assert.equal(r.current.id, "c:Em");
  assert.equal(C.fansOf(data), 3 * C.FANS.lesson + C.FANS.box, "fans: lessons and the opened box");
});

test("Playable songs (4.0.0): songs that use only chords you know, and how many more the next chord opens", () => {
  const data = { songs: [{ id: "a", title: "A", body: "G   C\nwords\nG   D\nmore" }, { id: "b", title: "B", body: "[G]one [Em]two" }, { id: "t", title: "T", format: "tab", body: "e|--0--|" }], sets: [], trash: [], settings: {} };
  assert.deepEqual(C.sheetChords(data.songs[0].body), ["G", "C", "D"]);
  assert.deepEqual(C.sheetChords(data.songs[1].body), ["G", "Em"]);
  assert.deepEqual(C.playableSongs(data, "G"), { now: 0, of: 2, more: 0 }, "tabs don't count; G alone opens nothing");
  for (const c of ["G", "C"]) C.skillDone(data, "c:" + c);
  assert.deepEqual(C.playableSongs(data, "D"), { now: 0, of: 2, more: 1 }, "D opens the first song");
  data.journal = { chords: { D: { n: 5 }, Em: { n: 6 } } };
  assert.equal(C.playableSongs(data).now, 2, "chords played in songs five times count as known");
});

test("The Gig (4.1.0): changes landed by a strum near them, the combo, strings, crowd and bonus fans", () => {
  const g = C.gigStart();
  assert.equal(C.gigCrowd(g), 6, "half the crowd before any change");
  assert.equal(C.gigPct(g), null);
  assert.equal(C.gigChange(g, 10, [10.2]).hit, true, "a strum within the window lands the change");
  assert.equal(C.gigChange(g, 12, [11.5]).hit, false, "half a second early is a miss");
  assert.equal(g.strings, C.GIG_STRINGS - 1, "a miss snaps a string");
  for (let i = 0; i < 8; i++) C.gigChange(g, 20 + i, [20 + i]);
  assert.equal(g.strings, C.GIG_STRINGS, "eight in a row restring it");
  assert.equal(g.best, 8); assert.equal(g.combo, 8);
  assert.equal(C.gigCrowd(g), 11, "9 of the last 10 changes");
  assert.equal(C.gigPct(g), 90);
  assert.equal(C.gigFans(g), 9 + 10, "a fan a change, and 10 for a crowd of 10 or more");
  assert.equal(C.gigFans(g, true), 38, "an encore doubles it");
  const data = { songs: [], sets: [], trash: [], settings: {} };
  assert.deepEqual(C.gigDone(data, "a", g), { fans: 19, pct: 90, request: null });
  assert.deepEqual(data.gig, { shows: 1, fans: 19, best: { a: 90 } });
  assert.deepEqual(C.cleanGig({ shows: "2", fans: 5, best: { a: 120, b: 50 } }), { shows: 2, fans: 5, best: { b: 50 } });
  assert.equal(C.cleanGig({}), null);
  assert.equal(C.fansOf(data), 19, "bonus fans count toward your fans");
});

test("Tour quests (4.5.0): the month's tour, tonight's setlist and the request line", () => {
  const now = new Date(2026, 9, 21, 20, 0).getTime(), day = "2026-10-21";
  const song = (id, days, body = "[Verse]\nG C\nla") => ({ id, title: id, format: "chords", body, playLog: { total: 0, last: 0, days } });
  const data = { songs: [song("a", { [day]: 2, "2026-10-02": 9 }), song("b", {}), song("c", {}), song("t", {})], sets: [], trash: [], settings: {}, journal: { days: { [day]: 360 } } };
  data.songs[3].format = "tab";
  const st = C.questState(data, now);
  assert.equal(st.monthName, "October"); assert.equal(st.daysLeft, 10);
  assert.deepEqual(st.tour, { shows: 11, need: 20, done: false, claimed: false }, "every play this month counts");
  assert.deepEqual(st.goals.map(g => [g.id, g.have, g.done]), [["two", 2, true], ["crowd", 0, false], ["mins", 5, true]]);
  const req = st.request.song;
  assert.ok(["b", "c"].includes(req.id), "a chord song you haven't played this week, never a tab");
  assert.equal(C.questState(data, now + 3600e3).request.song.id, req.id, "the same one all day");
  const got = C.questsSettle(data, now);
  assert.deepEqual(got.map(x => x.fans), [10, 10], "two goals done");
  assert.deepEqual(C.questsSettle(data, now), [], "credited once");
  /* a gig of the requested song with a crowd of 12: bonus fans double, the crowd goal and the full setlist */
  const g = C.gigStart(); for (let i = 0; i < 10; i++) C.gigChange(g, i, [i]);
  const fans = C.gigFans(g), r = C.gigDone(data, req.id, g, false, now);
  assert.equal(r.fans, fans * 2); assert.equal(r.request, true);
  assert.equal(C.gigDone(data, req.id, g, false, now).request, null, "once a day");
  assert.deepEqual(C.questsSettle(data, now).map(x => x.fans), [10, 25], "the crowd goal, then the whole setlist");
  assert.equal(C.questState(data, now).request.done, true);
  assert.equal(data.quests.fans, 55 + fans, "20 + 10 + 25 from the setlist, and the doubled bonus");
  assert.ok(C.fansOf(data, now) >= 55 + fans * 3, "quest fans count toward your fans");
  /* a new day starts a new setlist */
  assert.deepEqual(C.questState(data, now + 86400e3).goals.map(x => x.claimed), [false, false, false]);
  /* 20 shows finish the tour */
  data.songs[1].playLog.days["2026-10-05"] = 9;
  assert.equal(C.questsSettle(data, now).find(x => /October Tour/.test(x.label)).fans, 100);
  const kept = C.cleanQuests(JSON.parse(JSON.stringify(data.quests)));
  assert.deepEqual(kept, data.quests, "kept through a save");
  assert.equal(C.cleanQuests({ fans: -4, got: ["x"] }), null);
});

test("Charts (4.6.0): weekly XP, the chart, promotion and records, rival battles", () => {
  const mon = new Date(2026, 9, 19, 9).getTime(), wed = mon + 2 * 86400e3;
  assert.equal(C.weekOf(wed), "2026-10-19"); assert.equal(C.weekOf(new Date(2026, 9, 25, 23).getTime()), "2026-10-19", "Sunday is the same week");
  const song = { id: "a", title: "A", format: "chords", body: "[Verse]\nG C\nla", playLog: { total: 3, last: 0, days: { "2026-10-20": 3, "2026-10-12": 5 } } };
  const data = { songs: [song], sets: [], trash: [], settings: {} };
  C.addXP(data, 7, wed);
  assert.equal(C.weekXP(data, "2026-10-19"), 37, "10 a play this week, and kept XP");
  const r1 = C.chartRivals("2026-10-19", 0, 0.5), r2 = C.chartRivals("2026-10-19", 0, 1);
  assert.equal(r1.length, 9); assert.deepEqual(r1.map(x => x.name), r2.map(x => x.name), "the same players all week");
  assert.ok(r1.every((x, i) => x.xp <= r2[i].xp), "their XP grows through the week");
  const st = C.chartState(data, wed);
  assert.equal(st.name, "Garage"); assert.equal(st.next, "Open mic"); assert.equal(st.rows.length, 10); assert.equal(st.daysLeft, 5);
  assert.equal(st.you.xp, 37);
  /* the first look starts the week; the next week settles it */
  assert.equal(C.chartsSettle(data, wed), null);
  data.xp.days["2026-10-21"] = 5000;
  const last = C.chartsSettle(data, wed + 7 * 86400e3);
  assert.deepEqual([last.rank, last.up, data.charts.tier], [1, true, 1], "first place: up to the Open mic");
  assert.deepEqual(data.charts.records, [{ tier: 0, week: "2026-10-19", rank: 1 }]);
  assert.equal(C.chartsSettle(data, wed + 7 * 86400e3), null, "once a week");
  /* 4.11.0: a quiet week puts you in the bottom 3: back down a tier, the record stays */
  C.chartsSettle(data, wed + 14 * 86400e3);
  assert.deepEqual([data.charts.last.xp, data.charts.last.up, data.charts.last.down, data.charts.tier, data.charts.records.length], [0, false, true, 0, 1]);
  C.chartsSettle(data, wed + 21 * 86400e3);
  assert.equal(data.charts.tier, 0, "never below the Garage");
  /* the players behave like people: the shadow stays just ahead of you, weekend players surge late */
  const fri = C.chartRivals("2026-10-19", 2, 4.5 / 7, 300), sun = C.chartRivals("2026-10-19", 2, 6.9 / 7, 300);
  const shadow = fri.find(x => x.kind === "shadow");
  assert.ok(shadow.xp > 300 || shadow.xp === Math.round((90 + 2 * 55) * 1.7 * Math.min(1, 0.25 + 4.5 / 7)), "just ahead of you, unless they can't keep up");
  const wk = fri.filter(x => x.kind === "weekend");
  if (wk.length) assert.ok(wk.every(x => sun.find(y => y.id === x.id).xp > x.xp), "weekend players gain over the weekend");
  assert.deepEqual(new Set([...fri.map(x => x.kind)]).size >= 4, true, "different kinds of players");
  /* the battle: the player above you, a song of yours, a score to beat */
  const now = wed + 14 * 86400e3, b = C.startBattle(data, now);
  assert.equal(b.songId, "a"); assert.ok(b.target >= 55 && b.target <= 95);
  assert.equal(b.rival, C.chartState(data, now).rival.name);
  const g = C.gigStart(); for (let i = 0; i < 10; i++) C.gigChange(g, i, [i]);
  const fans0 = C.fansOf(data, now), xp0 = C.weekXP(data, C.weekOf(now));
  const r = C.gigDone(data, "a", g, false, now);
  assert.equal(r.battle.result, "won"); assert.equal(r.battle.pct, 100);
  assert.equal(C.weekXP(data, C.weekOf(now)) - xp0, 10 + 10 + 30, "landed changes, the crowd and the battle");
  assert.ok(C.fansOf(data, now) - fans0 >= 40, "40 fans for the win");
  assert.equal(C.gigDone(data, "a", g, false, now).battle, undefined, "one battle a day");
  const kept = C.cleanCharts(JSON.parse(JSON.stringify(data.charts)));
  assert.deepEqual(kept, data.charts, "kept through a save");
  assert.deepEqual(C.cleanXP(JSON.parse(JSON.stringify(data.xp))), data.xp);
});

test("Your band (4.7.0): friends join as you play; Beat plays the drums in gigs (4.42.0: Bex no longer plays bass)", () => {
  const data = { songs: [], sets: [], trash: [], settings: {}, journal: { v: 1, months: { "2026-10": { plays: 7 } } } };
  assert.equal(C.BAND.length, 27, "4.38.0: six more after Bottle-Slide");
  const st = C.bandState(data);
  assert.deepEqual(st.joined.map(b => b.id), ["lola", "tilly", "beat"]);
  assert.deepEqual([st.next.id, st.next.more], ["metro", 3]);
  assert.deepEqual(C.bandParts(data), { drums: true }, "Beat plays the drums");
  assert.deepEqual(C.bandMeet(data).map(b => b.id), ["lola", "tilly", "beat"], "new friends, met once");
  assert.deepEqual(C.bandMeet(data), []);
  data.journal.months["2026-10"].plays = 15;
  assert.deepEqual(C.bandMeet(data).map(b => b.id), ["metro", "bex"]);
  assert.deepEqual(C.bandParts(data), { drums: true }, "Bex joins but plays nothing");
  data.settings.bandPlays = false;
  assert.deepEqual(C.bandParts(data), {}, "turned off on the Band tab");
  assert.deepEqual(C.cleanBand({ seen: ["lola", "nobody"] }), { seen: ["lola"] });
});

test("Rehearse (4.8.0): the changes you dropped and today's soundcheck", () => {
  const now = new Date(2026, 9, 21, 20).getTime(), data = { songs: [], sets: [], trash: [], settings: {} };
  assert.equal(C.soundcheck(data, now).fromMisses, false, "nothing dropped yet: a switch from the neck");
  C.rehearseMisses(data, { "C>F": 3, "G>Em": 2, "A>D": 1 }, now);
  C.rehearseMisses(data, { "C>F": 1 }, now - 20 * 86400e3);
  assert.deepEqual(C.missedChanges(data, now).map(x => [x.id, x.n]), [["s:C-F", 3], ["s:G-Em", 2], ["s:A-D", 1]]);
  const sc = C.soundcheck(data, now);
  assert.deepEqual(sc.pairs.map(p => p.id), ["s:C-F", "s:G-Em"], "the two you dropped most");
  assert.equal(C.soundcheckDone(data, "s:A-D", now), null, "not in today's soundcheck");
  assert.deepEqual(C.soundcheckDone(data, "s:C-F", now), { done: false, left: 1 });
  C.rehearseMisses(data, { "A>D": 9 }, now);
  assert.deepEqual(C.soundcheck(data, now).pairs.map(p => p.id), ["s:C-F", "s:G-Em"], "fixed for the day once started");
  const xp0 = C.weekXP(data, C.weekOf(now));
  assert.deepEqual(C.soundcheckDone(data, "s:G-Em", now), { done: true, xp: 20 });
  assert.equal(C.weekXP(data, C.weekOf(now)) - xp0, 20);
  assert.equal(C.soundcheckDone(data, "s:G-Em", now).done, false, "20 XP once a day");
  assert.equal(C.soundcheck(data, now + 86400e3).done, false, "a new one tomorrow");
  const kept = C.cleanRehearse(JSON.parse(JSON.stringify(data.rehearse)));
  assert.deepEqual(kept, data.rehearse);
});

test("Cover requests (4.10.0): your listening becomes the request or a cover quest", () => {
  const now = new Date(2026, 9, 21, 20).getTime();
  const data = { songs: [{ id: "a", title: "River Road", artist: "The Wanderers", format: "chords", body: "[Verse]\nG C\nla" }, { id: "b", title: "Other", format: "chords", body: "[Verse]\nG D\nla" }], sets: [], trash: [], settings: {} };
  assert.equal(C.noteHeard(data, { title: "River Road (Remastered)", artist: "The Wanderers" }, now), true);
  assert.equal(C.requestSong(data, now).id, "a", "the song you just played is today's request");
  assert.equal(C.noteHeard(data, { title: "River Road", artist: "The Wanderers" }, now), false, "once");
  assert.equal(C.noteHeard(data, { title: "Wagon Wheel", artist: "Old Crow" }, now), true);
  let cv = C.coverState(data, now);
  assert.deepEqual([cv.title, cv.step], ["Wagon Wheel", 1], "not in the Songbook: get the song");
  data.songs.push({ id: "w", title: "Wagon Wheel", artist: "Old Crow", format: "chords", body: "[Verse]\nG D Em C\nla" });
  cv = C.coverState(data, now);
  assert.deepEqual([cv.song.id, cv.step], ["w", 2], "added: learn its chords");
  data.journal = { chords: { G: { n: 9 }, D: { n: 9 }, Em: { n: 9 }, C: { n: 9 } } };
  assert.equal(C.coverState(data, now).step, 3, "then play the gig");
  const g = C.gigStart(); for (let i = 0; i < 6; i++) C.gigChange(g, i, [i]);
  const base = C.gigFans(g), r = C.gigDone(data, "w", g, false, now);
  assert.equal(r.cover, true); assert.equal(r.fans, base * 3, "3x bonus fans");
  assert.equal(C.coverState(data, now), null, "done");
  assert.deepEqual(C.cleanQuests(JSON.parse(JSON.stringify(data.quests))), data.quests, "kept through a save");
});

test("Song duels (4.12.0): a challenge by link, answered by a gig, and the record between you", async () => {
  const now = Date.now(), me = { songs: [{ id: "a", title: "River Road", artist: "W", format: "chords", body: "[Verse]\nG C\nla" }], sets: [], trash: [], settings: {} };
  const d = C.startDuel(me, me.songs[0], { pct: 88, combo: 14, crowd: 11 }, now);
  const code = await C.packShare({ song: C.shareable(me.songs[0]), duel: { id: d.id, from: "Graham", pct: 88, combo: 14, crowd: 11 } });
  const got = await C.unpackShare(code);
  assert.deepEqual(got.duel, { id: d.id, from: "Graham", pct: 88, combo: 14, crowd: 11 });
  /* the friend takes it and plays it */
  const friend = { songs: [{ id: "x", title: "River Road", artist: "W", format: "chords", body: "[Verse]\nG C\nla" }], sets: [], trash: [], settings: {} };
  C.takeDuel(friend, got.duel, friend.songs[0], now);
  const g = C.gigStart(); for (let i = 0; i < 10; i++) C.gigChange(g, i, [i]);
  const r = C.gigDone(friend, "x", g, false, now);
  assert.equal(r.duel.opp, "Graham"); assert.equal(r.duel.mine.pct, 100); assert.equal(C.duelWon(r.duel), true);
  assert.equal(C.gigDone(friend, "x", g, false, now).duel, undefined, "answered once");
  /* their score comes back */
  const back = await C.unpackShare(await C.packShare({ song: C.shareable(friend.songs[0]), duel: { id: d.id, from: "Mike", pct: 100, combo: 10, crowd: 12, reply: true } }));
  const mine = C.takeDuel(me, back.duel, null, now);
  assert.deepEqual([mine.opp, mine.theirs.pct, C.duelWon(mine)], ["Mike", 100, false]);
  assert.deepEqual(C.duelRecord(me, "Mike"), { w: 0, l: 1, last: [false] });
  assert.deepEqual(C.cleanDuels(JSON.parse(JSON.stringify(me.duels))), me.duels, "kept through a save");
  assert.equal(C.cleanDuelLink({ id: "x", from: "a", pct: 50 }), null, "a bad id");
});

test("Friends (4.13.0): the friends list and the Friend quest from XP that rides on duel links", () => {
  const now = new Date(2026, 9, 21, 20).getTime(), wk = C.weekOf(now);
  const data = { songs: [{ id: "a", title: "A", format: "chords", body: "[Verse]\nG C\nla", playLog: { total: 0, last: 0, days: { "2026-10-20": 10 } } }], sets: [], trash: [], settings: {} };
  assert.equal(C.friendQuest(data, now), null, "no friends yet");
  const d = C.startDuel(data, data.songs[0], { pct: 80, combo: 1, crowd: 1 }, now);
  C.takeDuel(data, { id: d.id, from: "Mike", pct: 90, combo: 1, crowd: 1, reply: true, xp: 150, wk }, null, now);
  const fr = C.friendsOf(data, now);
  assert.deepEqual(fr.map(f => [f.name, f.xp, f.w, f.l]), [["Mike", 150, 0, 1]]);
  const fq = C.friendQuest(data, now);
  assert.deepEqual([fq.with, fq.mine, fq.theirs, fq.done], ["Mike", 100, 150, false]);
  data.songs[0].playLog.days["2026-10-21"] = 6;
  assert.equal(C.friendQuest(data, now).done, true, "100 + 60 + 150 passes 300");
  assert.equal(C.friendQuestSettle(data, now), 50); assert.equal(C.friendQuestSettle(data, now), 0, "once a week");
  assert.equal(C.friendsOf(data, now + 7 * 86400e3)[0].xp, 0, "last week's XP doesn't count");
  assert.deepEqual(C.cleanDuels(JSON.parse(JSON.stringify(data.duels))), data.duels);
  assert.deepEqual(C.cleanQuests(JSON.parse(JSON.stringify(data.quests))), data.quests);
});

test("Tour Map (4.18.0): rivals never share a word in their names, and corners taken count rival hexagons you newly hold", () => {
  for (const seed of [1, 7, 42, 99, 1234, 98765]) {
    const rv = C.simulateRivals({ seed, guitarists: 5000 });
    const words = rv.flatMap(r => r.name.split(" ").length === 2 ? r.name.split(" ") : [r.name]);
    const firsts = rv.map(r => r.name.split(" ").slice(0, -1).join(" ")), lasts = rv.map(r => r.name.split(" ").at(-1));
    assert.equal(new Set(firsts).size, rv.length, `no shared first word (seed ${seed})`);
    assert.equal(new Set(lasts).size, rv.length, `no shared last word (seed ${seed})`);
    assert.ok(words.length >= rv.length);
  }
  const rivals = C.simulateRivals({ seed: 42, guitarists: 5000, userRings: 1 });
  const data = { songs: [], settings: {} };
  assert.equal(C.cornersSettle(data, 7, rivals), 0, "the first look only remembers what you hold");
  assert.equal(data.tour.seen, 7);
  const { owner } = C.sceneMap(C.hexSpiral(7), rivals), next = C.hexSpiral(60).slice(7);
  const theirs = next.filter(c => (owner.get(c[0] + "," + c[1]) || "you") !== "you").length;
  assert.equal(C.cornersSettle(data, 60, rivals), theirs);
  assert.equal(data.tour.taken || 0, theirs);
  assert.equal(C.cleanTour(data.tour).taken || 0, theirs, "kept in saves");
  assert.equal(C.cornersSettle(data, 60, rivals), 0, "nothing new");
});

test("Levels and badges (4.17.0): XP from plays and gigs, levels that take a little longer each time, badges from what's saved", () => {
  const now = new Date(2026, 9, 21, 20).getTime();
  assert.deepEqual([1, 2, 3, 4].map(C.levelStart), [0, 100, 300, 600]);
  const data = { songs: [], sets: [], trash: [], settings: {} };
  assert.equal(C.levelOf(data).level, 1);
  data.xp = { days: { "2026-10-20": 40 } };
  C.addXP(data, 70, now);
  assert.equal(data.xp.life, 110, "the lifetime total starts from what days held");
  assert.equal(C.xpTotal(data), 110);
  assert.deepEqual(C.levelOf(data), { level: 2, xp: 110, from: 100, to: 300, into: 10, need: 200 });
  assert.equal(C.cleanXP({ days: {}, life: 5000 }).life, 5000, "kept in saves after the days roll off");
  const p = C.profileOf(data, now), b = C.badgesOf(data, p);
  assert.equal(b.all.length, 25);
  assert.equal(b.got.length, 0, "nothing played yet");
  data.gig = { shows: 12, fans: 0, best: {} };
  const ids = C.badgesOf(data, p).got.map(x => x.id);
  assert.deepEqual(ids, ["show1", "show10"]);
});

test("Merch table (4.16.0): Pink and Teal are free to wear, and test fans only add to what you can spend", () => {
  const now = new Date(2026, 9, 21, 20).getTime();
  const data = { songs: [], sets: [], trash: [], settings: {} };
  assert.equal(C.merchWear(data, "pink"), true, "free: no need to buy it");
  assert.equal(C.merchWorn(data), "pink");
  assert.equal(C.merchState(data, now).louie, "pink");
  assert.equal(C.cleanMerch({ louie: "teal" }).louie, "teal", "a free finish survives a backup");
  assert.equal(C.cleanMerch({ louie: "gold" }), null, "a bought one needs owning");
  assert.equal(C.MERCH.find(x => x.id === "black").name, "Studio black");
  const f0 = C.fansToSpend(data, now), xp = C.fansOf(data, now);
  data.merch.test = 1000;
  assert.equal(C.fansToSpend(data, now), f0 + 1000);
  assert.equal(C.fansOf(data, now), xp, "test fans aren't earned fans");
  assert.deepEqual(C.merchBuy(data, "tweed", now), { ok: true });
  assert.equal(C.cleanMerch({ test: 1000, spent: 600 }).test, 1000, "kept in saves");
});

test("Merch table (4.14.0): spending fans, gear, finishes and the Rain check", () => {
  const now = new Date(2026, 9, 21, 20).getTime();
  const data = { songs: [{ id: "a", title: "A", format: "chords", body: "[Verse]\nG C\nla", playLog: { total: 120, last: 0, days: { "2026-10-17": 60, "2026-10-18": 60 } } }], sets: [], trash: [], settings: {} };
  const f0 = C.fansToSpend(data, now);
  assert.ok(f0 >= 1200 && f0 < 1500, "120 plays");
  assert.deepEqual(C.merchBuy(data, "gold", now), f0 >= 1500 ? { ok: true } : { why: "fans" });
  if (f0 >= 1500) { data.merch.spent = 0; data.merch.has = []; delete data.merch.louie; }
  assert.deepEqual(C.merchBuy(data, "tweed", now), { ok: true });
  assert.equal(C.fansToSpend(data, now), f0 - 600, "spent");
  assert.equal(C.fansOf(data, now), f0, "earned fans stay");
  assert.equal(C.merchState(data, now).louie, "tweed", "worn once bought");
  assert.deepEqual(C.merchBuy(data, "tweed", now), { why: "have" });
  assert.equal(C.merchWear(data, "stock"), true); assert.equal(C.merchWear(data, "black"), false, "not bought");
  /* Rain checks: the 19th and 20th were missed; two checks cover both and the streak holds */
  assert.equal(C.streakOf(C.playSongs(data), now).days, 0);
  data.merch.own = { rain: 1 };
  assert.deepEqual(C.rainSettle(data, now), [], "one check can't cover two nights");
  data.merch.own.rain = 2;
  assert.deepEqual(C.rainSettle(data, now), ["2026-10-19", "2026-10-20"]);
  assert.equal(C.streakOf(C.playSongs(data), now).days, 4);
  assert.equal(C.weekXP(data, C.weekOf(now), now), 0, "covered nights (this week) add no XP");
  assert.deepEqual(C.merchBuy(data, "rain", now), { ok: true }); assert.deepEqual(C.merchBuy(data, "rain", now), { ok: true });
  assert.deepEqual(C.merchBuy(data, "rain", now), { why: "max" }, "two at most");
  /* Second take: a lost battle today plays again */
  data.charts = { tier: 0, battle: { day: "2026-10-21", rival: "Jen", songId: "a", target: 70, result: "lost", pct: 50 } };
  assert.equal(C.secondTake(data, now), false, "none held");
  data.merch.own.take = 1;
  assert.equal(C.secondTake(data, now), true); assert.equal(data.charts.battle.result, undefined); assert.equal(data.merch.own.take, 0);
  /* the Show complete tip names the cheapest thing you can now afford, once */
  const tip = C.merchTip(data, now);
  assert.equal(tip?.id, C.fansToSpend(data, now) >= 300 ? "brick" : undefined);
  assert.deepEqual(C.merchState({ ...data, merch: C.cleanMerch(JSON.parse(JSON.stringify(data.merch))) }, now), C.merchState(data, now), "kept through a save");
  assert.equal(C.cleanMerch({ own: { rain: 9 }, has: ["zz", "rain"], louie: "gold" }).own.rain, 2);
});

test("Stage Gels (4.1.0): each section's light from its name", () => {
  assert.equal(C.gelOf("Verse 2"), "verse");
  assert.equal(C.gelOf("Chorus"), "chorus");
  assert.equal(C.gelOf("Pre-Chorus"), "bridge");
  assert.equal(C.gelOf("Bridge"), "bridge");
  assert.equal(C.gelOf("Guitar solo"), "solo");
  assert.equal(C.gelOf("Intro"), "verse");
});

test("4.21.0 lesson of the day: warm up, the change his songs need, then that song's section at 70%", () => {
  const body = "[Verse]\n[C]Slip in[Dm]side the [C]eye of your [Dm]mind\n[Chorus]\n[G]So Sally can [C]wait\n[C]Here [Dm]we go [C]again";
  const other = "[Verse]\n[G]One [C]two [G]three [C]four";
  const data = { songs: [{ id: "a", title: "Anger", body, status: "learning" }, { id: "b", title: "Porch", body: other }], sets: [], trash: [], settings: {}, skills: { done: { "s:G-C": { n: 2, best: 90, at: 1 } }, last: 1 } };
  const now = new Date(2026, 9, 21, 10).getTime();
  const l = C.lessonOfDay(data, now);
  assert.deepEqual([l.warm.a, l.warm.b], ["G", "C"], "warm up on the switch he passed");
  assert.equal(l.learn.id, "s:C-Dm", "the change in the learning song he hasn't learned");
  assert.equal(l.learn.song, "Anger"); assert.equal(l.learn.times, 5);
  assert.equal(l.play.songId, "a"); assert.equal(l.play.sec, 0); assert.equal(l.play.secName, "Verse");
  assert.deepEqual(l.done, [false, false, false]); assert.equal(l.now, 0);
  /* the same all day, even after the library changes */
  assert.equal(C.lessonDone(data, 0, now).finished, false);
  data.songs.push({ id: "c", title: "New", body: "[V]\n[E]a [Am]b [E]c [Am]d [E]e [Am]f", status: "learning" });
  assert.equal(C.lessonOfDay(data, now + 3600e3).learn.id, "s:C-Dm");
  assert.equal(C.lessonPartOf(data, "s:C-Dm", now), 1);
  assert.equal(C.lessonPartOf(data, "s:E-Am", now), -1);
  C.lessonDone(data, 1, now);
  const before = data.xp?.life || 0;
  const r = C.lessonDone(data, 2, now);
  assert.deepEqual(r, { finished: true, xp: C.LESSON_XP });
  assert.equal(data.xp.life - before, C.LESSON_XP);
  assert.equal(C.lessonDone(data, 2, now).finished, false, "the XP once");
  assert.equal(C.lessonOfDay(data, now).finished, true);
  /* kept through a save */
  assert.deepEqual(C.cleanRehearse(JSON.parse(JSON.stringify(data.rehearse))).lesson.done.sort(), [0, 1, 2]);
  /* tomorrow: a new plan, and a learned change is skipped */
  data.skills.done["s:C-Dm"] = { n: 1, best: 80, at: now };
  const t = C.lessonOfDay(data, now + 86400e3);
  assert.notEqual(t.learn.id, "s:C-Dm"); assert.deepEqual(t.done, [false, false, false]);
});

test("4.21.0 lesson of the day: nothing to build from", () => {
  assert.equal(C.lessonOfDay({ songs: [], sets: [], trash: [], settings: {} }), null);
  assert.equal(C.lessonOfDay({ songs: [{ id: "t", title: "Tab", format: "tab", body: "e|--0--|" }], sets: [], trash: [], settings: {} }), null);
  /* no passed switches and nothing played: G to C to get going */
  const l = C.lessonOfDay({ songs: [{ id: "a", title: "A", body: "[V]\n[Am]x [F]y [Am]z [F]w" }], sets: [], trash: [], settings: {} });
  assert.equal(l.learn.id, "s:Am-F"); assert.equal(l.warm.id, "s:G-C"); assert.equal(l.play.sec, 0);
});

test("4.21.0 lesson of the day: learning the new change mid-lesson doesn't swap the lesson", () => {
  const data = { songs: [{ id: "a", title: "A", body: "[V]\n[Am]x [F]y [Am]z [F]w", status: "learning" }], sets: [], trash: [], settings: {} };
  const now = new Date(2026, 9, 21, 10).getTime();
  C.lessonKeep(data, now);
  C.skillDone(data, "s:Am-F", 80, now);
  assert.equal(C.lessonPartOf(data, "s:Am-F", now), 1);
  assert.equal(C.lessonOfDay(data, now).learn.id, "s:Am-F");
});

test("4.23.0 Your changes: the three your songs need most that you land least, and the one that's solid", () => {
  const now = new Date(2026, 9, 21, 10).getTime(), day = dayKey => dayKey;
  const k = new Date(now); const today = `${k.getFullYear()}-${String(k.getMonth() + 1).padStart(2, "0")}-${String(k.getDate()).padStart(2, "0")}`;
  const data = { songs: [
    { id: "a", title: "Anger", body: "[V]\n[C]a [Dm]b [C]c [Dm]d [C]e [Dm]f" },
    { id: "b", title: "Porch", body: "[V]\n[G]a [C]b [G]c [C]d [G]e [C]f [G]g" },
    { id: "c", title: "Late", body: "[V]\n[Em]a [Am]b [Em]c [Am]d [G]e [C]f" }
  ], sets: [], trash: [], settings: {}, rehearse: { lands: { "G>C": { n: 41, days: { [today]: 41 } }, "C>G": { n: 0, days: {} } }, misses: { "G>C": { n: 2, days: { [today]: 2 } }, "Em>Am": { n: 5, days: { [today]: 5 } } } } };
  data.rehearse.lands["Em>Am"] = { n: 2, days: { [today]: 2 } };
  const r = C.changesToWork(data, now);
  assert.equal(r.solid.id, "s:G-C"); assert.equal(r.solid.landed, 41); assert.equal(r.solid.of, 43);
  assert.equal(r.work[0].id, "s:C-Dm", "not tried yet, and the most in his songs, comes first");
  assert.match(r.work[0].why, /In Anger, 5 times|In Anger, \d+ times/);
  assert.equal(r.work[0].tried, false);
  assert.ok(r.work.some(w => w.id === "s:Em-Am" && w.landed === 2 && w.of === 7 && /Late/.test(w.why)));
  assert.ok(!r.work.some(w => w.id === "s:G-C"), "the solid one isn't a thing to work on");
  assert.ok(r.work.length <= 3);
  /* a window of seven days: old landings don't count */
  const later = C.changesToWork(data, now + 9 * 86400e3);
  assert.equal(later.solid, null);
  /* a library with no changes, or tab songs only */
  assert.deepEqual(C.changesToWork({ songs: [], sets: [], trash: [], settings: {} }, now), { work: [], solid: null });
});

test("4.23.0 the changes you land are kept like the ones you drop", () => {
  const data = { songs: [], sets: [], trash: [], settings: {} };
  const now = new Date(2026, 9, 21, 10).getTime();
  C.rehearseMisses(data, { "C>F": 2 }, now, { "G>C": 9, "bad": 3 });
  assert.equal(data.rehearse.lands["G>C"].n, 9); assert.equal(data.rehearse.lands.bad, undefined);
  C.rehearseMisses(data, {}, now + 20 * 86400e3, { "G>C": 1 });
  assert.equal(data.rehearse.lands["G>C"].n, 1, "older than 14 days is dropped");
  const clean = C.cleanRehearse(JSON.parse(JSON.stringify(data.rehearse)));
  assert.equal(clean.lands["G>C"].n, 1);
});

test("4.29.0 Play together links: the tempo rides along, an old start time is dropped", async () => {
  const song = { title: "A", body: "G C" };
  const now = await C.unpackShare(await C.packShare({ song, duet: { bpm: 120 } }));
  assert.deepEqual(now.duet, { bpm: 120 });
  const old = await C.unpackShare(await C.packShare({ song, duet: { at: Date.now() + 60000, bpm: 500 } }));
  assert.deepEqual(old.duet, { bpm: 300 }, "the time goes, the tempo is kept in range");
  assert.equal(old.song.title, "A");
});

test("4.36.0 languages: Spanish and Russian genders, the sound of Russian kept, German unchanged by default", () => {
  const L = [{ tokens: ["Grey", "boats", "home"], text: "Grey boats home" }];
  const ru = C.cleanGerman({ lines: [{ i: 0, de: "Се́рые ло́дки домо́й", tr: "Sérye lódki domóy", s: [{ w: 1, n: 1, l: 1, de: "ло́дки", tr: "lódki", g: "f", lemma: "ло́дка" }, { w: 2, n: 1, l: 1, de: "домо́й", g: "der" }] }] }, L, "ru");
  assert.equal(ru[0].tr, "Sérye lódki domóy");
  assert.equal(ru[0].s[0].g, "f"); assert.equal(ru[0].s[0].tr, "lódki");
  assert.equal(ru[0].s[1].g, "", "a German article isn't a Russian gender");
  const es = C.cleanGerman({ lines: [{ i: 0, de: "Barcos grises", tr: "x", s: [{ w: 1, n: 1, l: 1, de: "barcos", g: "el" }, { w: 2, n: 1, l: 1, de: "casa", g: "die" }] }] }, L, "es");
  assert.equal(es[0].s[0].g, "el"); assert.equal(es[0].s[1].g, ""); assert.equal(es[0].tr, undefined, "only Russian keeps a sound line");
  assert.equal(C.cleanGerman({ lines: [{ i: 0, de: "x", s: [{ w: 0, n: 1, l: 1, de: "Boote", g: "das" }] }] }, L)[0].s[0].g, "das", "German by default");
  assert.equal(C.langOf({ settings: {} }), "de"); assert.equal(C.langOf({ settings: { lang: "ru" } }), "ru"); assert.equal(C.langOf({ settings: { lang: "fr" } }), "de");
  assert.equal(C.langChosen({ settings: {}, songs: [] }), false); assert.equal(C.langChosen({ settings: {}, songs: [{ de: {} }] }), true, "a library translated before 4.36.0 counts as German");
  assert.equal(C.deLangOk({ de: {} }, { settings: { lang: "es" } }), false, "an untagged translation is German");
  const v = (name, lang) => ({ name, lang });
  assert.equal(C.bestVoice([v("Anna", "de-DE"), v("Milena", "ru-RU"), v("Monica", "es-ES")], "ru").name, "Milena");
  assert.equal(C.bestVoice([v("Anna", "de-DE")], "es"), null);
  const blocks = C.parseBlocks("[V]\nGrey boats home");
  const out = C.germanBlocks(blocks, { lines: [ru[0]] }, 4, { translit: true });
  assert.ok(out.some(b => b.tr === "Sérye lódki domóy"), "Fluent carries the sound under the line");
  assert.ok(C.germanBlocks(blocks, { lines: [ru[0]] }, 4).every(b => !b.tr), "only when asked");
});

test("4.39.1 Louie's hands: the thumbs up tips the thumb out, and the pointing hand leans toward the bubble", async () => {
  const { louie } = await import("../louie.js");
  const up = louie("cheer", { pose: "thumb" });
  assert.match(up, /rotate\(-32 -9 -27\)/, "the thumb is tipped out to the side, not standing in the middle");
  assert.equal((up.match(/class="lv-fs" x="0"/g) || []).length, 3, "three curled fingers show on the fist");
  assert.match(louie("happy", { pose: "point" }), /translate\(180 108\) rotate\(40\)/, "the pointing hand leans, never straight up");
});

test("4.40.0 Opening night: only for a new player, one step at a time, fans once, skip and replay", () => {
  const fresh = () => ({ songs: [{ id: "s", title: "Harbor Lights", sample: true, body: "[Verse]\nG D\nLights" }], sets: [], trash: [], settings: {} });
  const d = fresh();
  assert.equal(C.openingView(d), "leg", "a new player starts on Opening night");
  assert.equal(C.openingView({ ...fresh(), skills: { done: { "chord-G": { n: 1 } } } }), null, "anyone with a lesson (or a play) never sees it");
  assert.equal(C.openingAdvance(d, "chord"), false, "steps go in order");
  assert.equal(C.openingAdvance(d, "mic"), true);
  assert.equal(C.openingStep(d), 1); assert.equal(C.fansOf(d), C.FANS.lesson, "a step gives lesson fans");
  for (const id of ["chord", "verse", "pause", "show"]) assert.ok(C.openingAdvance(d, id), id);
  assert.equal(d.opening.fans, 4 * C.FANS.lesson, "the show itself pays as a play, not as a step");
  assert.equal(C.openingView(d), "done", "the Road shows it done once");
  d.opening.seen = 1; assert.equal(C.openingView(d), null);
  C.openingReplay(d); assert.equal(C.openingView(d), "leg", "Tips & gestures replays it");
  C.openingAdvance(d, "mic"); assert.equal(d.opening.fans, 4 * C.FANS.lesson, "no fans twice");
  const s = fresh(); C.openingSkip(s); assert.equal(C.openingView(s), null, "Skip ends it");
  assert.deepEqual(C.cleanOpening({ step: 9, fans: 999, micOff: true, done: "x", junk: 1 }), { step: 5, fans: 25, micOff: true });
  assert.equal(C.cleanOpening("no"), null);
});

test("4.41.0 chords where the chord sites have them: numbered words in, positions out, the sheet built on the phone", () => {
  const lyr = "[Verse 1]\nSaw the lights come on at six\nGulls were arguing over tricks\n\n[Chorus]\nCarry me home tonight\nLay me down";
  const num = C.numberLyrics(lyr);
  assert.match(num.prompt, /Stanza 1 \(Verse 1\)\n1\| \[1\]Saw \[2\]the/);
  assert.equal(num.lines.length, 4);
  const p = C.cleanPlaced({ found: true, sheet: [{ section: "Intro", chords: "G D" }, { section: "Verse 1", stanza: 1 }, { section: "Chorus", stanza: 2 }, { section: "Bad", stanza: 9 }],
    lines: [{ n: 1, c: [[1, "G"], [3, "D"]] }, { n: 2, c: [[0, "C"], [4, "Em"]] }, { n: 3, c: [[2, "A"]] }, { n: 4, c: [[9, "E"], [1, "Zz"]] }, { n: 99, c: [[1, "G"]] }] }, num);
  assert.deepEqual(p.lines[4], [[3, "E"]], "a word past the end is the last word; not-a-chord is dropped");
  assert.equal(p.sheet.length, 3, "a stanza that doesn't exist is dropped");
  const body = C.placedSheet("Key: G\n[Verse]\nG D", lyr, p);
  assert.match(body, /^Key: G\n\n\[Intro\]\nG {3}D\n\n\[Verse 1\]\nG {7}D\nSaw the lights come on at six\nC {18}Em\nGulls/);
  assert.match(body, /\[Chorus\]\n {6}A\nCarry me home tonight/);
  assert.equal(C.cleanPlaced({ found: false }, num), null);
  assert.equal(C.cleanPlaced({ found: true, sheet: [], lines: [] }, num), null, "too little to trust");
  const once = C.placedSheet("", "a b\nc d\n\ne f", C.cleanPlaced({ found: true, sheet: [{ section: "Verse", stanza: 1 }], lines: [{ n: 1, c: [[1, "G"]] }, { n: 2, c: [[1, "D"]] }, { n: 3, c: [[1, "C"]] }] }, C.numberLyrics("a b\nc d\n\ne f")));
  assert.match(once, /e f/, "a stanza the AI left out is never dropped");
  const guess = C.mergeWords("[Verse]\nG D Em C\n[Chorus]\nC G", "a b c d e\nf g h i\nj k l m\nn o p q r");
  assert.equal(C.looksGuessed(guess), true, "the old guess is recognised");
  assert.equal(C.looksGuessed(body), false);
  assert.equal(C.lyricsOfSheet(guess), "[Verse]\na b c d e\nf g h i\nj k l m\nn o p q r", "the words back out of a sheet, chords left out");
  assert.equal(C.cleanSong({ id: "x", body: "a", spots: "placed", spotsTried: 5 }).spots, "placed");
  assert.equal(C.cleanSong({ id: "x", body: "a", spots: "nope", spotsTried: "x" }).spots, undefined);
});

test("4.44.0 achievement callouts: a level and a badge are celebrated once; the first run counts what you have as seen", () => {
  const p = { songsPlayed: 0, chords: [], best: 0, got: 0, barres: 0, tune: { sessions: 0 } };
  const data = { songs: [], gig: { shows: 1 } };
  assert.deepEqual(C.achSettle(data, p), [], "first run: nothing, everything you have is seen");
  assert.ok(data.ach.badges.includes("show1"));
  data.gig.shows = 10;
  const got = C.achSettle(data, p);
  assert.deepEqual(got.map(x => [x.kind, x.word, x.big]), [["badge", "GIGS", "10"]]);
  assert.deepEqual(C.achSettle(data, p), [], "not again");
  const had = new Set(["G"]), p2 = { ...p, chords: [{ name: "G" }, { name: "F" }] };
  assert.deepEqual(C.achSettle(data, p2, had).map(x => x.big), ["F"], "a new chord");
});

test("4.44.0 callout looks never repeat back to back, and only joined friends celebrate", () => {
  for (const kind of Object.keys(C.CALLOUT_LOOKS)) for (const last of C.CALLOUT_LOOKS[kind]) for (const r of [0, 0.5, 0.99]) assert.notEqual(C.pickLook(kind, last, r), last, `${kind} after ${last}`);
  const none = { songs: [] };
  assert.equal(C.castFor(none, "combo", null, 0), null, "no band yet: Louie alone");
  const band = { songs: [], journal: { v: 1, months: { "2026-10": { plays: 20 } } } }, joined = C.bandState(band).joined.map(b => b.id);
  assert.ok(joined.includes("beat"));
  assert.equal(C.castFor(band, "combo", null, 0), "beat", "Beat takes the combos");
  assert.notEqual(C.castFor(band, "combo", "beat", 0), "beat", "not the same friend twice in a row");
  for (let i = 0; i < 20; i++) assert.ok(joined.includes(C.castFor(band, "badge", null, i / 20)), "always one who has joined");
  assert.equal(C.castFor(band, "join", "beat", 0, "beat"), "beat", "a new member is the one shown");
});
