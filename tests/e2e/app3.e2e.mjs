// Browser tests, part 3 of app.e2e (split so files run side by side).
// Run: node --test tests/e2e/   (needs Playwright: npm i --no-save playwright && npx playwright install chromium)
// They catch what unit tests can't: the app failing to load, screens not
// rendering, taps doing the wrong thing.

import test from "node:test";
import assert from "node:assert/strict";
import { chromium, base, phone, skip, LIB, FAKE_MIC, useBrowser, openSpeed, speedText } from "./harness.mjs";

useBrowser();


test("3.19.0 in a set, 4 of 9 is in the bar; playing folds it away with the rest; iPad keeps the bar", { skip: skip() }, async t => {
  const songs = [...LIB.songs.map(x => x.id === "a" ? { ...x, duration: 900 } : x), { id: "x0", title: "One", artist: "Y", format: "chords", body: "[Verse]\nG C\nla" }];
  const page = await phone(t, { ...LIB, songs, sets: [{ id: "s", name: "Gig", songIds: ["a", "x0"] }], settings: { ...LIB.settings, countIn: false } });
  await page.goto(base + "#/set/s"); await page.waitForTimeout(400);
  await page.click("[data-open='0']"); await page.waitForTimeout(600);
  assert.match(await page.innerText("#setdial"), /1 of 2/, "4 of 9 sits in the bar");
  assert.ok(await page.locator("#setdial").isVisible());
  await page.click("#play"); await page.waitForTimeout(500);
  assert.equal(await page.locator("#setdial").isVisible(), false, "folded away while playing");
  assert.match(await page.innerText("#fp-nav"), /One\s*2 of 2/, "3.20.0: beside Play, the next song in the set");
  await page.click("#fp-nav"); await page.waitForTimeout(700);
  assert.match(await page.innerText(".song-title"), /One/, "a tap moves on to it");

  const pad = await phone(t, { ...LIB, settings: { ...LIB.settings, countIn: false } }, { viewport: { width: 1180, height: 820 } });
  await pad.goto(base + "#/song/a"); await pad.waitForTimeout(400);
  await pad.click("#play"); await pad.waitForTimeout(400);
  assert.equal(await pad.evaluate(() => document.body.classList.contains("fold")), false, "iPad: the bar stays");
  assert.equal(await pad.evaluate(() => document.getElementById("play").closest(".player") !== null), true, "iPad: Play in the bar");
});
test("2.5 Settings > Song map turns the section rail off and on", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  assert.equal(await page.locator(".smap").count(), 1, "on by default");
  await page.goto(base + "#/settings/diagrams"); await page.waitForTimeout(300);
  await page.click("#s-map"); await page.waitForTimeout(200);
  assert.equal(await page.getAttribute("#s-map", "aria-checked"), "false");
  await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  assert.equal(await page.locator(".smap").count(), 0, "off: no rail");
  await page.goto(base + "#/settings/diagrams"); await page.waitForTimeout(300);
  await page.click("#s-map"); await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  assert.equal(await page.locator(".smap").count(), 1, "back on");
});

test("2.5 Back: beside the title (4.2.0); pull down at the top; the library opens at its top", { skip: skip() }, async t => {
  const songs = Array.from({ length: 30 }, (_, i) => ({ id: "s" + i, title: "Song " + String(i).padStart(2, "0"), artist: "A", format: "chords", body: "[Verse]\nG C\nla" }));
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, ...songs] }, { isMobile: true });
  await page.evaluate(() => scrollTo(0, 1500)); await page.waitForTimeout(200);
  await page.evaluate(() => { location.hash = "#/song/s25"; }); await page.waitForTimeout(500);
  const b = await page.evaluate(() => { const el = document.querySelector(".shead .sh-back"), r = el.getBoundingClientRect(); return { x: r.left, y: r.top, v: getComputedStyle(el).display }; });
  assert.ok(b.y < 100 && b.v !== "none", `4.2.0: Back sits beside the title (${JSON.stringify(b)})`);
  await page.click(".shead .sh-back"); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => location.hash), "#/library");
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
  assert.match(await page.textContent(".fp-pull"), /Release for Library/);
  assert.equal(await page.evaluate(() => document.querySelector(".fp-pull").classList.contains("go")), true);
  await touch("touchEnd"); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => location.hash), "#/library", "a full pull goes back");
});

test("2.6.4 Tips & gestures: one-hand group first, no button-only rows, Show me points at the control", { skip: skip() }, async t => {
  const page = await phone(t, LIB);
  await page.goto(base + "#/gestures"); await page.waitForTimeout(300);
  const labels = await page.evaluate(() => [...document.querySelectorAll(".label")].map(x => x.textContent));
  assert.match(labels[0], /One hand/i, "one-hand group first");
  const text = await page.innerText("#app");
  for (const t of ["Press Play", "Pull down at the top", "Tools, then Speed"]) assert.ok(text.includes(t), t);
  for (const t of ["Hold Play", "Sweep the arc", "Tap the cover", "Arrows in Edit", "Tap the status chip", "Sheet and Text"]) assert.ok(!text.includes(t), `no ${t}`);
  assert.ok(await page.locator(".gs-row").count() <= 24, "trimmed");
  await page.click(".gs-show[data-demo='speed']"); await page.waitForTimeout(1800);
  assert.match(await page.evaluate(() => location.hash), /#\/song\//);
  assert.ok(await page.locator(".coach").count() >= 1, "the tip points at the time");
});
test("2.6.5 speed dial: a wobble doesn't change it; Undo restores; nothing selectable", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: LIB.songs.map(s => s.id === "a" ? { ...s, duration: 200 } : s) });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(400);
  const before = await speedText(page);
  await openSpeed(page);
  const x = 250, y = 700;
  await page.mouse.move(x, y); await page.mouse.down();
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".dial-big")).webkitUserSelect || getComputedStyle(document.querySelector(".dial-big")).userSelect), "none");
  await page.mouse.move(x + 6, y - 8, { steps: 3 }); await page.mouse.up(); await page.waitForTimeout(300);
  if (await page.locator(".dial").count()) { await page.mouse.click(60, 120); await page.waitForTimeout(300); }
  assert.equal(await speedText(page), before, "a small wobble changes nothing");
  await openSpeed(page);
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 60, y - 140, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
  assert.notEqual(await speedText(page), before, "a real sweep changes it");
  assert.match(await page.innerText("#toast"), /Length .*Undo/s);
  await page.click("#toast .tact"); await page.waitForTimeout(300);
  assert.equal(await speedText(page), before, "Undo puts it back");
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
  assert.ok(box.y >= 0 && box.y < 70, `editor at the top, under the title strip (y=${box.y})`);
  assert.ok(bar.y >= box.y + box.height, "bar sits below the editor, not over it");
  assert.ok(await page.locator("#ce-done").isVisible(), "Save stays one tap away while typing");
  await page.keyboard.type("[Verse]\nG\nHello" + "\nline".repeat(60));
  const st = await page.evaluate(() => document.querySelector(".ed-tx").scrollTop);
  assert.ok(st > 0, "the editor follows the caret down");
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(100);
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("writing"))), "writing mode off when the keyboard closes");
});

test("2.13/2.16.4 Library: no Key or Tuning chip in a big library", { skip: skip() }, async t => {
  const keys = ["G", "C", "D", "A", "E", "F"];
  const songs = Array.from({ length: 14 }, (_, i) => ({ id: "k" + i, title: "Song " + i, artist: "A", format: "chords", key: keys[i % 6], tuning: i % 2 ? "dropd" : undefined, body: `[Verse]\n${keys[i % 6]}\nla` }));
  const page = await phone(t, { ...LIB, songs });
  assert.equal(await page.locator("#f-key").count(), 0, "no Key chip");
  assert.equal(await page.locator("#f-tune").count(), 0, "no Tuning chip (2.16.4)");
});

test("tuner 2.16.1: an octave slip on the low E still reads E, and the audio is running", { skip: skip() }, async t => {
  const browser2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => browser2.close());
  const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(FAKE_MIC);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(base); await page.waitForTimeout(400);
  await page.evaluate(d => localStorage.setItem("tabs-v1", JSON.stringify(d)), { ...LIB, settings: { ...LIB.settings, tipsSeen: { ...LIB.settings.tipsSeen, tuner: true }, micExplained: true } });
  await page.reload(); await page.waitForTimeout(300);
  await page.goto(base + "#/library"); await page.waitForSelector("#tunerbtn"); /* 4.0.0: the Road has no header */
  await page.click("#tunerbtn"); await page.waitForTimeout(600);
  const read = () => page.evaluate(() => ({ note: document.getElementById("tn-n").textContent, say: document.getElementById("tn-say").textContent }));
  await page.evaluate(() => { window.__hz = 82.41 * 2 * 2 ** (-20 / 1200); }); await page.waitForTimeout(800);
  const r = await read();
  assert.equal(r.note, "E"); assert.equal(r.say, "Tighten the E string", "read as the low E, 20 cents flat, not a far-off note");
  await page.click("#tn-done");
  assert.deepEqual(errors, []);
});

test("2.19.1 Library: the Recent cards show (the ring's styles had been hiding them)", { skip: skip() }, async t => {
  const now = Date.now();
  const songs = ["One", "Two", "Three", "Four"].map((title, i) => ({ id: "r" + i, title, artist: "A", format: "chords", body: "[Verse]\nG C\nla", opened: now - i * 60000 }));
  const page = await phone(t, { ...LIB, songs, sets: [], settings: { ...LIB.settings } }, { isMobile: true });
  const shown = await page.evaluate(() => [...document.querySelectorAll(".recent .rc")].map(el => el.offsetParent !== null && el.getBoundingClientRect().height > 20));
  assert.deepEqual(shown, [true, true], "two Recent cards, visible");
});

test("2.30.1: editing or adding a song hides Play", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { isMobile: true });
  await page.click("#add"); await page.waitForTimeout(700);
  await page.mouse.click(200, 300); await page.waitForTimeout(700);
  assert.equal(await page.evaluate(() => { const f = document.getElementById("fp"); return !f || getComputedStyle(f).display === "none"; }), true, "no Play on the new song page");
  assert.equal(await page.locator("#play").isVisible(), false);
});

test("2.33.0: writing mode keeps the song in view: a strip with title, artist and key; Return comes back to the pad", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { isMobile: true });
  await page.click("#add"); await page.waitForTimeout(600);
  await page.focus("#ed-body"); await page.waitForTimeout(400);
  assert.ok(await page.locator("#ed-strip").isVisible(), "the strip shows while writing");
  assert.match(await page.innerText("#ed-strip"), /Add a title/);
  const s = await page.locator("#ed-strip").boundingBox(), p = await page.locator(".ed-tx").boundingBox();
  assert.ok(p.y >= s.y + s.height, "the pad sits below the strip");
  await page.keyboard.type("[Verse]\nG       C\nHello there");
  await page.click("#ed-strip"); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.activeElement.id), "ed-title", "tap the strip: the title");
  await page.keyboard.type("Porch Light"); await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.id), "ed-artist", "Return: the artist");
  await page.keyboard.type("Me"); await page.keyboard.press("Enter"); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => document.activeElement.id), "ed-body", "Return again: back to the pad");
  assert.match(await page.innerText("#ed-strip"), /Porch Light\s*·\s*Me\s*·\s*Key G/);
});

test("the metronome plays a drum beat: kick, snare and hi-hat", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, metronome: true, countIn: false, controls: "bar" } });
  await page.evaluate(() => {
    window.__hits = { osc: 0, noise: 0 };
    const C = window.AudioContext || window.webkitAudioContext;
    const o = C.prototype.createOscillator, n = C.prototype.createBufferSource;
    C.prototype.createOscillator = function () { window.__hits.osc++; return o.call(this); };
    C.prototype.createBufferSource = function () { window.__hits.noise++; return n.call(this); };
  });
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.click(".list .row"); await page.waitForSelector("#play");
  await page.click("#play"); await page.waitForTimeout(1500);
  const h = await page.evaluate(() => window.__hits);
  assert.ok(h.osc >= 2, `kick and snare drums (${h.osc})`);
  assert.ok(h.noise >= 4, `snare and hi-hat noise (${h.noise})`);
  assert.deepEqual(errors, []);
});

test("the bass plays the root of each chord, at the sounding pitch, with the metronome off", { skip: skip() }, async t => {
  const plain = { id: "bs1", title: "Bass Song", artist: "Me", key: "G", format: "chords", bpm: 240, body: "[Verse]\nG   D   Em   C" };
  const capo = { id: "bs2", title: "Capo Bass", artist: "Me", key: "A", format: "chords", bpm: 240, body: "Capo 2 · Strum: D-DU-UDU\n\n[Verse]\nG   D   Em   C" };
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, plain, capo], settings: { ...LIB.settings, metronome: false, bass: true, bassStyle: "root", countIn: false, controls: "bar" } });
  await page.evaluate(() => {
    window.__osc = [];
    const C = window.AudioContext || window.webkitAudioContext, o = C.prototype.createOscillator;
    C.prototype.createOscillator = function () { const n = o.call(this); window.__osc.push(n); return n; };
  });
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  const freqs = async id => {
    await page.evaluate(() => { window.__osc.length = 0; });
    await page.evaluate(i => { location.hash = "#/song/" + i; }, id); await page.waitForSelector("#play");
    await page.click("#play"); await page.waitForTimeout(2700); await page.click("#play");
    return page.evaluate(() => [...new Set(window.__osc.map(n => Math.round(n.frequency.value * 10) / 10))]);
  };
  const low = await freqs("bs1");
  assert.ok(low.includes(98), `a G root at 98 Hz with the metronome off (${low})`);
  assert.ok(low.includes(146.8) && low.includes(82.4), `then D (146.8 Hz) and Em (82.4 Hz), a chord a bar (${low})`);
  const capoed = await freqs("bs2");
  assert.ok(capoed.includes(110), `Capo 2: the G shape sounds an A at 110 Hz (${capoed})`);
  assert.ok(!capoed.includes(98), "the shape's own G is not played");
  await page.evaluate(i => { location.hash = "#/song/" + i; }, "bs1"); await page.waitForSelector("#more");
  await page.click("#more"); await page.click(".menu [data-m='bass']");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.bass === false);
  assert.match(await page.innerText("#toast"), /Bass off/);
  assert.deepEqual(errors, []);
});

test("the bass also plays under a lyric sheet, with the walking line and the metronome on", { skip: skip() }, async t => {
  const song = { id: "bs3", title: "Words Song", artist: "Me", key: "G", format: "chords", bpm: 200, body: "[Verse]\nG       C\nHello there my friend\nD       Em\nSing along with me" };
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, song], settings: { ...LIB.settings, metronome: true, bass: true, bassStyle: "walk", countIn: false, controls: "bar" } });
  await page.evaluate(() => {
    window.__osc = [];
    const C = window.AudioContext || window.webkitAudioContext, o = C.prototype.createOscillator;
    C.prototype.createOscillator = function () { const n = o.call(this); window.__osc.push(n); return n; };
  });
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.evaluate(() => { location.hash = "#/song/bs3"; }); await page.waitForSelector("#play");
  await page.click("#play"); await page.waitForTimeout(1800); await page.click("#play");
  const f = await page.evaluate(() => [...new Set(window.__osc.map(n => Math.round(n.frequency.value * 10) / 10))]);
  assert.ok(f.includes(98), `the first chord's root is played (${f})`);
  assert.ok(f.some(x => x > 98 && x < 200), "and the walk moves to other notes");
  assert.deepEqual(errors, []);
});

test("a song's groove is found once, used for the song, and changed in Edit", { skip: skip() }, async t => {
  const song = { id: "gv", title: "Slow Blues", artist: "Me", key: "G", format: "chords", bpm: 100, body: "[Verse]\nG   C   G   D" };
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, song], settings: { ...LIB.settings, metronome: true, countIn: false, controls: "bar" } });
  let asks = 0;
  await page.route("https://api.anthropic.com/**", r => {
    if (!/session drummer/.test(r.request().postData() || "")) asks++;
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text: '{"beat": "half", "swing": "light", "bass": "walk"}' }], stop_reason: "end_turn" }) });
  });
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-test"));
  const groove = () => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "gv").groove);
  await page.evaluate(() => { location.hash = "#/song/gv"; }); await page.waitForSelector("#play");
  await page.click("#play");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "gv").groove, null, { timeout: 5000 });
  assert.deepEqual(await groove(), { src: "ai", beat: "half", swing: "light", bass: "walk" });
  assert.match(await page.innerText("#toast"), /Groove: Half time, light swing, walking bass/);
  await page.click("#play"); await page.click("#play"); await page.click("#play");
  assert.equal(asks, 1, "asked once; a song with a groove is not looked up again");
  await page.click("#more"); await page.click(".menu [data-m='edit']"); await page.waitForSelector("#ed-g-beat");
  assert.match(await page.innerText(".ed-chips"), /Drums\s*Half time\s*Found/);
  const saved = src => page.waitForFunction(w => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "gv").groove?.src === w, src);
  await page.selectOption("#ed-g-beat", "rock"); await saved("you");
  assert.deepEqual(await groove(), { src: "you", beat: "rock", swing: "light", bass: "walk" });
  await page.selectOption("#ed-g-swing", ""); await page.waitForSelector("#ed-g-bass");
  await page.selectOption("#ed-g-bass", ""); await page.waitForSelector("#ed-g-beat");
  await page.selectOption("#ed-g-beat", "");
  await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "gv").groove).length === 1);
  assert.deepEqual(await groove(), { src: "you" }, "all defaults: kept, and not looked up again");
  assert.match(await page.innerText(".ed-chips"), /Drums\s*Default/);
  assert.ok(await page.$("#ed-g-find"), "Find again is there with a key");
});

test("drums that fit the song: written once by the AI, played per section, busier or simpler in Practice", { skip: skip() }, async t => {
  const song = { id: "dr1", title: "Drum Song", artist: "Me", key: "G", format: "chords", bpm: 120, status: "learning", body: "[Verse]\nG   C   G   D\n\n[Chorus]\nC   G   D   G" };
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, song], settings: { ...LIB.settings, metronome: true, countIn: false, controls: "bar" } });
  const bars = { verse: { kick: "x.......x.......", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x." }, chorus: { kick: "X.x.....X.x.....", snare: "....X.......X...", hat: "xxxxxxxxxxxxxxxx" }, fill: { kick: "x...............", snare: "....x.x.xxxxXXXX", hat: "x..............." } };
  let drumAsks = 0, sent = "";
  await page.route("https://api.anthropic.com/**", r => {
    const body = r.request().postData() || "";
    if (/session drummer/.test(body)) { drumAsks++; sent = body; }
    const text = /session drummer/.test(body) ? (drumAsks === 1 ? "sorry, no" : JSON.stringify(bars)) : "{}";
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }) });
  });
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-test"));
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.evaluate(() => { location.hash = "#/song/dr1"; }); await page.waitForSelector("#play");
  assert.equal(await page.$("#lp-drums"), null, "no Drums chip before they are written");
  await page.click("#play");
  await page.waitForTimeout(1200);
  await page.click("#play"); await page.waitForTimeout(300);
  assert.ok(!(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "dr1").drums)), "the first answer was unusable");
  await page.waitForSelector("#lp-drums-new");
  assert.match(await page.innerText("#lp-drums-new"), /Write drums/, "the Practice row offers to write them");
  await page.click("#lp-drums-new");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "dr1").drums, null, { timeout: 5000 });
  assert.match(sent, /Parts: verse, chorus/, "the sheet's sections are sent");
  assert.doesNotMatch(sent, /G   C   G   D/, "the sheet itself is not sent");
  const d = () => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "dr1").drums);
  assert.deepEqual((await d()).chorus, bars.chorus);
  await page.waitForTimeout(600);
  await page.click("#play"); await page.waitForTimeout(200);
  await page.waitForSelector("#lp-drums");
  assert.match(await page.innerText("#lp-drums"), /Drums: as written/);
  await page.click("#lp-drums"); await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "dr1").drums.level === 1);
  assert.match(await page.innerText("#lp-drums"), /busier/);
  await page.click("#lp-drums"); await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "dr1").drums.level === -1);
  await page.click("#lp-drums"); await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "dr1").drums.level === undefined);
  await page.click("#play"); await page.waitForTimeout(400); await page.click("#play");
  assert.equal(drumAsks, 2, "one miss, then written once");
  assert.deepEqual(errors, []);
});

test("a bass riff: drawn in Edit, kept on the song, and played on each chord", { skip: skip() }, async t => {
  const song = { id: "rf1", title: "Riff Song", artist: "Me", key: "G", format: "chords", bpm: 240, body: "[Verse]\nG   G   G   G" };
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, song], settings: { ...LIB.settings, metronome: false, bass: true, countIn: false, controls: "bar" } });
  await page.evaluate(() => {
    window.__osc = [];
    const C = window.AudioContext || window.webkitAudioContext, o = C.prototype.createOscillator;
    C.prototype.createOscillator = function () { const n = o.call(this); window.__osc.push(n); return n; };
  });
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  const groove = () => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "rf1").groove);
  await page.evaluate(() => { location.hash = "#/song/rf1"; }); await page.waitForSelector("#play");
  await page.click("#more"); await page.click(".menu [data-m='edit']"); await page.waitForSelector("#ed-g-bass");
  await page.selectOption("#ed-g-bass", "riff"); await page.waitForSelector(".rf-c");
  assert.equal((await page.$$(".rf-c")).length, 16, "sixteen steps");
  assert.equal(await page.innerText(".rf-c[data-k='0']"), "1", "a root on the beat to start from");
  for (let i = 0; i < 3; i++) await page.click(".rf-c[data-k='8']"); /* rest, root, third, fifth */
  assert.equal(await page.innerText(".rf-c[data-k='8']"), "5");
  await page.click("#rf-play"); await page.click("#rf-ok");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "rf1").groove?.riff);
  assert.deepEqual(await groove(), { src: "you", bass: "riff", riff: "1.......5......." });
  assert.ok(await page.$("#ed-g-riff"), "Edit riff is there");
  await page.click("#ed-g-riff"); await page.waitForSelector(".rf-c");
  assert.equal(await page.innerText(".rf-c[data-k='8']"), "5", "the riff opens as it was saved");
  await page.click("#rf-scrim");
  await page.evaluate(() => { window.__osc.length = 0; });
  await page.evaluate(() => { location.hash = "#/library"; }); await page.waitForSelector(".list .row");
  await page.evaluate(() => { location.hash = "#/song/rf1"; }); await page.waitForSelector("#play");
  await page.click("#play"); await page.waitForTimeout(1300); await page.click("#play");
  const f = await page.evaluate(() => [...new Set(window.__osc.map(n => Math.round(n.frequency.value * 10) / 10))]);
  assert.ok(f.includes(98) && f.includes(146.8), `the riff plays the root (98 Hz) and the fifth (146.8 Hz) of G (${f})`);
  assert.deepEqual(errors, []);
});

test("Settings: the metronome's switch, volume and sound; a song with no tempo gets one", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, countIn: false, controls: "bar" } });
  await page.route("https://api.anthropic.com/**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text: '{"bpm": 120, "beats": 4}' }], stop_reason: "end_turn" }) }));
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-test"));
  await page.evaluate(() => { location.hash = "#/settings/playing"; }); await page.waitForSelector("#s-metro");
  await page.click("#s-metro");
  await page.$eval("#s-metvol", el => { el.value = 40; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); });
  await page.click("#s-metsound [data-m='click']");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.metroSound === "click");
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings);
  assert.equal(s.metronome, true); assert.equal(s.metroVol, 0.4); assert.equal(s.metroSound, "click");
  assert.equal(await page.getAttribute("#s-metsound [data-m='click']", "aria-pressed"), "true");
  assert.equal(await page.$("#s-metbeat"), null, "the drum beat and swing only show with Drums");
  await page.click("#s-metsound [data-m='drums']"); await page.waitForSelector("#s-metbeat");
  await page.selectOption("#s-metbeat", "half"); await page.click("#s-metswing [data-m='light']"); await page.click("#s-metdrop");
  await page.click("#s-bass");
  assert.equal(await page.getAttribute("#s-bass", "aria-checked"), "true");
  await page.selectOption("#s-bassstyle", "walk"); await page.click("#s-bassonly");
  await page.click("#s-metsound [data-m='click']");
  await page.waitForFunction(() => { const x = JSON.parse(localStorage.getItem("tabs-v1")).settings; return x.metroDrop === true && x.bassOnly === true && x.metroSound === "click"; });
  const s2 = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings);
  assert.equal(s2.bass, true); assert.equal(s2.bassStyle, "walk"); assert.equal(s2.bassOnly, true);
  assert.equal(s2.metroBeat, "half"); assert.equal(s2.metroSwing, "light"); assert.equal(s2.metroSound, "click");
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => !x.bpm)?.id);
  assert.ok(id, "a test song without a tempo");
  await page.evaluate(i => { location.hash = "#/song/" + encodeURIComponent(i); }, id); await page.waitForSelector("#play");
  await page.click("#play");
  await page.waitForFunction(i => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === i).bpm === 120, id, { timeout: 5000 });
  assert.match(await page.innerText("#toast"), /Tempo found: 120 BPM/);
});

test("Remove the capo: a chart's capo comes off and the chords move to the key it sounds in", { skip: skip() }, async t => {
  const song = { id: "cp", title: "Capo Song", artist: "Me", key: "A", format: "chords", body: "Capo 2 · Strum: D-DU-UDU\n\n[Verse]\nG   D   Em   C" };
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, song], settings: { ...LIB.settings, controls: "bar" } });
  await page.evaluate(() => { location.hash = "#/song/cp"; }); await page.waitForSelector("#sheet");
  const chords = () => page.$$eval("#sheet .c", els => els.map(e => e.textContent.trim()).filter(Boolean));
  const before = await chords();
  await page.click("#more"); await page.click(".menu [data-m='capo']"); await page.waitForTimeout(300);
  const after = await chords();
  assert.match(await page.innerText("#sheet"), /No capo \(Capo 2 taken off\)/);
  assert.ok(before.includes("G") && after.includes("A") && after.includes("F#m"), `G D Em C becomes A E F#m D (${before} → ${after})`);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "cp").capoOff, true);
  await page.click("#more"); await page.click(".menu [data-m='capo']"); await page.waitForTimeout(300);
  assert.deepEqual(await chords(), before, "and back");
});

test("Tour Map: on by default on plain ground, no location or map pictures until you plant your flag; pinch and drag go to the map", { skip: skip() }, async t => {
  const day = new Date().toISOString().slice(0, 10);
  const songs = LIB.songs.map(s => ({ ...s, playLog: { total: 5, last: Date.now(), days: { [day]: 5 } } }));
  const page = await phone(t, { ...LIB, songs }, { geolocation: { latitude: 40.71278, longitude: -74.00594 }, permissions: [] });
  const tiles = []; const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==", "base64");
  await page.route(/tile\.openstreetmap\.org/, r => { tiles.push(r.request().url()); r.fulfill({ contentType: "image/png", body: png }); });
  await page.evaluate(() => { window.__asked = 0; const g = navigator.geolocation, f = g.getCurrentPosition.bind(g); g.getCurrentPosition = (...a) => { window.__asked++; return f(...a); }; });
  await page.evaluate(() => { location.hash = "#/playmap"; });
  await page.waitForSelector(".tm-map svg path", { state: "attached" });
  assert.equal(await page.evaluate(() => document.body.classList.contains("tm-open")), true, "the page is locked while the map is open");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".tm-page")).touchAction), "none");
  await page.waitForSelector("#tm-venue:not([hidden])");
  assert.equal(await page.locator(".tm-bd.you").count(), 1, "the scene board ranks you with the rivals");
  assert.match(await page.textContent("#tm-sbody"), /You hold \d+ hexagon/);
  assert.ok(await page.locator(".tm-rival").count() >= 4, "rival players have turf around you");
  assert.match(await page.innerText(".tm-venue"), /Open mic · \d+ plays? to the Coffeehouse/);
  assert.ok(await page.locator(".tm-map path").count() >= 3, "fog, glow and outline are drawn");
  assert.equal(tiles.length, 0, "no map pictures before a spot");
  assert.equal(await page.evaluate(() => window.__asked), 0, "no location asked");
  const z0 = await page.evaluate(() => document.querySelector(".tm-map .leaflet-proxy")?.style.transform);
  await page.click("#tm-in"); await page.waitForTimeout(400);
  assert.notEqual(await page.evaluate(() => document.querySelector(".tm-map .leaflet-proxy")?.style.transform), z0, "zoom buttons move the map");
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/tm-plain.png" });
  await page.click("#tm-flag"); await page.waitForSelector("#pf-go");
  assert.equal(await page.evaluate(() => window.__asked), 0, "the explanation comes first");
  await page.context().grantPermissions(["geolocation"], { origin: new URL(page.url()).origin });
  await page.click("#pf-go");
  await page.waitForSelector("#tm-forget");
  await page.waitForFunction(n => window.__asked > 0, 0);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs.spot.v1"))), { lat: 40.71, lon: -74.01 });
  assert.equal(await page.evaluate(() => localStorage.getItem("tabs-v1").includes("40.71")), false, "not in the library");
  await page.waitForFunction(() => document.querySelectorAll(".tm-map img.leaflet-tile").length > 0);
  assert.ok(tiles.every(u => /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(u)));
  if (process.env.SHOT) { await page.waitForTimeout(500); await page.screenshot({ path: process.env.SHOT + "/tm-spot.png" }); }
  await page.click(".tm-sh-t"); await page.waitForFunction(() => document.getElementById("tm-sheet").dataset.state === "open");
  await page.click("#tm-forget"); await page.waitForSelector("#tm-flag");
  assert.equal(await page.evaluate(() => localStorage.getItem("tabs.spot.v1")), null);
  await page.click("#back"); await page.waitForFunction(() => !document.body.classList.contains("tm-open"));
});

test("A run that stops early is not a play", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, countIn: false } });
  await page.click(".list .row"); await page.waitForSelector("#play");
  await page.click("#play"); await page.waitForTimeout(1500); await page.click("#play");
  await page.waitForFunction(() => document.getElementById("play")?.getAttribute("aria-label") === "Start auto-scroll");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.every(s => !s.playLog?.total)), true);
});

test("The Road is home (4.0.0): stat bar, leg banner, the path with its current stop open, Louie, the Library drawer and the tab bar", { skip: skip() }, async t => {
  const y = new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
  const songs = LIB.songs.map(s => ({ ...s, playLog: { total: 3, last: Date.now() - 86400e3, days: { [y]: 1 } } }));
  const page = await phone(t, { ...LIB, songs }, { home: true });
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/road.png" });
  await page.waitForSelector(".rd-path");
  assert.equal(await page.locator(".hud #h-streak").count(), 1, "the stat bar has the streak");
  assert.match(await page.innerText("#h-fans"), /\d/, "and your fans");
  assert.match(await page.innerText(".rd-banner"), /LEG 1[\s\S]*Open chords/);
  assert.equal(await page.locator(".rd-node.now").count(), 1, "one current stop");
  assert.match(await page.innerText(".rd-pop.now"), /The G chord[\s\S]*START/, "its card is open");
  assert.ok(await page.locator(".rd-say svg.louie").count() === 1, "Louie beside the path");
  assert.equal(await page.locator(".rd-node.headline").count() >= 1, true, "each leg ends in a headline show");
  assert.equal(await page.locator(".rd-node.box").count() >= 1, true, "with merch boxes along the way");
  /* another stop's card opens on a tap, and the current one closes */
  await page.click(".rd-node.locked >> nth=0");
  assert.match(await page.innerText(".rd-pop"), /Finish the stops before this one/);
  /* tonight's song plays as a gig (4.1.0) */
  await page.click("#rd-tonight");
  await page.waitForSelector("#gig");
  assert.ok(await page.evaluate(() => /#\/song\//.test(location.hash)));
  await page.click("#gg-x");
  await page.waitForFunction(() => !document.getElementById("gig"));
  assert.match(await page.evaluate(() => location.hash), /#\/song\//, "4.2.0: leaving the show goes to the song, paused");
  await page.click(".shead .sh-back");
  await page.waitForSelector(".rd-path");
  assert.equal(await page.evaluate(() => location.hash), "#/", "and Back goes to the Road");
  /* the Library drawer: the Road never scrolls, the drawer opens by tap or drag, closes by drag, scrim or handle */
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, "the Road does not scroll");
  assert.match(await page.innerText("#rd-dh"), /Library/);
  const state = () => page.getAttribute("#rd-drawer", "data-state");
  assert.equal(await state(), "closed");
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("rd-dbody")).opacity), "0", "shut, none of the Library shows");
  const drag = (sel, from, to) => page.evaluate(([sel, from, to]) => {
    const el = document.querySelector(sel), t = y => new Touch({ identifier: 1, target: el, clientX: 200, clientY: y });
    el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [t(from)] }));
    for (let i = 1; i <= 6; i++) el.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [t(from + (to - from) * i / 6)] }));
    el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [] }));
  }, [sel, from, to]);
  await drag("#rd-dh", 700, 300); await page.waitForFunction(() => document.querySelector("#rd-drawer").dataset.state === "open");
  await page.waitForFunction(() => document.querySelector("#rd-drawer").getBoundingClientRect().top < 80, null, { timeout: 3000 });
  assert.ok(await page.locator("#list .row").first().isVisible(), "the real Library list is inside");
  await drag("#rd-dh", 100, 500); await page.waitForFunction(() => document.querySelector("#rd-drawer").dataset.state === "closed");
  await page.click("#rd-dh"); await page.waitForFunction(() => document.querySelector("#rd-drawer").dataset.state === "open");
  await page.mouse.click(195, 20); await page.waitForFunction(() => document.querySelector("#rd-drawer").dataset.state === "closed");
  assert.equal(await page.evaluate(() => location.hash), "#/", "the drawer never leaves the Road");
  /* the tab bar: Road is current; Tour has its quests (4.5.0); Charts (4.6.0); Your band (4.7.0); More reaches Settings; the current stop's Start opens its lesson */
  assert.equal(await page.getAttribute("#tabs [data-tab=road]", "aria-current"), "page");
  await page.click("#tabs [data-tab=tour]"); await page.waitForSelector(".tq-head");
  assert.match(await page.innerText(".tq-head"), /Tour[\s\S]*Play 20 shows[\s\S]*2 \/ 20/, "this month's plays count toward the tour");
  assert.match(await page.innerText(".tq-req"), /REQUEST LINE[\s\S]*asked for/);
  assert.equal(await page.locator(".tq-card .tq-row").count(), 4, "three setlist goals and the duet quest");
  await page.click("#tabs [data-tab=charts]"); await page.waitForSelector(".ch-head");
  assert.match(await page.innerText(".ch-head"), /Garage Chart/, "4.6.0: Charts start at the Garage");
  assert.equal(await page.locator(".ch-row").count(), 10);
  assert.match(await page.innerText(".ch-row.you"), /You\s*\d+ XP/, "your XP this week");
  await page.click("#ch-go"); await page.waitForSelector(".bt");
  assert.match(await page.innerText(".bt"), /wants your spot[\s\S]*TAKE THE STAGE/);
  await page.click("#bt-no"); await page.waitForSelector(".ch-head");
  await page.click("#tabs [data-tab=band]"); await page.waitForSelector(".bd-head");
  const joined = +(await page.innerText(".bd-head")).match(/(\d+) OF 18 JOINED/)[1];
  assert.ok(joined >= 1, "4.7.0: Lola joins after your first song");
  assert.equal(await page.locator(".bd-card.locked").count(), 18 - joined);
  assert.match(await page.innerText(".bd-next"), /NEXT TO JOIN[\s\S]*more song/);
  await page.click("#tabs [data-tab=road]"); await page.waitForSelector(".rd-pop.now");
  await page.click(".rd-pop.now .rd-start"); await page.waitForFunction(() => location.hash === "#/practice/c%3AG");
  await page.evaluate(() => { location.hash = "#/"; }); await page.waitForSelector(".rd-path");
  await page.click("#tabs [data-tab=more]"); await page.click("#m-set"); await page.waitForFunction(() => location.hash === "#/settings");
  await page.waitForFunction(() => !document.body.classList.contains("tabbed"), null, { timeout: 3000 }); /* no tab bar in Settings */
});

test("The Road on a new library: Louie waves and the first song is ready to play", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: LIB.songs.map(s => ({ ...s, playLog: undefined })) }, { home: true });
  await page.waitForSelector(".rd-path");
  assert.match(await page.innerText("#rd-bubble"), /first song/i);
  assert.match(await page.innerText("#rd-tonight"), /Gig: /);
});

test("Tour Map: the scene sheet says how many songs and minutes take a rival corner, pulls up for the details and the scene, and Play starts the song", { skip: skip() }, async t => {
  const page = await phone(t, LIB);
  await page.evaluate(() => { location.hash = "#/playmap"; });
  await page.waitForSelector("#tm-take-go");
  assert.match(await page.innerText("#tm-take"), /Take \S+'s corner\s*(One song|\d+ songs) · about \d+ min/);
  assert.equal(await page.getAttribute("#tm-sheet", "data-state"), "closed");
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("tm-sbody")).opacity), "0", "the details stay hidden until the sheet is pulled up");
  await page.click(".tm-sh-t"); await page.waitForFunction(() => document.getElementById("tm-sheet").dataset.state === "open");
  assert.match(await page.innerText("#tm-sbody"), /Start with[\s\S]*minutes a day[\s\S]*You hold/i);
  if (process.env.SHOT) { await page.waitForTimeout(500); await page.screenshot({ path: process.env.SHOT + "/scene-open.png" }); }
  await page.click(".tm-sh-t"); await page.waitForFunction(() => document.getElementById("tm-sheet").dataset.state === "closed");
  if (process.env.SHOT) { await page.waitForTimeout(500); await page.screenshot({ path: process.env.SHOT + "/scene-closed.png" }); }
  await page.click("#tm-take-go");
  await page.waitForFunction(() => /#\/song\//.test(location.hash));
});

test("4.0.1: one design system: buttons, chips, sheets and the editor's title field share the version 4 look", { skip: skip() }, async t => {
  const page = await phone(t);
  const look = sel => page.evaluate(s => { const c = getComputedStyle(document.querySelector(s)); return { r: c.borderTopWidth, f: c.fontFamily }; }, sel);
  await page.evaluate(() => { location.hash = "#/settings"; }); await page.waitForSelector(".btn.primary");
  assert.match((await look(".btn.primary")).f, /Fredoka/, "the main button is set in Fredoka");
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#stat");
  assert.equal((await look("#stat")).r, "2px", "chips have the 2px rim");
  assert.match((await look("#stat")).f, /Fredoka/);
  await page.evaluate(() => document.querySelector("#more").click()); await page.waitForSelector(".menu");
  assert.equal((await look(".menu")).r, "2px", "menus have the 2px rim");
  await page.evaluate(() => { location.hash = "#/edit/a"; }); await page.waitForSelector("#ed-title");
  assert.ok(await page.evaluate(() => document.getElementById("ed-title").getBoundingClientRect().width > 200), "the title field has room (the artist line sits below it)");
});

test("The Gig (4.1.0, 4.2.0): Play opens the show, graded by strums; paused it holds in place with Tools; Show complete", { skip: skip() }, async t => {
  const browser2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => browser2.close());
  const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(FAKE_MIC);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(base + "#/library"); await page.waitForTimeout(300);
  const body = "[Verse]\nA        D\nWalking down the road\nE        A\nLantern in my hand\n\n[Chorus]\nD        A\nCarry me home\nE        A\nLay me down";
  await page.evaluate(d => localStorage.setItem("tabs-v1", JSON.stringify(d)), { ...LIB, songs: [{ id: "g", title: "Short Road", artist: "Me", key: "A", format: "chords", duration: 16, body }], settings: { ...LIB.settings, gigLines: 4, plainPlay: false } });
  await page.goto(base + "#/song/g"); await page.reload(); await page.waitForTimeout(600);
  await page.evaluate(() => { setInterval(() => { window.__hz = 110; setTimeout(() => { window.__hz = 0; }, 90); }, 400); });
  assert.equal(await page.getAttribute("#play", "aria-label"), "Play as a gig");
  await page.click("#play");
  await page.waitForSelector("#gig");
  assert.equal(await page.getAttribute("#gig", "data-lines"), "4", "four lines of the song");
  assert.ok(await page.locator("#gg-lines > *").count() <= 4);
  assert.equal(await page.locator(".gg-map i").count(), 2, "the song map: a gel for each section");
  assert.equal(await page.locator("#gg-lc").count(), 0, "4.2.0: Lines moved to Tools");
  /* Hearing you: a tap stops listening for this show, another starts it again */
  await page.waitForFunction(() => /Hearing you/.test(document.getElementById("gg-mic").getAttribute("aria-label")));
  await page.click("#gg-mic");
  assert.match(await page.getAttribute("#gg-mic", "aria-label"), /Not listening/);
  await page.click("#gg-mic");
  await page.waitForFunction(() => /Hearing you/.test(document.getElementById("gg-mic").getAttribute("aria-label")));
  /* Paused, the show holds in place: the line you stopped on, Back a line, Tools, Sheet, Resume */
  await page.click("#gg-pause");
  await page.waitForSelector("#gg-hold:not([hidden])");
  assert.equal(await page.locator("#gg-hline > *").count(), 1, "the line you stopped on");
  await page.click("#gg-tools"); await page.waitForSelector(".menu.tools");
  assert.equal(await page.locator('.menu [data-m="edit"]').count(), 0, "from a show, only what you change mid-song");
  await page.click('.menu [data-lines="5"]');
  await page.waitForSelector('#gig[data-lines="5"]', { timeout: 3000 });
  assert.equal(await page.innerText(".menu [data-lines].on"), "5", "4.2.3: the picked count lights up");
  await page.mouse.click(200, 120); await page.waitForTimeout(200);
  assert.equal(await page.locator(".menu").count(), 0, "a tap above Tools closes it");
  assert.equal(await page.locator("#gig.paused").count(), 1, "and the show stays paused");
  await page.click("#gg-resume");
  await page.waitForSelector("#gg-hold[hidden]", { state: "attached" });
  await page.waitForFunction(() => document.getElementById("gg-sec").textContent === "CHORUS", null, { timeout: 15000 });
  assert.equal(await page.getAttribute("#gig", "data-gel"), "chorus", "the stage washes into the chorus gel");
  await page.waitForSelector(".gc", { timeout: 40000 });
  assert.match(await page.innerText(".gc-t"), /Show complete/);
  assert.match(await page.innerText(".gc-list"), /changes landed/, "the show was graded");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")));
  assert.equal(saved.gig.shows, 1); assert.ok(saved.gig.best.g >= 0);
  assert.equal(saved.settings.gigLines, 5);
  assert.equal(saved.songs[0].playLog.total, 1, "the show counts as a play");
  await page.click("#gc-go"); await page.waitForFunction(() => !document.getElementById("gig"));
  assert.match(await page.innerText(".shead .meta"), /Best show \d+%/, "the song shows its best show");
  await page.click("#play"); await page.waitForSelector("#gig:not(.done)");
  await page.click("#gg-pause"); await page.waitForSelector("#gg-hold:not([hidden])");
  await page.click("#gg-sheet"); await page.waitForFunction(() => !document.getElementById("gig"));
  assert.equal(await page.evaluate(() => location.hash), "#/song/g", "Sheet: back to the song, paused");
  assert.deepEqual(errors, []);
});

test("4.2.2 the Gig moves under a finger: drag the lines or the line you stopped on", { skip: skip() }, async t => {
  const long = { id: "l", title: "Long", artist: "A", key: "G", format: "chords", duration: 300, body: "[Verse]\n" + Array.from({ length: 30 }, (_, i) => `G   C\nLine ${i} of the song`).join("\n") + "\n\n[Chorus]\nD   G\nThe end" };
  const page = await phone(t, { ...LIB, songs: [long], settings: { ...LIB.settings, plainPlay: false, gigScore: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/l"; }); await page.waitForSelector("#play");
  await page.click("#play"); await page.waitForSelector("#gig");
  await page.click("#gg-pause"); await page.waitForSelector("#gg-hold:not([hidden])");
  assert.match(await page.getAttribute("#gg-mic", "aria-label"), /Not listening/, "Score my plays off: the show starts unscored");
  const before = await page.evaluate(() => scrollY), line = await page.innerText("#gg-hline");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 420 }] });
  for (let y = 410; y >= 200; y -= 30) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y }] }); await page.waitForTimeout(16); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForFunction(b => scrollY > b + 150, before);
  await page.waitForFunction(l => document.getElementById("gg-hline").innerText !== l, line);
  assert.equal(await page.locator("#gig.paused").count(), 1, "still paused");
});

test("4.4.0 Full: the Gig as a strip over the whole song page, which scrolls under a finger", { skip: skip() }, async t => {
  const long = { id: "l", title: "Long", artist: "A", key: "G", format: "chords", duration: 300, body: "[Verse]\n" + Array.from({ length: 30 }, (_, i) => `G   C\nLine ${i} of the song`).join("\n") + "\n\n[Chorus]\nD   G\nThe end" };
  const page = await phone(t, { ...LIB, songs: [long], settings: { ...LIB.settings, plainPlay: false, gigScore: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/l"; }); await page.waitForSelector("#play");
  await page.click("#more"); await page.click('.menu [data-lines="full"]');
  assert.equal(await page.innerText(".menu [data-lines].on"), "Full");
  await page.mouse.click(200, 100); await page.waitForTimeout(200);
  await page.click("#play"); await page.waitForSelector("#gig");
  assert.equal(await page.getAttribute("#gig", "data-lines"), "full");
  assert.ok(await page.evaluate(() => document.body.classList.contains("gig-full")), "the page shows");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".app.viewer .dock")).visibility), "hidden", "the show's bar replaces the song's");
  await page.waitForFunction(() => /→/.test(document.getElementById("gg-mini").textContent), null, { timeout: 5000 });
  await page.click("#gg-pause"); await page.waitForSelector("#gg-hold:not([hidden])");
  const before = await page.evaluate(() => scrollY);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 500 }] });
  for (let y = 490; y >= 250; y -= 30) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y }] }); await page.waitForTimeout(16); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForFunction(b => scrollY > b + 100, before);
  await page.click("#gg-tools"); await page.click('.menu [data-lines="5"]');
  await page.waitForFunction(() => !document.body.classList.contains("gig-full"), null, { timeout: 3000 });
  await page.mouse.click(200, 100); await page.waitForTimeout(200);
  await page.click("#gg-sheet"); await page.waitForFunction(() => !document.getElementById("gig"));
  assert.equal(await page.evaluate(() => document.body.classList.contains("gig-full")), false);
});
