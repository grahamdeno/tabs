// Browser tests, part 3 of app.e2e (split so files run side by side).
// Run: node --test tests/e2e/   (needs Playwright: npm i --no-save playwright && npx playwright install chromium)
// They catch what unit tests can't: the app failing to load, screens not
// rendering, taps doing the wrong thing.

import test from "node:test";
import assert from "node:assert/strict";
import { chromium, base, phone, skip, LIB, FAKE_MIC, useBrowser, until, settled, openSpeed, speedText, tool } from "./harness.mjs";

useBrowser();


test("3.19.0 in a set, 4 of 9 is in the bar; playing folds it away with the rest; iPad keeps the bar", { skip: skip() }, async t => {
  const songs = [...LIB.songs.map(x => x.id === "a" ? { ...x, duration: 900 } : x), { id: "x0", title: "One", artist: "Y", format: "chords", body: "[Verse]\nG C\nla" }];
  const page = await phone(t, { ...LIB, songs, sets: [{ id: "s", name: "Gig", songIds: ["a", "x0"] }], settings: { ...LIB.settings, countIn: false } });
  await page.goto(base + "#/set/s"); await page.waitForSelector("[data-open='0']");
  await page.click("[data-open='0']"); await page.waitForSelector('#setdial'); await settled(page);
  assert.match(await page.innerText("#setdial"), /1 of 2/, "4 of 9 sits in the bar");
  assert.ok(await page.locator("#setdial").isVisible());
  await page.click("#play"); await page.waitForFunction(() => document.body.classList.contains('fold'));
  assert.equal(await page.locator("#setdial").isVisible(), false, "folded away while playing");
  assert.match(await page.innerText("#fp-nav"), /One\s*2 of 2/, "3.20.0: beside Play, the next song in the set");
  await page.click("#fp-nav"); await page.waitForFunction(() => /One/.test(document.querySelector('.song-title')?.innerText || ''));
  assert.match(await page.innerText(".song-title"), /One/, "a tap moves on to it");

  const pad = await phone(t, { ...LIB, settings: { ...LIB.settings, countIn: false } }, { viewport: { width: 1180, height: 820 } });
  await pad.goto(base + "#/song/a"); await pad.waitForSelector("#play"); await settled(pad);
  await pad.click("#play"); await pad.waitForFunction(() => document.getElementById("play").getAttribute("aria-label") === "Pause auto-scroll");
  assert.equal(await pad.evaluate(() => document.body.classList.contains("fold")), false, "iPad: the bar stays");
  assert.equal(await pad.evaluate(() => document.getElementById("play").closest(".player") !== null), true, "iPad: Play in the bar");
});
test("4.15.0: the section rail is always there; Stage mode and the old toggles are gone from Settings", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, songMap: false, stage: true, pauseDiagrams: false } });
  await page.goto(base + "#/song/a"); await page.waitForSelector(".smap");
  assert.equal(await page.evaluate(() => document.body.classList.contains("stage")), false, "no stage look");
  await page.goto(base + "#/settings/playing"); await page.waitForSelector("#s-focus");
  assert.equal(await page.locator("#s-stage, #s-map, #s-pause, #s-diagrams").count(), 0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings);
  assert.equal("stage" in saved || "songMap" in saved || "pauseDiagrams" in saved, false, "dropped from saves");
});

test("2.5 Back: beside the title (4.2.0); pull down at the top; the library opens at its top", { skip: skip() }, async t => {
  const songs = Array.from({ length: 30 }, (_, i) => ({ id: "s" + i, title: "Song " + String(i).padStart(2, "0"), artist: "A", format: "chords", body: "[Verse]\nG C\nla" }));
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, ...songs] }, { isMobile: true });
  await page.evaluate(() => scrollTo(0, 1500)); await page.waitForFunction(() => scrollY >= 1000);
  await page.evaluate(() => { location.hash = "#/song/s25"; }); await page.waitForSelector('.shead .sh-back');
  const b = await page.evaluate(() => { const el = document.querySelector(".shead .sh-back"), r = el.getBoundingClientRect(); return { x: r.left, y: r.top, v: getComputedStyle(el).display }; });
  assert.ok(b.y < 100 && b.v !== "none", `4.2.0: Back sits beside the title (${JSON.stringify(b)})`);
  await page.click(".shead .sh-back"); await page.waitForFunction(() => location.hash === '#/library' && scrollY === 0);
  assert.equal(await page.evaluate(() => location.hash), "#/library");
  assert.equal(await page.evaluate(() => scrollY), 0, "the library opens at its top");
  /* Pull down at the top of a song. */
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector('.metarow'); await settled(page);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: y == null ? [] : [{ x: 150, y }] });
  await touch("touchStart", 300);
  for (let y = 300; y <= 360; y += 10) { await touch("touchMove", y); await page.waitForTimeout(16); /* real timer */ }
  await touch("touchEnd"); await page.waitForTimeout(400); /* real timer */
  assert.equal(await page.evaluate(() => location.hash), "#/song/a", "a short pull springs back");
  await touch("touchStart", 300);
  for (let y = 300; y <= 420; y += 10) { await touch("touchMove", y); await page.waitForTimeout(16); /* real timer */ }
  assert.match(await page.textContent(".fp-pull"), /Release for Songbook/);
  assert.equal(await page.evaluate(() => document.querySelector(".fp-pull").classList.contains("go")), true);
  await touch("touchEnd"); await page.waitForFunction(() => location.hash === '#/library');
  assert.equal(await page.evaluate(() => location.hash), "#/library", "a full pull goes back");
});


test("Add the words: paste lyrics on a chord chart and the chords go over them", { skip: skip() }, async t => {
  const chart = "[Verse]\nG   D   Em   C\n\n[Chorus]\nC   G   D";
  const page = await phone(t, { ...LIB, songs: [{ id: "c", title: "Chart Song", artist: "X", format: "chords", ai: "chart", body: chart }, ...LIB.songs] });
  await page.goto(base + "#/song/c"); await page.waitForSelector('.metarow');
  await tool(page, "words"); await page.waitForSelector('#ws-text');
  assert.equal(await page.isDisabled("#ws-ok"), true, "nothing to save before words");
  await page.fill("#ws-text", "first line of the verse here\nsecond line goes on\n\n[Chorus]\nthis is the chorus line");
  await page.waitForFunction(() => /first line of the verse here/.test(document.getElementById('ws-prev')?.textContent || ''));
  assert.match(await page.textContent("#ws-prev"), /\[Verse\]\nG\s+D\nfirst line of the verse here/);
  await page.click("#ws-ok"); await page.waitForFunction(() => /this is the chorus line/.test(JSON.parse(localStorage.getItem('tabs-v1')).songs.find(s => s.id === 'c').body));
  const body = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "c").body;
  assert.match(body, /\[Chorus\]\nC\s+G\nthis is the chorus line/);
  assert.match(await page.textContent("#sheet"), /first line of.*chorus line/, "the song page shows the words");
  await page.click("#toast .tact"); await page.waitForFunction(c => JSON.parse(localStorage.getItem('tabs-v1')).songs.find(s => s.id === 'c').body === c, chart);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "c").body, chart, "Undo");
});

test("typing in Text on a phone opens writing mode; the editor fills the top and the bar rides above", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { isMobile: true });
  await page.click("#add"); await page.waitForSelector("#sr-write"); await page.click("#sr-write"); /* 4.45.0: "What song?" first */
  await page.waitForSelector('#ed-body'); await settled(page);
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.focus("#ed-body");
  await page.waitForFunction(() => document.body.classList.contains('writing'));
  assert.ok(await page.evaluate(() => document.body.classList.contains("writing")), "writing mode on");
  const box = await page.locator(".ed-tx").boundingBox(), bar = await page.locator(".cebar").boundingBox();
  assert.ok(box.y >= 0 && box.y < 70, `editor at the top, under the title strip (y=${box.y})`);
  assert.ok(bar.y >= box.y + box.height, "bar sits below the editor, not over it");
  assert.ok(await page.locator("#ce-done").isVisible(), "Save stays one tap away while typing");
  await page.keyboard.type("[Verse]\nG\nHello" + "\nline".repeat(60));
  const st = await page.evaluate(() => document.querySelector(".ed-tx").scrollTop);
  assert.ok(st > 0, "the editor follows the caret down");
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForFunction(() => !document.body.classList.contains('writing'));
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("writing"))), "writing mode off when the keyboard closes");
});

test("2.13/2.16.4 Library: no Key or Tuning chip in a big library", { skip: skip() }, async t => {
  const keys = ["G", "C", "D", "A", "E", "F"];
  const songs = Array.from({ length: 14 }, (_, i) => ({ id: "k" + i, title: "Song " + i, artist: "A", format: "chords", key: keys[i % 6], tuning: i % 2 ? "dropd" : undefined, body: `[Verse]\n${keys[i % 6]}\nla` }));
  const page = await phone(t, { ...LIB, songs });
  assert.equal(await page.locator("#f-key").count(), 0, "no Key chip");
  assert.equal(await page.locator("#f-tune").count(), 0, "no Tuning chip (2.16.4)");
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
  await page.click("#add"); await page.waitForSelector("#sr-write"); await page.click("#sr-write"); /* 4.45.0: "What song?" first */ await page.waitForSelector('#ed-body'); await settled(page);
  await page.mouse.click(200, 300); await page.evaluate(() => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok))));
  assert.equal(await page.evaluate(() => { const f = document.getElementById("fp"); return !f || getComputedStyle(f).display === "none"; }), true, "no Play on the new song page");
  assert.equal(await page.locator("#play").isVisible(), false);
});

test("2.33.0: writing mode keeps the song in view: a strip with title, artist and key; Return comes back to the pad", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { isMobile: true });
  await page.click("#add"); await page.waitForSelector("#sr-write"); await page.click("#sr-write"); /* 4.45.0: "What song?" first */ await page.waitForSelector('#ed-body'); await settled(page);
  await page.focus("#ed-body"); await page.waitForSelector('#ed-strip'); await page.waitForFunction(() => document.body.classList.contains('writing'));
  assert.ok(await page.locator("#ed-strip").isVisible(), "the strip shows while writing");
  assert.match(await page.innerText("#ed-strip"), /Add a title/);
  const s = await page.locator("#ed-strip").boundingBox(), p = await page.locator(".ed-tx").boundingBox();
  assert.ok(p.y >= s.y + s.height, "the pad sits below the strip");
  await page.keyboard.type("[Verse]\nG       C\nHello there");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('tabs-v1')).songs.some(s => /Hello there/.test(s.body || '')));
  await page.click("#ed-strip"); await page.waitForFunction(() => document.activeElement.id === 'ed-title');
  assert.equal(await page.evaluate(() => document.activeElement.id), "ed-title", "tap the strip: the title");
  await page.keyboard.type("Porch Light"); await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.id), "ed-artist", "Return: the artist");
  await page.keyboard.type("Me"); await page.keyboard.press("Enter"); await page.waitForFunction(() => document.activeElement.id === 'ed-body');
  assert.equal(await page.evaluate(() => document.activeElement.id), "ed-body", "Return again: back to the pad");
  await page.waitForFunction(() => /Porch Light\s*·\s*Me\s*·\s*Key G/.test(document.getElementById('ed-strip').innerText));
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
  await page.click("#play"); await page.waitForFunction(() => window.__hits.osc >= 2 && window.__hits.noise >= 4, null, { timeout: 8000 });
  const h = await page.evaluate(() => window.__hits);
  assert.ok(h.osc >= 2, `kick and snare drums (${h.osc})`);
  assert.ok(h.noise >= 4, `snare and hi-hat noise (${h.noise})`);
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
  assert.deepEqual(await groove(), { src: "ai", beat: "half", swing: "light" }, "4.42.0: a bass in the answer is dropped");
  assert.match(await page.innerText("#toast"), /Groove: Half time, light swing/);
  await page.click("#play"); await page.click("#play"); await page.click("#play");
  assert.equal(asks, 1, "asked once; a song with a groove is not looked up again");
  await tool(page, "edit"); await page.waitForSelector("#ed-g-beat");
  assert.match(await page.innerText(".ed-chips"), /Drums\s*Half time\s*Found/);
  const saved = src => page.waitForFunction(w => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "gv").groove?.src === w, src);
  await page.selectOption("#ed-g-beat", "rock"); await saved("you");
  assert.deepEqual(await groove(), { src: "you", beat: "rock", swing: "light" });
  assert.equal(await page.locator("#ed-g-bass").count(), 0, "4.42.0: no bass chip");
  await page.selectOption("#ed-g-swing", ""); await page.waitForSelector("#ed-g-beat");
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
  await until(() => drumAsks >= 1);
  await page.click("#play"); await page.waitForFunction(() => !document.body.classList.contains('playing'));
  assert.ok(!(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "dr1").drums)), "the first answer was unusable");
  await page.waitForSelector("#lp-drums-new");
  assert.match(await page.innerText("#lp-drums-new"), /Write drums/, "the Practice row offers to write them");
  await page.click("#lp-drums-new");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "dr1").drums, null, { timeout: 5000 });
  assert.match(sent, /Parts: verse, chorus/, "the sheet's sections are sent");
  assert.doesNotMatch(sent, /G   C   G   D/, "the sheet itself is not sent");
  const d = () => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "dr1").drums);
  assert.deepEqual((await d()).chorus, bars.chorus);
  await page.waitForFunction(() => !document.body.classList.contains('playing'));
  await page.click("#play"); await page.waitForFunction(() => document.body.classList.contains('playing'));
  await page.waitForSelector("#lp-drums");
  assert.match(await page.innerText("#lp-drums"), /Drums: as written/);
  await page.click("#lp-drums"); await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "dr1").drums.level === 1);
  assert.match(await page.innerText("#lp-drums"), /busier/);
  await page.click("#lp-drums"); await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "dr1").drums.level === -1);
  await page.click("#lp-drums"); await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "dr1").drums.level === undefined);
  await page.click("#play"); await page.waitForTimeout(400); /* real timer */ await page.click("#play");
  assert.equal(drumAsks, 2, "one miss, then written once");
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
  assert.equal(await page.locator("#s-bass").count(), 0, "4.42.0: no bass in Settings");
  await page.click("#s-metsound [data-m='click']");
  await page.waitForFunction(() => { const x = JSON.parse(localStorage.getItem("tabs-v1")).settings; return x.metroDrop === true && x.metroSound === "click"; });
  const s2 = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings);
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
  await tool(page, "capo"); await page.waitForFunction(() => /No capo \(Capo 2 taken off\)/.test(document.getElementById('sheet').innerText));
  const after = await chords();
  assert.match(await page.innerText("#sheet"), /No capo \(Capo 2 taken off\)/);
  assert.ok(before.includes("G") && after.includes("A") && after.includes("F#m"), `G D Em C becomes A E F#m D (${before} → ${after})`);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('tabs-v1')).songs.find(s => s.id === 'cp').capoOff === true);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "cp").capoOff, true);
  await tool(page, "capo"); await page.waitForFunction(() => !/No capo/.test(document.getElementById('sheet').innerText));
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
  await page.waitForSelector(".tm-bd.you");
  assert.equal(await page.locator(".tm-bd.you").count(), 1, "the scene board ranks you with the rivals");
  assert.match(await page.textContent("#tm-sbody"), /\d+HEXAGONS? YOU HOLD/);
  assert.ok(await page.locator(".tm-rival").count() >= 4, "rival players have turf around you");
  /* 4.18.0: the venue and the fine print are behind About the map */
  await page.click("#tm-info"); await page.waitForSelector("#mi-x");
  assert.match(await page.innerText("[role=dialog][aria-label='About the map']"), /Open mic: \d+ plays? to the Coffeehouse[\s\S]*simulated/);
  await page.click("#mi-x"); await page.waitForSelector("#mi-x", { state: "detached" });
  assert.ok(await page.locator(".tm-map path").count() >= 3, "fog, glow and outline are drawn");
  assert.equal(tiles.length, 0, "no map pictures before a spot");
  assert.equal(await page.evaluate(() => window.__asked), 0, "no location asked");
  const z0 = await page.evaluate(() => document.querySelector(".tm-map .leaflet-proxy")?.style.transform);
  await page.click("#tm-in"); await page.waitForFunction(z => document.querySelector('.tm-map .leaflet-proxy')?.style.transform !== z, z0);
  assert.notEqual(await page.evaluate(() => document.querySelector(".tm-map .leaflet-proxy")?.style.transform), z0, "zoom buttons move the map");
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/tm-plain.png" });
  await page.click("#tm-flag"); await page.waitForSelector("#pf-go");
  assert.equal(await page.evaluate(() => window.__asked), 0, "the explanation comes first");
  await page.context().grantPermissions(["geolocation"], { origin: new URL(page.url()).origin });
  await page.click("#pf-go");
  await page.waitForFunction(() => !!localStorage.getItem("tabs.spot.v1")); await page.waitForSelector("#tm-flag", { state: "detached" });
  await page.waitForFunction(n => window.__asked > 0, 0);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs.spot.v1"))), { lat: 40.71, lon: -74.01 });
  assert.equal(await page.evaluate(() => localStorage.getItem("tabs-v1").includes("40.71")), false, "not in the library");
  await page.waitForFunction(() => document.querySelectorAll(".tm-map img.leaflet-tile").length > 0);
  assert.ok(tiles.every(u => /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(u)));
  /* 4.20.0: the sheet's number tiles once shared the map layer's class and hid the map */
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".tm-map .leaflet-layer")).display), "block", "the map pictures show");
  if (process.env.SHOT) { await page.waitForTimeout(500); /* real timer */ await page.screenshot({ path: process.env.SHOT + "/tm-spot.png" }); }
  await page.waitForSelector("#tm-take-go"); await page.waitForFunction(() => !document.querySelector("[role=dialog][aria-label='About the map']"));
  await page.click("#tm-info"); await page.waitForSelector("#tm-forget");
  await page.click("#tm-forget"); await page.waitForSelector("#tm-flag");
  assert.equal(await page.evaluate(() => localStorage.getItem("tabs.spot.v1")), null);
  await page.click("#back"); await page.waitForFunction(() => !document.body.classList.contains("tm-open"));
});

test("A run that stops early is not a play", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, countIn: false } });
  await page.click(".list .row"); await page.waitForSelector("#play");
  await page.click("#play"); await page.waitForTimeout(1500); /* real timer */ await page.click("#play");
  await page.waitForFunction(() => document.getElementById("play")?.getAttribute("aria-label") === "Start auto-scroll");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.every(s => !s.playLog?.total)), true);
});

test("The Road is home (4.0.0): stat bar, leg banner, the path with its current stop open, Louie, the Songbook bar and the tab bar", { skip: skip() }, async t => {
  const y = new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
  const songs = LIB.songs.map(s => ({ ...s, playLog: { total: 3, last: Date.now() - 86400e3, days: { [y]: 1 } } }));
  const page = await phone(t, { ...LIB, songs }, { home: true });
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/road.png" });
  await page.waitForSelector(".rd-path");
  assert.equal(await page.locator(".hud #h-streak").count(), 1, "the stat bar has the streak");
  assert.match(await page.innerText("#h-fans"), /\d/, "and your fans");
  assert.match(await page.innerText(".rd-banner"), /LEG 1[\s\S]*Open chords/);
  assert.equal(await page.locator(".rd-node.now").count(), 1, "one current stop");
  assert.equal(await page.locator(".rd-pop, .rd-flag").count(), 0, "4.35.0: nothing open on arrival, no flag");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".rd-node.now .rd-halo")).animationName), "rd-halo", "the halo pulses");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".rd-node.now .rd-body")).animationName), "rd-wiggle", "the pick wiggles now and then");
  await page.click(".rd-node.now"); await page.waitForSelector(".rd-pop.now");
  assert.match(await page.innerText(".rd-pop.now"), /The G chord[\s\S]*START · \+5 FANS/, "a tap opens its card");
  await page.click(".rd-node.now"); await page.waitForSelector(".rd-pop", { state: "detached" });
  assert.equal(await page.locator(".rd-node .rd-pk").count() > 3, true, "the stops are picks");
  assert.equal(await page.locator(".rd-node.now .rd-halo").count(), 1, "a halo behind the next pick");
  assert.ok(await page.locator(".rd-say svg.louie").count() === 1, "Louie beside the path");
  assert.equal(await page.locator(".rd-node.headline").count() >= 1, true, "each leg ends in a headline show");
  assert.equal(await page.locator(".rd-node.box").count() >= 1, true, "with merch boxes along the way");
  /* another pick: a small bubble; a tap anywhere else closes it */
  await page.click(".rd-node.locked >> nth=0");
  assert.match(await page.innerText(".rd-pop"), /Finish the stops before this one/);
  await page.click(".rd-legmark >> nth=1"); await page.waitForSelector(".rd-pop", { state: "detached" });
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
  /* 4.9.0: the Road never scrolls; the Songbook is a bar along the bottom that opens its page */
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, "the Road does not scroll");
  assert.equal(await page.locator("#rd-drawer").count(), 0, "no drawer");
  assert.match(await page.innerText("#rd-songbook"), /Songbook[\s\S]*2 songs/);
  const bar = await page.locator(".rd-sbk").boundingBox(), tabsTop = (await page.locator("#tabs").boundingBox()).y;
  assert.ok(bar.y + bar.height <= tabsTop, "above the tab bar");
  await page.click("#rd-songbook"); await page.waitForFunction(() => location.hash === "#/library");
  assert.match(await page.innerText("h1.title"), /Songbook/);
  assert.ok(await page.locator("#list .row").first().isVisible(), "the songs");
  await page.click("#libback"); await page.waitForSelector(".rd-path");
  await page.click("#rd-search"); await page.waitForFunction(() => location.hash === "#/library" && document.body.classList.contains("searching"));
  await page.evaluate(() => { location.hash = "#/"; }); await page.waitForSelector(".rd-path");
  /* the tab bar: Road is current; Tour has its quests (4.5.0); Charts (4.6.0); Your band (4.7.0); More reaches Settings; the current stop's Start opens its lesson */
  assert.equal(await page.getAttribute("#tabs [data-tab=road]", "aria-current"), "page");
  await page.click("#tabs [data-tab=tour]"); await page.waitForSelector(".tq-head");
  assert.match(await page.innerText(".tq-head"), /Tour[\s\S]*Play 20 shows[\s\S]*2 \/ 20/, "this month's plays count toward the tour");
  assert.match(await page.innerText(".tq-req"), /REQUEST LINE[\s\S]*asked for/);
  assert.equal(await page.locator(".tq-card .tq-row").count(), 4, "three setlist goals and the Friend quest");
  await page.click("#tabs [data-tab=charts]"); await page.waitForSelector(".ch-head");
  assert.match(await page.innerText(".ch-head"), /Garage Chart/, "4.6.0: Charts start at the Garage");
  assert.equal(await page.locator(".ch-row").count(), 10);
  assert.match(await page.innerText(".ch-row.you"), /You[\s\S]*\d+ XP/, "your XP this week (4.11.0: with what you did today)");
  await page.click("#ch-go"); await page.waitForSelector(".bt");
  assert.match(await page.innerText(".bt"), /wants your spot[\s\S]*TAKE THE STAGE/);
  await page.click("#bt-no"); await page.waitForSelector(".ch-head");
  await page.click("#tabs [data-tab=band]"); await page.waitForSelector(".bd-head");
  const joined = +(await page.innerText(".bd-head")).match(/(\d+) OF 27 JOINED/)[1];
  assert.ok(joined >= 1, "4.7.0: Lola joins after your first song");
  assert.equal(await page.locator(".bd-card.locked").count(), 27 - joined);
  assert.match(await page.innerText(".bd-next"), /NEXT TO JOIN[\s\S]*more song/);
  await page.click("#tabs [data-tab=road]"); await page.waitForSelector(".rd-node.now");
  await page.click(".rd-node.now"); await page.click(".rd-pop.now .rd-start"); await page.waitForFunction(() => location.hash === "#/practice/c%3AG");
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

test("Tour Map (4.18.0): the sheet gives one goal in minutes of playing, pulls up for the scene, and Play starts the song", { skip: skip() }, async t => {
  const page = await phone(t, LIB);
  await page.evaluate(() => { location.hash = "#/playmap"; });
  await page.waitForSelector("#tm-take-go");
  assert.match(await page.innerText("#tm-take"), /NEXT CORNER TO TAKE\s*\S+ \S+'s corner[\s\S]*About \d+ min of playing takes it[\s\S]*START WITH/);
  assert.equal(await page.getAttribute("#tm-sheet", "data-state"), "closed");
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("tm-sbody")).opacity), "0", "the details stay hidden until the sheet is pulled up");
  await page.click(".tm-sh-t"); await page.waitForFunction(() => document.getElementById("tm-sheet").dataset.state === "open");
  assert.match(await page.innerText("#tm-sbody"), /Your scene this week[\s\S]*min a day[\s\S]*NEXT[\s\S]*HEXAGONS? YOU HOLD[\s\S]*CORNERS? TAKEN/i);
  if (process.env.SHOT) { await page.waitForTimeout(500); /* real timer */ await page.screenshot({ path: process.env.SHOT + "/scene-open.png" }); }
  await page.click(".tm-sh-t"); await page.waitForFunction(() => document.getElementById("tm-sheet").dataset.state === "closed");
  if (process.env.SHOT) { await page.waitForTimeout(500); /* real timer */ await page.screenshot({ path: process.env.SHOT + "/scene-closed.png" }); }
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

test("4.12.0 song duels: a challenge link opens a duel and the gig; a reply shows the head-to-head", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, plainPlay: false, gigScore: false } });
  const code = await page.evaluate(async () => { const C = await import("/core.js"); return C.packShare({ song: { title: "Wagon Wheel", artist: "Old Crow", format: "chords", body: "[Verse]\nG D Em C\nla" }, duel: { id: "abc123def", from: "Mike", pct: 91, combo: 22, crowd: 12 } }); });
  await page.evaluate(c => { location.hash = "#/import/" + c; }, code);
  await page.waitForSelector(".dl-card");
  assert.match(await page.innerText(".dl-card"), /Mike[\s\S]*91%[\s\S]*Wagon Wheel[\s\S]*Beat it/);
  await page.click("#dl-yes"); await page.waitForSelector("#gig");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")));
  assert.ok(saved.songs.some(s => s.title === "Wagon Wheel"), "the song came with it");
  assert.equal(saved.duels.list[0].opp, "Mike");
  await page.click("#gg-x"); await page.waitForFunction(() => !document.getElementById("gig"));
  /* a duel you sent comes back answered */
  const reply = await page.evaluate(async () => {
    const C = await import("/core.js"), app = await import("/app.js"), d = C.startDuel(app.data, app.data.songs[0], { pct: 70, combo: 5, crowd: 8 }); C.Tabs.save(app.data);
    return { id: d.id, code: await C.packShare({ song: C.shareable(app.data.songs[0]), duel: { id: d.id, from: "Sarah", pct: 82, combo: 9, crowd: 10, reply: true } }) };
  });
  await page.evaluate(c => { location.hash = "#/import/" + c; }, reply.code);
  await page.waitForFunction(id => location.hash === "#/duel/" + id, reply.id);
  await page.waitForSelector(".du h1");
  assert.match(await page.innerText(".du h1"), /Sarah beat your/);
  assert.match(await page.innerText(".du-rec"), /YOU AND SARAH[\s\S]*0[\s\S]*1/);
  assert.ok(await page.locator("#du-again").isVisible(), "take it back");
  await page.click("#du-charts"); await page.waitForSelector(".du-row");
  assert.equal(await page.locator(".du-row").count(), 2, "both duels on Charts");
  /* 4.13.0: Friends on Charts, and Play together from a friend */
  await page.click('[data-pane="friends"]'); await page.waitForSelector(".fr-row");
  assert.equal(await page.locator(".fr-row").count(), 3, "Mike, Sarah and you");
  await page.click('[data-friend="Sarah"]'); await page.waitForSelector("#du-together");
  await page.click("#du-together"); await page.waitForSelector("#pt-listen");
  await page.goto(base + "#/tour"); await page.waitForSelector(".tq-head");
  assert.match(await page.innerText(".tq-card[aria-label='Friend quest']"), /Earn 300 XP with/);
});

test("4.14.0 the Merch table: fans open it, buy and wear a finish, a Rain check holds the streak, a Second take on Charts", { skip: skip() }, async t => {
  const dk = d => { const x = new Date(Date.now() - d * 864e5); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
  const songs = LIB.songs.map(s => s.id === "a" ? { ...s, playLog: { total: 120, last: Date.now() - 2 * 864e5, days: { [dk(3)]: 60, [dk(2)]: 60 } } } : s);
  const lib = { ...LIB, songs, merch: { own: { rain: 1, take: 1 } }, charts: { tier: 0, battle: { day: dk(0), rival: "Neon Jen", songId: "a", target: 70, result: "lost", pct: 50 } } };
  const page = await phone(t, lib, { home: true });
  await page.waitForSelector("#h-fans");
  assert.match(await page.innerText("#h-streak > span"), /^\s*3\s*$/, "the Rain check covered yesterday");
  const fans = +(await page.innerText("#h-fans")).replace(/\D/g, "");
  assert.ok(fans >= 1200, "fans to spend");
  await page.click("#h-fans"); await page.waitForSelector(".mc-head");
  assert.equal(await page.locator(".mc-gear").count(), 3);
  assert.match(await page.innerText(".mc-gear[data-id=take]"), /x1/, "the Second take you hold");
  await page.click(".mc-fin[data-id=tweed]"); await page.waitForSelector(".mt-sheet");
  assert.match(await page.innerText(".mt-sheet"), /Tweed Louie[\s\S]*COSTS[\s\S]*600/);
  await page.click("#mt-buy"); await page.waitForSelector(".mc-fin.on[data-id=tweed]");
  assert.equal(await page.evaluate(() => document.body.dataset.wear), "tweed", "Louie wears it everywhere");
  assert.equal(+(await page.innerText(".mc-head .mc-fans")).replace(/\D/g, ""), fans - 600);
  await page.click(".mc-fin[data-id=gold]"); await page.waitForSelector(".mt-sheet");
  assert.match(await page.innerText(".mt-acts"), /MORE FANS TO GO/i, "can't afford Gold top yet");
  await page.click("#mt-not");
  await page.click("#tabs [data-tab=more]"); await page.waitForSelector("#m-lib");
  assert.equal(await page.locator("#m-merch").count(), 0, "4.16.2: the Merch table opens from the fans in the stat bar, not More");
  await page.click("#more-x");
  await page.click("#tabs [data-tab=charts]"); await page.waitForSelector("#ch-take");
  await page.click("#ch-take"); await page.waitForSelector(".bt");
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem("tabs-v1")).charts.battle.result, null, { timeout: 3000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")));
  assert.equal(saved.charts.battle.result, undefined, "the battle is on again");
  assert.deepEqual([saved.merch.own.take || 0, saved.merch.own.rain || 0, saved.merch.louie], [0, 0, "tweed"], "both used");
});

test("4.35.0 the Road's headline: a tap opens its card, which names a song that fits; Other songs lists the rest", { skip: skip() }, async t => {
  const done = Object.fromEntries(["G", "C", "D", "Em", "Am", "E", "A"].map((c, i) => [`c:${c}`, { n: 1, at: Date.now() - 1000 + i }]));
  const songs = [{ ...LIB.songs[0], id: "h1", title: "Low Tide", body: "[V]\n[G]a [C]b [D]c [G]d", playLog: { total: 1, last: Date.now() - 2 * 864e5, days: {} } },
    { ...LIB.songs[1], id: "h2", title: "Porch Light", body: "[V]\n[Em]a [C]b [G]c [D]d", playLog: { total: 1, last: Date.now() - 5 * 864e5, days: {} } }];
  const page = await phone(t, { ...LIB, songs, skills: { done, last: Date.now() } }, { home: true });
  await page.waitForSelector(".rd-node.now.headline");
  const w = await page.evaluate(() => document.querySelector(".rd-node.now .rd-pk").getBoundingClientRect().width);
  assert.ok(w > 80, `4.34.1: the headline pick keeps its size (${w})`);
  await page.click(".rd-node.now"); await page.waitForSelector(".rd-pop.now");
  assert.match(await page.innerText(".rd-pop.now"), /Headline show[\s\S]*Low Tide[\s\S]*PLAY LOW TIDE/, "the last played song that fits");
  assert.match(await page.innerText("#rd-other"), /Other songs that fit \(1\)/);
  await page.click("#rd-other"); await page.waitForSelector(".rd-others [data-play]");
  assert.deepEqual(await page.$$eval(".rd-others [data-play]", b => b.map(x => x.dataset.play)), ["h1", "h2"]);
  await page.click("#ro-x"); await page.waitForSelector(".rd-others", { state: "detached" });
  await page.click(".rd-pop.now .rd-start"); await page.waitForSelector("#gig");
});

test("4.48.0 One search: a labelled bar on the Songbook, two buttons on the Road; before typing only what helps; typing shows your songs, then rows that say what they do", { skip: skip() }, async t => {
  const songs = LIB.songs.map((x, i) => i ? x : { ...x, opened: Date.now() - 3600e3 });
  const page = await phone(t, { ...LIB, songs }, { home: true, permissions: ["clipboard-read", "clipboard-write"] });
  await page.route("https://itunes.apple.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ results: [{ trackName: "Wagon Wheel", artistName: "Old Crow Medicine Show", releaseDate: "2004-01-01" }, { trackName: "Wagon Wheel", artistName: "Old Crow Medicine Show" }, { trackName: "Wagon Wheel", artistName: "Darius Rucker" }] }) }));
  /* the Road: Songbook and Search or add, both labelled */
  await page.waitForSelector("#rd-search"); await settled(page);
  assert.match(await page.innerText("#rd-songbook"), /Songbook[\s\S]*2 songs/);
  assert.match(await page.innerText("#rd-search"), /Search or add a song/);
  await page.click("#rd-search"); await page.waitForSelector("#sr-browse");
  assert.match(await page.innerText("#sr-browse"), /Open your Songbook[\s\S]*2 songs/, "from the Road, the Songbook is the first row");
  assert.match(await page.innerText("#list"), /Played lately[\s\S]*Not in your Songbook yet\?[\s\S]*Paste[\s\S]*Sing it[\s\S]*Write one from scratch/i);
  assert.equal(await page.locator(".sr-card").count(), 1, "only songs you played");
  assert.equal(await page.locator("#sr-scan").count(), 0, "Scan needs the AI");
  await page.click("#sr-browse"); await page.waitForFunction(() => !document.body.classList.contains("searching"));
  /* the Songbook: one bar, its + opens the same screen without the Songbook row */
  assert.equal(await page.getAttribute("#q", "placeholder"), "Search or add a song");
  assert.ok((await page.locator(".dock .cmd").boundingBox()).width > 300, "a full-width bar");
  await page.click("#add"); await page.waitForSelector("#sr-paste");
  assert.equal(await page.locator("#sr-browse").count(), 0, "from the Songbook there's no Open your Songbook row");
  await page.fill("#q", LIB.songs[0].title.slice(0, 5)); await page.waitForSelector("#list [data-id]");
  assert.match(await page.innerText("#list"), /In your Songbook/i);
  await page.fill("#q", "wagon wh"); await page.waitForSelector("[data-cat]");
  assert.equal(await page.locator("[data-cat]").count(), 2, "the same recording twice shows once");
  assert.match(await page.innerText("#sr-cat"), /Not in your Songbook[\s\S]*Old Crow Medicine Show · 2004[\s\S]*Start a sheet[\s\S]*Darius Rucker[\s\S]*Or look on Ultimate Guitar[\s\S]*Write “wagon wh” myself/i);
  assert.equal(await page.locator(".findcard").count(), 0, "no second card saying the same thing");
  await page.click("[data-cat='1']"); await page.waitForSelector("#ed-body");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.some(s => s.title === "Wagon Wheel"));
  const added = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.title === "Wagon Wheel"));
  assert.equal(added?.artist, "Darius Rucker", "without an AI key the row starts a sheet with the title and artist");
  /* a sheet on the clipboard goes to the paste card */
  await page.goto(base + "#/library"); await page.waitForSelector("#add"); await settled(page);
  await page.click("#add"); await page.waitForSelector("#sr-paste");
  await page.evaluate(() => navigator.clipboard.writeText("Porch Song\n[Verse]\nG C\nla la"));
  await page.click("#sr-paste"); await page.waitForSelector("#p-title");
});
