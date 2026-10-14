// Browser tests: the real app in Chromium, phone-sized.
// Run: node --test tests/e2e/   (needs Playwright: npm i --no-save playwright && npx playwright install chromium)
// They catch what unit tests can't: the app failing to load, screens not
// rendering, taps doing the wrong thing.

import test from "node:test";
import assert from "node:assert/strict";
import { chromium, base, browser, phone, skip, LIB, SONG, useBrowser } from "./harness.mjs";

useBrowser();

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
  assert.match(await page.innerText(".findcard.more"), /Find “willows” elsewhere/, "matches still leave a way to look further");
  assert.ok(await page.locator(".findcard.more [data-find='ug']").count());
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
  await page.evaluate(() => document.activeElement.blur()); /* close the keyboard first, as on a phone */
  await page.waitForTimeout(50);
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
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("tabs-v1")); delete d._savedAt; d.trash = [{ type: "song", item: { id: "z", title: "Old Song", body: "G" }, deletedAt: new Date().toISOString() }]; localStorage.setItem("tabs-v1", JSON.stringify(d)); });
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
  setInterval(() => { if (window.__hz) { o.frequency.value = window.__hz; g.gain.value = window.__gain ?? 0.4; } else g.gain.value = 0; }, 20);
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
  const glows = () => page.evaluate(() => document.querySelector(".tn-note").classList.contains("glow"));
  await at(82.41, -1); await page.waitForTimeout(500);
  assert.equal(await glows(), true, "in tune: the letter glows");
  await at(82.41, -25); await page.waitForTimeout(600);
  assert.equal(await glows(), false, "out of tune: no glow");
  const order = [];
  for (const hz of [82.41, 110, 146.83, 196, 246.94, 329.63]) {
    order.push(await page.evaluate(() => document.querySelector(".tn-key") && [...document.querySelectorAll("#tn-stage text")].find(x => x.getAttribute("font-weight") === "700")?.textContent));
    await at(hz, 0); await page.waitForTimeout(1700);
  }
  assert.deepEqual(order.map(x => (x || "").replace(/[^A-Ga-g]/g, "")), ["E", "A", "D", "G", "B", "e"], "guided: E, A, D, G, B, e in order");
  assert.equal((await read()).note, "All in tune");
  assert.match(await page.innerText("#toast"), /All six strings in tune/, "success is announced");
  assert.equal(await page.evaluate(() => document.querySelector(".tn-note").classList.contains("glow")), true, "and glows");
  assert.match(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--tune")), /#/, "the tuner's green");
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

test("the library lives in the phone's database; its copy brings it back if the database copy is lost", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.waitForTimeout(400);
  const inDB = () => page.evaluate(() => new Promise(ok => {
    const r = indexedDB.open("tabs-library", 1);
    r.onsuccess = () => { const g = r.result.transaction("copy").objectStore("copy").get("lib"); g.onsuccess = () => ok(g.result ? JSON.parse(g.result.json).songs.length : -1); };
  }));
  assert.equal(await inDB(), 2, "the test library moved into the database");
  // A change saves to both.
  await page.goto(base + "#/song/b"); await page.waitForTimeout(300);
  await page.click(".fav:visible"); await page.waitForTimeout(400);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "b").favorite, true);
  // The database copy is unreadable: the localStorage copy brings the library back.
  await page.evaluate(() => new Promise(ok => {
    const r = indexedDB.open("tabs-library", 1);
    r.onsuccess = () => { const tx = r.result.transaction("copy", "readwrite"); tx.objectStore("copy").put({ json: "{broken", at: new Date(Date.now() + 1e6).toISOString() }, "lib"); tx.oncomplete = ok; };
  }));
  await page.goto(base + "#/"); await page.reload(); await page.waitForTimeout(900);
  assert.equal(await page.locator("#list .row").count(), 2);
  assert.match(await page.innerText("#toast"), /restored from its safety copy/);
  assert.equal(await inDB(), 2, "and the database is whole again");
  // With the copy gone, the database alone has everything.
  await page.evaluate(() => localStorage.removeItem("tabs-v1"));
  await page.reload(); await page.waitForTimeout(600);
  assert.equal(await page.locator("#list .row").count(), 2);
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
  assert.equal(await page.evaluate(() => document.activeElement.dataset.m), "listen", "on a phone held upright the menu is a bottom sheet; mid-song items sit lowest");
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

test("iPad: chords in a rail, songs in a list beside the song; rotating puts them back", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { viewport: { width: 1180, height: 820 } });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.getElementById("strip").parentElement.id), "rail");
  assert.equal(await page.locator(".side-r").count(), 2);
  assert.equal(await page.getAttribute(".side-r.on", "data-id"), "a");
  await page.click(".side-r:not(.on)"); await page.waitForTimeout(500);
  assert.match(await page.innerText("h1.song-title"), /Harbor Lights/);
  await page.setViewportSize({ width: 820, height: 1180 }); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => document.getElementById("strip").parentElement.id), "app");
  assert.equal(await page.locator(".side").isVisible(), false);
});

test("song, artist and set names are shown as text, never run as markup", { skip: skip() }, async t => {
  const bad = n => `<img src=x onerror="window.__x=(window.__x||0)+${n}">`;
  const lib = { ...LIB,
    songs: [{ id: "a", title: bad(1), artist: bad(2), key: "A", format: "chords", body: `[${bad(3)}]\nA   D\n${bad(4)} words` }, LIB.songs[1]],
    sets: [{ id: "s", name: bad(5), songIds: ["a", "b"], created: "2026-10-01T00:00:00Z" }],
    trash: [{ type: "song", item: { id: "z", title: bad(6), artist: bad(7), body: "G" }, deletedAt: new Date().toISOString() }] };
  const page = await phone(t, lib, { viewport: { width: 1180, height: 820 } });
  for (const h of ["#/", "#/song/a", "#/set/s", "#/trash", "#/settings"]) { await page.goto(base + h); await page.waitForTimeout(400); }
  await page.goto(base + "#/"); await page.waitForTimeout(300);
  await page.click("#q"); await page.keyboard.type("img"); await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__x), undefined);
  assert.equal(await page.locator("img[src=x]").count(), 0);
});

test("All songs sorts by artist", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, { id: "c", title: "Anchor", artist: "Zed", body: "G\nla" }] });
  assert.deepEqual(await page.$$eval("#sort option", o => o.map(x => x.textContent)), ["A–Z", "Artist", "Recently played", "Most played"]);
  await page.selectOption("#sort", "artist"); await page.waitForTimeout(300);
  assert.deepEqual(await page.$$eval("#list .row .t", r => r.map(x => x.textContent)), ["Harbor Lights", "River Road", "Anchor"]);
});

test("sketch: sing two lines, add their words, get chords in the melody's key", { skip: skip() }, async t => {
  const browser2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => browser2.close());
  const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(FAKE_MIC);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (/Content Security Policy/i.test(m.text())) errors.push(m.text()); });
  await page.goto(base); await page.waitForTimeout(400);
  await page.evaluate(d => localStorage.setItem("tabs-v1", JSON.stringify(d)), LIB);
  await page.reload(); await page.waitForTimeout(300);
  // From Add: an empty new song offers Sing it.
  await page.click("#add"); await page.waitForTimeout(600);
  await page.click("#ed-sing"); await page.waitForTimeout(500);
  assert.match(await page.innerText("h1"), /New sketch/);
  const hz = m => 440 * 2 ** ((m - 69) / 12);
  const pad = await page.locator("#sk-pad").boundingBox(), px = pad.x + pad.width / 2, py = pad.y + pad.height - 60;
  // Hold the pad to sing a line; let go to keep it.
  const singLine = async melody => {
    await page.mouse.move(px, py); await page.mouse.down(); await page.waitForTimeout(400);
    for (const m of melody) { await page.evaluate(f => { window.__hz = f; }, hz(m)); await page.waitForTimeout(420); }
    await page.evaluate(() => { window.__hz = 0; }); await page.waitForTimeout(150);
    await page.mouse.up(); await page.waitForTimeout(500);
  };
  await singLine([55, 59, 62, 59, 60, 64, 67, 64]);          // G B D B | C E G E
  assert.equal(await page.evaluate(() => document.activeElement.id), "sk-words", "the words field is ready for dictation");
  await page.keyboard.type("Porch light burning past the second shift");
  await page.evaluate(() => document.activeElement.blur()); await page.waitForTimeout(200);
  // Slide left while singing: that take goes, nothing is added.
  await page.mouse.move(px, py); await page.mouse.down(); await page.waitForTimeout(400);
  await page.evaluate(f => { window.__hz = f; }, hz(50)); await page.waitForTimeout(500);
  await page.mouse.move(px - 120, py, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(400);
  await page.evaluate(() => { window.__hz = 0; });
  assert.equal(await page.locator(".sknb-row").count(), 1, "the slid-away take wasn't kept");
  await singLine([62, 66, 57, 62, 59, 55, 55, 55]);          // D F# A D | B G G G
  await page.keyboard.type("Home to you a little more");
  await page.evaluate(() => document.activeElement.blur()); await page.waitForTimeout(200);
  assert.match(await page.innerText("#sk-meter"), /G major/);
  assert.equal(await page.locator(".sknb-row").count(), 2);
  assert.deepEqual(await page.$$eval(".skfam-c", b => b.map(x => x.textContent)), ["G", "C", "D", "Em", "Am", "Bm"], "the key's chords, ready to hear");
  await page.click("#sk-done"); await page.waitForTimeout(1200);
  const song = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.sketch);
  assert.ok(song, "a new song was made");
  assert.equal(song.key, "G");
  assert.match(song.body, /^G\s+C\nPorch light burning past the second shift\nD\s+G\nHome to you a little more$/);
  assert.ok(await page.locator("#ce-done").isVisible(), "it opens in the editor to name it");
  assert.deepEqual(song.sketch.lines.map(l => l.n.length), [8, 6], "the melody stays with the song (the three Gs at the end are one held note)");

  // Name it and save; the song page offers the recording and Simple or Rich.
  await page.fill("#ed-title", "Porch Light"); await page.dispatchEvent("#ed-title", "change");
  await page.click("#ce-done"); await page.waitForTimeout(900);
  await page.waitForSelector("#sk-hear:not([hidden])", { timeout: 4000 });
  await page.click("[data-st='rich']"); await page.waitForTimeout(400);
  const body = async () => JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.sketch).body;
  assert.match(await body(), /\nD7\s+G\nHome to you/, "Rich: the V chord becomes D7");
  await page.click("#toast .tact"); await page.waitForTimeout(400);
  assert.match(await body(), /\nD\s+G\nHome to you/, "Undo");
  // Hear it back: the first line is lit while it plays, then Stop.
  await page.click("#sk-hear"); await page.waitForTimeout(700);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll("#sheet > .pr")].findIndex(e => e.classList.contains("skcur"))), 0);
  assert.match(await page.innerText("#sk-hear"), /Stop/);
  await page.click("#sk-hear"); await page.waitForTimeout(300);
  assert.equal(await page.locator("#sheet.skplay").count(), 0);

  // In Edit, a word's chord picker shows chords that fit the melody and other ways for the line.
  await page.click("#more"); await page.click(".menu [data-m='edit']"); await page.waitForTimeout(600);
  await page.click(".ce-line[data-line='3'] .ce-w >> nth=0"); await page.waitForTimeout(300);
  assert.equal(await page.locator(".ce-fitb").count(), 4);
  assert.match(await page.innerText(".ce-alt.on"), /D · G\s*now/);
  const other = page.locator(".ce-alt:not(.on)").first(), label = (await other.innerText()).trim();
  await other.click(); await page.waitForTimeout(400);
  const chords = label.split(" · ");
  assert.match(await body(), new RegExp(`\\n${chords[0]}\\s+${chords[1] ? chords[1] + "\\n" : "\\n"}Home to you a little more$`));
  assert.deepEqual(errors, []);
});

test("a set's Album art cover finds art for its songs on Apple Music", { skip: skip() }, async t => {
  const lib = { ...LIB,
    songs: [{ ...LIB.songs[0], listen: { url: "https://music.apple.com/us/album/x/1?i=111", service: "Apple Music" } }, { ...LIB.songs[1], artist: "The Night Ferries" }],
    sets: [{ id: "s", name: "Friday", songIds: ["a", "b"] }] };
  const page = await phone(t, lib);
  const art = n => `https://is1-ssl.mzstatic.com/image/thumb/${n}/100x100bb.jpg`;
  await page.route("https://itunes.apple.com/lookup**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ results: [{ trackId: 111, artworkUrl100: art("river"), trackTimeMillis: 200000 }] }) }));
  await page.route("https://itunes.apple.com/search**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ results: [{ trackName: "Harbor Lights", artistName: "The Night Ferries", trackViewUrl: "https://music.apple.com/x", artworkUrl100: art("harbor") }] }) }));
  await page.route("https://is1-ssl.mzstatic.com/**", r => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex") }));
  await page.goto(base + "#/set/s"); await page.waitForTimeout(400);
  await page.click("#s-cover"); await page.waitForTimeout(200);
  await page.click('[data-cv="art"]'); await page.waitForTimeout(800);
  const songs = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs;
  assert.match(songs.find(s => s.id === "a").listen.art, /river\/600x600bb/);
  assert.match(songs.find(s => s.id === "b").art, /harbor\/600x600bb/);
  assert.match(await page.innerText("#toast"), /Album art for every song/);
  assert.ok(await page.locator('.cover img[src*="river"]').count() >= 1, "the cover shows the art");
});

test("Back from a song opened in a set returns to that set; from the library, to the library", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, sets: [{ id: "s", name: "Friday", songIds: ["a", "b"] }] });
  const hash = () => page.evaluate(() => location.hash);
  await page.goto(base + "#/set/s"); await page.waitForTimeout(300);
  await page.click("[data-open='0']"); await page.waitForTimeout(400);
  assert.equal(await page.getAttribute(".oh-back", "aria-label"), "Back to Friday");
  await page.click("#snext"); await page.waitForTimeout(400);               // on to the next song in the set
  await page.click(".oh-back"); await page.waitForTimeout(400);
  assert.equal(await hash(), "#/set/s");
  await page.goto(base + "#/"); await page.waitForTimeout(300);
  await page.click('#list .row[data-id="a"]'); await page.waitForTimeout(400);
  assert.equal(await page.getAttribute(".oh-back", "aria-label"), "Back to library");
  await page.click(".oh-back"); await page.waitForTimeout(400);
  assert.equal(await hash(), "#/");
});

test("sketch: a quiet voice is still heard; silence says so and is logged; the pad stays under the finger", { skip: skip() }, async t => {
  const browser2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => browser2.close());
  const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(FAKE_MIC);
  const page = await ctx.newPage();
  await page.goto(base); await page.waitForTimeout(400);
  await page.evaluate(d => localStorage.setItem("tabs-v1", JSON.stringify(d)), LIB);
  await page.goto(base + "#/sketch"); await page.waitForTimeout(500);
  const pad = await page.locator("#sk-pad").boundingBox(), px = pad.x + pad.width / 2, py = pad.y + pad.height - 60;
  const hold = async (hzs, gain) => {
    await page.evaluate(g => { window.__gain = g; window.__padAtStart = document.getElementById("sk-pad"); }, gain);
    await page.mouse.move(px, py); await page.mouse.down(); await page.waitForTimeout(400);
    const same = await page.evaluate(() => document.getElementById("sk-pad") === window.__padAtStart && document.getElementById("sk-pad").classList.contains("on"));
    for (const hz of hzs) { await page.evaluate(f => { window.__hz = f; }, hz); await page.waitForTimeout(400); }
    await page.evaluate(() => { window.__hz = 0; }); await page.waitForTimeout(150);
    await page.mouse.up(); await page.waitForTimeout(500);
    return same;
  };
  // About a quarter of the old threshold: a voice at arm's length.
  assert.equal(await hold([196, 247, 294, 247, 262], 0.012), true, "the same pad, now recording, is under the finger");
  assert.equal(await page.locator(".sknb-row").count(), 1, "a quiet line is kept");
  await page.evaluate(() => document.activeElement?.blur());
  // Silence: a clear message, and the details go to the problems log.
  await hold([196, 247, 294], 0);
  assert.match(await page.innerText("#toast"), /only silence/);
  assert.match(await page.evaluate(() => localStorage.getItem("tabs.errors.v1")), /Sketch heard no notes: .* peak level 0\.0000/);
});

test("while playing, the focus line skips section names to the section's first line", { skip: skip() }, async t => {
  const long = { ...LIB.songs[0], body: LIB.songs[0].body + "\n\n" + LIB.songs[0].body.replace("[Chorus]", "[Chorus 2]").replace("[Verse]", "[Verse 2]") };
  const page = await phone(t, { ...LIB, songs: [long, LIB.songs[1]], settings: { ...LIB.settings, focus: "always" } });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(400);
  await page.click("#play"); await page.waitForTimeout(300);
  // Put the Chorus name exactly at the reading line.
  await page.evaluate(() => {
    const sec = [...document.querySelectorAll("#sheet > .sec")].find(e => /chorus/i.test(e.textContent));
    window.scrollTo(0, sec.getBoundingClientRect().top + scrollY - innerHeight * 0.4 + 2);
  });
  await page.waitForTimeout(250);
  const cur = await page.evaluate(() => { const c = document.querySelector("#sheet > .cur"); const sec = [...document.querySelectorAll("#sheet > .sec")].find(e => /chorus/i.test(e.textContent)); return { cls: c?.className, text: c?.textContent.slice(0, 30), prev: c?.previousElementSibling?.className, secTop: sec.getBoundingClientRect().top - innerHeight * 0.4, afterChorus: /chorus/i.test(c?.previousElementSibling?.textContent || "") }; });
  assert.ok(!/\bsec\b/.test(cur.cls || ""), `the focus is not on the section name (${cur.cls})`);
  assert.equal(cur.afterChorus, true, "it's the Chorus's first line");
  const two = await page.evaluate(() => { const c = [...document.querySelectorAll("#sheet > .cur")]; return { n: c.length, second: c[1]?.classList.contains("cur2"), next: c[0]?.nextElementSibling === c[1] || c[0]?.nextElementSibling?.matches(".sec, .gap") }; });
  assert.deepEqual(two, { n: 2, second: true, next: true }, "focus covers the current line and the next one");
});

test("Listen searches Apple Music in the app: change the words, hear a preview, tap to save", { skip: skip() }, async t => {
  const page = await phone(t);
  const terms = [];
  const track = (name, artist, id) => ({ trackName: name, artistName: artist, collectionName: "Album", trackViewUrl: `https://music.apple.com/us/album/a/1?i=${id}`, artworkUrl100: `https://is1-ssl.mzstatic.com/${id}/100x100bb.jpg`, previewUrl: `https://audio-ssl.itunes.apple.com/${id}.m4a` });
  await page.route("https://itunes.apple.com/search**", r => {
    const q = new URL(r.request().url()).searchParams.get("term"); terms.push(q);
    const results = /live/i.test(q) ? [track("Harbor Lights (Live)", "Me", 222)] : [track("Harbor Lights", "Someone Else", 111), track("Harbor", "Me", 112)];
    r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ results }) });
  });
  await page.route("https://audio-ssl.itunes.apple.com/**", r => r.fulfill({ status: 200, contentType: "audio/mp4", body: "" }));
  await page.route("https://is1-ssl.mzstatic.com/**", r => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("89504e470d0a1a0a", "hex") }));
  let left = false; page.on("popup", () => { left = true; });
  await page.goto(base + "#/song/b"); await page.waitForTimeout(400);
  await page.click("#listen"); await page.waitForTimeout(500);
  assert.equal(await page.inputValue("#ls-q"), "Harbor Lights Me");
  assert.equal(await page.locator(".ls-row").count(), 2);
  assert.equal(await page.locator(".ls-pv").count(), 2, "each result can be previewed");
  await page.fill("#ls-q", "Harbor Lights live"); await page.press("#ls-q", "Enter"); await page.waitForTimeout(500);
  assert.equal(terms.at(-1), "Harbor Lights live");
  assert.match(await page.innerText(".ls-row"), /Harbor Lights \(Live\)/);
  await page.click(".ls-row"); await page.waitForTimeout(400);
  const song = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "b");
  assert.match(song.listen.url, /i=222/);
  assert.match(song.listen.art, /222\/600x600bb/);
  assert.equal(await page.locator("#ls-panel").count(), 0, "the sheet closes");
  assert.match(await page.innerText("#toast"), /Saved: Harbor Lights \(Live\)/);
  assert.equal(left, false, "Tabs didn't send you to Apple Music");
});

test("Listen still finds songs when Safari blocks Apple's reply, and offers a way on when Apple can't be reached", { skip: skip() }, async t => {
  const page = await phone(t);
  let down = false;
  const hit = { trackName: "Harbor Lights", artistName: "Me", trackViewUrl: "https://music.apple.com/us/album/a/1?i=5", artworkUrl100: "" };
  await page.route("https://itunes.apple.com/search**", r => {
    const cb = new URL(r.request().url()).searchParams.get("callback");
    if (down) return r.abort();
    /* The plain request is blocked (as Safari does when Apple's reply lacks the CORS header); the script way works. */
    if (!cb) return r.abort("accessdenied");
    r.fulfill({ status: 200, contentType: "text/javascript", body: `${cb}(${JSON.stringify({ results: [hit] })});` });
  });
  await page.goto(base + "#/song/b"); await page.waitForTimeout(400);
  await page.click("#listen"); await page.waitForTimeout(1200);
  assert.equal(await page.locator(".ls-row").count(), 1, "found by the fallback");
  down = true;
  await page.fill("#ls-q", "Harbor"); await page.press("#ls-q", "Enter"); await page.waitForTimeout(1500);
  assert.match(await page.innerText("#ls-res"), /Couldn't reach/);
  const log = await page.evaluate(() => localStorage.getItem("tabs.errors.v1"));
  assert.match(log, /Apple catalog search/, "the reason is kept for diagnostics");
  let opened = "";
  await page.context().route("https://music.apple.com/**", r => { opened = r.request().url(); r.fulfill({ status: 200, body: "" }); });
  await page.click("#ls-apple"); await page.waitForTimeout(800);
  assert.match(opened, /music\.apple\.com\/search\?term=Harbor/, "opens Apple Music's own search");
  down = false;
  await page.click("#ls-retry"); await page.waitForTimeout(1200);
  assert.equal(await page.locator(".ls-row").count(), 1, "Try again works");
  /* A page opened before the update has older rules: offer a restart instead. */
  page.removeAllListeners("console");
  await page.evaluate(() => { const m = document.querySelector("meta[http-equiv='Content-Security-Policy']"); m.content = m.content.replace(/script-src[^;]*/, "script-src 'self'"); });
  down = true;
  await page.fill("#ls-q", "Harbor two"); await page.press("#ls-q", "Enter"); await page.waitForTimeout(1500);
  assert.equal(await page.locator("#ls-restart").count(), 1, "offers a restart");
});

test("iPhone: Listen opens Apple Music's search, and Paste on return saves the link", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1", permissions: ["clipboard-read", "clipboard-write"] });
  let searched = false, opened = "";
  await page.route("https://itunes.apple.com/search**", r => { searched = true; r.abort(); });
  await page.context().route("https://music.apple.com/**", r => { opened = r.request().url(); r.fulfill({ status: 200, body: "" }); });
  await page.goto(base + "#/song/b"); await page.waitForTimeout(400);
  await page.click("#listen"); await page.waitForTimeout(300);
  assert.equal(await page.locator("#ls-q").count(), 0, "no in-app search on an iPhone");
  await page.click("#ls-open"); await page.waitForTimeout(800);
  assert.match(opened, /music\.apple\.com\/search\?term=Harbor%20Lights%20Me/);
  assert.equal(searched, false, "Apple's catalog search isn't tried");
  await page.evaluate(() => navigator.clipboard.writeText("https://music.apple.com/us/album/harbor/1?i=777"));
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(200);
  await page.click("#bp-go"); await page.waitForTimeout(400);
  const song = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "b");
  assert.match(song.listen.url, /i=777/);
  assert.equal(await page.locator(".bp-listen").count(), 0, "the offer goes away");
});

test("2.0 one hand: on a phone held upright the controls sit at the bottom; iPad keeps its layout", { skip: skip() }, async t => {
  const page = await phone(t);
  const box = async sel => page.evaluate(sel => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r && r.width ? { top: r.top, bottom: r.bottom, right: r.right } : null; }, sel);
  const H = 844;
  assert.ok((await box("#chips")).top < H * 0.3, "filters at the top (2.6: moved back)");
  assert.ok((await box("#tunerbtn")).top < 100, "tuner in the header (2.6: moved back)");
  assert.ok(await page.evaluate(() => { const b = document.querySelector("#tunerbtn"), r = b.getBoundingClientRect(), i = b.querySelector("svg").getBoundingClientRect(); return Math.abs((i.top + i.bottom) / 2 - (r.top + r.bottom) / 2) < 2 && Math.abs((i.left + i.right) / 2 - (r.left + r.right) / 2) < 2; }), "the tuner icon is centered");
  const dot = await page.evaluate(() => { const d = document.querySelector("#tunerbtn .dotmark"); return d && getComputedStyle(d).position; });
  if (dot) assert.equal(dot, "absolute", "the not-tuned dot sits in the corner");
  await page.goto(base + "#/song/a"); await page.waitForTimeout(400);
  assert.equal(await box(".head"), null, "song page top has no buttons");
  for (const sel of [".oh-back", ".player .fav", "#more", "#play"]) assert.ok((await box(sel)).top > H * 0.85, `${sel} in the bar`);
  assert.ok((await box("#play")).right > 330, "Play at the bottom right");
  await page.click("#more"); await page.waitForTimeout(300);
  const m = await box(".menu");
  assert.ok(m.bottom > H - 40 && m.top > H * 0.35, "the menu rises from the bottom");
  assert.match(await page.evaluate(() => [...document.querySelectorAll(".menu .mrow")].at(-1).textContent), /Text size/, "Text size lowest");

  const pad = await phone(t, LIB, { viewport: { width: 1180, height: 820 } });
  await pad.goto(base + "#/song/a"); await pad.waitForTimeout(400);
  assert.ok(await pad.evaluate(() => document.querySelector(".head [data-go]").getBoundingClientRect().top < 100), "iPad: buttons stay at the top");
  assert.equal(await pad.evaluate(() => document.querySelector(".oh-back").offsetParent), null, "iPad: no bar copies");
  await pad.goto(base + "#/"); await pad.waitForTimeout(400);
  assert.ok(await pad.evaluate(() => document.querySelector("#tunerbtn").getBoundingClientRect().top < 100), "iPad: tuner at the top");
});

test("2.1 speed dial: hold the time and sweep the corner; the length follows and saves", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: LIB.songs.map(s => s.id === "a" ? { ...s, duration: 200 } : s) });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(400);
  const before = await page.innerText("#dialbtn");
  const b = await page.locator("#dialbtn").boundingBox();
  const x = b.x + 20, y = b.y + 16;
  await page.mouse.move(x, y); await page.mouse.down();
  assert.equal(await page.locator(".dial").count(), 1, "the dial opens on press");
  await page.mouse.move(x + 60, y - 140, { steps: 8 });
  const shown = await page.textContent(".dial-big");
  await page.mouse.up(); await page.waitForTimeout(300);
  assert.equal(await page.locator(".dial").count(), 0, "it closes on release");
  const after = await page.innerText("#dialbtn");
  assert.notEqual(after.trim(), before.trim(), "the length changed");
  assert.equal(after.trim(), shown.trim(), "the bar shows what the dial showed");
  assert.ok(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "a").durationSet, "saved");
  /* A tap opens it to sweep anywhere; a tap off it closes it. */
  await page.click("#dialbtn"); await page.waitForTimeout(200);
  assert.equal(await page.locator(".dial").count(), 1);
  await page.mouse.click(60, 120); await page.waitForTimeout(300);
  assert.equal(await page.locator(".dial").count(), 0);
});

test("2.1 set dial: in a set, sweep to a song and let go to open it", { skip: skip() }, async t => {
  const songs = [...LIB.songs, ...["One", "Two", "Three"].map((title, i) => ({ id: "x" + i, title, artist: "Y", format: "chords", body: "[Verse]\nG C\nla" }))];
  const page = await phone(t, { ...LIB, songs, sets: [{ id: "s", name: "Gig", songIds: ["a", "x0", "x1", "x2"] }] });
  await page.goto(base + "#/set/s"); await page.waitForTimeout(400);
  await page.click("[data-open='0']"); await page.waitForTimeout(500);
  await page.click("#play"); await page.waitForTimeout(600); /* works while playing too */
  assert.match(await page.innerText("#setdial"), /1 of 4/);
  const b = await page.locator("#setdial").boundingBox();
  const x = b.x + 20, y = b.y + 16;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 60, y - 160, { steps: 8 });
  const pick = await page.textContent(".dial-big");
  assert.notEqual(pick, "River Road", "sweeping moves through the set");
  await page.mouse.up(); await page.waitForTimeout(600);
  assert.match(await page.innerText("h1.song-title"), new RegExp(pick));
  assert.match(await page.innerText("#setdial"), /of 4/);
});

test("2.1 glow: count-in and the chord you're on glow; gig day counts down on Up Next", { skip: skip() }, async t => {
  const soon = new Date(Date.now() + 50 * 60e3), when = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(soon.getDate()).padStart(2, "0")}T${String(soon.getHours()).padStart(2, "0")}:${String(soon.getMinutes()).padStart(2, "0")}`;
  const sameDay = soon.toDateString() === new Date().toDateString();
  const page = await phone(t, { ...LIB, sets: [{ id: "s", name: "Gig", songIds: ["a"], when }], settings: { ...LIB.settings, diagrams: true, countIn: true } });
  if (sameDay) {
    const a = await page.textContent("#un-cd");
    assert.match(a, /^0:[45]\d:\d\d$/, "a countdown on gig day");
    await page.waitForTimeout(1300);
    assert.notEqual(await page.textContent("#un-cd"), a, "it ticks");
    assert.match(await page.evaluate(() => getComputedStyle(document.querySelector("#un-cd")).textShadow), /px/, "it glows");
  }
  await page.goto(base + "#/song/a"); await page.waitForTimeout(400);
  await page.click("#play"); await page.waitForSelector(".countin", { timeout: 3000 });
  assert.match(await page.evaluate(() => getComputedStyle(document.querySelector(".countin")).textShadow), /px/, "the count-in glows");
  await page.waitForSelector("#nn .nowcol .dn", { timeout: 8000 });
  assert.match(await page.evaluate(() => getComputedStyle(document.querySelector("#nn .nowcol .dn")).filter), /glow-f/, "Now glows");
  assert.doesNotMatch(await page.evaluate(() => getComputedStyle(document.querySelector("#nn .cards .dn")).filter), /glow-f/, "Next stays plain");
});

test("2.2 ring: Play rests in the corner, rises with a touch, settles when still; hold it for the ring", { skip: skip() }, async t => {
  const ring = { ...LIB, settings: { ...LIB.settings, controls: "ring", follow: "touch" } };
  const page = await phone(t, ring);
  const center = () => page.evaluate(() => { const r = document.getElementById("play").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.getElementById("play").parentElement.id), "rc", "Play sits in the ring controls");
  let c = await center();
  assert.ok(c.x > 330 && c.y > 780, `Play rests in the corner (${c.x}, ${c.y})`);
  await page.mouse.click(120, 300); await page.waitForTimeout(900);
  c = await center();
  assert.ok(Math.abs(c.x - 390 * 0.66) < 6 && Math.abs(c.y - 844 * 0.79) < 6, `a touch lifts Play to the thumb (${c.x}, ${c.y})`);
  assert.equal(await page.evaluate(() => document.body.classList.contains("ring-up")), true);
  await page.waitForTimeout(5800);
  c = await center();
  assert.ok(c.x > 330 && c.y > 780, "still for 5 seconds: back in the corner");
  /* A tap on Play still plays and pauses. */
  await page.click("#play"); await page.waitForTimeout(300);
  assert.equal(await page.getAttribute("#play", "aria-label"), "Pause auto-scroll");
  await page.click("#play"); await page.waitForTimeout(300);
  assert.equal(await page.getAttribute("#play", "aria-label"), "Start auto-scroll");
  /* A firm tap (400 ms) is still a tap: no ring. */
  c = await center();
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.waitForTimeout(400); await page.mouse.up(); await page.waitForTimeout(250);
  assert.equal(await page.locator(".ringx").count(), 0, "a firm tap doesn't open the ring");
  assert.equal(await page.getAttribute("#play", "aria-label"), "Pause auto-scroll", "it played");
  await page.click("#play"); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("play")).webkitUserSelect || getComputedStyle(document.getElementById("play")).userSelect), "none");
  /* Hold: the ring. Slide toward More and let go: the menu. */
  c = await center();
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.waitForTimeout(600);
  assert.equal(await page.locator(".ringx .ri").count(), 5, "Favorite, Metronome, Key, Now and Next, More (no Back: it's in the island; no Set outside a set)");
  assert.equal(await page.locator(".ringx .ri[data-r='back']").count(), 0);
  const more = await page.evaluate(() => { const r = document.querySelector(".ri[data-r='more']").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(more.x, more.y, { steps: 6 });
  assert.match(await page.textContent(".ring-name"), /More/);
  await page.mouse.up(); await page.waitForTimeout(300);
  assert.equal(await page.locator(".menu.msheet").count(), 1, "the More menu opens");
  assert.equal(await page.getAttribute("#play", "aria-label"), "Start auto-scroll", "holding didn't start playback");
  await page.mouse.click(120, 200); await page.waitForTimeout(300);
  /* Let go without choosing: the ring stays to tap; Key opens the key dial. */
  c = await center();
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.waitForTimeout(600); await page.mouse.up(); await page.waitForTimeout(200);
  assert.equal(await page.locator(".ringx").count(), 1, "stays open");
  await page.click(".ri[data-r='key']"); await page.waitForTimeout(300);
  assert.equal(await page.locator(".dial.key").count(), 1, "the key dial");
  assert.match(await page.textContent(".dial-small"), /KEY A/);
  await page.mouse.click(60, 120); await page.waitForTimeout(300);
  assert.equal(await page.locator(".dial").count(), 0);
  /* Metronome from the ring: on, and the item shows it. */
  c = await center();
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.waitForTimeout(600); await page.mouse.up(); await page.waitForTimeout(200);
  await page.click(".ri[data-r='metro']"); await page.waitForTimeout(200);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).settings.metronome, true, "metronome on from the ring");
  c = await center();
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.waitForTimeout(600); await page.mouse.up(); await page.waitForTimeout(200);
  assert.equal(await page.getAttribute(".ri[data-r='metro']", "aria-pressed"), "true");
  await page.mouse.click(60, 120); await page.waitForTimeout(200);
  /* While playing: hold Play, slide to More, let go: the song pauses and the menu stays. */
  await page.click("#play"); await page.waitForTimeout(400);
  c = await center();
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.waitForTimeout(800);
  const m2 = await page.evaluate(() => { const r = document.querySelector(".ri[data-r='more']").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(m2.x, m2.y, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(1200);
  assert.equal(await page.locator(".menu").count(), 1, "the menu stays open");
  assert.equal(await page.getAttribute("#play", "aria-label"), "Start auto-scroll", "the song paused");
  await page.mouse.click(60, 120); await page.waitForTimeout(300);
  /* Screen readers get the same controls as buttons. */
  assert.equal(await page.locator(".rc .sr-only [data-ri]").count(), 5);
});

test("2.2 ring: motion lifts Play (hand), a set adds Set to the ring; iPad keeps the bar", { skip: skip() }, async t => {
  const songs = [...LIB.songs, { id: "x0", title: "One", artist: "Y", format: "chords", body: "[Verse]\nG C\nla" }];
  const page = await phone(t, { ...LIB, songs, sets: [{ id: "s", name: "Gig", songIds: ["a", "x0"] }], settings: { ...LIB.settings, controls: "ring", follow: "hand", motionAsked: true } });
  await page.goto(base + "#/set/s"); await page.waitForTimeout(400);
  await page.click("[data-open='0']"); await page.waitForTimeout(5800);
  assert.equal(await page.evaluate(() => document.body.classList.contains("ring-up")), false, "settled");
  await page.evaluate(() => { for (let i = 0; i < 6; i++) window.dispatchEvent(new DeviceMotionEvent("devicemotion", { accelerationIncludingGravity: { x: 0, y: -9.8, z: 0 }, rotationRate: { alpha: 20, beta: 10, gamma: 5 } })); });
  await page.waitForTimeout(700);
  assert.equal(await page.evaluate(() => document.body.classList.contains("ring-up")), true, "picking the phone up lifts Play");
  const c = await page.evaluate(() => { const r = document.getElementById("play").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.waitForTimeout(600);
  assert.equal(await page.locator(".ringx .ri[data-r='set']").count(), 1, "Set in a set");
  await page.mouse.up(); await page.mouse.click(60, 120); await page.waitForTimeout(200);
  assert.match(await page.innerText("#setdial"), /1 of 2/, "4 of 9 sits in the island");

  const pad = await phone(t, { ...LIB, settings: { ...LIB.settings, controls: "ring" } }, { viewport: { width: 1180, height: 820 } });
  await pad.goto(base + "#/song/a"); await pad.waitForTimeout(400);
  assert.equal(await pad.evaluate(() => document.body.classList.contains("ring")), false, "iPad: no ring");
  assert.equal(await pad.evaluate(() => document.getElementById("play").closest(".player") !== null), true, "iPad: Play in the bar");
});

test("2.3 sweep the track: up the arc moves forward in the song, down moves back", { skip: skip() }, async t => {
  const long = { ...LIB.songs[0], body: Array.from({ length: 6 }, () => LIB.songs[0].body).join("\n\n") };
  const page = await phone(t, { ...LIB, songs: [long, LIB.songs[1]], settings: { ...LIB.settings, controls: "ring", follow: "touch" } });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(400);
  await page.mouse.click(120, 300); await page.waitForTimeout(900);
  const W = 390, H = 844, r = Math.hypot(W * 0.34, H * 0.21);
  const at = a => ({ x: W + r * Math.cos(a * Math.PI / 180), y: H + r * Math.sin(a * Math.PI / 180) });
  const lit = () => page.evaluate(() => document.querySelector(".rc-t1").getAttribute("d"));
  const before = await lit();
  const startY = await page.evaluate(() => +document.querySelector(".rc-hit").getAttribute("d").split(" ")[2]);
  assert.ok(startY < 844 - 29, `the arc stays clear of the home bar (${startY})`);
  let p = at(190);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  for (let a = 192; a <= 220; a += 4) { p = at(a); await page.mouse.move(p.x, p.y); }
  const y1 = await page.evaluate(() => scrollY);
  assert.ok(y1 > 200, `sweeping up the arc moves forward (${y1})`);
  for (let a = 216; a >= 204; a -= 4) { p = at(a); await page.mouse.move(p.x, p.y); }
  const y2 = await page.evaluate(() => scrollY);
  assert.ok(y2 < y1 - 60, `sweeping down moves back (${y2} < ${y1})`);
  await page.mouse.up(); await page.waitForTimeout(200);
  assert.notEqual(await lit(), before, "the lit part shows the new place");
  assert.equal(await page.getAttribute("#play", "aria-label"), "Start auto-scroll", "sweeping doesn't press Play");
  /* While playing: auto-scroll carries on from the new place. */
  await page.click("#play"); await page.waitForTimeout(400);
  /* (a tap on the words would pause, so lift Play with a touch elsewhere) */
  await page.evaluate(() => { document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); document.body.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); });
  await page.waitForTimeout(800);
  assert.equal(await page.getAttribute("#play", "aria-label"), "Pause auto-scroll");
  p = at(190); await page.mouse.move(p.x, p.y); await page.mouse.down();
  for (let a = 192; a <= 214; a += 4) { p = at(a); await page.mouse.move(p.x, p.y); }
  const held = await page.evaluate(() => scrollY); await page.waitForTimeout(500);
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - held) < 3, "holds still under the thumb");
  await page.mouse.up(); await page.waitForTimeout(1500);
  const after = await page.evaluate(() => [scrollY, document.documentElement.scrollHeight - innerHeight, document.getElementById("play").getAttribute("aria-label"), document.body.className]);
  assert.ok(after[0] > held || after[0] >= after[1] - 2, `then carries on (${held} -> ${after})`);
  assert.equal(await page.getAttribute("#play", "aria-label"), "Pause auto-scroll", "still playing");
});

test("2.4 arc: a full sweep goes end to end; a slow sweep moves finely; the section glows", { skip: skip() }, async t => {
  const long = { ...LIB.songs[0], body: Array.from({ length: 12 }, (_, i) => LIB.songs[0].body.replace("[Chorus]", `[Chorus ${i + 1}]`)).join("\n\n") };
  const page = await phone(t, { ...LIB, songs: [long, LIB.songs[1]], settings: { ...LIB.settings, controls: "ring", follow: "touch" } });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(400);
  const lift = async () => { await page.mouse.click(120, 300); await page.waitForTimeout(800); };
  await lift();
  const W = 390, H = 844, r = Math.hypot(W * 0.34, H * 0.21), a0 = 180 + Math.asin(30 / r) * 180 / Math.PI;
  const at = a => ({ x: W + r * Math.cos(a * Math.PI / 180), y: H + r * Math.sin(a * Math.PI / 180) });
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  assert.ok(max > 3000, "a long song");
  /* Slow: a fifth of the arc, gently, moves less than a screen. */
  let p = at(a0 + 3); await page.mouse.move(p.x, p.y); await page.mouse.down();
  for (let a = a0 + 3; a <= a0 + 18; a += 1) { p = at(a); await page.mouse.move(p.x, p.y); await page.waitForTimeout(40); }
  const slow = await page.evaluate(() => scrollY);
  assert.ok(slow > 20 && slow < 844, `slow sweep moves finely (${slow})`);
  assert.match(await page.textContent(".rc-where"), /VERSE|Verse|CHORUS|Chorus/i, "the section glows while sweeping");
  await page.mouse.up(); await page.waitForTimeout(300);
  /* End to end in one sweep: the end of the song. */
  await lift();
  p = at(a0 + 2); await page.mouse.move(p.x, p.y); await page.mouse.down();
  for (let a = a0 + 2; a <= 263; a += 6) { p = at(a); await page.mouse.move(p.x, p.y); await page.waitForTimeout(15); }
  p = at(263); await page.mouse.move(p.x, p.y); await page.waitForTimeout(50);
  await page.mouse.up(); await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => scrollY) >= max - 2, "a full sweep up reaches the end");
  await lift();
  p = at(262); await page.mouse.move(p.x, p.y); await page.mouse.down();
  for (let a = 262; a >= a0 + 1; a -= 6) { p = at(a); await page.mouse.move(p.x, p.y); await page.waitForTimeout(15); }
  p = at(a0 + 1); await page.mouse.move(p.x, p.y);
  await page.mouse.up(); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => scrollY), 0, "a full sweep down reaches the start");
});

test("2.4.6 arc: real touch sweeps move steadily, never jump, never reverse", { skip: skip() }, async t => {
  const long = { ...LIB.songs[0], body: Array.from({ length: 14 }, (_, i) => LIB.songs[0].body.replace("[Chorus]", `[Chorus ${i + 1}]`)).join("\n\n") };
  const page = await phone(t, { ...LIB, songs: [long, LIB.songs[1]], settings: { ...LIB.settings, controls: "ring", follow: "touch" } }, { isMobile: true });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  const cdp = await page.context().newCDPSession(page);
  const W = 390, H = 844, r = Math.hypot(W * 0.34, H * 0.21), a0 = 180 + Math.asin(30 / r) * 180 / Math.PI;
  const at = a => ({ x: W + r * Math.cos(a * Math.PI / 180), y: H + r * Math.sin(a * Math.PI / 180) });
  const touch = (type, p) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const sweep = async (from, to, degPerSec) => {
    await touch("touchStart", { x: 100, y: 300 }); await touch("touchEnd"); await page.waitForTimeout(900); /* lift Play */
    await page.evaluate(() => { window.__ys = []; const f = () => { window.__ys.push(scrollY); window.__raf = requestAnimationFrame(f); }; f(); });
    const steps = Math.ceil(Math.abs(to - from) / degPerSec * 60); let p = at(from);
    await touch("touchStart", p);
    for (let i = 1; i <= steps; i++) { p = at(from + (to - from) * i / steps); await touch("touchMove", p); await page.waitForTimeout(16); }
    await touch("touchEnd"); await page.waitForTimeout(300);
    const ys = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__ys; });
    const d = ys.slice(1).map((y, i) => y - ys[i]).filter(Boolean);
    return { moved: ys.at(-1) - ys[0], biggest: Math.max(0, ...d.map(Math.abs)), reversals: d.filter((x, i) => i && Math.sign(x) !== Math.sign(d[i - 1])).length, end: ys.at(-1) };
  };
  const slow = await sweep(a0 + 4, a0 + 20, 25);
  assert.ok(slow.moved > 60 && slow.moved < 400, `slow: fine (${slow.moved})`);
  assert.ok(slow.biggest <= 14 && slow.reversals === 0, `slow: steady (${JSON.stringify(slow)})`);
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
  const full = await sweep(a0 + 3, 262.5, 250);
  assert.ok(full.end >= max - 2, `a quick full sweep reaches the end (${full.end} of ${max})`);
  assert.ok(full.biggest < max * 0.12 && full.reversals === 0, `no jump: biggest frame ${full.biggest} of ${max}`);
  const back = await sweep(255, 230, 40);
  assert.ok(back.moved < 0 && back.reversals === 0, `back up the song, steadily (${JSON.stringify(back)})`);
});

test("2.5 Settings > Song map turns the section rail off and on", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  assert.equal(await page.locator(".smap").count(), 1, "on by default");
  await page.goto(base + "#/settings"); await page.waitForTimeout(300);
  await page.click("#s-map"); await page.waitForTimeout(200);
  assert.equal(await page.getAttribute("#s-map", "aria-checked"), "false");
  await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  assert.equal(await page.locator(".smap").count(), 0, "off: no rail");
  await page.goto(base + "#/settings"); await page.waitForTimeout(300);
  await page.click("#s-map"); await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  assert.equal(await page.locator(".smap").count(), 1, "back on");
});

test("2.5 Back: in the island; pull down at the top; the library opens at its top", { skip: skip() }, async t => {
  const songs = Array.from({ length: 30 }, (_, i) => ({ id: "s" + i, title: "Song " + String(i).padStart(2, "0"), artist: "A", format: "chords", body: "[Verse]\nG C\nla" }));
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, ...songs], settings: { ...LIB.settings, controls: "ring", follow: "touch" } }, { isMobile: true });
  await page.evaluate(() => scrollTo(0, 1500)); await page.waitForTimeout(200);
  await page.evaluate(() => { location.hash = "#/song/s25"; }); await page.waitForTimeout(500);
  const b = await page.evaluate(() => { const r = document.getElementById("rc-back").getBoundingClientRect(); return { x: r.left, y: r.top, v: getComputedStyle(document.getElementById("rc-back")).display }; });
  assert.ok(b.y > 760 && b.v !== "none", `Back sits in the island (${JSON.stringify(b)})`);
  await page.click("#rc-back"); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => location.hash), "#/");
  assert.equal(await page.evaluate(() => scrollY), 0, "the library opens at its top");
  /* Pull down at the top of a song. */
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForTimeout(500);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: y == null ? [] : [{ x: 150, y }] });
  await touch("touchStart", 300);
  for (let y = 300; y <= 360; y += 10) { await touch("touchMove", y); await page.waitForTimeout(16); }
  await touch("touchEnd"); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => location.hash), "#/song/a", "a short pull springs back");
  await touch("touchStart", 300);
  for (let y = 300; y <= 420; y += 10) { await touch("touchMove", y); await page.waitForTimeout(16); }
  assert.match(await page.textContent(".rc-pull"), /Release for Library/);
  assert.equal(await page.evaluate(() => document.querySelector(".rc-pull").classList.contains("go")), true);
  await touch("touchEnd"); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => location.hash), "#/", "a full pull goes back");
});

test("2.6.4 Tips & gestures: one-hand group first, no button-only rows, Show me points at the ring", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, controls: "ring", follow: "touch" } });
  await page.goto(base + "#/gestures"); await page.waitForTimeout(300);
  const labels = await page.evaluate(() => [...document.querySelectorAll(".label")].map(x => x.textContent));
  assert.match(labels[0], /One hand/i, "one-hand group first");
  const text = await page.innerText("#app");
  for (const t of ["Hold Play", "Sweep the arc", "Pull down at the top", "Hold the time"]) assert.ok(text.includes(t), t);
  for (const t of ["Tap the cover", "Arrows in Edit", "Tap the status chip", "Sheet and Text"]) assert.ok(!text.includes(t), `no ${t}`);
  assert.ok(await page.locator(".gs-row").count() <= 24, "trimmed");
  await page.click(".gs-show[data-demo='ring']"); await page.waitForTimeout(1800);
  assert.match(await page.evaluate(() => location.hash), /#\/song\//);
  assert.ok(await page.locator(".coach").count() >= 1, "the tip points at Play");
});

test("2.6.5 speed dial: a wobble doesn't change it; Undo restores; nothing selectable", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: LIB.songs.map(s => s.id === "a" ? { ...s, duration: 200 } : s) });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(400);
  const before = (await page.innerText("#dialbtn")).trim();
  const b = await page.locator("#dialbtn").boundingBox();
  const x = b.x + 20, y = b.y + 16;
  await page.mouse.move(x, y); await page.mouse.down();
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".dial-big")).webkitUserSelect || getComputedStyle(document.querySelector(".dial-big")).userSelect), "none");
  await page.mouse.move(x + 6, y - 8, { steps: 3 }); await page.mouse.up(); await page.waitForTimeout(300);
  if (await page.locator(".dial").count()) { await page.mouse.click(60, 120); await page.waitForTimeout(300); }
  assert.equal((await page.innerText("#dialbtn")).trim(), before, "a small wobble changes nothing");
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 60, y - 140, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
  assert.notEqual((await page.innerText("#dialbtn")).trim(), before, "a real sweep changes it");
  assert.match(await page.innerText("#toast"), /Length .*Undo/s);
  await page.click("#toast .tact"); await page.waitForTimeout(300);
  assert.equal((await page.innerText("#dialbtn")).trim(), before, "Undo puts it back");
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "a").duration, 200);
});

test("Add the words: paste lyrics on a chord chart and the chords go over them", { skip: skip() }, async t => {
  const chart = "[Verse]\nG   D   Em   C\n\n[Chorus]\nC   G   D";
  const page = await phone(t, { ...LIB, songs: [{ id: "c", title: "Chart Song", artist: "X", format: "chords", ai: "chart", body: chart }, ...LIB.songs] });
  await page.goto(base + "#/song/c"); await page.waitForTimeout(400);
  await page.click("#more"); await page.click(".menu [data-m='words']"); await page.waitForTimeout(400);
  assert.equal(await page.isDisabled("#ws-ok"), true, "nothing to save before words");
  await page.fill("#ws-text", "first line of the verse here\nsecond line goes on\n\n[Chorus]\nthis is the chorus line");
  await page.waitForTimeout(400);
  assert.match(await page.textContent("#ws-prev"), /\[Verse\]\nG\s+D\nfirst line of the verse here/);
  await page.click("#ws-ok"); await page.waitForTimeout(500);
  const body = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "c").body;
  assert.match(body, /\[Chorus\]\nC\s+G\nthis is the chorus line/);
  assert.match(await page.textContent("#sheet"), /first line of.*chorus line/, "the song page shows the words");
  await page.click("#toast .tact"); await page.waitForTimeout(300);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "c").body, chart, "Undo");
});

test("typing in Text on a phone opens writing mode; the editor fills the top and the bar rides above", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { isMobile: true });
  await page.click("#add");
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.focus("#ed-body");
  await page.waitForTimeout(450);
  assert.ok(await page.evaluate(() => document.body.classList.contains("writing")), "writing mode on");
  const box = await page.locator(".ed-tx").boundingBox(), bar = await page.locator(".cebar").boundingBox();
  assert.ok(box.y >= 0 && box.y < 30, `editor at the top (y=${box.y})`);
  assert.ok(bar.y >= box.y + box.height, "bar sits below the editor, not over it");
  assert.ok(await page.locator("#ce-done").isVisible(), "Save stays one tap away while typing");
  await page.keyboard.type("[Verse]\nG\nHello" + "\nline".repeat(60));
  const st = await page.evaluate(() => document.querySelector(".ed-tx").scrollTop);
  assert.ok(st > 0, "the editor follows the caret down");
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(100);
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("writing"))), "writing mode off when the keyboard closes");
});
