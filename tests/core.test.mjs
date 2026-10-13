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
  const scripts = fs.readdirSync(root).filter(f => f.endsWith(".js"));
  for (const f of scripts) execFileSync(process.execPath, ["--check", path.join(root, f)], { stdio: "pipe" });
  const html = read("index.html");
  assert.match(html, /<script type="module" src="app.js"><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="styles.css">/);
  const shell = read("sw.js");
  for (const f of ["index.html", "styles.css", ...scripts.filter(f => f !== "sw.js")]) assert.ok(shell.includes(`"${f}"`), `${f} is saved for offline`);
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
  assert.equal(C.fitLength(900), 480);
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

test("tuner: advice, guided order, hold and strobe", () => {
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
  assert.equal(C.heldInTune(1000, 1900), false);
  assert.equal(C.heldInTune(1000, 2000), true);
  assert.equal(C.strobeSpeed(2), 0);
  assert.ok(C.strobeSpeed(-5) < 0 && C.strobeSpeed(5) > 0);
  assert.equal(C.strobeSpeed(500), 60);
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
  const files = fs.readdirSync(new URL("..", import.meta.url)).filter(f => f.endsWith(".js") && f !== "sw.js" && f !== "eslint.config.js");
  const src = Object.fromEntries(files.map(f => [f, fs.readFileSync(new URL("../" + f, import.meta.url), "utf8")]));
  const exported = f => {
    const s = src[f], out = new Set();
    for (const m of s.matchAll(/export\s*\{([^}]*)\}/g)) m[1].split(",").map(x => x.trim().split(/\s+as\s+/).pop()).filter(Boolean).forEach(n => out.add(n));
    for (const m of s.matchAll(/export\s+(?:async\s+)?(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/g)) out.add(m[1]);
    return out;
  };
  const missing = [];
  for (const [f, s] of Object.entries(src)) for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*"\.\/([^"?]+)"/g)) {
    const have = exported(m[2]);
    for (const n of m[1].split(",").map(x => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) if (!have.has(n)) missing.push(`${f} imports ${n} from ${m[2]}`);
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
    const want = f.split(/[_.]/)[0];
    const reads = [];
    for (let s = Math.round(rate * 0.25); s + 4096 < n && s < rate * 2.5; s += Math.round(rate * 0.25)) {
      const hz = C.detectPitch(pcm.subarray(s, s + 4096), rate);
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
