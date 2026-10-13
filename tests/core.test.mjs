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

test("the app script in index.html parses", () => {
  // A syntax error here stops the whole app from loading, so check it before every release.
  const html = read("index.html");
  const start = html.indexOf('<script type="module">');
  assert.ok(start >= 0, "module script not found");
  const end = html.indexOf("</script>", start);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tabs-")), "app.mjs");
  fs.writeFileSync(file, html.slice(start + '<script type="module">'.length, end));
  execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
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
  assert.equal(d.settings.v, 4);
  assert.equal(d.settings.speedMode, "length");
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

test("library sorts by recent, most played and key", () => {
  assert.deepEqual(C.sortSongs(lib, "recent").map(s => s.id), ["3", "2", "1"]);
  assert.deepEqual(C.sortSongs(lib, "most").map(s => s.id), ["1", "2", "3"]);
  assert.deepEqual(C.sortSongs(lib, "key").map(s => s.id), ["3", "2", "1"]);
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
