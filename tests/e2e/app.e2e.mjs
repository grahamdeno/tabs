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
  settings: { v: 5, tipsSeen: { library: true, song: true }, sampleAdded: true, lastBackup: "2099-01-01T00:00:00Z", countIn: false }
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

test("settings render and the theme switches", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.goto(base + "#/settings"); await page.waitForTimeout(300);
  assert.match(await page.innerText(".app"), /Playing/i);
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.click("#s-theme");
  await page.waitForTimeout(200);
  assert.notEqual(await page.evaluate(() => document.documentElement.dataset.theme), before);
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
    trash: [], settings: { v: 5, tipsSeen: { library: true, song: true }, sampleAdded: true, lastBackup: "2099-01-01T00:00:00Z" },
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
  page.once("dialog", d => d.accept());
  await page.click("#ce-cancel");
  await page.waitForTimeout(500);
  assert.deepEqual(await titles(), ["New One", "River Road", "Harbor Lights"]);
});
