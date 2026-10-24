// Browser tests for the Gig, the main Play path in version 4 (clean-up Step 7.1).
// Most other tests set plainPlay: true and never open it; these leave it off.
// Run: node --test tests/e2e/gig.e2e.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { chromium, base, phone, skip, LIB, FAKE_MIC, CHORD_PLAYER, useBrowser, settled } from "./harness.mjs";

useBrowser();

/* A page whose microphone plays the chord the song is on (4.54.0), with the library in place before the app starts.
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
  if (strum) await page.evaluate(CHORD_PLAYER); /* 4.54.0: plays the chord the song is waiting for */
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
  await page.waitForSelector("#sheet > .st-now");
  assert.equal(await page.locator("#gg-lines").count(), 0, "4.51.0: the lines are the song page itself, not a copy");
  assert.ok(await page.evaluate(() => document.body.classList.contains("staged")), "the page is the stage");
  assert.equal(await page.locator(".gg-map, #st-map, #gg-str, #gg-tw").count(), 0, "4.54.0: no song map over the stage, no strings, no timing word");
  /* 4.58.0: bold words that fade by distance; the chords stay brighter than the words; nothing runs past the edge */
  const look = await page.evaluate(() => {
    const now = document.querySelector("#sheet > .st-now"), next = document.querySelector("#sheet > .st-next"), sheet = document.getElementById("sheet");
    const alpha = c => { const m = c.match(/[\d.]+/g); return m.length > 3 ? +m[3] : 1; };
    const w = el => +getComputedStyle(el).fontWeight, col = el => alpha(getComputedStyle(el).color);
    const nc = next?.querySelector(".c");
    return { now: w(now), next: next ? w(next) : 0, nowCol: col(now), nextCol: next ? col(next) : 0, chordBrighter: nc ? +getComputedStyle(nc).opacity > col(next) : true,
      overflow: [...sheet.querySelectorAll(":scope > .pr, :scope > .ly, :scope > .crow")].some(l => [...l.children].some(c => c.getBoundingClientRect().right > sheet.getBoundingClientRect().right + 1)) };
  });
  assert.equal(look.now, 800, "4.58.0: the line you're on is boldest");
  assert.ok(look.next === 700 || look.next === 0, "4.58.0: the next line is bold, got " + look.next);
  assert.ok(look.nowCol > look.nextCol, "4.58.0: the next line's words are dimmer than the current line's");
  assert.ok(look.chordBrighter, "4.58.0: the next line's chords are brighter than its words");
  assert.equal(look.overflow, false, "4.58.0: no line runs past the edge at the boldest weight");
  assert.equal(await page.locator("#gg-lc").count(), 0, "4.2.0: Lines moved to Tools");
  /* Hearing you: a tap stops listening for this show, another starts it again */
  await page.waitForFunction(() => /Hearing you/.test(document.getElementById("gg-mic").getAttribute("aria-label")));
  await page.click("#gg-mic");
  assert.match(await page.getAttribute("#gg-mic", "aria-label"), /Not listening/);
  await page.click("#gg-mic");
  await page.waitForFunction(() => /Hearing you/.test(document.getElementById("gg-mic").getAttribute("aria-label")));
  /* Paused, the show holds the line you stopped on; Tools has only what you change mid-song */
  await page.click("#gg-pause"); await page.waitForSelector("body.held"); await settled(page);
  assert.equal(await page.locator("#gg-hline, .gg-here, #gg-hold, #gg-back, #gg-sheet").count(), 0, "4.52.0: no pause screen, no Back a line, no Sheet");
  assert.ok(await page.locator(".app.viewer .shead").isVisible(), "paused, the song page is back");
  assert.match(await page.innerText("#play"), /RESUME/, "Play reads Resume");
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#sheet > .st-now")).opacity === "1"); /* the line you stopped on is not dimmed */
  assert.equal(await page.locator("#sheet > .st-now").count(), 1, "the line you stopped on stays on its band");
  await page.click("#more"); await page.waitForSelector(".menu.tools");
  assert.equal(await page.locator('.menu [data-m="edit"]').count(), 0, "from a show, only what you change mid-song");
  await page.keyboard.press("Escape"); await page.waitForSelector(".menu", { state: "detached" });
  assert.equal(await page.locator("#gig.paused").count(), 1, "closing Tools, the show stays paused");
  await page.click("#play"); await page.waitForSelector("body.staged:not(.held)");
  await page.waitForFunction(() => document.getElementById("gg-sec").textContent === "CHORUS", null, { timeout: 15000 });
  assert.equal(await page.evaluate(() => document.body.dataset.gel), "chorus", "the stage washes into the chorus gel");
  /* Show complete */
  await page.waitForSelector(".gc", { timeout: 40000 });
  assert.match(await page.innerText(".gc-t"), /Show complete/);
  assert.match(await page.innerText(".gc-list"), /chords caught/, "the show was graded");
  assert.ok(await page.locator(".gc-song .gc-ch.got").count() > 0, "the song you played lists the chords you caught");
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

test("Gig: paused, Tools has no Lines in a gig (4.43.0); Play resumes the show; the page's Back ends it", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [LONG], settings: { ...LIB.settings, plainPlay: false, gigScore: false, countIn: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/g"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector("#gig");
  await page.click("#gg-pause"); await page.waitForSelector("body.held"); await settled(page);
  const held = await page.innerText("#sheet > .st-now");
  await page.click("#more"); await page.waitForSelector(".menu.tools");
  assert.equal(await page.locator(".menu [data-lines]").count(), 0, "no Lines in a gig");
  await page.keyboard.press("Escape"); await page.waitForSelector(".menu", { state: "detached" });
  assert.equal(await page.innerText("#sheet > .st-now"), held, "Tools while paused keeps the line you stopped on");
  assert.equal(await page.locator("#gig.paused").count(), 1, "still paused");
  const at = await page.evaluate(() => scrollY);
  await page.click("#play"); await page.waitForSelector("body.staged:not(.held)");
  assert.equal(await page.locator("#gig.paused").count(), 0);
  await page.waitForFunction(a => scrollY > a + 20, at, { timeout: 8000 });
  await page.keyboard.press("Shift"); /* 4.60.0: the controls may have faded; a key wakes them without pressing */
  await page.click("#gg-pause"); await page.waitForSelector("body.held"); await settled(page);
  assert.equal(await page.evaluate(() => location.hash), "#/song/g", "paused on the song page");
  assert.ok(await page.evaluate(() => { const b = getComputedStyle(document.querySelector("#sheet > .st-now"), "::before"); return b.content !== "none"; }), "a quiet band on the line you stopped on");
  await page.click(".shead .sh-back"); await page.waitForFunction(() => !document.getElementById("gig"));
  assert.equal(await page.evaluate(() => document.body.classList.contains("held") || document.body.classList.contains("staged")), false, "leaving ends the show and clears the stage");
});

test("4.49.12 the Metronome switch in a gig is the band's switch: Beat's drums go quiet when it is off, and come back when it is on", { skip: skip() }, async t => {
  const lib = { ...LIB, songs: [LONG], journal: { v: 1, months: { "2026-01": { plays: 7 } } }, settings: { ...LIB.settings, plainPlay: false, gigScore: false, countIn: false, metronome: false } };
  const page = await phone(t, lib, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/g"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector("#gig");
  await page.waitForFunction(() => import("/audio.js").then(m => m.metro.timer > 0), null, { timeout: 8000 });
  await page.click("#gg-pause"); await page.waitForSelector("body.held"); await settled(page);
  await page.click("#more"); await page.waitForSelector(".menu.tools");
  assert.equal(await page.getAttribute(".menu [data-m='metro']", "aria-checked"), "true", "Beat is playing, so the switch says on");
  await page.click(".menu [data-m='metro']");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.bandPlays === false);
  assert.equal(await page.getAttribute(".menu [data-m='metro']", "aria-checked"), "false");
  assert.equal(await page.evaluate(() => import("/audio.js").then(m => m.metroOn())), false, "no drums once it is off");
  await page.keyboard.press("Escape"); await page.waitForSelector(".menu", { state: "detached" });
  await page.click("#play"); await page.waitForSelector("body.staged:not(.held)");
  /* real timer */ await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => import("/audio.js").then(m => m.metro.timer)), 0, "Resume does not start the drums again");
  await page.click("#gg-pause"); await page.waitForSelector("body.held"); await settled(page);
  await page.click("#more"); await page.waitForSelector(".menu.tools");
  await page.click(".menu [data-m='metro']");
  await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem("tabs-v1")).settings; return s.metronome === true && s.bandPlays === undefined; });
  assert.equal(await page.evaluate(() => import("/audio.js").then(m => m.metroOn())), true);
});

test("4.2.2 the Gig moves under a finger: drag the lines or the line you stopped on", { skip: skip() }, async t => {
  const long = { id: "l", title: "Long", artist: "A", key: "G", format: "chords", duration: 300, body: "[Verse]\n" + Array.from({ length: 30 }, (_, i) => `G   C\nLine ${i} of the song`).join("\n") + "\n\n[Chorus]\nD   G\nThe end" };
  const page = await phone(t, { ...LIB, songs: [long], settings: { ...LIB.settings, plainPlay: false, gigScore: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/l"; }); await page.waitForSelector("#play");
  await page.click("#play"); await page.waitForSelector("#gig");
  await page.click("#gg-pause"); await page.waitForSelector("body.held"); await settled(page);
  assert.match(await page.getAttribute("#gg-mic", "aria-label"), /Not listening/, "Score my plays off: the show starts unscored");
  const before = await page.evaluate(() => scrollY), line = await page.innerText("#sheet > .st-now");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 420 }] });
  for (let y = 410; y >= 200; y -= 30) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y }] }); await page.waitForTimeout(16); /* real timer */ }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForFunction(b => scrollY > b + 150, before);
  await page.waitForFunction(l => document.querySelector("#sheet > .st-now").innerText !== l, line);
  assert.equal(await page.locator("#gig.paused").count(), 1, "still paused");
});

test("4.54.0 words first: a repeat shown once, a shape for a chord you haven't learned, no dots and no lit chord", { skip: skip() }, async t => {
  const body = "[Intro]\nG   C   G   C\n\n[Verse]\n" + Array.from({ length: 12 }, (_, i) => `G        G        Fmaj7\nLine ${i + 1} of the verse goes here`).join("\n");
  const song = { id: "w", title: "Words", artist: "A", key: "G", format: "chords", duration: 240, bpm: 80, body };
  const journal = { v: 1, since: "2026-01-01", seeded: "2026-01-01", secs: 0, changes: {}, keys: {}, months: {}, week: Array(168).fill(0), best: 0, firsts: [], tune: { n: 0, checked: Array(6).fill(0), drift: Array(6).fill(0) }, chords: { G: { n: 9, first: "2026-01-01" }, C: { n: 9, first: "2026-01-01" } } };
  const page = await phone(t, { ...LIB, songs: [song], journal, settings: { ...LIB.settings, plainPlay: false, gigScore: false, countIn: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/w"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector("#gig");
  /* words first (4.50.0: the big Now and Next cards are gone, so an intro is lines too) */
  assert.equal(await page.locator(".gg-chords, #gig.bigc").count(), 0, "no big cards");
  await page.waitForSelector("#sheet > .st-now");
  assert.equal(await page.locator("#sheet .gc-run, #sheet .st-lit").count(), 0, "4.54.0: no beat dots and no lit chord");
  assert.ok(await page.locator("#sheet .c.st-rep").count() > 0, "a chord played again in a row is hidden");
  await page.waitForFunction(() => { const s = document.getElementById("gg-shape"); return s && !s.hidden && /Fmaj7/.test(s.textContent); }, null, { timeout: 40000 }); /* the taller chord tiles put the first line lower, so the song takes longer to get there */
  assert.match(await page.innerText("#gg-shape"), /NOW|NEXT/, "a shape for the chord you haven't learned");
  assert.equal(await page.locator(".gg-timing, .gg-louie, .gg-crowd").count(), 0, "no timing bar, no Louie card, no crowd card");
});

test("4.41.0 a sheet whose chords are a guess: a chord you don't play is never a miss", { skip: skip() }, async t => {
  const page = await strummingPage(t, { ...LIB, songs: [{ ...SHORT, spots: "guess" }], settings: { ...LIB.settings, plainPlay: false } }, "#/song/g", { strum: false });
  await page.click("#play"); await page.waitForSelector("#gig");
  await page.waitForSelector(".gc", { timeout: 40000 });
  assert.match(await page.innerText(".gc-list"), /still a best guess, so a chord you missed wasn't counted/);
});

test("4.54.0 Chord Catch: a chord you play turns green and stays green, the combo counts the run, and the crowd is bigger", { skip: skip() }, async t => {
  const body = "[Verse]\n" + Array.from({ length: 6 }, (_, i) => `G        C\nLine ${i + 1} of the verse goes on here`).join("\n");
  const song = { id: "k", title: "Catch", artist: "A", key: "G", format: "chords", duration: 40, bpm: 120, body };
  const page = await strummingPage(t, { ...LIB, songs: [song], settings: { ...LIB.settings, plainPlay: false, countIn: false } }, "#/song/k");
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  assert.equal(await page.locator("#gg-fans svg").count(), 12, "the crowd is 12 fans");
  assert.ok(await page.evaluate(() => document.querySelector("#gg-fans").getBoundingClientRect().height >= 50), "a bigger crowd, on its own row");
  await page.waitForSelector("#sheet .c.st-got", { state: "attached", timeout: 25000 });
  const first = await page.evaluate(() => [...document.querySelectorAll("#sheet .c[data-ch]")].findIndex(e => e.classList.contains("st-got")));
  await page.waitForFunction(() => document.querySelectorAll("#sheet .c.st-got").length >= 3, null, { timeout: 25000 });
  assert.ok(await page.evaluate(i => document.querySelectorAll("#sheet .c[data-ch]")[i].classList.contains("st-got"), first), "once green, it stays green");
  assert.ok(await page.evaluate(() => { const e = document.querySelector("#sheet .c.st-got .ct"); return getComputedStyle(e).textDecorationLine === "underline"; }), "caught is marked by a bar as well as the colour");
  await page.waitForFunction(() => /in a row/.test(document.getElementById("gg-combo").textContent), null, { timeout: 25000 });
  assert.equal(await page.locator("#sheet .gc-run, #sheet .st-lit").count(), 0, "no beat dots and no lit chord");
});

test("4.54.0 Chord Catch: a chord that goes by unplayed stays plain, with no snapped string; Show complete lists it outlined", { skip: skip() }, async t => {
  const page = await strummingPage(t, { ...LIB, songs: [SHORT], settings: { ...LIB.settings, plainPlay: false, countIn: false } }, "#/song/g", { strum: false });
  await page.click("#play"); await page.waitForSelector("#gig");
  await page.waitForSelector("#sheet .c.st-miss", { state: "attached", timeout: 25000 });
  assert.equal(await page.locator("#sheet .c.st-got").count(), 0, "nothing caught in a silent room");
  await page.waitForSelector(".gc", { timeout: 40000 });
  assert.match(await page.innerText(".gc-list"), /0 of \d+ chords caught/);
  assert.ok(await page.locator(".gc-song .gc-ch.miss").count() > 0, "the song you played shows the chords that went by");
  assert.match(await page.innerText(".gc-worst"), /MISSED MOST[\s\S]*to/);
});

test("4.49.6 a chord before the singing stands ahead of the words on the song page", { skip: skip() }, async t => {
  const song = { id: "l", title: "Lead", artist: "A", key: "Em", format: "chords", body: "[Verse]\nEm            C\n  Down the river   slowly" };
  const page = await phone(t, { ...LIB, songs: [song] }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/l"; }); await page.waitForSelector("#sheet .pr"); await settled(page);
  assert.equal(await page.locator("#sheet .w.lead .c").innerText(), "Em");
  const x = await page.evaluate(() => ({ lead: document.querySelector("#sheet .w.lead").getBoundingClientRect().right, word: [...document.querySelectorAll("#sheet .w")].find(w => /Down/.test(w.textContent)).getBoundingClientRect().left }));
  assert.ok(x.word > x.lead, "the words start after the lead chord");
});

test("4.50.0 Now and Next is gone: an intro is lines like any other, and Tools has no switch for it", { skip: skip() }, async t => {
  const body = "[Intro]\n" + Array.from({ length: 6 }, () => "G   C   G   C").join("\n") + "\n\n[Verse]\nG        C\nLine one goes here";
  const song = { id: "i", title: "Intro", artist: "A", key: "G", format: "chords", duration: 240, bpm: 80, body };
  const page = await phone(t, { ...LIB, songs: [song], settings: { ...LIB.settings, plainPlay: false, gigScore: false, countIn: false, diagrams: true } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/i"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now .c");
  assert.equal(await page.locator("#gig.bigc, .gg-chords").count(), 0, "no big cards, even with the old setting on");
  await page.click("#gg-pause"); await page.waitForSelector("body.held"); await settled(page);
  await page.click("#more"); await page.waitForSelector(".menu.tools");
  assert.equal(await page.locator('.menu [data-m="nn"]').count(), 0, "no Now and Next row");
});

test("4.51.0 one page: a line of the song fits on one line, an intro's chords spread across, a quiet stage light behind the words", { skip: skip() }, async t => {
  const body = "[Intro]\nG   D   Em   C\n\n[Verse]\n" + Array.from({ length: 8 }, (_, i) => `G              D              Em\nThey keep the secrets that the sailors keep ${i}`).join("\n");
  const song = { id: "f", title: "Fit", artist: "A", key: "G", format: "chords", duration: 240, bpm: 80, body };
  const page = await phone(t, { ...LIB, songs: [song], settings: { ...LIB.settings, plainPlay: false, gigScore: false, countIn: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/f"; }); await page.waitForSelector("#sheet .pr"); await settled(page);
  const oneLine = () => page.evaluate(() => [...document.querySelectorAll("#sheet > .pr")].every(pr => new Set([...pr.querySelectorAll(".w")].map(w => Math.round(w.getBoundingClientRect().top))).size === 1));
  assert.ok(await oneLine(), "every line of the song is one line on screen");
  const size = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById("sheet")).fontSize));
  assert.ok(size >= 14 && size <= 22, `the text is sized to fit (${size}px)`);
  const spread = await page.evaluate(() => { const r = document.querySelector("#sheet > .crow"), cs = [...r.querySelectorAll(".c")]; return cs[cs.length - 1].getBoundingClientRect().left - r.getBoundingClientRect().left > r.getBoundingClientRect().width * 0.6; });
  assert.ok(spread, "an intro's chords spread across the width");
  const hs = await page.evaluate(() => [document.querySelector("#sheet > .crow"), document.querySelector("#sheet > .pr")].map(e => e.getBoundingClientRect().height));
  assert.ok(Math.abs(hs[0] - hs[1]) <= 3, `4.56.0: a row of chords with no words is as tall as a sung line, paused too (${hs[0]} and ${hs[1]})`);
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  assert.ok(await oneLine(), "playing, nothing rewraps");
  await page.evaluate(() => { /* a redraw during the show measures at the boldest weight, not the stage's */
    const sh = document.getElementById("sheet"); sh.classList.add("measure");
    const w = [...sh.querySelectorAll(":scope > .pr")].map(e => getComputedStyle(e).fontWeight); sh.classList.remove("measure");
    window.__w = w;
  });
  assert.ok((await page.evaluate(() => window.__w)).every(x => x === "800"), "4.61.1: lines are measured at 800 even while staged");
  assert.equal(await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById("sheet")).fontSize)), size, "the same size playing as paused");
  assert.ok(await page.evaluate(() => { const b = document.querySelector("#st-bg .st-beam"); return !!b && b.getBoundingClientRect().bottom <= innerHeight * 0.4 + 1; }), "the stage light ends above the reading line");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".app.viewer > .shead")).visibility), "hidden", "the rest of the page steps back");
  await page.click("#gg-x"); await page.waitForFunction(() => !document.getElementById("gig"));
  assert.equal(await page.locator("#st-bg, #sheet .st-now, #sheet .st-lit").count(), 0, "leaving the show clears the stage");
});

test("4.52.0 unscored play is on the stage too: the band and the chord you're on, no score on top; pausing clears it", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [LONG], settings: { ...LIB.settings, countIn: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/g"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  assert.equal(await page.locator("#gig").count(), 0, "no show: nothing scored, no crowd");
  assert.ok(await page.evaluate(() => document.body.classList.contains("staged-plain")), "the stage, with nothing on top");
  await page.evaluate(() => document.querySelector(".fp-play, #play")?.click());
  await page.waitForFunction(() => !document.body.classList.contains("staged"));
  assert.equal(await page.locator("#sheet .st-now, #st-bg").count(), 0, "paused, the page is as it was");
});

test("4.54.0 no section bar over the stage, in a show or in practice; the page's own rail still jumps", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [LONG], settings: { ...LIB.settings, countIn: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/g"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  assert.equal(await page.locator("#st-map, .gg-map").count(), 0, "unscored play has no bar");
  await page.evaluate(() => document.querySelector(".fp-play, #play")?.click());
  await page.waitForFunction(() => !document.body.classList.contains("staged"));
  assert.ok(await page.locator(".smap").count() > 0, "paused, the page's own rail is as it was");
});

test("4.54.0 Wait for me: the song holds on a chord nobody plays, Skip moves on and counts it missed", { skip: skip() }, async t => {
  const song = { ...SHORT, waitForMe: true, bpm: 120 };
  const page = await strummingPage(t, { ...LIB, songs: [song], settings: { ...LIB.settings, plainPlay: false, countIn: false } }, "#/song/g", { strum: false });
  await page.click("#play"); await page.waitForSelector("#gig");
  await page.waitForSelector("#gg-wait:not([hidden])", { timeout: 20000 });
  assert.match(await page.innerText("#gg-wait"), /Waiting for [A-G]/);
  assert.equal(await page.locator("#gg-wpill:not([hidden])").count(), 1, "the WAIT FOR ME pill");
  assert.ok(await page.locator("#sheet .c.st-wait").count() === 1, "the waiting chord has a ring");
  const y = await page.evaluate(() => scrollY); await page.waitForTimeout(1200); /* real timer */
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - y) < 3, "the page does not move while it waits");
  await page.click("#gg-skip");
  await page.waitForSelector("#sheet .c.st-miss", { state: "attached", timeout: 10000 });
});

test("4.54.0 Wait for me: playing the chord lets the song go on, and the show is a practice show", { skip: skip() }, async t => {
  const song = { ...SHORT, waitForMe: true, bpm: 120 };
  const page = await strummingPage(t, { ...LIB, songs: [song], settings: { ...LIB.settings, plainPlay: false, countIn: false } }, "#/song/g");
  await page.click("#play"); await page.waitForSelector("#gig");
  await page.waitForFunction(() => document.querySelectorAll("#sheet .c.st-got").length >= 3, null, { timeout: 30000 });
  assert.match(await page.innerText("#gg-combo"), /\d+ of \d+/);
  await page.waitForSelector(".gc", { timeout: 60000 });
  assert.match(await page.innerText(".gc-list"), /practice show/);
  assert.doesNotMatch(await page.innerText(".gc-list"), /Rival battle:/);
});

test("4.54.0 the chords row on the song page is shape tiles: name over a diagram, 44 px or taller, tap marks the chord", { skip: skip() }, async t => {
  const page = await strummingPage(t, { ...LIB, songs: [SHORT], settings: { ...LIB.settings, plainPlay: false } }, "#/song/g", { strum: false });
  const tiles = page.locator(".strip .scard");
  assert.ok(await tiles.count() >= 3, "a tile for each chord");
  const box = await tiles.first().boundingBox();
  assert.ok(box.height >= 44 && box.width >= 44, "big enough for a thumb");
  assert.ok(await tiles.first().locator("svg").count() === 1, "a diagram in the tile");
  assert.match(await tiles.first().getAttribute("aria-label"), /^[A-G][#b]?\w* chord shape/);
  await tiles.first().click();
  await page.waitForSelector("#sheet .c.sel", { state: "attached" });
});

test("4.56.0 Louie's count-in: Louie and a big number stepping 1 to 4, the first chord and the strum, until the song gets going", { skip: skip() }, async t => {
  const song = { ...LONG, body: "Strum: D-DU-UDU\n\n" + LONG.body };
  const page = await strummingPage(t, { ...LIB, songs: [song], settings: { ...LIB.settings, plainPlay: false, gigScore: false, countIn: true } }, "#/song/g", { strum: false });
  await page.click("#play"); await page.waitForSelector("#st-open");
  assert.equal(await page.getAttribute("#st-open", "aria-label"), "Count in, 4 beats");
  assert.equal(await page.locator("#st-open .so-ch, #st-open .so-beats").count(), 0, "no shape tiles and no dots");
  assert.ok(await page.locator("#st-open .so-lou svg").count() === 1, "Louie");
  assert.match(await page.textContent("#st-open .so-s"), /First: A · Strum: D-DU-UDU/);
  const seen = await page.evaluate(() => new Promise(res => { const got = []; const iv = setInterval(() => { const x = document.querySelector("#st-open .so-n")?.textContent; if (x && got.at(-1) !== x) got.push(x); if (got.includes("4")) { clearInterval(iv); res(got); } }, 30); setTimeout(() => { clearInterval(iv); res(got); }, 9000); }));
  assert.deepEqual(seen.slice(0, 4), ["1", "2", "3", "4"], "the number counts the beats");
  const b = await page.evaluate(() => { const o = document.getElementById("st-open")?.getBoundingClientRect(), l = document.querySelector("#sheet .pr, #sheet .ly:not(.note), #sheet .crow")?.getBoundingClientRect(); return o && l ? [o.bottom, l.top] : null; });
  if (b) assert.ok(b[0] <= b[1], "above the first line, not over it");
  await page.waitForFunction(() => !document.getElementById("st-open"), null, { timeout: 30000 });
});

test("4.56.0 no count-in: no Louie card, the song just starts", { skip: skip() }, async t => {
  const page = await strummingPage(t, { ...LIB, songs: [LONG], settings: { ...LIB.settings, plainPlay: false, gigScore: false, countIn: false } }, "#/song/g", { strum: false });
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  assert.equal(await page.locator("#st-open").count(), 0);
});

test("4.55.0 leaving the app pauses the song, back where the swipe began", { skip: skip() }, async t => {
  const page = await strummingPage(t, { ...LIB, songs: [{ ...LONG, duration: 40 }], settings: { ...LIB.settings, plainPlay: true, countIn: false } }, "#/song/g", { strum: false });
  await page.click("#play");
  await page.waitForFunction(() => scrollY > 60, null, { timeout: 20000 });
  const y = await page.evaluate(async () => {
    const before = scrollY; await new Promise(r => setTimeout(r, 900)); /* real timer: the page moves on during the swipe */
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    const mid = scrollY;
    document.dispatchEvent(new Event("visibilitychange"));
    return [before, mid];
  });
  await page.waitForFunction(() => !document.body.classList.contains("playing"));
  const after = await page.evaluate(() => scrollY);
  assert.ok(after < y[1] && after >= y[0] - 2, `back near where it was (${y[0]} to ${y[1]}, now ${after})`);
});

test("4.56.0 a header note (Capo, Strum) is read, not played: the band starts on the first chord line", { skip: skip() }, async t => {
  const body = "Capo 2 · Strum: D-DU-UDU\n\n[Intro]\nG   C\n\n[Verse]\n" + Array.from({ length: 6 }, (_, i) => `G        C\nVerse line ${i + 1} goes on`).join("\n");
  const song = { id: "n", title: "Note", artist: "A", key: "G", format: "chords", duration: 60, bpm: 100, body };
  const page = await phone(t, { ...LIB, songs: [song], settings: { ...LIB.settings, plainPlay: false, gigScore: false, countIn: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/n"; }); await page.waitForSelector("#sheet .pr"); await settled(page);
  assert.equal(await page.locator("#sheet > .ly.note").count(), 1, "the note is marked");
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  assert.equal(await page.locator("#sheet > .ly.note.st-now").count(), 0, "the band is not on the note");
  assert.ok(await page.evaluate(() => document.querySelector("#sheet > .st-now").classList.contains("crow")), "it starts on the first chord line");
});

/* 4.59.0: the album cover behind the show; gone when you leave; no cover, no change */
test("The album cover behind the show (4.59.0)", { skip: skip() }, async t => {
  const art = "https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg";
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64");
  const covered = { ...SHORT, id: "c", duration: 60, listen: { url: "https://music.apple.com/us/album/x/1?i=2", art } };
  const page = await strummingPage(t, { ...LIB, songs: [covered, { ...SHORT, duration: 60 }], settings: { ...LIB.settings, plainPlay: false } }, "#/song/c", { strum: false });
  await page.route("https://is1-ssl.mzstatic.com/**", r => r.fulfill({ status: 200, contentType: "image/png", body: png }));
  /* 4.61.0: the cover is the room behind the whole song screen, before Play too, with bold words */
  await page.reload(); await page.waitForSelector("#play"); /* the picture is routed now; the page tried it before */
  await page.waitForSelector("body.covered #gg-cover.in");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#sheet > :is(.pr, .ly):not(.cur)")).fontWeight), "700", "bold on the song page too");
  /* 4.61.1: the dock is real glass under a cover, a tile names its chord once, and the page's current line is bold, not grown */
  const dockA = await page.evaluate(() => +(getComputedStyle(document.querySelector(".dock .pw")).backgroundColor.match(/[\d.]+/g)[3] ?? 1));
  assert.ok(dockA >= 0.85, `the dock lets no words through (${dockA})`);
  assert.equal(await page.locator(".scard svg text.dn").count(), 0, "a chord tile names its chord once");
  assert.ok(await page.locator(".scard .sc-n").count() > 0, "the name is the tile's big letter");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".sheet > .cur") || document.querySelector("#sheet > .pr")).transform), "none", "no growing current line");
  await page.click("#play"); await page.waitForSelector("#gig");
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#sheet > .st-now")).color === "rgb(255, 255, 255)"); /* after the fade */
  const look = await page.evaluate(() => ({ fg: getComputedStyle(document.querySelector("#sheet > .st-now")).color, light: getComputedStyle(document.getElementById("st-bg")).display }));
  assert.equal(look.fg, "rgb(255, 255, 255)", "the words are white on the cover");
  assert.equal(look.light, "none", "no stage light on a cover");
  assert.equal(await page.evaluate(() => { const b = document.querySelector("#gig .gg-bd"); return b ? getComputedStyle(b).display : "none"; }), "none", "4.62.1: a bought backdrop doesn't sit on top of the cover");
  /* 4.60.1: paused, the page and Tools are dark with white text, not white on white */
  await page.click("#gg-pause"); await page.waitForSelector("body.held"); await settled(page);
  const dock = await page.evaluate(() => { const t = document.querySelector(".dock"); const b = document.querySelector(".dock .tools, .dock button:not(#play)"); const cs = getComputedStyle(b || t); return { text: cs.color, dockBg: getComputedStyle(t).backgroundColor }; });
  assert.notEqual(dock.text, dock.dockBg, "the Tools button is readable on the dock");
  assert.ok(!/rgb\(2[0-9]{2}, 2[0-9]{2}, 2[0-9]{2}\)/.test(dock.dockBg), "the dock is dark under a cover: " + dock.dockBg);
  await page.click("#play"); await page.waitForSelector("body.staged:not(.held)");
  await page.click("#gg-x"); await page.waitForSelector("#gig", { state: "detached" });
  assert.equal(await page.locator("#gg-cover").count(), 1, "leaving the show, the cover stays behind the song page");
  await page.goto(base + "#/"); await page.waitForFunction(() => !document.getElementById("gg-cover"));
  assert.equal(await page.evaluate(() => document.body.classList.contains("covered")), false, "off the song page, the cover is gone");
  /* a song with no cover: the show as before */
  await page.goto(base + "#/song/g"); await page.waitForSelector("#play"); await settled(page);
  assert.equal(await page.locator("#gg-cover").count(), 0, "no cover, no change");
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  assert.equal(await page.locator("#gg-cover").count(), 0, "no cover in the show either");
  assert.equal(await page.evaluate(() => document.body.classList.contains("covered")), false);
});

/* 4.60.0: the X, mic and Pause fade after 3 s of play without a touch; the first touch only wakes them */
test("Controls that hide while the song plays (4.60.0)", { skip: skip() }, async t => {
  const page = await strummingPage(t, { ...LIB, songs: [LONG], settings: { ...LIB.settings, plainPlay: false } }, "#/song/g");
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  const box = await page.locator("#gg-pause").boundingBox();
  await page.waitForSelector("#gig.idle", { timeout: 15000 }); /* real timer */
  await page.waitForFunction(() => getComputedStyle(document.getElementById("gg-pause")).visibility === "hidden");
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("gg-pause")).opacity), "0", "Pause is hidden");
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("gg-combo")).visibility), "visible", "the combo stays");
  assert.equal(await page.getAttribute("#gg-pause", "aria-label"), "Pause", "hidden, it keeps its name");
  /* a tap where Pause was only wakes the controls */
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForSelector("#gig:not(.idle)"); await page.waitForTimeout(300); /* real timer: the tap would have paused by now */
  assert.equal(await page.locator("#gig.paused").count(), 0, "the first touch only wakes the controls, it doesn't pause");
  await page.click("#gg-pause"); await page.waitForSelector("#gig.paused", { state: "attached" });
  await page.waitForTimeout(4500); /* real timer */
  assert.equal(await page.locator("#gig.idle").count(), 0, "paused, the controls stay");
});
