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

test("4.69.0 the beat: a bass drum on every beat, or the click; no snare or hi-hat", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, metronome: true, countIn: false, controls: "bar" } });
  await page.evaluate(() => {
    window.__hits = { osc: 0, tri: 0 };
    const C = window.AudioContext || window.webkitAudioContext;
    const o = C.prototype.createOscillator;
    C.prototype.createOscillator = function () { const x = o.call(this); window.__hits.osc++; const d = Object.getOwnPropertyDescriptor(OscillatorNode.prototype, "type"); Object.defineProperty(x, "type", { set(v) { if (v === "triangle") window.__hits.tri++; d.set.call(this, v); }, get() { return d.get.call(this); } }); return x; };
  });
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.click(".list .row"); await page.waitForSelector("#play");
  await page.click("#play"); await page.waitForFunction(() => window.__hits.osc >= 3, null, { timeout: 8000 });
  assert.equal(await page.evaluate(() => window.__hits.tri), 0, "no snare (its body is a triangle wave)");
  assert.equal(await page.evaluate(() => import("/audio.js").then(m => m.beatMode())), "kick", "an old drums setting plays the bass drum");
  assert.deepEqual(errors, []);
});

test("a song's groove is found once, used for the song, and changed in Edit", { skip: skip() || "4.69.0: the drum kit sits out until Beat comes back with a part (the code stays)" }, async t => {
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

test("drums that fit the song: written once by the AI, played per section, busier or simpler in Practice", { skip: skip() || "4.69.0: the drum kit sits out until Beat comes back with a part (the code stays)" }, async t => {
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

test("Settings: the beat (Off, Bass drum, Metronome) and its volume; a song with no tempo gets one", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, countIn: false, controls: "bar" } });
  await page.route("https://api.anthropic.com/**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text: '{"bpm": 120, "beats": 4}' }], stop_reason: "end_turn" }) }));
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-test"));
  await page.evaluate(() => { location.hash = "#/settings/playing"; }); await page.waitForSelector("#s-beat");
  assert.equal(await page.getAttribute("#s-beat [data-m='off']", "aria-pressed"), "true", "off by default");
  await page.click("#s-beat [data-m='click']");
  await page.$eval("#s-metvol", el => { el.value = 40; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.metroSound === "click");
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings);
  assert.equal(s.metronome, true); assert.equal(s.metroVol, 0.4); assert.equal(s.metroSound, "click");
  assert.equal(await page.getAttribute("#s-beat [data-m='click']", "aria-pressed"), "true");
  assert.equal(await page.locator("#s-metbeat, #s-metswing, #s-bass").count(), 0, "no drum beat, swing or bass while the drum kit sits out");
  await page.click("#s-beat [data-m='kick']");
  await page.waitForFunction(() => { const x = JSON.parse(localStorage.getItem("tabs-v1")).settings; return x.metronome === true && x.metroSound === "kick"; });
  await page.click("#s-beat [data-m='click']"); await page.click("#s-metdrop");
  await page.waitForFunction(() => { const x = JSON.parse(localStorage.getItem("tabs-v1")).settings; return x.metroDrop === true && x.metroSound === "click"; });
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
  /* the Tour Map is the Tour tab: no Back button; the month's tour is a button on it */
  assert.equal(await page.locator("#back").count(), 0);
  await page.click("#tm-month"); await page.waitForFunction(() => !document.body.classList.contains("tm-open"));
});

test("A run that stops early is not a play", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, countIn: false } });
  await page.click(".list .row"); await page.waitForSelector("#play");
  await page.click("#play"); await page.waitForTimeout(1500); /* real timer */ await page.click("#play");
  await page.waitForFunction(() => document.getElementById("play")?.getAttribute("aria-label") === "Start auto-scroll");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.every(s => !s.playLog?.total)), true);
});

test("4.76.0 the merch box: a road case you reach, tap open, and get its fans", { skip: skip() }, async t => {
  const skills = { done: { "c:G": { n: 3, best: 90, at: Date.now() }, "c:C": { n: 3, best: 90, at: Date.now() }, "c:D": { n: 3, best: 90, at: Date.now() } } };
  const page = await phone(t, { ...LIB, skills, boxes: { opened: [] } }, { home: true });
  await page.waitForSelector(".rd-node.box.now");
  assert.match(await page.innerText(".rn-now-tx"), /Merch box/, "the shut box is the next stop");
  const fans = async () => +(await page.innerText("#h-fans")).replace(/\D/g, "");
  const before = await fans();
  await page.click(".rd-node.box.now");
  await page.waitForSelector(".co.co-plate .co-badge"); /* 4.99.0: in Light and Dark the news is an engraved plate, not a POW */
  assert.match(await page.innerText(".co-badge"), /MERCH BOX/, "the plate says what you got");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).boxes?.opened?.length === 1);
  await page.waitForSelector(".rd-node.box.done .rn-pearl");
  await page.waitForFunction(b => +(document.querySelector("#h-fans")?.innerText || "0").replace(/\D/g, "") >= b + 25, before);
  assert.equal(await page.locator(".rd-node.box.now").count(), 0, "opened, the road moves on");
});

/* A saved Green Room is read as Light or Dark, so this is the Road Ready road. The old Green Room road is no longer shown. */
test("The Road is home: a saved Green Room shows the Road Ready road and keeps the saved look", { skip: skip() }, async t => {
  const y = new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
  const songs = LIB.songs.map(s => ({ ...s, playLog: { total: 3, last: Date.now() - 86400e3, days: { [y]: 1 } } }));
  const page = await phone(t, { ...LIB, songs, settings: { ...LIB.settings, v: 6, theme: "green" } }, { home: true });
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/road.png" });
  await page.waitForSelector(".rd-path");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.theme), "green", "the saved look stays");
  assert.ok(["neon", "festival"].includes(await page.evaluate(() => document.documentElement.dataset.look)), "shown as Light or Dark");
  assert.equal(await page.locator(".rr-stats #h-streak, header.rr-head").count() >= 1, true, "the Road Ready header");
});

test("The Road on a new library: the first song is ready to play on the current stop, and Louie's first line waits for the playing screen", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: LIB.songs.map(s => ({ ...s, playLog: undefined })) }, { home: true });
  await page.waitForSelector(".rd-path");
  assert.equal(await page.locator("#rd-bubble").count(), 0, "no message on the Road (one-row header, Grok 2026-11-19)");
  assert.equal(await page.locator("#rd-tonight").count(), 0, "no Tonight bar on the Road");
  assert.match(await page.innerText(".rn-now-tx"), /^G$/, "the current stop's name sits on the plate");
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
  /* 5.x: Settings shows its Back up button only when a backup is due, so only that step gets an old backup date */
  const due = await phone(t, { ...LIB, settings: { ...LIB.settings, lastBackup: "2020-01-01T00:00:00Z" } });
  await due.evaluate(() => { location.hash = "#/settings"; }); await due.waitForSelector(".btn.primary");
  assert.match(await due.evaluate(() => getComputedStyle(document.querySelector(".btn.primary")).fontFamily), /Sora/, "the main button is set in Sora");
  const page = await phone(t);
  const look = sel => page.evaluate(s => { const c = getComputedStyle(document.querySelector(s)); return { r: c.borderTopWidth, f: c.fontFamily }; }, sel);
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#stat");
  assert.equal((await look("#stat")).r, "2px", "chips have the 2px rim");
  assert.match((await look("#stat")).f, /Sora/);
  await page.evaluate(() => document.querySelector("#more").click()); await page.waitForSelector(".menu");
  assert.equal((await look(".menu")).r, "2px", "menus have the 2px rim");
  await page.evaluate(() => { location.hash = "#/edit/a"; }); await page.waitForSelector("#ed-title");
  assert.ok((await page.locator("#ed-title").boundingBox()).width > 200, "the title field has room (the artist line sits below it)");
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
  await page.click("#gg-pause"); await page.waitForSelector("body.held");
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
  assert.equal((await page.innerText("#h-streak")).trim(), "3", "the Rain check covered yesterday (one-row header: the streak is its own stat)");
  assert.match(await page.getAttribute("#h-streak", "aria-label"), /^Gig streak 3 days/);
  const fans = +(await page.innerText("#h-tips")).replace(/\D/g, "");
  assert.ok(fans >= 1200, "4.70.0: the fans you had to spend became tips");
  assert.ok(+(await page.innerText("#h-fans")).replace(/\D/g, "") >= 1200, "and your fans stay");
  await page.click("#h-tips"); await page.waitForSelector(".mc-head");
  /* 4.104.0: the table is three tabs in Dark and Light; Guitars first, arrows move between them */
  assert.equal(await page.innerText(".mc-head h1"), "Merch");
  assert.deepEqual(await page.$$eval(".mc-seg [role=tab]", ts => ts.map(t => [t.textContent, t.getAttribute("aria-selected")])), [["Guitars", "true"], ["Looks", "false"], ["Gear", "false"]]);
  assert.equal(await page.isVisible("#mc-p-guitars"), true); assert.equal(await page.isVisible("#mc-p-gear"), false);
  await page.focus("#mc-t-guitars"); await page.keyboard.press("ArrowLeft");
  assert.equal(await page.getAttribute("#mc-t-gear", "aria-selected"), "true", "left from the first tab goes to the last");
  assert.equal(await page.evaluate(() => document.activeElement.id), "mc-t-gear");
  assert.equal(await page.locator(".mc-gear").count(), 3);
  assert.match(await page.innerText(".mc-gear[data-id=take]"), /x1/, "the Second take you hold");
  /* His other colours are on the Looks tab. A backdrop is bought and put on as well. */
  assert.equal(await page.locator(".mc-fin[aria-label$=' Louie']").count(), 7, "Louie's finishes are on the table");
  await page.click("#mc-t-looks"); await page.click(".mc-drop[data-id=brick]"); await page.waitForSelector(".mt-sheet");
  assert.match(await page.innerText(".mt-sheet"), /Brick wall[\s\S]*COSTS[\s\S]*300/);
  await page.click("#mt-buy"); await page.waitForSelector(".mc-drop.on[data-id=brick]");
  assert.equal(+(await page.innerText(".mc-head .mc-fans")).replace(/\D/g, ""), fans - 300);
  await page.click("#tabs [data-tab=me]"); await page.waitForSelector("#pf-r-charts"); await settled(page);
  assert.equal(await page.getAttribute("#pf-r-merch", "href"), "#/merch", "Road Ready 04: the Merch table is a row on Me (More is gone; 4.16.2's stat bar way in stays)");
  await page.click("#pf-r-charts"); await page.waitForSelector("#ch-take");
  await page.click("#ch-take"); await page.waitForSelector(".bt");
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem("tabs-v1")).charts.battle.result, null, { timeout: 3000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")));
  assert.equal(saved.charts.battle.result, undefined, "the battle is on again");
  assert.deepEqual([saved.merch.own.take || 0, saved.merch.own.rain || 0, saved.merch.backdrop], [0, 0, "brick"], "both used, and the backdrop is on");
});

test("4.35.0 the Road's headline: a tap opens its card, which names a song that fits; Other songs lists the rest", { skip: skip() }, async t => {
  const done = Object.fromEntries(["G", "C", "D", "Em", "Am", "E", "A"].map((c, i) => [`c:${c}`, { n: 1, at: Date.now() - 1000 + i }]));
  const songs = [{ ...LIB.songs[0], id: "h1", title: "Low Tide", body: "[V]\n[G]a [C]b [D]c [G]d", playLog: { total: 1, last: Date.now() - 2 * 864e5, days: {} } },
    { ...LIB.songs[1], id: "h2", title: "Porch Light", body: "[V]\n[Em]a [C]b [G]c [D]d", playLog: { total: 1, last: Date.now() - 5 * 864e5, days: {} } }];
  const page = await phone(t, { ...LIB, songs, skills: { done, last: Date.now() } }, { home: true });
  await page.waitForSelector(".rd-node.now.headline");
  const w = await page.evaluate(() => document.querySelector(".rd-node.now .rn-pearl").getBoundingClientRect().width);
  assert.ok(w >= 60, `4.34.1: the headline keeps its size (Road Ready: two 24 px pearls, ${w})`);
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
  /* Search starts in the Songbook. A saved Green Room is Light or Dark, so the Road has no search bar of its own. */
  const page = await phone(t, { ...LIB, songs, settings: { ...LIB.settings, v: 6, theme: "green" } }, { home: true, permissions: ["clipboard-read", "clipboard-write"] });
  await page.route("https://itunes.apple.com/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ results: [{ trackName: "Wagon Wheel", artistName: "Old Crow Medicine Show", releaseDate: "2004-01-01" }, { trackName: "Wagon Wheel", artistName: "Old Crow Medicine Show" }, { trackName: "Wagon Wheel", artistName: "Darius Rucker" }] }) }));
  await page.evaluate(() => { location.hash = "#/library"; });
  await page.waitForSelector("#add"); await settled(page);
  await page.click("#add"); await page.waitForSelector("#sr-paste");
  assert.equal(await page.locator("#sr-browse").count(), 0, "from the Songbook there's no Open your Songbook row");
  assert.equal(await page.getAttribute("#q", "placeholder"), "Search or add a song");
  await page.fill("#q", LIB.songs[0].title.slice(0, 5)); await page.waitForSelector("#list [data-id]");
  assert.match(await page.innerText("#list"), /In your Songbook/i);
  await page.fill("#q", "wagon wh"); await page.waitForSelector("[data-cat]");
  assert.equal(await page.locator("[data-cat]").count(), 2, "the same recording twice shows once");
  assert.match(await page.innerText("#sr-cat"), /Not in your Songbook[\s\S]*Old Crow Medicine Show · 2004[\s\S]*Get the chords[\s\S]*Darius Rucker[\s\S]*Or look on Ultimate Guitar[\s\S]*Write “wagon wh” myself/i);
  assert.equal(await page.locator(".findcard").count(), 0, "no second card saying the same thing");
  /* 4.67.0: Get the chords opens the chart sheet; without an AI key it searches the site, or you start the sheet yourself */
  await page.click("[data-cat='1']"); await page.waitForSelector(".cl-sheet #cl-open");
  assert.match(await page.innerText(".cl-sheet"), /Wagon Wheel[\s\S]*Darius Rucker[\s\S]*Beginner[\s\S]*Search Ultimate Guitar[\s\S]*Start the sheet myself/);
  await page.click("#cl-self"); await page.waitForSelector("#ed-body");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.some(s => s.title === "Wagon Wheel"));
  const added = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.title === "Wagon Wheel"));
  assert.equal(added?.artist, "Darius Rucker", "without an AI key the row starts a sheet with the title and artist");
  /* a sheet on the clipboard goes to the paste card */
  await page.goto(base + "#/library"); await page.waitForSelector("#add"); await settled(page);
  await page.click("#add"); await page.waitForSelector("#sr-paste");
  await page.evaluate(() => navigator.clipboard.writeText("Porch Song\n[Verse]\nG C\nla la"));
  await page.click("#sr-paste"); await page.waitForSelector("#p-title");
});

test("4.49.1 The search screen holds still before you type, and scrolls again once you do", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.goto(base + "#/library"); await page.waitForSelector("#add"); await settled(page);
  await page.click("#add"); await page.waitForSelector("#sr-paste");
  assert.equal(await page.evaluate(() => document.body.classList.contains("sr-lock") && getComputedStyle(document.body).overflow), "hidden");
  await page.fill("#q", "river"); await page.waitForFunction(() => !document.body.classList.contains("sr-lock"));
  await page.click("#qcancel"); await page.waitForFunction(() => !document.body.classList.contains("searching") && !document.body.classList.contains("sr-lock"));
});

test("4.49.3 Closing the keyboard keeps the search screen; Cancel goes back where you came from", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, v: 6, theme: "green" } }, { home: true });
  await page.evaluate(() => { location.hash = "#/library"; });
  await page.waitForSelector("#add"); await settled(page);
  await page.click("#add"); await page.waitForSelector("#sr-paste");
  await page.evaluate(() => document.activeElement.blur()); /* the keyboard's checkmark */
  await page.waitForTimeout(400); /* real timer: the old screen closed 200 ms after the keyboard did */
  assert.equal(await page.evaluate(() => document.body.classList.contains("searching")), true, "still on the search screen");
  await page.click("#qcancel"); await page.waitForSelector("#add");
  assert.equal(await page.evaluate(() => location.hash), "#/library", "Cancel goes back to the Songbook");
});

test("4.49.5 Leaving search any way lets the page scroll again (Get the song from the empty search screen left it locked)", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.goto(base + "#/library"); await page.waitForSelector("#add"); await settled(page);
  await page.click("#add"); await page.waitForSelector("#sr-paste");
  assert.equal(await page.evaluate(() => document.body.classList.contains("sr-lock")), true, "locked before typing");
  await page.evaluate(async () => (await import("./app.js")).leaveSearch()); /* what Get the song does when it opens */
  assert.equal(await page.evaluate(() => document.body.classList.contains("sr-lock")), false, "the lock goes with the search");
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflow), "hidden");
});

test("4.49.8 On an iPhone the search screen finds songs through Apple Music, since Apple closes its own search to web pages", { skip: skip() }, async t => {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1";
  const lib = { ...LIB, settings: { ...LIB.settings, appleMusic: true, appleMusicToken: "https://tabs-musickit.example.workers.dev/token", countIn: false } };
  const page = await phone(t, lib, { userAgent: IPHONE });
  let itunesAsked = 0;
  await page.route(/itunes\.apple\.com/, r => { itunesAsked++; r.abort(); });
  await page.route("https://*.workers.dev/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ token: "t.t.t", expires: 0 }) }));
  await page.route("https://js-cdn.music.apple.com/**", r => r.fulfill({ status: 200, contentType: "text/javascript", body: `
    window.mkMusic = { isAuthorized: false, storefrontId: "us", api: { music: async (path, p) => path.includes("/search")
      ? { data: { results: { songs: { data: [{ attributes: { name: "Harbor Lights", artistName: "The Cape Fear", releaseDate: "2015-03-01" } }] } } } }
      : { data: { data: [] } } } };
    window.MusicKit = { configure: async () => {}, getInstance: () => window.mkMusic };
    document.dispatchEvent(new Event("musickitloaded"));` }));
  await page.goto(base + "#/library"); await page.waitForSelector("#add"); await settled(page);
  await page.click("#add"); await page.waitForSelector("#q");
  await page.fill("#q", "harbor"); await page.dispatchEvent("#q", "input");
  await page.waitForFunction(() => /Harbor Lights/.test(document.getElementById("sr-cat")?.innerText || ""), null, { timeout: 5000 });
  assert.match(await page.innerText("#sr-cat"), /The Cape Fear · 2015/);
  assert.equal(itunesAsked, 0, "the closed iTunes search is not tried on an iPhone");
});

test("a headline show does not offer Headliner or switch the look on", { skip: skip() }, async t => {
  const done = Object.fromEntries(["G", "C", "D", "Em", "Am", "E", "A", "k:open"].map((c, i) => [c.startsWith("k:") ? c : `c:${c}`, { n: 3, best: 90, at: Date.now() - 1000 + i }]));
  const page = await phone(t, { ...LIB, skills: { done, last: Date.now() }, merch: { tconv: 1, lconv: 1 } }, { home: true });
  await page.waitForSelector(".rd-node"); await settled(page);
  assert.equal(await page.locator(".rd-hl:not(.rd-gt)").count(), 0, "no Headliner sheet");
  assert.notEqual(await page.evaluate(() => document.documentElement.dataset.look), "headliner");
  assert.notEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.theme), "headliner");
});

test("4.82.0 the fretboard Road: a neck per leg with its guitar's name, and the new guitar is announced once", { skip: skip() }, async t => {
  const done = Object.fromEntries(["G", "C", "D", "Em", "Am", "E", "A", "k:open"].map((c, i) => [c.startsWith("k:") ? c : `c:${c}`, { n: 3, best: 90, at: Date.now() - 1000 + i }]));
  const page = await phone(t, { ...LIB, skills: { done, last: Date.now() }, merch: { tconv: 1, lconv: 1, hlseen: 1 } }, { home: true });
  await page.waitForSelector(".rn-neck");
  assert.equal(await page.locator(".rn-neck").count(), 1, "one rosewood neck for the legs you can see");
  assert.match(await page.innerText(".rn-legbar"), /Leg 1/);
  assert.equal(await page.locator(".rn-bubble").count(), 0, "no name bubble in the gutter");
  assert.equal(await page.locator(".rn-now").count(), 1, "one now plate, for the current stop");
  assert.equal(await page.locator(".rd-node.headline .rn-pearl").count() >= 1, true, "the headline is an inlay");
  await page.waitForSelector("#gt-x");
  assert.match(await page.innerText(".rd-gt"), /Cornerstone/, "the sheet names the new guitar");
  await page.click("#gt-x");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).guitars?.seen?.includes("open"));
  await page.reload(); await page.waitForSelector(".rn-neck");
  assert.equal(await page.locator("#gt-x").count(), 0, "said once");
});

test("4.84.0 a lesson that opens songs you have says how many; an opened merch box is a crate in the guitar's material", { skip: skip() }, async t => {
  const now = Date.now(), done = Object.fromEntries(["G", "C", "D"].map((c, i) => [`c:${c}`, { n: 3, best: 90, at: now - 1000 + i }]));
  const extra = { id: "x1", title: "Porch Light", artist: "", format: "chords", body: "[V]\nEm      C\nla la\nG       D\nla la" };
  /* Green Room: the old Road draws the box in the guitar's material; Road Ready's pearls are tested in roadready.e2e.mjs */
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, extra], skills: { done, last: now }, boxes: { opened: ["b:open-3"] }, settings: { ...LIB.settings, v: 6, theme: "green" } }, { home: true });
  await page.waitForSelector(".rn-neck");
  assert.match(await page.getAttribute(".rd-node.now", "aria-label"), /opens 1 of your songs/, "and says so to a screen reader");
});

/* ---- Road Ready 9a: the Guitar shop on the Merch table, and the chosen guitar on the Road, Me and Show complete ---- */
const shopLib = (ring, merch, theme = "dark") => ({ ...LIB, journal: { v: 1, months: { "2026-11": { plays: 4 * ring * ring } } }, merch: { tconv: 1, lconv: 1, hlseen: 1, ...merch }, settings: { ...LIB.settings, v: 6, theme } });
const openShop = async (t, ring, merch, theme) => {
  const page = await phone(t, shopLib(ring, merch, theme), { home: true });
  await page.waitForSelector("#h-fans"); await settled(page);
  await page.evaluate(() => { location.hash = "#/merch"; }); await page.waitForSelector(".mc-gts"); await settled(page);
  return page;
};

for (const theme of ["dark", "light"]) {
  test(`Road Ready 9a (${theme}): the Guitar shop sits after every existing section; a locked guitar says it opens at a venue, an open one it can't afford says how many tips more, and one is Next up`, { skip: skip() }, async t => {
    const page = await openShop(t, 3, { tips: 160 }, theme);   /* Club: Sticker Riot to Walnut Hall are open */
    const heads = await page.$$eval(".mc .mc-h span", els => els.map(e => e.textContent));
    assert.deepEqual(heads, ["Gear", "Louie's finishes", "Stage backdrops", "Hats", "Looks", "Build your guitar", "Guitar shop"], "Louie's other colours are on the table, and the rest keeps its order");
    assert.equal(await page.locator(".mc-gt").count(), 16);
    const row = id => page.locator(`.mc-gt[data-gt="${id}"]`);
    /* a locked guitar: a lock and "Opens at Theater", read as "Locked, opens at Theater", and it can't be bought */
    assert.equal((await row("velvetcrown").innerText()).includes("Opens at Theater"), true);
    assert.match(await row("velvetcrown").getAttribute("aria-label"), /Locked, opens at Theater/);
    assert.equal(await row("velvetcrown").locator("svg").count(), 1, "a small lock");
    /* an open guitar you can't afford: "$40 more" (tips 160, Highline $180: $20 more; Sticker Riot $90 can be bought) */
    assert.match(await row("highline").innerText(), /\$20 more/); assert.match(await row("highline").getAttribute("aria-label"), /\$180, \$20 more/);
    assert.doesNotMatch(await row("stickerriot").innerText(), /more/, "an affordable guitar shows only its price");
    /* Next up: exactly one, the cheapest in reach */
    assert.equal(await page.locator(".mc-next").count(), 1); assert.match(await row("stickerriot").innerText(), /NEXT UP/); assert.match(await row("stickerriot").getAttribute("aria-label"), /Next up/);
    /* progress in plain words: no "about N shows" (nothing stored gives an honest average), no clocks, no guilt */
    const words = await page.innerText(".mc-gts") + await page.innerText(".mc-sub");
    assert.doesNotMatch(words, /about \d+ shows?|\bshows?\b.*\baway\b|hurry|limited|expires?|ends? (in|soon)|countdown|last chance|you missed|don't miss|only \d+ left/i);
    /* every row is a 44 px target with a name */
    for (const b of await page.$$(".mc-gt")) { const r = await b.boundingBox(); assert.ok(r.height >= 44 && r.width >= 44, "a target of at least 44 px"); assert.ok((await b.getAttribute("aria-label")).length > 8); }
  });
}

test("Road Ready 9a: buying a shop guitar takes its price once, saves it as g-<slug>, puts it on and shows it on the Road, in the case on Me and in the guitarist's hands", { skip: skip() }, async t => {
  const page = await openShop(t, 1, { tips: 250 });
  await page.click('.mc-gt[data-gt="stickerriot"]');
  await page.waitForSelector(".mt[aria-label='Sticker Riot'] #gs-buy");
  assert.equal(await page.innerText("#gs-buy"), "BUY FOR $90");
  assert.equal(await page.locator("#mt-x").count(), 1);
  await page.click("#gs-buy");
  await page.waitForFunction(() => { const m = JSON.parse(localStorage.getItem("tabs-v1")).merch; return m.guitar === "stickerriot" && m.has?.includes("g-stickerriot"); });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).merch);
  assert.equal(saved.tspent, 90); assert.deepEqual(saved.has, ["g-stickerriot"]);
  await page.waitForSelector('.mc-gt[data-gt="stickerriot"].on'); assert.match(await page.locator('.mc-gt[data-gt="stickerriot"]').innerText(), /ON NOW/);
  assert.equal(await page.locator(".mc-gt-leg").count(), 1, "a way back to the leg's guitar");
  /* the Road is the rosewood neck in every look that uses it; the shop guitar still shows on Me and in your hands */
  await page.evaluate(() => { location.hash = "#/"; }); await page.waitForSelector(".rn-neck"); await settled(page);
  const cur = await page.locator(".rn-neck").evaluate(el => getComputedStyle(el).backgroundImage + el.innerHTML);
  assert.match(cur, /neck-rosewood(?:-v2)?\.webp/, "the Road stays the rosewood neck");
  assert.doesNotMatch(cur, /stickerriot-road\.webp/, "a shop guitar does not replace the neck");
  /* Me's case has it, and says it is the one you play */
  await page.evaluate(() => { location.hash = "#/you"; }); await page.waitForSelector(".rr-me"); await settled(page);
  assert.ok((await page.$$eval(".rr-gtr", els => els.map(e => e.getAttribute("aria-label")))).includes("Sticker Riot, from the Guitar shop, the one you play"));
  assert.match(await page.innerText(".rr-case-card .rr-card-h"), /1 guitar\b/);
  /* the guitarist holds it (the small picture in his hands) */
  const hands = await page.evaluate(async () => { const g = await import("./guitarist.js"); return g.you(JSON.parse(localStorage.getItem("tabs-v1")), { size: 120 }); });
  assert.match(hands, /art\/guitars\/stickerriot-small\.webp/, "the guitarist holds the guitar you chose");
  /* back to the leg's guitar, and the saved choice is gone */
  await page.evaluate(() => { location.hash = "#/merch"; }); await page.waitForSelector("#mc-gt-leg"); await settled(page);
  await page.click("#mc-gt-leg");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).merch.guitar === undefined);
  assert.equal(await page.locator(".mc-gt-leg").count(), 0);
  /* put it on again from the sheet: owned, no second charge */
  await page.click('.mc-gt[data-gt="stickerriot"]'); await page.waitForSelector("#gs-wear");
  assert.equal(await page.locator("#gs-buy").count(), 0); await page.click("#gs-wear");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).merch.guitar === "stickerriot");
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).merch)).tspent, 90, "charged once");
});

test("Road Ready 9a: a locked guitar and one you can't afford open a sheet whose button is off, and nothing is spent", { skip: skip() }, async t => {
  const page = await openShop(t, 1, { tips: 40 });
  await page.click('.mc-gt[data-gt="barebones"]'); await page.waitForSelector(".mt");
  assert.equal(await page.innerText(".mt-acts .btn"), "OPENS AT COFFEEHOUSE"); assert.equal(await page.isDisabled(".mt-acts .btn"), true);
  await page.click("#mt-not");
  await page.click('.mc-gt[data-gt="tartanpin"]'); await page.waitForSelector(".mt");
  assert.equal(await page.innerText(".mt-acts .btn"), "$50 MORE IN TIPS TO GO"); assert.equal(await page.isDisabled(".mt-acts .btn"), true);
  assert.doesNotMatch(await page.innerText(".mt-sheet"), /about \d+ shows?|hurry|limited|expires?|last chance|you missed/i);
  await page.click("#mt-not");
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).merch)).tspent, undefined);
});

test("Road Ready 9a: the Road is one rosewood neck, with six strings drawn on it", { skip: skip() }, async t => {
  const page = await phone(t, shopLib(0, {}), { home: true });
  await page.waitForSelector(".rn-neck"); await settled(page);
  const html = await page.locator(".rn-neck").evaluate(el => getComputedStyle(el).backgroundImage + el.innerHTML);
  assert.match(html, /neck-rosewood(?:-v2)?\.webp/);
  assert.equal(await page.locator(".rn-string").count(), 6, "six strings");
  assert.equal(await page.locator(".rn-neck").getAttribute("aria-label"), "The neck");
});

test("Road Ready 9a fix: for each of the 23 new pictures, lit and shade match the picture's own fretboard", { skip: skip() }, async t => {
  const PICS = (await import("../../art/guitars/pics.js")).default;
  const news = Object.entries(PICS).filter(([, p]) => p.str).map(([slug, p]) => ({ slug, lit: p.lit, shade: p.shade, cx: p.body.cx, nw: p.body.nw, end: p.body.end }));
  const page = await phone(t, LIB, { home: true });
  await page.waitForSelector("#h-fans");
  const out = await page.evaluate(async list => {
    const med = a => { a = a.slice().sort((x, y) => x - y); return a[a.length >> 1]; };
    const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const res = [];
    for (const g of list) {
      const im = new Image(); im.src = `/art/guitars/${g.slug}-body.webp`; await im.decode();
      const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d"); x.drawImage(im, 0, 0);
      /* the wood: of the pixels over the neck, the darker half (strings, fret wires and inlays are the bright ones), then the median of each channel */
      const half = (x0, x1) => { const px = []; const y0 = 0, y1 = 36; const w = Math.max(1, Math.round(x1 - x0)); const d = x.getImageData(Math.round(x0), y0, w, y1 - y0).data; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 250) px.push([d[i], d[i + 1], d[i + 2]]); px.sort((p, q) => p[0] + p[1] + p[2] - q[0] - q[1] - q[2]); const dark = px.slice(0, Math.ceil(px.length / 2)); return [0, 1, 2].map(k => med(dark.map(p => p[k]))); };
      const L = half(g.cx - .35 * g.nw, g.cx - .05 * g.nw), R = half(g.cx + .05 * g.nw, g.cx + .35 * g.nw);
      const d = (u, v) => u.reduce((s, q, i) => s + Math.abs(q - v[i]), 0);
      res.push({ slug: g.slug, l: d(L, hex(g.lit)), r: d(R, hex(g.shade)) });
    }
    return res;
  }, news);
  assert.equal(out.length, 23);
  if (process.env.DBG) console.log(JSON.stringify(out.map(o => [o.slug, o.l, o.r])));
  for (const o of out) { assert.ok(o.l <= 70 && o.r <= 70, `${o.slug}: lit is ${o.l} and shade ${o.r} away from the picture's own fretboard`); }
});
