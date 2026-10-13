// Browser tests: the real app in Chromium, phone-sized.
// Run: node --test tests/e2e/   (needs Playwright: npm i --no-save playwright && npx playwright install chromium)
// They catch what unit tests can't: the app failing to load, screens not
// rendering, taps doing the wrong thing.

import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { try { ({ chromium } = require(path.join(process.execPath, "..", "..", "lib", "node_modules", "playwright"))); } catch {} }

// A tiny static server for the repo.
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };
function serve() {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = path.join(root, p === "/" ? "index.html" : p);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(ok => server.listen(0, "127.0.0.1", () => ok(server)));
}

const SONG = `[Verse]
A                  D
Walking down the river road tonight
A              D
Lantern in my hand and nothing in mind

[Chorus]
A        F#m          E
Carry me home, carry me home
D                     A
Lay me down where the willows grow`;
const LIB = {
  songs: [
    { id: "a", title: "River Road", artist: "The Wanderers", key: "A", format: "chords", body: SONG, duration: 30 },
    { id: "b", title: "Harbor Lights", artist: "Me", key: "G", format: "chords", body: "[Verse]\nG   C\nLights on the water" }
  ],
  sets: [], trash: [],
  settings: { v: 5, tipsSeen: { library: true, song: true, edit: true, add: true, map: true, pause: true, chord: true, play: true, line: true, tap: true, paste: true, menu: true, strobe: true, searchInvite: true, search: true, nn: true }, sampleAdded: true, lastBackup: "2099-01-01T00:00:00Z", countIn: false }
};

let server, browser, base;
test.before(async () => {
  if (!chromium) return;
  server = await serve();
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});
test.after(async () => { await browser?.close(); server?.close(); });

// A fresh phone with the test library; fails the test on any page error.
async function phone(t, lib = LIB, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: "block", hasTouch: true, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (/Content Security Policy/i.test(m.text())) errors.push(m.text()); });
  await page.goto(base);
  await page.waitForTimeout(300);
  await page.evaluate(d => localStorage.setItem("tabs-v1", JSON.stringify(d)), lib);
  await page.reload();
  await page.waitForTimeout(300);
  t.after(async () => { assert.deepEqual(errors, [], "page errors"); await ctx.close(); });
  return page;
}
const skip = () => !chromium && "Playwright not installed";

test("first launch adds the sample song and shows the library", { skip: skip() }, async t => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(base); await page.waitForTimeout(500);
  assert.match(await page.innerText("h1.title"), /Library/);
  assert.equal(await page.locator("#list .row").count(), 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("a song opens, transposes and plays; a tap pauses it", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.goto(base + "#/song/a"); await page.waitForTimeout(400);
  assert.match(await page.innerText("#meta"), /Key A/);
  await page.click("#up"); await page.waitForTimeout(100);
  assert.match(await page.innerText("#meta"), /Key Bb/);
  await page.click("#play"); await page.waitForTimeout(800);
  assert.equal(await page.getAttribute("#play", "aria-label"), "Pause auto-scroll");
  await page.touchscreen.tap(200, 500); await page.waitForTimeout(200);
  assert.equal(await page.getAttribute("#play", "aria-label"), "Start auto-scroll");
});

test("search moves to the top, finds lyrics, and offers to find what's missing", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.tap("#q"); await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => document.body.classList.contains("searching")));
  await page.keyboard.type("willows"); await page.waitForTimeout(300);
  assert.match(await page.innerText("#list"), /River Road/);
  await page.fill("#q", "zzz unknown"); await page.dispatchEvent("#q", "input"); await page.waitForTimeout(300);
  assert.ok(await page.locator(".findcard").count());
  await page.tap("#qcancel"); await page.waitForTimeout(300);
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("searching"))));
});

test("Edit places a chord over a word, and Text keeps the change", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.goto(base + "#/song/a"); await page.waitForTimeout(400);
  await page.click("#more"); await page.waitForTimeout(150);
  await page.click(".menu [data-m='edit']"); await page.waitForTimeout(300);
  await page.click(".ce-w[data-word='road']"); await page.waitForTimeout(200);
  await page.click("[data-u='E']"); await page.waitForTimeout(300);
  await page.click("[data-v='text']"); await page.waitForTimeout(300);
  assert.match(await page.inputValue("#ed-body"), /A {18}D {3}E\nWalking down the river road tonight/);
  await page.click("#ce-done"); await page.waitForTimeout(400);
  assert.match(await page.innerText("#sheet"), /E/);
});

test("a new set with a date shows as Up next and plays after its title card", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.click("[data-f='sets']"); await page.waitForTimeout(200);
  await page.click("#newset"); await page.waitForTimeout(400);
  await page.fill("#ns-name", "Friday Gig");
  const d = new Date(Date.now() + 3 * 864e5); const when = `${d.toISOString().slice(0, 10)}T20:00`;
  await page.fill("#ns-when", when); await page.dispatchEvent("#ns-when", "change");
  await page.click("#ns-ok"); await page.waitForTimeout(800);
  await page.click("#pk-list .row:has-text('River Road')"); await page.click("#pk-list .row:has-text('Harbor Lights')");
  await page.click("#pk-add"); await page.waitForTimeout(400);
  await page.goto(base); await page.waitForTimeout(400);
  assert.match(await page.innerText("#upnext"), /Friday Gig/);
  await page.click("#un-play"); await page.waitForTimeout(500);
  assert.ok(await page.locator(".titlecard").count());
  await page.waitForTimeout(3000);
  assert.match(page.url(), /#\/song\/a/);
});

test("a shared song link opens the Shared with you sheet", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { permissions: ["clipboard-read", "clipboard-write"] });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(400);
  await page.click("#more"); await page.waitForTimeout(150);
  await page.click(".menu [data-m='share']"); await page.waitForTimeout(400);
  const url = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(url, /#\/import\/z/);
  await page.goto(url); await page.reload(); await page.waitForTimeout(500);
  assert.match(await page.innerText("[aria-label='Shared with you']"), /River Road/);
});

test("theme: Automatic follows the phone; Dark and Light override it", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { colorScheme: "light" });
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  assert.equal(await theme(), "light", "automatic follows a light phone");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(100);
  assert.equal(await theme(), "dark", "and changes with it");
  await page.goto(base + "#/settings");
  await page.waitForTimeout(200);
  await page.click("#s-theme [data-t='light']");
  assert.equal(await theme(), "light", "Light overrides a dark phone");
  await page.click("#s-theme [data-t='auto']");
  assert.equal(await theme(), "dark");
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.theme), "auto");
});

test("security policy allows Apple art, the Anthropic API and song search, and nothing else", { skip: skip() }, async t => {
  const page = await phone(t);
  const blocked = [];
  page.removeAllListeners("console");
  page.on("console", m => { if (/Content Security Policy/i.test(m.text())) blocked.push(m.text()); });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  await page.route(/mzstatic\.com|example\.com\/.*\.png/, r => r.fulfill({ status: 200, contentType: "image/png", body: png }));
  await page.route(/api\.anthropic\.com|itunes\.apple\.com|example\.com\/api/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }));
  const res = await page.evaluate(async () => {
    const img = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(true); i.onerror = () => ok(false); i.src = src; });
    const get = url => fetch(url).then(() => true, () => false);
    return {
      art: await img("https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.png"),
      otherImg: await img("https://example.com/pixel.png"),
      anthropic: await get("https://api.anthropic.com/v1/messages"),
      itunes: await get("https://itunes.apple.com/search?term=x"),
      other: await get("https://example.com/api")
    };
  });
  assert.deepEqual(res, { art: true, otherImg: false, anthropic: true, itunes: true, other: false });
  assert.ok(blocked.length >= 2, "blocked requests are reported");
});

test("restoring a backup brings back songs and set cover photos, and skips broken songs", { skip: skip() }, async t => {
  const page = await phone(t);
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const backup = {
    songs: [{ id: "x", title: "Backup Song", body: "[Verse]\nG\nhello", format: "chords" }, { id: "y", title: "Broken" }],
    sets: [{ id: "s9", name: "Saturday", songIds: ["x"], cover: { type: "photo", tint: "#553322" } }],
    trash: [], settings: { v: 5, tipsSeen: { library: true, song: true, edit: true, add: true, map: true, pause: true, chord: true, play: true, line: true, tap: true, paste: true, menu: true, strobe: true, searchInvite: true, search: true, nn: true }, sampleAdded: true, lastBackup: "2099-01-01T00:00:00Z" },
    covers: { s9: png }
  };
  await page.goto(base + "#/settings");
  await page.locator("#file").setInputFiles({ name: "tabs-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.waitForTimeout(500);
  assert.match(await page.locator("#toast").textContent(), /Imported 1 song\. Skipped 1/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")));
  assert.deepEqual(saved.songs.map(s => s.title), ["Backup Song"]);
  assert.equal(saved.covers, undefined, "photos stay out of the main save");
  await page.goto(base + "#/set/s9");
  await page.waitForTimeout(400);
  assert.equal(await page.locator(".cover img").first().getAttribute("src"), png);
});

test("Add opens a blank song in the editor; Save keeps it, Cancel removes it", { skip: skip() }, async t => {
  const page = await phone(t);
  const titles = () => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.map(s => s.title + (s.isNew ? "*" : "")));
  await page.click("#add");
  await page.waitForTimeout(600);
  assert.equal(await page.locator("#ce-done").textContent(), "Save");
  assert.ok(await page.locator("#ed-body").isVisible(), "opens in the Text view");
  await page.fill("#ed-body", "[Verse]\nG       C\nHello there friend");
  await page.waitForTimeout(450);
  assert.match(await page.locator(".ed-chips").textContent(), /G \(auto\)/);
  await page.click("#ce-done");
  await page.waitForTimeout(200);
  assert.match(await page.locator("#toast").textContent(), /Add a title first/);
  await page.fill("#ed-title", "New One");
  await page.click("#ce-done");
  await page.waitForTimeout(500);
  assert.equal(await page.locator("h1.song-title").textContent(), "New One");
  assert.deepEqual(await titles(), ["New One", "River Road", "Harbor Lights"]);

  await page.goto(base + "#/");
  await page.waitForTimeout(300);
  await page.click("#add");
  await page.waitForTimeout(600);
  await page.fill("#ed-body", "e|---0---2---|\nB|---1---3---|\nG|---0---2---|\nD|---2---0---|");
  await page.waitForTimeout(450);
  assert.match(await page.locator(".ed-chips").textContent(), /Format\s*Tab/);
  assert.equal(await page.locator("#ed-seg").isVisible(), false, "no Sheet view for tab");
  // Cancel discards at once (no question), and Undo brings it back to editing.
  await page.click("#ce-cancel");
  await page.waitForTimeout(500);
  assert.deepEqual(await titles(), ["New One", "River Road", "Harbor Lights"]);
  assert.match(await page.innerText("#toast"), /Song discarded/);
  await page.click("#toast .tact"); await page.waitForTimeout(600);
  assert.match(await page.inputValue("#ed-body"), /^e\|---0/);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.length, 4);
});

test("questions are asked in the app: rename a section, any chord, delete for good", { skip: skip() }, async t => {
  const page = await phone(t);
  page.on("dialog", d => { d.dismiss(); throw new Error("native dialog: " + d.message()); });
  const body = async () => JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "a").body;
  await page.goto(base + "#/song/a"); await page.waitForTimeout(400);
  await page.click("#more"); await page.click(".menu [data-m='edit']"); await page.waitForTimeout(500);
  await page.click("[data-sec] >> nth=0"); await page.waitForTimeout(200);
  assert.equal(await page.inputValue("#ask-in"), "Verse");
  await page.click(".ask [data-pick='Intro']"); await page.waitForTimeout(400);
  assert.match(await body(), /^\[Intro\]/);
  await page.click(".ce-w >> nth=0"); await page.click("#ce-other"); await page.waitForTimeout(200);
  await page.fill("#ask-in", "Cadd9");
  assert.equal(await page.textContent("#ask-ok"), "Place Cadd9");
  assert.equal(await page.locator("#ask-pv svg").count(), 1, "diagram shows as you type");
  await page.press("#ask-in", "Enter"); await page.waitForTimeout(400);
  assert.match(await body(), /Cadd9/);
  // Delete for good asks in a sheet; Keep it keeps it.
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("tabs-v1")); d.trash = [{ type: "song", item: { id: "z", title: "Old Song", body: "G" }, deletedAt: new Date().toISOString() }]; localStorage.setItem("tabs-v1", JSON.stringify(d)); });
  await page.goto(base + "#/"); await page.reload(); await page.waitForTimeout(300);
  await page.goto(base + "#/trash"); await page.waitForTimeout(300);
  await page.click("[data-forget]"); await page.waitForTimeout(200);
  assert.match(await page.innerText(".ask"), /Delete “Old Song” for good\?/);
  await page.click("#ask-no"); await page.waitForTimeout(200);
  assert.equal(await page.locator("[data-forget]").count(), 1);
  await page.click("[data-forget]"); await page.click("#ask-ok"); await page.waitForTimeout(300);
  assert.equal(await page.locator("[data-forget]").count(), 0);
});

test("an Apple Music link sets the song's length; tapping sets the tempo", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.route("https://itunes.apple.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ results: [{ trackName: "Harbor Lights", artistName: "Me", trackViewUrl: "https://music.apple.com/us/album/a/1?i=111", trackTimeMillis: 232000 }] }) }));
  await page.route("https://music.apple.com/**", r => r.fulfill({ status: 200, body: "" }));
  await page.goto(base + "#/song/b");
  await page.waitForTimeout(400);
  await page.click("#listen");
  await page.waitForTimeout(400);
  await page.click("[data-t='0']");
  await page.waitForTimeout(400);
  assert.equal(await page.locator("#sv").textContent(), "3:52");
  assert.match(await page.locator("#toast").textContent(), /Length set from the recording: 3:52/);

  await page.click("#more");
  await page.click(".menu [data-m='edit']");
  await page.waitForTimeout(300);
  const box = await page.locator("#ed-tap").boundingBox();
  for (let i = 0; i < 5; i++) { await page.mouse.click(box.x + 10, box.y + 10); await page.waitForTimeout(500); }
  await page.waitForTimeout(1800);
  const bpm = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.id === "b").bpm);
  assert.ok(bpm >= 105 && bpm <= 122, `about 120 BPM, got ${bpm}`);
});

test("first song: try a chord, then Play; tips never block and show once", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, tipsSeen: { library: true, song: true } } });
  await page.goto(base + "#/song/a");
  await page.waitForTimeout(900);
  const cap = () => page.evaluate(() => document.querySelector(".coach")?.textContent || null);
  assert.equal(await cap(), "Tap a chord to see how to play it");
  // The caption doesn't block: tapping the chord works and shows its diagram.
  await page.locator(".coach-pulse").click();
  await page.waitForTimeout(200);
  assert.ok(await page.locator(".dpop").count(), "diagram shown");
  assert.equal(await cap(), "That's how it's played");
  await page.waitForTimeout(2200);
  assert.equal(await cap(), "Press play when you're ready");
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings);
  assert.ok(s.used.chord && s.tipsSeen.chord && s.tipsSeen.play);
  // Second visit: nothing.
  await page.goto(base + "#/");
  await page.goto(base + "#/song/a");
  await page.waitForTimeout(900);
  assert.equal(await cap(), null);
  // New features carry a dot in the menu until used.
  await page.click("#more");
  assert.ok(await page.locator(".menu [data-new='tuner']").count());
});

// A pretend microphone: a steady tone whose pitch the test sets with window.__hz.
const FAKE_MIC = `
window.__hz = 0;
navigator.mediaDevices.getUserMedia = async () => {
  const ctx = new AudioContext(), o = ctx.createOscillator(), g = ctx.createGain(), dest = ctx.createMediaStreamDestination();
  o.type = "sawtooth"; g.gain.value = 0; o.connect(g).connect(dest); o.start();
  setInterval(() => { if (window.__hz) { o.frequency.value = window.__hz; g.gain.value = 0.4; } else g.gain.value = 0; }, 20);
  return dest.stream;
};`;

test("tuner: guided acoustic walks the strings, the strobe shows near pitch, chromatic reads any note", { skip: skip() }, async t => {
  const browser2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => browser2.close());
  const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(FAKE_MIC);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(base);
  await page.waitForTimeout(400); /* let the first-launch save land before replacing the library */
  await page.evaluate(d => localStorage.setItem("tabs-v1", JSON.stringify(d)), { ...LIB, settings: { ...LIB.settings, tipsSeen: { ...LIB.settings.tipsSeen, tuner: true }, micExplained: true } });
  await page.reload();
  await page.waitForTimeout(300);
  await page.click("#tunerbtn");
  await page.waitForTimeout(600);
  const read = () => page.evaluate(() => ({ note: document.getElementById("tn-n").textContent, say: document.getElementById("tn-say").textContent, strobe: !document.getElementById("tn-strobe").hidden }));
  assert.equal((await read()).say, "Play the E string");
  assert.equal(await page.locator(".tn-tile.on").textContent(), "Acoustic");
  const at = (hz, cents) => page.evaluate(f => { window.__hz = f; }, hz * 2 ** (cents / 1200));
  await at(82.41, -25); await page.waitForTimeout(700);
  assert.deepEqual(await read(), { note: "E", say: "Tighten", strobe: false });
  await at(82.41, -4); await page.waitForTimeout(700);
  assert.equal((await read()).strobe, true, "strobe within 5 cents");
  for (const hz of [82.41, 110, 146.83, 196, 246.94, 329.63]) { await at(hz, 0); await page.waitForTimeout(1700); }
  assert.equal((await read()).note, "All in tune");
  await page.click("[data-mode='chromatic']");
  await at(185, -12); await page.waitForTimeout(700);
  const r = await read();
  assert.equal(r.note, "F♯");
  assert.equal(r.say, "A little flat");
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings);
  assert.equal(s.tunerMode, "chromatic");
  assert.ok(s.lastTuned > 0);
  await page.click("#tn-done");
  assert.equal(await page.locator(".tuner2").count(), 0);
  assert.deepEqual(errors, []);
});

test("Tips & gestures lists every gesture and Show me replays a tip where it happens", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.goto(base + "#/settings");
  await page.click("#s-tips");
  await page.waitForTimeout(300);
  assert.ok(await page.locator(".gs-row").count() >= 20, "all gestures listed");
  // The page itself scrolls (it isn't a sheet over Settings).
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  assert.ok(await page.evaluate(() => scrollY > 200));
  await page.click("[data-demo='search']");
  await page.waitForTimeout(800);
  assert.match(await page.locator(".coach").last().innerText(), /Paste a chord sheet to add it/);
  await page.goto(base + "#/gestures");
  await page.click("[data-demo='line']");
  await page.waitForTimeout(1500);
  assert.match(await page.locator(".coach").last().innerText(), /Tap a line to start from it/);
  assert.ok(await page.evaluate(() => document.getElementById("sheet").classList.contains("focus")), "real focus look");
});

test("tuner: says why it needs the microphone before the phone asks", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = () => new Promise(() => {}); });
  await page.click("#tunerbtn");
  await page.waitForTimeout(500);
  assert.match(await page.locator(".tn-mic").innerText(), /Nothing is recorded or sent/);
  await page.click("#tn-allow");
  assert.equal(await page.locator(".tn-mic").count(), 0);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.micExplained), true);
});

test("after an update, an open app still loads its parts from its own release", { skip: skip() }, async t => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  t.after(() => ctx.close());
  const page = await ctx.newPage();
  await page.goto(base);
  await page.waitForFunction(() => navigator.serviceWorker?.ready.then(() => true), null, { timeout: 10000 });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
  // An older release, still in its cache, whose tuner imports its own heads.js.
  const got = await page.evaluate(async () => {
    const c = await caches.open("tabs-v0.0.1");
    const js = b => new Response(b, { headers: { "content-type": "text/javascript" } });
    await c.put(new Request("./tuner.js"), js('import { WHICH } from "./heads.js"; export const which = () => "old tuner, " + WHICH;'));
    await c.put(new Request("./heads.js"), js('export const WHICH = "old heads";'));
    return (await import("./tuner.js?v=0.0.1")).which();
  });
  assert.equal(got, "old tuner, old heads");
  // A page on the current release gets the current parts.
  await page.reload();
  const cur = await page.evaluate(async () => typeof (await import("./tuner.js?v=" + (await import("./core.js")).VERSION)).openTuner);
  assert.equal(cur, "function");
});

test("a problem is kept, and Copy diagnostics reports it without song words or the key", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { permissions: ["clipboard-read", "clipboard-write"] });
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-ant-secret"));
  await page.evaluate(() => { localStorage.setItem("tabs.errors.v1", JSON.stringify([{ at: "2026-10-01T00:00:00Z", v: "1.0.0", where: "#/", msg: "Earlier problem", stack: "" }])); });
  await page.reload(); await page.waitForTimeout(300);
  await page.goto(base + "#/settings"); await page.waitForTimeout(300);
  assert.match(await page.innerText("#s-diag"), /1 problem/);
  await page.click("#s-diag"); await page.waitForTimeout(300);
  const text = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(text, /Tabs \d+\.\d+\.\d+/);
  assert.match(text, /2 songs/);
  assert.match(text, /Earlier problem/);
  assert.match(text, /AI key: set/);
  assert.doesNotMatch(text, /sk-ant-secret|River Road|Walking down/);
});

test("an unreadable save comes back from the safety copy", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.waitForTimeout(400);
  // The safety copy follows saves.
  const copied = await page.evaluate(() => new Promise(ok => {
    const r = indexedDB.open("tabs-library", 1);
    r.onsuccess = () => { const g = r.result.transaction("copy").objectStore("copy").get("lib"); g.onsuccess = () => ok(JSON.parse(g.result.json).songs.length); };
  }));
  assert.equal(copied, 2);
  await page.evaluate(() => localStorage.setItem("tabs-v1", "{broken"));
  await page.reload(); await page.waitForTimeout(600);
  assert.equal(await page.locator("#list .row").count(), 2);
  assert.match(await page.innerText("#toast"), /restored from its safety copy/);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.length, 2);
});

test("a page-turner pedal: left plays and pauses, right goes to the next section, held goes back", { skip: skip() }, async t => {
  const long = { ...LIB, songs: [{ ...LIB.songs[0], body: Array.from({ length: 6 }, (_, i) => `[Part ${i + 1}]\n` + "A  D\nWalking down the road\n".repeat(6)).join("\n") }, LIB.songs[1]] };
  const page = await phone(t, long);
  await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  const secTop = n => page.evaluate(n => Math.round(document.querySelectorAll("#sheet > .sec")[n].getBoundingClientRect().top - innerHeight * 0.4), n);
  await page.keyboard.press("PageDown"); await page.waitForTimeout(900);
  assert.ok(Math.abs(await secTop(1)) < 4, "Part 2 at the reading line");
  await page.keyboard.press("ArrowRight"); await page.waitForTimeout(900);
  assert.ok(Math.abs(await secTop(2)) < 4, "Part 3 at the reading line");
  await page.keyboard.down("PageDown"); await page.waitForTimeout(800); await page.keyboard.up("PageDown"); await page.waitForTimeout(900);
  assert.ok(Math.abs(await secTop(1)) < 4, "held: back to Part 2");
  await page.keyboard.press("PageUp"); await page.waitForTimeout(500);
  assert.equal(await page.getAttribute("#play", "aria-label"), "Pause auto-scroll");
  await page.keyboard.press(" "); await page.waitForTimeout(300);
  assert.equal(await page.getAttribute("#play", "aria-label"), "Start auto-scroll");
});

test("menus and panels work from a keyboard: focus moves in, Escape closes", { skip: skip() }, async t => {
  const page = await phone(t);
  const inside = sel => page.evaluate(sel => !!document.activeElement.closest(sel), sel);
  await page.goto(base + "#/song/a"); await page.waitForTimeout(400);
  await page.focus("#more"); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
  assert.equal(await inside(".menu"), true, "focus is in the menu");
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.m), "loop");
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  assert.equal(await page.locator(".menu").count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.id), "more");
  await page.keyboard.press("Enter"); await page.waitForTimeout(200);
  await page.keyboard.press("Enter"); await page.waitForTimeout(400); /* Add to set */
  assert.equal(await page.getAttribute("#layer [role=dialog]", "aria-modal"), "true");
  assert.equal(await inside("#layer"), true, "focus is in the panel");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.getElementById("layer").children.length), 0);
});
