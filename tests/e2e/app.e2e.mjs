// Browser tests: the real app in Chromium, phone-sized.
// Run: node --test tests/e2e/   (needs Playwright: npm i --no-save playwright && npx playwright install chromium)
// They catch what unit tests can't: the app failing to load, screens not
// rendering, taps doing the wrong thing.

import test from "node:test";
import assert from "node:assert/strict";
import { chromium, base, browser, phone, skip, LIB, FAKE_MIC, useBrowser, until, settled } from "./harness.mjs";

useBrowser();


test("first launch adds the sample song and opens on the Road with it ready (4.0.0)", { skip: skip() }, async t => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(base); await page.waitForSelector(".rd-path");
  assert.equal(await page.locator(".rd-node.now").count(), 1, "one current stop");
  assert.match(await page.innerText("#rd-tonight"), /Gig: /, "the sample song is ready to play as a gig");
  await page.click("#rd-songbook"); await page.waitForSelector("#list .row"); /* 4.9.0: the Songbook page */
  assert.equal(await page.locator("#list .row").count(), 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("a song opens, its Key opens the key dial, and it plays; a tap pauses it", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.goto(base + "#/song/a"); await page.waitForSelector('.metarow');
  assert.match(await page.innerText(".metarow"), /Key A/);
  /* 3.20.0: Key is a button under the title that opens the key dial */
  await page.click("#keybtn"); await page.waitForSelector(".dial.key");
  assert.match(await page.textContent(".dial-small"), /KEY A/);
  await page.mouse.click(60, 120); await page.waitForSelector('.dial', { state: 'detached' });
  assert.equal(await page.locator(".dial").count(), 0);
  await page.click("#play"); await page.waitForFunction(() => document.getElementById('play').getAttribute('aria-label') === 'Pause auto-scroll');
  assert.equal(await page.getAttribute("#play", "aria-label"), "Pause auto-scroll");
  await page.touchscreen.tap(200, 500); await page.waitForFunction(() => document.getElementById('play').getAttribute('aria-label') === 'Start auto-scroll');
  assert.equal(await page.getAttribute("#play", "aria-label"), "Start auto-scroll");
});

test("search moves to the top, finds lyrics, and offers to find what's missing", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.tap("#q"); await page.waitForFunction(() => document.body.classList.contains('searching'));
  assert.ok(await page.evaluate(() => document.body.classList.contains("searching")));
  await page.keyboard.type("willows"); await page.waitForFunction(() => /River Road/.test(document.getElementById('list').innerText) && /Find “willows” elsewhere/.test(document.querySelector('.findcard.more')?.innerText || ''));
  assert.match(await page.innerText("#list"), /River Road/);
  assert.match(await page.innerText(".findcard.more"), /Find “willows” elsewhere/, "matches still leave a way to look further");
  assert.ok(await page.locator(".findcard.more [data-find='ug']").count());
  await page.fill("#q", "zzz unknown"); await page.dispatchEvent("#q", "input"); await page.waitForSelector('.findcard');
  assert.ok(await page.locator(".findcard").count());
  await page.tap("#qcancel"); await page.waitForFunction(() => !document.body.classList.contains('searching'));
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("searching"))));
});

test("Edit places a chord over a word, and Text keeps the change", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.goto(base + "#/song/a"); await page.waitForSelector('.metarow');
  await page.click("#more"); await page.waitForSelector(".menu [data-m='edit']");
  await page.click(".menu [data-m='edit']"); await page.waitForSelector(".ce-w[data-word='road']");
  await page.click(".ce-w[data-word='road']"); await page.waitForSelector("[data-u='E']");
  await page.click("[data-u='E']"); await page.waitForSelector("[data-v='text']");
  await page.click("[data-v='text']"); await page.waitForSelector('#ed-body');
  assert.match(await page.inputValue("#ed-body"), /A {18}D {3}E\nWalking down the river road tonight/);
  await page.click("#ce-done"); await page.waitForSelector('#sheet .pr');
  assert.match(await page.innerText("#sheet"), /E/);
});

test("a new set with a date shows as Up next and plays after its title card", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.click("[data-f='sets']"); await page.waitForSelector('#newset');
  await page.click("#newset"); await page.waitForSelector('#ns-name');
  await page.fill("#ns-name", "Friday Gig");
  const d = new Date(Date.now() + 3 * 864e5); const when = `${d.toISOString().slice(0, 10)}T20:00`;
  await page.fill("#ns-when", when); await page.dispatchEvent("#ns-when", "change");
  await page.click("#ns-ok"); await page.waitForSelector('#pk-list .row');
  await page.click("#pk-list .row:has-text('River Road')"); await page.click("#pk-list .row:has-text('Harbor Lights')");
  await page.click("#pk-add"); await page.waitForFunction(() => JSON.parse(localStorage.getItem('tabs-v1')).sets.some(s => s.songIds.length === 2));
  await page.goto(base + "#/library"); await page.reload(); await page.waitForSelector('#upnext');
  assert.match(await page.innerText("#upnext"), /Friday Gig/);
  await page.click("#un-play"); await page.waitForSelector('.titlecard');
  assert.ok(await page.locator(".titlecard").count());
  await page.waitForFunction(() => /#\/song\/a/.test(location.hash), null, { timeout: 8000 });
  assert.match(page.url(), /#\/song\/a/);
});

test("a shared song link opens the Shared with you sheet", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { permissions: ["clipboard-read", "clipboard-write"] });
  await page.goto(base + "#/song/a"); await page.waitForSelector('.metarow');
  await page.click("#more"); await page.waitForSelector(".menu [data-m='share']");
  await page.click(".menu [data-m='share']");
  /* Waited for, not slept on, so a busy test machine doesn't flake. */
  await page.waitForFunction(async () => /#\/import\//.test(await navigator.clipboard.readText()), null, { timeout: 8000 });
  const url = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(url, /#\/import\/z/);
  await page.goto(url); await page.reload();
  await page.waitForSelector("[aria-label='Shared with you']", { timeout: 8000 });
  assert.match(await page.innerText("[aria-label='Shared with you']"), /River Road/);
});

test("theme: Automatic follows the phone; Dark and Light override it", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { colorScheme: "light" });
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  assert.equal(await theme(), "light", "automatic follows a light phone");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  assert.equal(await theme(), "dark", "and changes with it");
  await page.goto(base + "#/settings/look");
  await page.waitForSelector('#s-theme');
  await page.click("#s-theme [data-t='light']");
  assert.equal(await theme(), "light", "Light overrides a dark phone");
  await page.click("#s-theme [data-t='auto']");
  assert.equal(await theme(), "dark");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('tabs-v1')).settings.theme === 'auto');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.theme), "auto");
});

test("security policy allows Apple art, the Anthropic API, song search, LRCLIB, GetSongBPM, Open-Meteo and the Apple Music token Worker, and nothing else", { skip: skip() }, async t => {
  const page = await phone(t);
  const blocked = [];
  page.removeAllListeners("console");
  page.on("console", m => { if (/Content Security Policy/i.test(m.text())) blocked.push(m.text()); });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  await page.route(/mzstatic\.com|example\.com\/.*\.png/, r => r.fulfill({ status: 200, contentType: "image/png", body: png }));
  await page.route(/api\.anthropic\.com|itunes\.apple\.com|lrclib\.net|api\.getsong\.co|open-meteo\.com|workers\.dev|example\.com\/api/, r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "{}" }));
  const res = await page.evaluate(async () => {
    const img = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(true); i.onerror = () => ok(false); i.src = src; });
    const get = url => fetch(url).then(() => true, () => false);
    return {
      art: await img("https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.png"),
      otherImg: await img("https://example.com/pixel.png"),
      anthropic: await get("https://api.anthropic.com/v1/messages"),
      itunes: await get("https://itunes.apple.com/search?term=x"),
      lrclib: await get("https://lrclib.net/api/search?q=x"),
      getsong: await get("https://api.getsong.co/search/?type=song&lookup=x"),
      weather: await get("https://api.open-meteo.com/v1/forecast?latitude=1&longitude=1"),
      places: await get("https://geocoding-api.open-meteo.com/v1/search?name=x"),
      musicToken: await get("https://tabs-musickit.example.workers.dev/token"),
      other: await get("https://example.com/api")
    };
  });
  assert.deepEqual(res, { art: true, otherImg: false, anthropic: true, itunes: true, lrclib: true, getsong: true, weather: true, places: true, musicToken: true, other: false });
  assert.ok(blocked.length >= 2, "blocked requests are reported");
});

test("restoring a backup brings back songs and set cover photos, and skips broken songs", { skip: skip() }, async t => {
  const page = await phone(t);
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const backup = {
    songs: [{ id: "x", title: "Backup Song", body: "[Verse]\nG\nhello", format: "chords" }, { id: "y", title: "Broken" }],
    sets: [{ id: "s9", name: "Saturday", songIds: ["x"], cover: { type: "photo", tint: "#553322" } }],
    trash: [], settings: { v: 5, streakMoment: false, tipsSeen: { library: true, song: true, edit: true, add: true, map: true, pause: true, chord: true, play: true, line: true, tap: true, paste: true, menu: true, strobe: true, searchInvite: true, search: true, nn: true }, sampleAdded: true, lastBackup: "2099-01-01T00:00:00Z" },
    covers: { s9: png }
  };
  await page.goto(base + "#/settings/library");
  await page.locator("#file").setInputFiles({ name: "tabs-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.waitForFunction(() => /Imported 1 song/.test(document.getElementById('toast')?.textContent || '') && JSON.parse(localStorage.getItem('tabs-v1')).songs[0]?.title === 'Backup Song');
  assert.match(await page.locator("#toast").textContent(), /Imported 1 song\. Skipped 1/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")));
  assert.deepEqual(saved.songs.map(s => s.title), ["Backup Song"]);
  assert.equal(saved.covers, undefined, "photos stay out of the main save");
  await page.goto(base + "#/set/s9");
  await page.waitForSelector('.cover img');
  assert.equal(await page.locator(".cover img").first().getAttribute("src"), png);
});

test("Add opens a blank song in the editor; Save keeps it, Cancel removes it", { skip: skip() }, async t => {
  const page = await phone(t);
  const titles = () => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.map(s => s.title + (s.isNew ? "*" : "")));
  await page.click("#add");
  await page.waitForSelector('#ed-body');
  assert.equal(await page.locator("#ce-done").textContent(), "Save");
  assert.ok(await page.locator("#ed-body").isVisible(), "opens in the Text view");
  await page.fill("#ed-body", "[Verse]\nG       C\nHello there friend");
  await page.waitForFunction(() => /G \(auto\)/.test(document.querySelector('.ed-chips')?.textContent || ''));
  assert.match(await page.locator(".ed-chips").textContent(), /G \(auto\)/);
  await page.click("#ce-done");
  await page.waitForFunction(() => /Add a title first/.test(document.getElementById('toast')?.textContent || ''));
  assert.match(await page.locator("#toast").textContent(), /Add a title first/);
  await page.fill("#ed-title", "New One");
  await page.click("#ce-done");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('tabs-v1')).songs.some(s => s.title === 'New One' && !s.isNew));
  await page.waitForSelector('h1.song-title');
  assert.equal(await page.locator("h1.song-title").textContent(), "New One");
  assert.deepEqual(await titles(), ["New One", "River Road", "Harbor Lights"]);

  await page.goto(base + "#/library");
  await page.waitForSelector('#add');
  await page.click("#add");
  await page.waitForSelector('#ed-body');
  await page.fill("#ed-body", "e|---0---2---|\nB|---1---3---|\nG|---0---2---|\nD|---2---0---|");
  await page.waitForFunction(() => /Format\s*Tab/.test(document.querySelector('.ed-chips')?.textContent || ''));
  assert.match(await page.locator(".ed-chips").textContent(), /Format\s*Tab/);
  assert.equal(await page.locator("#ed-seg").isVisible(), false, "no Sheet view for tab");
  // Cancel discards at once (no question), and Undo brings it back to editing.
  await page.evaluate(() => document.activeElement.blur()); /* close the keyboard first, as on a phone */
  await page.waitForFunction(() => document.activeElement === document.body);
  await page.click("#ce-cancel");
  await page.waitForFunction(() => /Song discarded/.test(document.getElementById('toast')?.textContent || '') && JSON.parse(localStorage.getItem('tabs-v1')).songs.length === 3);
  assert.deepEqual(await titles(), ["New One", "River Road", "Harbor Lights"]);
  assert.match(await page.innerText("#toast"), /Song discarded/);
  await page.click("#toast .tact"); await page.waitForFunction(() => /^e\|---0/.test(document.getElementById('ed-body')?.value || '') && JSON.parse(localStorage.getItem('tabs-v1')).songs.length === 4);
  assert.match(await page.inputValue("#ed-body"), /^e\|---0/);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.length, 4);
});

test("questions are asked in the app: rename a section, any chord, delete for good", { skip: skip() }, async t => {
  const page = await phone(t);
  page.on("dialog", d => { d.dismiss(); throw new Error("native dialog: " + d.message()); });
  const body = async () => JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "a").body;
  await page.goto(base + "#/song/a"); await page.waitForSelector('.metarow');
  await page.click("#more"); await page.click(".menu [data-m='edit']"); await page.waitForSelector('[data-sec]');
  await page.click("[data-sec] >> nth=0"); await page.waitForSelector('#ask-in');
  assert.equal(await page.inputValue("#ask-in"), "Verse");
  await page.click(".ask [data-pick='Intro']"); await page.waitForFunction(() => /^\[Intro\]/.test(JSON.parse(localStorage.getItem('tabs-v1')).songs.find(s => s.id === 'a').body));
  assert.match(await body(), /^\[Intro\]/);
  await page.click(".ce-w >> nth=0"); await page.click("#ce-other"); await page.waitForSelector('#ask-in');
  await page.fill("#ask-in", "Cadd9");
  assert.equal(await page.textContent("#ask-ok"), "Place Cadd9");
  assert.equal(await page.locator("#ask-pv svg").count(), 1, "diagram shows as you type");
  await page.press("#ask-in", "Enter"); await page.waitForFunction(() => /Cadd9/.test(JSON.parse(localStorage.getItem('tabs-v1')).songs.find(s => s.id === 'a').body));
  assert.match(await body(), /Cadd9/);
  // Delete for good asks in a sheet; Keep it keeps it.
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("tabs-v1")); delete d._savedAt; d.trash = [{ type: "song", item: { id: "z", title: "Old Song", body: "G" }, deletedAt: new Date().toISOString() }]; localStorage.setItem("tabs-v1", JSON.stringify(d)); });
  await page.goto(base + "#/library"); await page.reload(); await page.waitForSelector('#add');
  await page.goto(base + "#/trash"); await page.waitForSelector('[data-forget]');
  await page.click("[data-forget]"); await page.waitForSelector('#ask-no');
  assert.match(await page.innerText(".ask"), /Delete “Old Song” for good\?/);
  await page.click("#ask-no"); await page.waitForSelector('#ask-no', { state: 'detached' });
  assert.equal(await page.locator("[data-forget]").count(), 1);
  await page.click("[data-forget]"); await page.click("#ask-ok"); await page.waitForSelector('[data-forget]', { state: 'detached' });
  assert.equal(await page.locator("[data-forget]").count(), 0);
});

test("an Apple Music link sets the song's length; tapping sets the tempo", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.route("https://itunes.apple.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ results: [{ trackName: "Harbor Lights", artistName: "Me", trackViewUrl: "https://music.apple.com/us/album/a/1?i=111", trackTimeMillis: 232000 }] }) }));
  await page.route("https://music.apple.com/**", r => r.fulfill({ status: 200, body: "" }));
  await page.goto(base + "#/song/b");
  await page.waitForSelector('.metarow');
  await page.click("#listen");
  await page.waitForSelector("[data-t='0']");
  await page.click("[data-t='0']");
  await page.waitForFunction(() => document.getElementById('sv')?.textContent === '3:52');
  assert.equal(await page.locator("#sv").textContent(), "3:52");
  assert.match(await page.locator("#toast").textContent(), /Length set from the recording: 3:52/);

  await page.click("#more");
  await page.click(".menu [data-m='edit']");
  await page.waitForSelector('#ed-tap');
  const box = await page.locator("#ed-tap").boundingBox();
  for (let i = 0; i < 5; i++) { await page.mouse.click(box.x + 10, box.y + 10); await page.waitForTimeout(500); /* real timer */ }
  await page.waitForTimeout(1800); /* real timer */
  const bpm = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.id === "b").bpm);
  assert.ok(bpm >= 105 && bpm <= 122, `about 120 BPM, got ${bpm}`);
});

test("first song: try a chord, then Play; tips never block and show once", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, tipsSeen: { library: true, song: true } } });
  await page.goto(base + "#/song/a");
  await page.waitForSelector('.coach-pulse');
  const cap = () => page.evaluate(() => document.querySelector(".coach")?.textContent || null);
  assert.equal(await cap(), "Tap a chord to see how to play it");
  // The caption doesn't block: tapping the chord works and shows its diagram.
  await page.locator(".coach-pulse").click();
  await page.waitForSelector('.dpop');
  assert.ok(await page.locator(".dpop").count(), "diagram shown");
  assert.equal(await cap(), "That's how it's played");
  await page.waitForFunction(() => document.querySelector('.coach')?.textContent === "Press play when you're ready", null, { timeout: 8000 });
  assert.equal(await cap(), "Press play when you're ready");
  await page.waitForFunction(() => { const x = JSON.parse(localStorage.getItem("tabs-v1")).settings; return x.used?.chord && x.tipsSeen?.chord && x.tipsSeen?.play; });
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings);
  assert.ok(s.used.chord && s.tipsSeen.chord && s.tipsSeen.play);
  // Second visit: nothing.
  await page.goto(base + "#/library");
  await page.goto(base + "#/song/a");
  await page.waitForTimeout(900); /* real timer */
  assert.equal(await cap(), null);
  // New features carry a dot in the menu until used.
  await page.click("#more");
  assert.ok(await page.locator(".menu [data-new='tuner']").count());
});


test("tuner: guided acoustic walks the strings, the meter shows how far off, chromatic reads any note", { skip: skip() }, async t => {
  const browser2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => browser2.close());
  const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(FAKE_MIC);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(base);
  await page.waitForFunction(() => !!localStorage.getItem('tabs-v1')); /* let the first-launch save land before replacing the library */ /* let the first-launch save land before replacing the library */
  await page.evaluate(d => localStorage.setItem("tabs-v1", JSON.stringify(d)), { ...LIB, settings: { ...LIB.settings, tipsSeen: { ...LIB.settings.tipsSeen, tuner: true }, micExplained: true } });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.goto(base + "#/library"); await page.waitForSelector("#tunerbtn"); /* 4.0.0: the Road has no header; the Library does */
  await page.click("#tunerbtn");
  await page.waitForSelector('#tn-say');
  const read = () => page.evaluate(() => ({ note: document.getElementById("tn-n").textContent, say: document.getElementById("tn-say").textContent, tag: document.getElementById("tn-tag").textContent }));
  assert.equal((await read()).say, "Play the E string");
  assert.equal(await page.locator(".tn-tile.on").textContent(), "Acoustic");
  const at = (hz, cents) => page.evaluate(f => { window.__hz = f; }, hz * 2 ** (cents / 1200));
  /* 2.16.1: an octave slip on the low E still reads E, 20 cents flat, not a far-off note */
  await at(82.41 * 2, -20); await page.waitForFunction(() => document.getElementById('tn-n').textContent === 'E' && document.getElementById('tn-say').textContent === 'Tighten the E string');
  await at(0, 0);
  await at(82.41, -25); await page.waitForFunction(() => document.getElementById('tn-say').textContent === 'Tighten the E string');
  assert.deepEqual(await read(), { note: "E", say: "Tighten the E string", tag: "Too low" });
  await at(82.41, -4); await page.waitForFunction(() => parseFloat(document.getElementById('tn-dot').style.left) < 42);
  assert.ok(await page.evaluate(() => parseFloat(document.getElementById("tn-dot").style.left) < 42), "4 cents flat sits well left of center");
  const glows = () => page.evaluate(() => document.querySelector(".tn-note").classList.contains("glow"));
  await at(82.41, -1); await page.waitForFunction(() => document.querySelector('.tn-note').classList.contains('glow'));
  assert.equal(await glows(), true, "in tune: the letter glows");
  await at(82.41, -25); await page.waitForFunction(() => !document.querySelector('.tn-note').classList.contains('glow'));
  assert.equal(await glows(), false, "out of tune: no glow");
  const order = [];
  for (const hz of [82.41, 110, 146.83, 196, 246.94, 329.63]) {
    order.push(await page.evaluate(() => document.querySelector(".tn-key") && document.querySelector("#tn-stage text.on")?.textContent));
    await at(hz, 0); await page.waitForTimeout(1700); /* real timer */
  }
  assert.deepEqual(order.map(x => (x || "").replace(/[^A-Ga-g]/g, "")), ["E", "A", "D", "G", "B", "e"], "guided: E, A, D, G, B, e in order");
  assert.equal((await read()).note, "All in tune");
  assert.match(await page.innerText("#toast"), /All six strings in tune/, "success is announced");
  assert.equal(await page.evaluate(() => document.querySelector(".tn-note").classList.contains("glow")), true, "and glows");
  assert.match(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--tune")), /#/, "the tuner's green");
  await page.click("[data-mode='chromatic']");
  await at(185, -12); await page.waitForFunction(() => document.getElementById('tn-n').textContent === 'F♯' && document.getElementById('tn-say').textContent === 'A little flat');
  const r = await read();
  assert.equal(r.note, "F♯");
  assert.equal(r.say, "A little flat");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.tunerMode === "chromatic");
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings);
  assert.equal(s.tunerMode, "chromatic");
  assert.ok(s.lastTuned > 0);
  await page.click("#tn-done");
  assert.equal(await page.locator(".tuner2").count(), 0);
  assert.deepEqual(errors, []);
});

test("Tips & gestures (2.6.4): opens from Help, one-hand group first, no button-only rows, and Show me plays the real thing", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.goto(base + "#/settings/help");
  await page.click("#s-tips");
  await page.waitForFunction(() => /One hand/i.test(document.querySelector(".label")?.textContent || "")); await settled(page);
  const rows = await page.locator(".gs-row").count();
  assert.ok(rows >= 20 && rows <= 24, `every gesture, trimmed (${rows})`);
  const text = await page.innerText("#app");
  for (const t of ["Press Play", "Pull down at the top", "Tools, then Speed"]) assert.ok(text.includes(t), t);
  for (const t of ["Hold Play", "Sweep the arc", "Tap the cover", "Arrows in Edit", "Tap the status chip", "Sheet and Text"]) assert.ok(!text.includes(t), `no ${t}`);
  // The page itself scrolls (it isn't a sheet over Settings).
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  assert.ok(await page.evaluate(() => scrollY > 200));
  /* Each demo's tip is checked in tips.e2e.mjs; here, one shows the real screen behind it. */
  await page.click("[data-demo='line']");
  await page.waitForFunction(() => /Tap a line to start from it/.test([...document.querySelectorAll('.coach')].pop()?.innerText || ''));
  assert.ok(await page.evaluate(() => document.getElementById("sheet").classList.contains("focus")), "real focus look");
});

test("tuner: says why it needs the microphone before the phone asks", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = () => new Promise(() => {}); });
  await page.goto(base + "#/library"); await page.waitForSelector("#tunerbtn"); /* 4.0.0: the Road has no header; the Library does */
  await page.click("#tunerbtn");
  await page.waitForSelector('.tn-mic');
  assert.match(await page.locator(".tn-mic").innerText(), /Nothing is recorded or sent/);
  await page.click("#tn-allow");
  assert.equal(await page.locator(".tn-mic").count(), 0);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('tabs-v1')).settings.micExplained === true);
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
  await page.reload(); await page.waitForLoadState('domcontentloaded');
  await page.goto(base + "#/settings/help"); await page.waitForSelector('#s-diag');
  assert.match(await page.innerText("#s-diag"), /1 problem/);
  await page.click("#s-diag"); await page.waitForFunction(async () => /The Road/.test(await navigator.clipboard.readText()));
  const text = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(text, /The Road \d+\.\d+\.\d+/);
  assert.match(text, /2 songs/);
  assert.match(text, /Earlier problem/);
  assert.match(text, /AI key: set/);
  assert.doesNotMatch(text, /sk-ant-secret|River Road|Walking down/);
});

test("the library lives in the phone's database; its copy brings it back if the database copy is lost", { skip: skip() }, async t => {
  const page = await phone(t);
  const inDB = () => page.evaluate(() => new Promise(ok => {
    const r = indexedDB.open("tabs-library", 1);
    r.onsuccess = () => { const g = r.result.transaction("copy").objectStore("copy").get("lib"); g.onsuccess = () => ok(g.result ? JSON.parse(g.result.json).songs.length : -1); };
  }));
  await until(async () => (await inDB()) === 2);
  assert.equal(await inDB(), 2, "the test library moved into the database");
  // A change saves to both.
  await page.goto(base + "#/song/b"); await page.waitForSelector('.fav');
  await page.click(".fav:visible"); await page.waitForFunction(() => JSON.parse(localStorage.getItem('tabs-v1')).songs.find(s => s.id === 'b').favorite === true);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "b").favorite, true);
  // The database copy is unreadable: the localStorage copy brings the library back.
  await page.evaluate(() => new Promise(ok => {
    const r = indexedDB.open("tabs-library", 1);
    r.onsuccess = () => { const tx = r.result.transaction("copy", "readwrite"); tx.objectStore("copy").put({ json: "{broken", at: new Date(Date.now() + 1e6).toISOString() }, "lib"); tx.oncomplete = ok; };
  }));
  await page.goto(base + "#/library"); await page.reload(); await page.waitForFunction(() => /restored from its safety copy/.test(document.getElementById('toast')?.textContent || ''));
  assert.equal(await page.locator("#list .row").count(), 2);
  assert.match(await page.innerText("#toast"), /restored from its safety copy/);
  assert.equal(await inDB(), 2, "and the database is whole again");
  // With the copy gone, the database alone has everything.
  await page.evaluate(() => localStorage.removeItem("tabs-v1"));
  await page.reload(); await page.waitForSelector('#list .row');
  assert.equal(await page.locator("#list .row").count(), 2);
});


test("a page-turner pedal: left plays and pauses, right goes to the next section, held goes back", { skip: skip() }, async t => {
  const long = { ...LIB, songs: [{ ...LIB.songs[0], body: Array.from({ length: 6 }, (_, i) => `[Part ${i + 1}]\n` + "A  D\nWalking down the road\n".repeat(6)).join("\n") }, LIB.songs[1]] };
  const page = await phone(t, long);
  await page.goto(base + "#/song/a"); await page.waitForSelector('#sheet > .sec');
  const secTop = n => page.evaluate(n => Math.round(document.querySelectorAll("#sheet > .sec")[n].getBoundingClientRect().top - innerHeight * 0.4), n);
  await page.keyboard.press("PageDown"); await until(async () => Math.abs(await secTop(1)) < 4);
  assert.ok(Math.abs(await secTop(1)) < 4, "Part 2 at the reading line");
  await page.keyboard.press("ArrowRight"); await until(async () => Math.abs(await secTop(2)) < 4);
  assert.ok(Math.abs(await secTop(2)) < 4, "Part 3 at the reading line");
  await page.keyboard.down("PageDown"); await page.waitForTimeout(800); /* real timer */ await page.keyboard.up("PageDown"); await until(async () => Math.abs(await secTop(1)) < 4);
  assert.ok(Math.abs(await secTop(1)) < 4, "held: back to Part 2");
  await page.keyboard.press("PageUp"); await page.waitForFunction(() => document.getElementById('play').getAttribute('aria-label') === 'Pause auto-scroll');
  assert.equal(await page.getAttribute("#play", "aria-label"), "Pause auto-scroll");
  await page.keyboard.press(" "); await page.waitForFunction(() => document.getElementById('play').getAttribute('aria-label') === 'Start auto-scroll');
  assert.equal(await page.getAttribute("#play", "aria-label"), "Start auto-scroll");
});
