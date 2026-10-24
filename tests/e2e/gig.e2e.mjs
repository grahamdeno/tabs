// Browser tests for the Gig, the main Play path in version 4 (clean-up Step 7.1).
// Most other tests set plainPlay: true and never open it; these leave it off.
// Run: node --test tests/e2e/gig.e2e.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { chromium, base, phone, skip, LIB, FAKE_MIC, useBrowser, settled } from "./harness.mjs";

useBrowser();

/* A page that hears a strum every 400 ms, with the library in place before the app starts.
   Seeding it before the first load (instead of replacing it after) means the app's own first
   save can't land on top of it, which is what made the scored Gig test flaky on a busy machine. */
async function strummingPage(t, lib, hash, { strum = true } = {}) {
  const browser2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => browser2.close());
  const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(FAKE_MIC);
  await ctx.addInitScript(json => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("tabs-v1", json); } }, JSON.stringify(lib));
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  t.after(() => assert.deepEqual(errors, [], "page errors"));
  await page.goto(base + hash); await page.waitForSelector("#play"); await settled(page);
  if (strum) await page.evaluate(() => { setInterval(() => { window.__hz = 110; setTimeout(() => { window.__hz = 0; }, 90); }, 400); });
  return page;
}
const SHORT = { id: "g", title: "Short Road", artist: "Me", key: "A", format: "chords", duration: 16,
  body: "[Verse]\nA        D\nWalking down the road\nE        A\nLantern in my hand\n\n[Chorus]\nD        A\nCarry me home\nE        A\nLay me down" };
const LONG = { ...SHORT, duration: 200, body: "[Verse]\n" + Array.from({ length: 8 }, (_, i) => `A        D\nVerse line ${i + 1}`).join("\n") + "\n\n[Chorus]\n" + Array.from({ length: 8 }, (_, i) => `E        A\nChorus line ${i + 1}`).join("\n") };
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")));

test("The Gig (4.1.0, 4.2.0, 4.14.0): a scored show from Play to Show complete, with a Double set and the merch tip", { skip: skip() }, async t => {
  /* 400 fans from earlier shows: enough for the Brick wall backdrop (300), the cheapest thing not owned */
  const page = await strummingPage(t, { ...LIB, songs: [SHORT], gig: { shows: 3, fans: 400, best: {} }, merch: { own: { double: 2 } }, settings: { ...LIB.settings, plainPlay: false } }, "#/song/g");
  assert.equal(await page.getAttribute("#play", "aria-label"), "Play as a gig");
  await page.click("#play"); await page.waitForSelector("#gig");
  assert.ok(await page.locator("#gg-lines > *").count() >= 4, "4.43.0: words first, every line that fits");
  assert.equal(await page.locator(".gg-map i").count(), 2, "the song map: a gel for each section");
  assert.equal(await page.locator("#gg-lc").count(), 0, "4.2.0: Lines moved to Tools");
  /* Hearing you: a tap stops listening for this show, another starts it again */
  await page.waitForFunction(() => /Hearing you/.test(document.getElementById("gg-mic").getAttribute("aria-label")));
  await page.click("#gg-mic");
  assert.match(await page.getAttribute("#gg-mic", "aria-label"), /Not listening/);
  await page.click("#gg-mic");
  await page.waitForFunction(() => /Hearing you/.test(document.getElementById("gg-mic").getAttribute("aria-label")));
  /* Paused, the show holds the line you stopped on; Tools has only what you change mid-song */
  await page.click("#gg-pause"); await page.waitForSelector("#gg-hold:not([hidden])");
  assert.equal(await page.locator("#gg-hline, .gg-here").count(), 0, "4.49.13: no focus card on pause");
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("gg-lines")).opacity), "1", "the lines are not dimmed");
  assert.equal(await page.locator("#gg-lines .gl-now").count(), 1, "the line you stopped on stays on its band");
  await page.click("#gg-tools"); await page.waitForSelector(".menu.tools");
  assert.equal(await page.locator('.menu [data-m="edit"]').count(), 0, "from a show, only what you change mid-song");
  await page.mouse.click(200, 120); await page.waitForSelector(".menu", { state: "detached" });
  assert.equal(await page.locator("#gig.paused").count(), 1, "a tap above Tools closes it, and the show stays paused");
  await page.click("#gg-resume"); await page.waitForSelector("#gg-hold[hidden]", { state: "attached" });
  await page.waitForFunction(() => document.getElementById("gg-sec").textContent === "CHORUS", null, { timeout: 15000 });
  assert.equal(await page.getAttribute("#gig", "data-gel"), "chorus", "the stage washes into the chorus gel");
  /* Show complete */
  await page.waitForSelector(".gc", { timeout: 40000 });
  assert.match(await page.innerText(".gc-t"), /Show complete/);
  assert.match(await page.innerText(".gc-list"), /changes landed/, "the show was graded");
  assert.match(await page.innerText(".gc-list"), /Double set: 2x XP on this show\. 1 more to go\./);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1"))?.gig?.shows === 4); /* the save lands a moment after */
  const s = await saved(page);
  assert.ok(s.gig.best.g >= 0, "a best score for the song");
  assert.equal(s.songs[0].playLog.total, 1, "the show counts as a play");
  assert.equal(s.merch.own.double, 1, "one Double set used");
  assert.deepEqual(s.merch.told, ["brick"], "the merch tip is said once");
  assert.match(await page.innerText("#gc-merch"), /Brick wall/);
  await page.click("#gc-merch");
  await page.waitForFunction(() => location.hash === "#/merch" && !document.getElementById("gig"));
  await page.waitForSelector(".mc-head");
  await page.evaluate(() => { location.hash = "#/song/g"; }); await page.waitForSelector(".shead .meta");
  assert.match(await page.innerText(".shead .meta"), /Best show \d+%/, "the song shows its best show");
});

test("Gig: paused, Tools has no Lines in a gig (4.43.0); Resume plays on; Sheet goes back", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [LONG], settings: { ...LIB.settings, plainPlay: false, gigScore: false, countIn: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/g"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector("#gig");
  await page.click("#gg-pause"); await page.waitForSelector("#gg-hold:not([hidden])");
  const held = await page.innerText("#gg-lines .gl-now");
  await page.click("#gg-tools"); await page.waitForSelector(".menu.tools");
  assert.equal(await page.locator(".menu [data-lines]").count(), 0, "no Lines in a gig");
  await page.mouse.click(200, 120); await page.waitForSelector(".menu", { state: "detached" });
  assert.equal(await page.innerText("#gg-lines .gl-now"), held, "Tools while paused keeps the line you stopped on");
  assert.equal(await page.locator("#gig.paused").count(), 1, "still paused");
  const at = await page.evaluate(() => document.getElementById("gg-mark").style.left);
  await page.click("#gg-resume"); await page.waitForSelector("#gg-hold[hidden]", { state: "attached" });
  assert.equal(await page.locator("#gig.paused").count(), 0);
  await page.waitForFunction(a => document.getElementById("gg-mark").style.left !== a, at, { timeout: 8000 });
  await page.click("#gg-pause"); await page.waitForSelector("#gg-hold:not([hidden])");
  await page.click("#gg-sheet"); await page.waitForFunction(() => !document.getElementById("gig"));
  assert.equal(await page.evaluate(() => location.hash), "#/song/g", "Sheet: back to the song, paused");
});

test("4.49.12 the Metronome switch in a gig is the band's switch: Beat's drums go quiet when it is off, and come back when it is on", { skip: skip() }, async t => {
  const lib = { ...LIB, songs: [LONG], journal: { v: 1, months: { "2026-01": { plays: 7 } } }, settings: { ...LIB.settings, plainPlay: false, gigScore: false, countIn: false, metronome: false } };
  const page = await phone(t, lib, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/g"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector("#gig");
  await page.waitForFunction(() => import("/audio.js").then(m => m.metro.timer > 0), null, { timeout: 8000 });
  await page.click("#gg-pause"); await page.waitForSelector("#gg-hold:not([hidden])");
  await page.click("#gg-tools"); await page.waitForSelector(".menu.tools");
  assert.equal(await page.getAttribute(".menu [data-m='metro']", "aria-checked"), "true", "Beat is playing, so the switch says on");
  await page.click(".menu [data-m='metro']");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.bandPlays === false);
  assert.equal(await page.getAttribute(".menu [data-m='metro']", "aria-checked"), "false");
  assert.equal(await page.evaluate(() => import("/audio.js").then(m => m.metroOn())), false, "no drums once it is off");
  await page.mouse.click(200, 120); await page.waitForSelector(".menu", { state: "detached" });
  await page.click("#gg-resume"); await page.waitForSelector("#gg-hold[hidden]", { state: "attached" });
  /* real timer */ await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => import("/audio.js").then(m => m.metro.timer)), 0, "Resume does not start the drums again");
  await page.click("#gg-pause"); await page.waitForSelector("#gg-hold:not([hidden])");
  await page.click("#gg-tools"); await page.waitForSelector(".menu.tools");
  await page.click(".menu [data-m='metro']");
  await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem("tabs-v1")).settings; return s.metronome === true && s.bandPlays === undefined; });
  assert.equal(await page.evaluate(() => import("/audio.js").then(m => m.metroOn())), true);
});

test("4.2.2 the Gig moves under a finger: drag the lines or the line you stopped on", { skip: skip() }, async t => {
  const long = { id: "l", title: "Long", artist: "A", key: "G", format: "chords", duration: 300, body: "[Verse]\n" + Array.from({ length: 30 }, (_, i) => `G   C\nLine ${i} of the song`).join("\n") + "\n\n[Chorus]\nD   G\nThe end" };
  const page = await phone(t, { ...LIB, songs: [long], settings: { ...LIB.settings, plainPlay: false, gigScore: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/l"; }); await page.waitForSelector("#play");
  await page.click("#play"); await page.waitForSelector("#gig");
  await page.click("#gg-pause"); await page.waitForSelector("#gg-hold:not([hidden])");
  assert.match(await page.getAttribute("#gg-mic", "aria-label"), /Not listening/, "Score my plays off: the show starts unscored");
  const before = await page.evaluate(() => scrollY), line = await page.innerText("#gg-lines .gl-now");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 420 }] });
  for (let y = 410; y >= 200; y -= 30) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y }] }); await page.waitForTimeout(16); /* real timer */ }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForFunction(b => scrollY > b + 150, before);
  await page.waitForFunction(l => document.querySelector("#gg-lines .gl-now").innerText !== l, line);
  assert.equal(await page.locator("#gig.paused").count(), 1, "still paused");
});

test("4.43.0 words first: the chord you're on lit in the line, the next one with its beats, a repeat shown once, a shape for a new chord, big cards with no words", { skip: skip() }, async t => {
  const body = "[Intro]\nG   C   G   C\n\n[Verse]\n" + Array.from({ length: 12 }, (_, i) => `G        G        Fmaj7\nLine ${i + 1} of the verse goes here`).join("\n");
  const song = { id: "w", title: "Words", artist: "A", key: "G", format: "chords", duration: 240, bpm: 80, body };
  const journal = { v: 1, since: "2026-01-01", seeded: "2026-01-01", secs: 0, changes: {}, keys: {}, months: {}, week: Array(168).fill(0), best: 0, firsts: [], tune: { n: 0, checked: Array(6).fill(0), drift: Array(6).fill(0) }, chords: { G: { n: 9, first: "2026-01-01" }, C: { n: 9, first: "2026-01-01" } } };
  const page = await phone(t, { ...LIB, songs: [song], journal, settings: { ...LIB.settings, plainPlay: false, gigScore: false, countIn: false, diagrams: true } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/w"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector("#gig");
  /* the intro has no words: the big Now and Next */
  await page.waitForSelector("#gig.bigc");
  assert.ok(await page.locator(".gg-chords").isVisible(), "big cards in the intro");
  /* into the verse: words first */
  await page.waitForFunction(() => !document.getElementById("gig").classList.contains("bigc"), null, { timeout: 20000 });
  assert.equal(await page.locator(".gg-chords").isVisible(), false, "no big cards over words");
  assert.ok(await page.locator("#gg-lines > *").count() >= 7, "at least seven lines on screen");
  await page.waitForSelector("#gg-lines .gc-lit:not(.gc-rep) .ct"); await page.waitForSelector("#gg-lines .gc-next .ct"); await page.waitForSelector("#gg-lines .gc-run i", { state: "attached" });
  assert.ok(await page.locator("#gg-lines .gc-rep").count() > 0, "a chord played again in a row is hidden");
  await page.waitForFunction(() => { const s = document.getElementById("gg-shape"); return s && !s.hidden && /Fmaj7/.test(s.textContent); }, null, { timeout: 20000 });
  assert.match(await page.innerText("#gg-shape"), /NEW CHORD/, "a shape for the chord you haven't learned");
  assert.equal(await page.locator("#gg-tw").count(), 1, "timing lives beside the combo");
  assert.equal(await page.locator(".gg-timing, .gg-louie, .gg-crowd").count(), 0, "no timing bar, no Louie card, no crowd card");
});

test("4.46.0 Score the timing: off by default; Settings > Playing turns it on and it is saved", { skip: skip() }, async t => {
  const page = await phone(t, LIB, {});
  await page.goto(page.url().split("#")[0] + "#/settings/playing"); await page.waitForSelector("#s-time"); await settled(page);
  assert.equal(await page.getAttribute("#s-time", "aria-checked"), "false", "off by default");
  assert.match(await page.innerText(".set:has(#s-time)"), /Score the timing[\s\S]*late change breaks the combo/);
  await page.click("#s-time");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.gigTime === true);
});

test("4.41.0 a sheet whose chords are a guess: a change you don't strum is never a miss", { skip: skip() }, async t => {
  const page = await strummingPage(t, { ...LIB, songs: [{ ...SHORT, spots: "guess" }], settings: { ...LIB.settings, plainPlay: false } }, "#/song/g", { strum: false });
  await page.click("#play"); await page.waitForSelector("#gig");
  await page.waitForSelector(".gc", { timeout: 40000 });
  assert.match(await page.innerText(".gc-list"), /still a best guess, so a change you missed wasn't counted/);
  assert.equal(await page.locator(".gc-list b").filter({ hasText: /^0$/ }).count(), 0, "no 0 of n changes landed");
});

test("4.49.10 the beat dots sit between the chord you're on and the next, one lit at a time stepping toward it; no sweep; the crowd are fans", { skip: skip() }, async t => {
  const body = "[Verse]\n" + Array.from({ length: 12 }, (_, i) => `G                       C\nLine ${i + 1} of the verse goes on here`).join("\n");
  const song = { id: "w", title: "Words", artist: "A", key: "G", format: "chords", duration: 240, bpm: 80, body };
  const page = await phone(t, { ...LIB, songs: [song], settings: { ...LIB.settings, plainPlay: false, gigScore: false, countIn: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/w"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector("#gig #gg-lines .gl-now");
  /* 4.49.14: the band and every line run the full width of the screen, so the time after the words reads as space in the line */
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#gg-lines > *")].map(e => { const r = e.getBoundingClientRect(); return Math.round(r.left) === 0 && Math.round(r.width) === innerWidth; }).every(Boolean)), true, "full-width lines");
  assert.equal(await page.locator(".gl-sweep").count(), 0, "no sweep");
  assert.equal(await page.locator("#gg-lines .gl-next").count(), 1, "one next line");
  assert.equal(await page.locator("#gg-fans i svg").count(), 12, "the crowd is 12 fans");
  const geo = await page.waitForFunction(() => {
    const run = document.querySelector("#gg-lines .gc-run"), lit = document.querySelector("#gg-lines .gc-lit .ct");
    if (!run || !lit || !run.children.length) return null;
    const xs = [...run.children].map(e => e.getBoundingClientRect().left);
    return { first: xs[0], last: xs[xs.length - 1], n: xs.length, chordRight: lit.getBoundingClientRect().right, on: run.querySelectorAll("i.on").length };
  }, null, { timeout: 20000 }).then(h => h.jsonValue());
  assert.ok(geo.first > geo.chordRight, "the dots start on the right of the chord you're on");
  assert.ok(geo.n >= 2 && geo.last > geo.first, "spread out toward the next chord");
  await page.waitForFunction(() => document.querySelectorAll("#gg-lines .gc-run i.on").length === 1, null, { timeout: 20000 });
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#gg-lines .gc-next .ct")).backgroundColor), "rgba(0, 0, 0, 0)", "the next chord stays plain until the dots reach it (4.49.11)");
});

test("4.49.6 a chord before the singing stands ahead of the words on the song page", { skip: skip() }, async t => {
  const song = { id: "l", title: "Lead", artist: "A", key: "Em", format: "chords", body: "[Verse]\nEm            C\n  Down the river   slowly" };
  const page = await phone(t, { ...LIB, songs: [song] }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/l"; }); await page.waitForSelector("#sheet .pr"); await settled(page);
  assert.equal(await page.locator("#sheet .w.lead .c").innerText(), "Em");
  const x = await page.evaluate(() => ({ lead: document.querySelector("#sheet .w.lead").getBoundingClientRect().right, word: [...document.querySelectorAll("#sheet .w")].find(w => /Down/.test(w.textContent)).getBoundingClientRect().left }));
  assert.ok(x.word > x.lead, "the words start after the lead chord");
});

test("4.49.9 the big chord cards are off by default: the lines fill the screen in an intro; Now and Next in Tools turns them on without leaving the show", { skip: skip() }, async t => {
  const body = "[Intro]\n" + Array.from({ length: 6 }, () => "G   C   G   C").join("\n") + "\n\n[Verse]\nG        C\nLine one goes here";
  const song = { id: "i", title: "Intro", artist: "A", key: "G", format: "chords", duration: 240, bpm: 80, body };
  const page = await phone(t, { ...LIB, songs: [song], settings: { ...LIB.settings, plainPlay: false, gigScore: false, countIn: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/i"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector("#gig #gg-lines .gl-now .c");
  assert.equal(await page.locator("#gig.bigc").count(), 0, "no big cards by default");
  assert.equal(await page.locator(".gg-chords").isVisible(), false);
  await page.click("#gg-pause"); await page.waitForSelector("#gg-hold:not([hidden])");
  await page.click("#gg-tools"); await page.waitForSelector('.menu [data-m="nn"]');
  await page.click('.menu [data-m="nn"]');
  await page.waitForSelector("#gig.bigc");
  assert.equal(await page.locator("#gig").count(), 1, "still in the show");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.diagrams === true);
});
