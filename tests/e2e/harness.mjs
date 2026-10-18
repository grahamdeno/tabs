// Shared setup for the browser tests: a tiny static server for the repo, one
// Chromium per test file, and phone() for a fresh phone with a test library.
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);
export let chromium;
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

export const SONG = `[Verse]
A                  D
Walking down the river road tonight
A              D
Lantern in my hand and nothing in mind

[Chorus]
A        F#m          E
Carry me home, carry me home
D                     A
Lay me down where the willows grow`;
export const LIB = {
  songs: [
    { id: "a", title: "River Road", artist: "The Wanderers", key: "A", format: "chords", body: SONG, duration: 30 },
    { id: "b", title: "Harbor Lights", artist: "Me", key: "G", format: "chords", body: "[Verse]\nG   C\nLights on the water" }
  ],
  sets: [], trash: [],
  settings: { v: 5, controls: "bar", nudge: false, streakMoment: false, tipsSeen: { library: true, song: true, edit: true, add: true, map: true, pause: true, chord: true, play: true, line: true, tap: true, paste: true, menu: true, strobe: true, searchInvite: true, search: true, nn: true, swipe: true }, sampleAdded: true, lastBackup: "2099-01-01T00:00:00Z", countIn: false }
};

export let server, browser, base;
// Each test file calls useBrowser() once: a static server for the repo and one Chromium.
export function useBrowser() {
test.before(async () => {
  if (!chromium) return;
  server = await serve();
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});
test.after(async () => { await browser?.close(); server?.close(); });
}

// A fresh phone with the test library; fails the test on any page error.
// opts are Playwright context options, plus fixedTime: a date the page's clock stays at.
export async function phone(t, lib = LIB, { fixedTime, ...opts } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: "block", hasTouch: true, ...opts });
  if (fixedTime) await ctx.clock.setFixedTime(new Date(fixedTime));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (/Content Security Policy/i.test(m.text())) errors.push(m.text()); });
  await page.goto(base);
  await page.waitForTimeout(300);
  await page.evaluate(d => localStorage.setItem("tabs-v1", JSON.stringify(d)), lib);
  await page.reload();
  await page.waitForFunction(() => document.getElementById("app")?.childElementCount > 0); /* drawn, rather than a fixed wait */
  t.after(async () => { assert.deepEqual(errors, [], "page errors"); await ctx.close(); });
  return page;
}
export const skip = () => !chromium && "Playwright not installed";

// A pretend microphone: a steady tone whose pitch the test sets with window.__hz.
export const FAKE_MIC = `
window.__hz = 0;
navigator.mediaDevices.getUserMedia = async () => {
  const ctx = new AudioContext(), o = ctx.createOscillator(), g = ctx.createGain(), dest = ctx.createMediaStreamDestination();
  o.type = "sawtooth"; g.gain.value = 0; o.connect(g).connect(dest); o.start();
  setInterval(() => { if (window.__hz) { o.frequency.value = window.__hz; g.gain.value = window.__gain ?? 0.4; } else g.gain.value = 0; }, 20);
  return dest.stream;
};`;
