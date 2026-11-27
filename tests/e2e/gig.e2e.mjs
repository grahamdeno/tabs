// Browser tests for the Gig, the main Play path in version 4 (clean-up Step 7.1).
// Most other tests set plainPlay: true and never open it; these leave it off.
// Run: node --test tests/e2e/gig.e2e.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { chromium, base, phone, skip, LIB, FAKE_MIC, useBrowser, settled } from "./harness.mjs";

useBrowser();

/* A page whose microphone plays the chord the song is on (4.54.0), with the library in place before the app starts.
   Seeding it before the first load (instead of replacing it after) means the app's own first
   save can't land on top of it, which is what made the scored Gig test flaky on a busy machine. */
async function strummingPage(t, lib, hash, opts = {}) {
  const browser2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => browser2.close());
  const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", ...(opts.reducedMotion ? { reducedMotion: opts.reducedMotion } : {}) });
  await ctx.addInitScript(FAKE_MIC);
  await ctx.addInitScript(json => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("tabs-v1", json); } }, JSON.stringify(lib));
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  t.after(() => assert.deepEqual(errors, [], "page errors"));
  await page.goto(base + hash); await page.waitForSelector("#play"); await settled(page);
  return page;
}
const SHORT = { id: "g", title: "Short Road", artist: "Me", key: "A", format: "chords", duration: 16,
  body: "[Verse]\nA        D\nWalking down the road\nE        A\nLantern in my hand\n\n[Chorus]\nD        A\nCarry me home\nE        A\nLay me down" };
const LONG = { ...SHORT, duration: 200, body: "[Verse]\n" + Array.from({ length: 8 }, (_, i) => `A        D\nVerse line ${i + 1}`).join("\n") + "\n\n[Chorus]\n" + Array.from({ length: 8 }, (_, i) => `E        A\nChorus line ${i + 1}`).join("\n") };
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")));

test("The Gig (4.1.0, 4.2.0, 4.14.0): a show from Play to Show complete, with a Double set and the merch tip", { skip: skip() }, async t => {
  /* 400 fans from earlier shows: enough for the Brick wall backdrop (300), the cheapest thing not owned */
  const page = await strummingPage(t, { ...LIB, songs: [SHORT], gig: { shows: 3, fans: 400, best: {} }, merch: { own: { double: 2 } }, settings: { ...LIB.settings, plainPlay: false } }, "#/song/g");
  assert.equal(await page.getAttribute("#play", "aria-label"), "Play as a gig");
  await page.click("#play"); await page.waitForSelector("#gig");
  await page.waitForSelector("#sheet > .st-now");
  assert.equal(await page.locator("#gg-lines").count(), 0, "4.51.0: the lines are the song page itself, not a copy");
  assert.ok(await page.evaluate(() => document.body.classList.contains("staged")), "the page is the stage");
  assert.equal(await page.locator(".gg-map, #st-map, #gg-str, #gg-tw").count(), 0, "4.54.0: no song map over the stage, no strings, no timing word");
  /* 4.58.0: bold words that fade by distance; the chords stay brighter than the words; nothing runs past the edge */
  /* 4.65.3: wait out the 0.25 s colour fade, so the check doesn't read a line mid-change (it failed CI once) */
  /* Road Ready 05: "dimmer" is how strongly a colour stands out from the page, its alpha times its contrast with the
     background, so it holds both for the earlier looks (which fade with alpha) and Road Ready (solid lyric colours) */
  await page.evaluate(() => {
    window.__strength = el => {
      const n = c => c.match(/[\d.]+/g).map(Number), L = c => { const [r, g, b] = n(c).slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
      const bg = getComputedStyle(document.body).backgroundColor, solid = n(bg).length < 4 || n(bg)[3] > 0 ? bg : "rgb(0, 0, 0)";
      const c = getComputedStyle(el).color, m = n(c), a = m.length > 3 ? m[3] : 1, x = L(c), y = L(solid);
      return a * (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
    };
  });
  await page.waitForFunction(() => { const strength = window.__strength, n = document.querySelector("#sheet > .st-now"), x = document.querySelector("#sheet > .st-next"); if (!n || !x) return true; return strength(n) > strength(x) && !n.getAnimations().length && !x.getAnimations().length; });
  const look = await page.evaluate(() => {
    /* Road Ready 05: in the Road Ready looks the chords stand out by colour (amber, or amber-brown on cream) at 4.5:1 or
       more, as the spec's tokens set them; the earlier looks keep 4.58.0's "brighter than the words" */
    const rr = ["neon", "festival"].includes(document.documentElement.dataset.look);
    const strength = window.__strength, now = document.querySelector("#sheet > .st-now"), next = document.querySelector("#sheet > .st-next"), sheet = document.getElementById("sheet");
    const w = el => +getComputedStyle(el).fontWeight, col = el => strength(el);
    const nc = next?.querySelector(".c");
    return { now: w(now), next: next ? w(next) : 0, nowCol: col(now), nextCol: next ? col(next) : 0, chordBrighter: !nc ? true : rr ? strength(nc) >= 4.5 : strength(nc) * +getComputedStyle(nc).opacity > col(next),
      overflow: [...sheet.querySelectorAll(":scope > .pr, :scope > .ly, :scope > .crow")].some(l => [...l.children].some(c => c.getBoundingClientRect().right > sheet.getBoundingClientRect().right + 1)) };
  });
  assert.equal(look.now, 800, "4.58.0: the line you're on is boldest");
  assert.ok(look.next === 700 || look.next === 0, "4.58.0: the next line is bold, got " + look.next);
  assert.ok(look.nowCol > look.nextCol, "4.58.0: the next line's words are dimmer than the current line's");
  assert.ok(look.chordBrighter, "4.58.0: the next line's chords stand out from its words");
  assert.equal(look.overflow, false, "4.58.0: no line runs past the edge at the boldest weight");
  assert.equal(await page.locator("#gg-lc").count(), 0, "4.2.0: Lines moved to Tools");
  /* Paused, the show holds the line you stopped on; Tools has only what you change mid-song */
  await page.click("#gg-pause"); await page.waitForSelector("body.held"); await settled(page);
  assert.equal(await page.locator("#gg-hline, .gg-here, #gg-hold, #gg-back, #gg-sheet").count(), 0, "4.52.0: no pause screen, no Back a line, no Sheet");
  assert.ok(await page.locator(".app.viewer .shead").isVisible(), "paused, the song page is back");
  assert.match(await page.innerText("#play"), /RESUME/, "Play reads Resume");
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#sheet > .st-now")).opacity === "1"); /* the line you stopped on is not dimmed */
  assert.equal(await page.locator("#sheet > .st-now").count(), 1, "the line you stopped on stays on its band");
  await page.click("#more"); await page.waitForSelector(".menu.tools");
  assert.equal(await page.locator('.menu [data-m="edit"]').count(), 1, "4.66.0: Tools is the same sheet in a show as out of one");
  await page.keyboard.press("Escape"); await page.waitForSelector(".menu", { state: "detached" });
  assert.equal(await page.locator("#gig.paused").count(), 1, "closing Tools, the show stays paused");
  await page.click("#play"); await page.waitForSelector("body.staged:not(.held)");
  await page.waitForFunction(() => document.getElementById("gg-sec").textContent === "CHORUS", null, { timeout: 15000 });
  assert.equal(await page.evaluate(() => document.body.dataset.gel), "chorus", "the stage washes into the chorus gel");
  /* Show complete */
  await page.waitForSelector(".gc", { timeout: 40000 });
  assert.match(await page.innerText(".gc"), /SHOW COMPLETE/, "Road Ready 06: the overline says it; the title is the song");
  assert.match(await page.innerText(".gc-list"), /Played \d+ chord change/, "4.91.0: the changes played through");
  assert.ok(await page.locator(".gc-song .gc-ch.got").count() > 0, "the song you played lists the changes played");
  assert.doesNotMatch(await page.innerText(".gc-list"), /no pausing/, "it was paused, so not the whole song");
  assert.match(await page.innerText(".gc-list"), /Your tour: [\s\S]*E chord, 1 of 5 songs/, "4.83.0: what the song did on the Road");
  /* Road Ready 06 (Graham, 2026-11-18): no backdrop on Show complete in Dark and Light; Green Room keeps it (its own test below) */
  assert.equal(await page.locator(".gc-hero, #gc-bdc").count(), 0, "no backdrop or Change in Road Ready");
  assert.match(await page.innerText(".gc-list"), /Double set: 2x XP on this show\. 1 more to go\./);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1"))?.gig?.shows === 4); /* the save lands a moment after */
  const s = await saved(page);
  assert.equal(s.gig.ready?.g, undefined, "paused, so not Gig-ready");
  assert.equal(s.songs[0].playLog.total, 1, "the show counts as a play");
  assert.equal(s.merch.own.double, 1, "one Double set used");
  assert.deepEqual(s.merch.told, ["brick"], "the merch tip is said once");
  assert.match(await page.innerText("#gc-merch"), /Brick wall/);
  await page.click("#gc-merch");
  await page.waitForFunction(() => location.hash === "#/merch" && !document.getElementById("gig"));
  await page.waitForSelector(".mc-head");
  await page.evaluate(() => { location.hash = "#/song/g"; }); await page.waitForSelector(".shead .meta");
  assert.match(await page.innerText(".shead .meta"), /★☆☆☆ Learning/, "4.91.0: the song shows its stars");
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

test("4.49.12 the Metronome switch in a gig is the band's switch: Beat's drums go quiet when it is off, and come back when it is on", { skip: skip() || "4.69.0: Beat isn't playing for now (the beat is Off, Bass drum or Metronome)" }, async t => {
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
  assert.equal(await page.locator("#gg-mic").count(), 0, "4.91.0: no microphone in a show");
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

test("4.91.0 the show counts what you play through: the crowd fills, the run, no microphone, and a whole song makes it Gig-ready", { skip: skip() }, async t => {
  const body = "[Verse]\n" + Array.from({ length: 6 }, (_, i) => `G        C\nLine ${i + 1} of the verse goes on here`).join("\n");
  const song = { id: "k", title: "Through", artist: "A", key: "G", format: "chords", duration: 30, bpm: 120, body, playLog: { total: 3, last: 0, days: {} } };
  const page = await phone(t, { ...LIB, songs: [song], settings: { ...LIB.settings, plainPlay: false, countIn: false } });
  await page.evaluate(() => { location.hash = "#/song/k"; }); await page.waitForSelector("#play"); await settled(page);
  assert.match(await page.innerText(".shead .meta"), /Rehearsed/, "three plays: two stars");
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  assert.equal(await page.locator("#gg-mic, #gg-skip, #gg-wpill").count(), 0, "no microphone button, no Skip, no Wait for me");
  assert.equal(await page.locator("#gg-fans svg").count(), 12, "the crowd is 12 fans");
  /* Graham, 2026-11-18: Road Ready (this test's look) doesn't draw the crowd row, so the words fill the screen; the crowd
     still fills behind the scenes. Green Room's row is checked in "Green Room keeps the show as it was". */
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".gg-status")).display), "none", "no crowd row in Road Ready");
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("gg-sec")).display), "none", "no section pill either");
  assert.ok(await page.locator("#gg-combo").count() === 1, "the run counter stays");
  await page.waitForFunction(() => /in a row/.test(document.getElementById("gg-combo").textContent), null, { timeout: 25000 });
  await page.waitForFunction(() => document.querySelectorAll("#gg-fans .on").length > 0, null, { timeout: 25000 });
  assert.equal(await page.locator("#sheet .c.st-got, #sheet .c.st-miss").count(), 0, "no green or missed marks: nothing is judged");
  await page.waitForSelector(".gc", { timeout: 40000 });
  assert.match(await page.innerText(".gc-list"), /Played \d+ chord changes[\s\S]*no pausing/);
  assert.match(await page.innerText(".gc-list"), /New star: Gig-ready!/);
  assert.equal(await page.locator(".gc-tiles .gc-stars i.on").count(), 3, "three stars on the card");
  assert.ok(await page.locator(".gc-song .gc-ch.got").count() > 0, "the song you played lists the changes played");
  assert.equal(await page.locator(".gc-duel, #gc-duel").count(), 0, "no % to challenge a friend with");
  assert.doesNotMatch(await page.innerText(".gc"), /caught|microphone|scored/i);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1"))?.gig?.ready?.k?.length === 1);
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
  /* A saved Green Room is read as Light or Dark, so lyrics are the Road Ready size. */
  const page = await phone(t, { ...LIB, songs: [song], settings: { ...LIB.settings, v: 6, theme: "green", plainPlay: false, gigScore: false, countIn: false } }, { isMobile: true, colorScheme: "dark" });
  await page.evaluate(() => { location.hash = "#/song/f"; }); await page.waitForSelector("#sheet .pr"); await settled(page);
  const oneLine = () => page.evaluate(() => [...document.querySelectorAll("#sheet > .pr")].every(pr => new Set([...pr.querySelectorAll(".w")].map(w => Math.round(w.getBoundingClientRect().top))).size === 1));
  /* the size is measured again once the app's font is in (fitText); CI's slower font load showed the fallback's fit (4.63.1) */
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.querySelectorAll("#sheet > .pr")].every(pr => new Set([...pr.querySelectorAll(".w")].map(w => Math.round(w.getBoundingClientRect().top))).size === 1), null, { timeout: 5000 }).catch(() => {});
  const size = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById("sheet")).fontSize));
  assert.ok(size > 22, `Road Ready lyrics are full size (${size}px)`);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.theme), "green");
  const spread = await page.evaluate(() => { const r = document.querySelector("#sheet > .crow"), cs = [...r.querySelectorAll(".c")]; return cs[cs.length - 1].getBoundingClientRect().left - r.getBoundingClientRect().left > r.getBoundingClientRect().width * 0.6; });
  assert.ok(spread, "an intro's chords spread across the width");
  const hs = await page.evaluate(() => [document.querySelector("#sheet > .crow"), document.querySelector("#sheet > .pr")].map(e => e.getBoundingClientRect().height));
  assert.ok(hs[0] > 20 && hs[1] > 20, `a chord row and a sung line both have a height (${hs[0]} and ${hs[1]})`);
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  assert.equal(await page.evaluate(() => document.documentElement.dataset.look), "neon", "still Dark while it plays");
  await page.evaluate(() => { /* a redraw during the show measures at the boldest weight, not the stage's */
    const sh = document.getElementById("sheet"); sh.classList.add("measure");
    const w = [...sh.querySelectorAll(":scope > .pr")].map(e => getComputedStyle(e).fontWeight); sh.classList.remove("measure");
    window.__w = w;
  });
  assert.ok((await page.evaluate(() => window.__w)).every(x => x === "800"), "4.61.1: lines are measured at 800 even while staged");
  assert.equal(await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById("sheet")).fontSize)), size, "the same size playing as paused");
  /* Road Ready 05 polish (no stage light, the page steps back) moved to "lyrics are full size", which runs in Dark (2026-11-19) */
  /* 4.66.0: no X: Pause, then the page's own Back leaves the show */
  await page.click("#gg-pause"); await page.waitForSelector("body.held"); await settled(page);
  await page.click(".shead .sh-back"); await page.waitForSelector("#gig", { state: "detached" });
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

test("4.54.0 no section bar over the stage, in a show or in practice (5.3.1: no section rail on the page either)", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [LONG], settings: { ...LIB.settings, countIn: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/g"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  assert.equal(await page.locator("#st-map, .gg-map").count(), 0, "unscored play has no bar");
  await page.evaluate(() => document.querySelector(".fp-play, #play")?.click());
  await page.waitForFunction(() => !document.body.classList.contains("staged"));
  assert.equal(await page.locator(".smap").count(), 0, "5.3.1: the section rail is gone, paused too");
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
  assert.ok(await page.evaluate(() => { const lines = [...document.querySelectorAll("#sheet > :is(.pr, .ly)")], c = document.querySelector(".sheet > .cur") || lines[0], px = e => parseFloat(getComputedStyle(e).fontSize) * new DOMMatrixReadOnly(getComputedStyle(e).transform).a; return lines.every(e => px(e) <= px(c) + 0.5) && lines.every(e => px(c) <= px(e) + 0.5 || e.style.fontSize); }), "no growing current line: on the song page every line is drawn at one size");
  await page.click("#play"); await page.waitForSelector("#gig");
  await page.waitForFunction(() => getComputedStyle(document.querySelector("#sheet > .st-now")).color === "rgb(255, 255, 255)"); /* after the fade */
  const look = await page.evaluate(() => ({ fg: getComputedStyle(document.querySelector("#sheet > .st-now")).color, light: getComputedStyle(document.getElementById("st-bg")).display }));
  assert.equal(look.fg, "rgb(255, 255, 255)", "the words are white on the cover");
  assert.equal(look.light, "none", "no stage light on a cover");
  assert.equal(await page.locator("#gig .gg-bd").count(), 0, "4.66.0: no backdrop over the show (it's on Show complete)");
  /* 4.60.1: paused, the page and Tools are dark with white text, not white on white */
  await page.click("#gg-pause"); await page.waitForSelector("body.held"); await settled(page);
  const dock = await page.evaluate(() => { const t = document.querySelector(".dock"); const b = document.querySelector(".dock .tools, .dock button:not(#play)"); const cs = getComputedStyle(b || t); return { text: cs.color, dockBg: getComputedStyle(t).backgroundColor }; });
  assert.notEqual(dock.text, dock.dockBg, "the Tools button is readable on the dock");
  assert.ok(!/rgb\(2[0-9]{2}, 2[0-9]{2}, 2[0-9]{2}\)/.test(dock.dockBg), "the dock is dark under a cover: " + dock.dockBg);
  await page.click("#play"); await page.waitForSelector("body.staged:not(.held)");
  await page.click("#gg-pause"); await page.waitForSelector("body.held");
  assert.equal(await page.locator("#gg-cover").count(), 1, "paused, the cover stays behind the song page");
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

/* ---- Road Ready 05: the playing screen ---- */
const rr = (theme, settings = {}) => ({ ...LIB, songs: [LONG], settings: { ...LIB.settings, v: 6, theme, plainPlay: false, countIn: false, ...settings } });
const idleNow = page => page.evaluate(() => document.getElementById("gig")?.classList.contains("idle"));
const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };

test("Road Ready 05: with Keep playing controls on screen on, or keyboard focus on a control, the controls never hide", { skip: skip() }, async t => {
  const kept = await strummingPage(t, rr("dark", { keepControls: true }), "#/song/g");
  await kept.click("#play"); await kept.waitForSelector("#sheet > .st-now");
  await kept.waitForTimeout(4500); /* real timer: they would have hidden by now */
  assert.equal(await idleNow(kept), false, "the setting keeps them on screen");
  const page = await strummingPage(t, rr("dark"), "#/song/g");
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  await page.waitForTimeout(1000); /* real timer: no touch just before the focus */
  await page.keyboard.press("Shift"); await page.focus("#gg-pause");
  await page.waitForTimeout(4500); /* real timer */
  assert.equal(await idleNow(page), false, "focus on Pause keeps them on screen");
  /* focus that came with no touch (a screen reader or a switch) keeps them until the song is paused */
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(4500); /* real timer */
  assert.equal(await idleNow(page), false, "still kept after focus moves on, while the song plays");
  await page.keyboard.press("Space"); await page.waitForSelector("body.held");
  await page.keyboard.press("Space"); await page.waitForSelector("body.staged:not(.held)");
  await page.waitForSelector("#gig.idle", { timeout: 15000 }); /* real timer: paused once, they hide again */
});

test("Road Ready 05: any key brings the controls back, and Space plays and pauses", { skip: skip() }, async t => {
  const page = await strummingPage(t, rr("dark", { used: { playHint: true } }), "#/song/g");
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForSelector("#gig.idle", { timeout: 15000 }); /* real timer */
  await page.keyboard.press("Shift"); await page.waitForSelector("#gig:not(.idle)");
  assert.equal(await page.locator("body.held").count(), 0, "a key that isn't Space only shows them");
  await page.keyboard.press("Space"); await page.waitForSelector("body.held");
  assert.equal(await page.locator("#gig.paused").count(), 1, "Space pauses the show");
  await page.keyboard.press("Space"); await page.waitForSelector("#gig:not(.paused)");
  assert.equal(await page.locator("body.held").count(), 0, "and plays it again");
});

test("Road Ready 05: the first-run hint shows once, goes on the first tap, and never comes back", { skip: skip() }, async t => {
  const page = await strummingPage(t, rr("dark"), "#/song/g");
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  await page.waitForSelector("#gg-hint", { timeout: 15000 }); /* real timer: the first time the controls hide */
  assert.match(await page.innerText("#gg-hint"), /Tap anywhere for controls/);
  assert.equal(await page.getAttribute("#gg-hint .gg-hint-l", "aria-hidden"), "true", "Louie beside it is decoration");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.used?.playHint === true);
  await page.mouse.click(200, 300); await page.waitForSelector("#gg-hint", { state: "detached" });
  assert.equal(await page.locator("#gig.paused").count(), 0, "the tap only took the hint away");
  await page.reload(); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  await page.waitForSelector("#gig.idle", { timeout: 15000 }); await page.waitForTimeout(800); /* real timer */
  assert.equal(await page.locator("#gg-hint").count(), 0, "never again");
});

test("Road Ready 05: the first-run hint sits below the words, above the progress line, and fades on its own after 5 s", { skip: skip() }, async t => {
  const page = await strummingPage(t, rr("dark"), "#/song/g");
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  await page.waitForSelector("#gg-hint", { timeout: 15000 }); /* real timer: the first time the controls hide */
  const shown = Date.now();
  const r = await page.evaluate(() => {
    const gig = document.getElementById("gig"), hint = document.getElementById("gg-hint").getBoundingClientRect();
    /* the bottom fade (.gig::after) is solid from 44 px down, so words below that line can't be seen */
    const solid = innerHeight - (parseFloat(getComputedStyle(gig, "::after").height) - 44);
    const lines = [...document.querySelectorAll("#sheet > :is(.pr, .ly, .crow)")].filter(el => getComputedStyle(el).visibility !== "hidden")
      .map(el => el.getBoundingClientRect()).filter(b => b.height && b.top < solid && b.bottom > 0);
    return { top: hint.top, bottom: hint.bottom, left: hint.left, right: hint.right, words: Math.max(...lines.map(b => Math.min(b.bottom, solid))), n: lines.length,
      prog: document.getElementById("gg-prog").parentElement.getBoundingClientRect().top, w: innerWidth };
  });
  assert.ok(r.n > 3, "words fill the screen behind it");
  assert.ok(r.top >= r.words - 0.5, `the hint (top ${r.top}) is below the last visible lyric line (${r.words})`);
  assert.ok(r.bottom <= r.prog, "above the progress line");
  assert.ok(r.left >= 0 && r.right <= r.w, "inside the screen");
  await page.waitForTimeout(4000); /* real timer */
  assert.equal(await page.locator("#gg-hint").count(), 1, "still there before 5 s");
  await page.waitForSelector("#gg-hint", { state: "detached", timeout: 3000 });
  const gone = Date.now() - shown;
  assert.ok(gone >= 4500 && gone < 6500, `gone 5 s after it shows (${gone} ms; the test sees the hint a little after it shows)`);
  assert.equal(await page.locator("#gig.paused").count(), 0, "the song plays on");
  assert.equal((await saved(page)).settings.used?.playHint, true, "it still counts as shown");
});

for (const theme of ["dark", "light"]) test(`Road Ready 05 (${theme}): words in the lyric colours on the plain base, amber chords, the bar and the progress line, all readable`, { skip: skip() }, async t => {
  const page = await strummingPage(t, rr(theme), "#/song/g");
  await page.click("#play"); await page.waitForSelector("#sheet > .st-past:is(.pr, .ly)");
  await page.waitForFunction(() => !document.querySelector("#sheet > .st-now")?.getAnimations().length);
  const r = await page.evaluate(() => {
    const css = (el, pseudo) => getComputedStyle(el, pseudo), q = s => document.querySelector(s), root = css(document.documentElement);
    const probe = document.createElement("i"); document.body.appendChild(probe);
    const tok = n => { probe.style.color = root.getPropertyValue(n); return getComputedStyle(probe).color; };
    const out = { base: tok("--rr-base"), card: tok("--rr-card"), sung: tok("--rr-lyric-sung"), next: tok("--rr-lyric-next"), now: tok("--rr-lyric-now"), chordTok: tok("--rr-chord") };
    probe.remove();
    const now = q("#sheet > .st-now"), past = q("#sheet > .st-past:is(.pr, .ly)"), next = q("#sheet > .st-next");
    return { ...out, body: css(document.body).backgroundColor, bodyImg: css(document.body).backgroundImage, cNow: css(now).color, cPast: css(past).color, cNext: css(next).color,
      opPast: css(past).opacity, chord: css(past.querySelector(".c")).color, chordOp: css(past.querySelector(".c")).opacity,
      bar: css(now, "::after").width, barBg: css(now, "::after").backgroundColor, prog: css(q(".gg-prog")).height, progHidden: q(".gg-prog").getAttribute("aria-hidden"),
      title: q("#gg-head")?.textContent };
  });
  assert.equal(r.body, r.base, "the plain base behind the words");
  assert.equal(r.bodyImg, "none", "no tolex grain behind the words");
  assert.deepEqual([r.cPast, r.cNext, r.cNow], [r.sung, r.next, r.now], "sung, next and current lines in their own colours");
  assert.equal(r.opPast, "1", "never dimmed with opacity");
  assert.equal(r.chord, r.chordTok, "chords in amber"); assert.equal(r.chordOp, "1");
  assert.ok(ratio(r.sung, r.base) >= 4.5 && ratio(r.sung, r.card) >= 4.5, `sung lines ${ratio(r.sung, r.base).toFixed(1)}:1`);
  assert.ok(ratio(r.chordTok, r.base) >= 4.5, `chords ${ratio(r.chordTok, r.base).toFixed(1)}:1`);
  assert.equal(r.bar, "3px", "a 3 px bar beside the line you're on");
  assert.equal(r.prog, "2px", "a 2 px progress line"); assert.equal(r.progHidden, "true");
  assert.match(r.title, /Short Road[\s\S]*Me/, "the song's title and artist at the top");
  const box = await page.locator("#gg-pause").boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44, "Pause is at least 44 px");
});

for (const motion of ["no-preference", "reduce"]) test(`Road Ready 05: the controls hide with ${motion === "reduce" ? "a plain 0.2 s fade (Reduce Motion)" : "a 0.25 s fade and an 8 px slide"}`, { skip: skip() }, async t => {
  const page = await strummingPage(t, rr("dark", { used: { playHint: true } }), "#/song/g");
  await page.emulateMedia({ reducedMotion: motion });
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForSelector("#gig.idle", { timeout: 15000 }); await page.waitForTimeout(500); /* real timer: the fade is done */
  const r = await page.evaluate(() => { const c = getComputedStyle(document.getElementById("gg-pause")); return { tr: c.transitionDuration, prop: c.transitionProperty, tf: c.transform }; });
  if (motion === "reduce") { assert.match(r.tr, /^0\.2s/); assert.equal(r.tf, "none", "no slide"); assert.doesNotMatch(r.prop, /transform/); }
  else { assert.match(r.tr, /^0\.25s/); assert.equal(r.tf, "matrix(1, 0, 0, 1, 0, 8)", "an 8 px slide"); }
});

test("Road Ready 05: at large text only the line you're on and the next ones show, nothing runs off the edge or sits under Pause", { skip: skip() }, async t => {
  const page = await strummingPage(t, rr("dark", { keepControls: true }), "#/song/g");
  await page.click("#play"); await page.waitForSelector("#sheet > .st-past");
  await page.evaluate(() => { const r = document.documentElement; r.style.setProperty("--sys-px", "33px"); r.dataset.ax = "1"; });
  const r = await page.evaluate(() => {
    const p = document.getElementById("gg-pause").getBoundingClientRect(), sheet = document.getElementById("sheet").getBoundingClientRect();
    const lines = [...document.querySelectorAll("#sheet > :is(.pr, .ly, .crow)")].filter(l => getComputedStyle(l).visibility !== "hidden" && l.getBoundingClientRect().bottom > 0 && l.getBoundingClientRect().top < innerHeight);
    return { n: lines.length, past: [...document.querySelectorAll("#sheet > .st-past")].some(l => getComputedStyle(l).visibility !== "hidden"),
      off: lines.some(l => [...l.querySelectorAll("*")].some(c => c.getBoundingClientRect().right > sheet.right + 1)),
      under: lines.some(l => { const b = l.getBoundingClientRect(); return b.bottom > p.top && b.top < p.bottom && b.right > p.left && b.left < p.right; }) };
  });
  assert.equal(r.past, false, "lines already sung step aside");
  assert.ok(r.n >= 2 && r.n <= 3, `the line you're on and the next one or two (${r.n})`);
  assert.equal(r.off, false, "nothing runs off the edge");
  assert.equal(r.under, false, "nothing sits under Pause");
});

test("Road Ready 05: Settings has Keep playing controls on screen, off until turned on", { skip: skip() }, async t => {
  const page = await phone(t, rr("dark"));
  await page.evaluate(() => { location.hash = "#/settings/playing"; }); await page.waitForSelector("#s-keepctl");
  assert.equal(await page.getAttribute("#s-keepctl", "aria-checked"), "false");
  assert.match(await page.innerText(".set:has(#s-keepctl)"), /For VoiceOver, Switch Control or if you like seeing them\./);
  await page.click("#s-keepctl");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.keepControls === true);
});

test("a saved Green Room plays with the Road Ready show", { skip: skip() }, async t => {
  const page = await strummingPage(t, { ...rr("green"), merch: { has: ["green"], tspent: 400 } }, "#/song/g");
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now");
  const r = await page.evaluate(() => ({ head: getComputedStyle(document.getElementById("gg-head")).display, prog: getComputedStyle(document.querySelector(".gg-prog")).display, look: document.documentElement.dataset.look, saved: JSON.parse(localStorage.getItem("tabs-v1")).settings.theme }));
  assert.notEqual(r.head, "none"); assert.notEqual(r.prog, "none");
  assert.notEqual(r.look, "green");
  assert.equal(r.saved, "green");
});

for (const theme of ["dark", "light"]) test(`Road Ready 05 polish (${theme}): no band behind the line or stage light while playing, and the run chip and NOW card in Road Ready colours`, { skip: skip() }, async t => {
  const page = await strummingPage(t, rr(theme), "#/song/g");
  await page.click("#play"); await page.waitForSelector("body.staged:not(.held) #sheet > .st-now");
  const r = await page.evaluate(() => {
    const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), probe = document.createElement("i");
    document.body.append(probe); const rgb = v => { probe.style.color = v; return getComputedStyle(probe).color; };
    const out = { band: getComputedStyle(document.querySelector("#sheet > .st-now"), "::before").content, light: getComputedStyle(document.getElementById("st-bg")).display,
      amber: rgb(css("--rr-amber-text")), card: rgb(css("--rr-card")), hair: rgb(css("--rr-hairline")) };
    const combo = document.getElementById("gg-combo"); combo.textContent = "3 in a row";
    const shape = document.getElementById("gg-shape"); shape.hidden = false; shape.innerHTML = "<small>NOW</small><b>F</b>";
    const c = getComputedStyle(combo), s = getComputedStyle(shape);
    Object.assign(out, { comboInk: c.color, comboBg: c.backgroundColor, shapeBg: s.backgroundColor, shapeEdge: s.borderTopColor, shapeLabel: getComputedStyle(shape.querySelector("small")).color });
    probe.remove(); return out;
  });
  assert.equal(r.band, "none", "no section-coloured band behind the line you're on (the amber bar marks it)");
  assert.equal(r.light, "none", "no stage light");
  assert.equal(r.comboInk, r.amber, "the run chip's text is amber"); assert.equal(r.comboBg, r.card, "on the Road Ready card");
  assert.equal(r.shapeBg, r.card, "the NOW card is the Road Ready card"); assert.equal(r.shapeEdge, r.hair, "with a hairline edge");
  assert.equal(r.shapeLabel, r.amber, "and an amber NOW");
  await page.keyboard.press("Shift"); await page.click("#gg-pause"); await page.waitForSelector("body.held"); await settled(page);
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.querySelector("#sheet > .st-now"), "::before").content), "none", "paused keeps the quiet band on the line you stopped on");
});

/* ---- Road Ready 06: Show complete ---- */
const scLib = (theme, extra = {}) => ({ ...LIB, songs: [SHORT], merch: { tconv: 1, lconv: 1, has: ["green"] }, ...extra, settings: { ...LIB.settings, v: 6, theme, plainPlay: false, countIn: false } });
async function toComplete(t, theme, opts) {
  const page = await strummingPage(t, scLib(theme), "#/song/g", opts);
  await page.click("#play"); await page.waitForSelector(".gc", { timeout: 40000 });
  return page;
}

test("Road Ready 9a: Show complete shows the guitar you chose from the Guitar shop, by name, instead of the leg's", { skip: skip() }, async t => {
  const page = await strummingPage(t, scLib("dark", { merch: { tconv: 1, lconv: 1, has: ["green", "g-nova"], guitar: "nova" } }), "#/song/g");
  await page.click("#play"); await page.waitForSelector(".gc", { timeout: 40000 });
  assert.match(await page.getAttribute(".sc-show.glow .sc-guitar img", "src"), /art\/guitars\/streak\/nova-small\.webp/);
  assert.equal(await page.innerText(".sc-label"), "Nova");
});

test("Road Ready 06: Show complete has the overline, the song, the glowing guitar with its name, Louie, one-sentence reward tiles, the next stop and the two buttons", { skip: skip() }, async t => {
  const page = await toComplete(t, "dark");
  assert.equal(await page.locator(".gc.rr-sc").count(), 1);
  assert.equal(await page.innerText(".sc-over"), "SHOW COMPLETE");
  assert.equal(await page.innerText(".sc-title"), "Short Road");
  assert.match(await page.getAttribute(".sc-show.glow .sc-guitar img", "src"), /art\/guitars\/streak\/porch-small\.webp/, "the guitar you played on, its whole picture as in the case");
  assert.equal(await page.innerText(".sc-label"), "Porch", "named after the leg you're on");
  await page.waitForFunction(() => { const i = document.querySelector(".sc-guitar img"); return i.complete && i.naturalWidth > 0; });
  const gr = await page.$eval(".sc-guitar img", i => i.complete && i.naturalWidth ? [i.naturalWidth, i.naturalHeight, i.getBoundingClientRect().width, i.getBoundingClientRect().height] : null);
  assert.ok(gr && gr[1] / gr[0] >= 2.5, "a whole guitar in its own proportions, not a stubby one");
  assert.ok(Math.abs(gr[3] / gr[2] - gr[1] / gr[0]) < 0.05, "drawn without stretching");
  assert.equal(await page.getAttribute(".sc-show", "aria-hidden"), "true", "the picture, label and Louie are hidden from screen readers");
  assert.ok(await page.locator(".sc-show .sc-louie .louie").count() === 1, "the cheering Louie");
  /* the tiles: "+N fans" and "+$N tips", read as one sentence */
  const tiles = await page.$$eval(".sc-tile b", bs => bs.map(b => b.textContent));
  assert.match(tiles[0], /^\+\d+ fans$/); assert.match(tiles[1], /^\+\$\d+ tips$/);
  const [f, d] = [tiles[0].match(/\d+/)[0], tiles[1].match(/\d+/)[0]];
  assert.equal(await page.getAttribute(".sc-reward", "aria-label"), `Reward: ${f} fans and ${d} dollars in tips.`);
  assert.equal(await page.getAttribute(".sc-reward", "role"), "img", "one thing to a screen reader");
  assert.match(await page.innerText(".sc-next"), /^Next stop: \S/);
  /* everything Show complete showed before is still here, below */
  for (const sel of [".gc-tile.crowd", ".gc-tile.beat .gc-stars", ".gc-song", ".gc-list"]) assert.equal(await page.locator(sel).count(), 1, sel);
  assert.equal(await page.locator(".gc-hero, #gc-bdc").count(), 0, "no backdrop in Road Ready");
  assert.doesNotMatch(await page.innerText(".gc"), /missed|lost|sorry|too bad|try harder/i, "nothing that makes you feel bad");
  /* buttons: 44 px or more, Play it again starts the Encore */
  const small = await page.evaluate(() => [...document.querySelectorAll(".gc button")].map(b => { const r = b.getBoundingClientRect(); return [b.id || b.textContent.trim(), r.width, r.height]; }).filter(([, w, h]) => w < 44 || h < 44));
  assert.deepEqual(small, []);
  assert.equal(await page.innerText("#gc-go"), "Continue");
  assert.match(await page.innerText("#gc-encore"), /Play it again, 2x bonus fans/);
  await page.click("#gc-encore"); await page.waitForSelector("#gig:not(.done)");
});

test("Road Ready 06: Continue keeps its action, and the text on Show complete meets AA in both looks", { skip: skip() }, async t => {
  for (const theme of ["dark", "light"]) {
    const page = await toComplete(t, theme);
    const r = await page.evaluate(() => {
      const rgb = c => c.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = c => { const [a, b, d] = rgb(c).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * a + .7152 * b + .0722 * d; };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
      const bg = getComputedStyle(document.querySelector(".gig.done")).backgroundColor, col = s => getComputedStyle(document.querySelector(s)).color;
      return { over: ratio(col(".sc-over"), bg), title: ratio(col(".sc-title"), bg), sub: ratio(col(".sc-sub"), bg), tile: ratio(col(".sc-tile b"), bg), next: ratio(col(".sc-next"), bg),
        label: ratio(col(".sc-label"), getComputedStyle(document.querySelector(".sc-label")).backgroundColor) };
    });
    for (const [k, v] of Object.entries(r)) assert.ok(v >= 4.5, `${theme} ${k}: ${v.toFixed(2)}:1`);
    await page.click("#gc-go"); await page.waitForSelector("#gig", { state: "detached" });
    assert.ok(await page.locator(".shead").isVisible(), "Continue stays on the song page, as before");
  }
});

test("Road Ready 06: Show complete moves (sparks, one pulse, one hop) and stays still with Reduce Motion", { skip: skip() }, async t => {
  for (const reduce of [false, true]) {
    const page = await toComplete(t, "dark", { reducedMotion: reduce ? "reduce" : "no-preference" });
    const a = await page.evaluate(() => ["glow .sc-guitar", "sc-louie", "sc-sparks i"].map(s => getComputedStyle(document.querySelector(s.startsWith("glow") ? ".sc-show.glow .sc-guitar" : "." + s)).animationName));
    assert.deepEqual(a, reduce ? ["none", "none", "none"] : ["sc-pulse", "sc-hop", "sc-drift"]);
  }
});

test("a saved Green Room uses the Road Ready Show complete", { skip: skip() }, async t => {
  const page = await toComplete(t, "green");
  assert.ok(await page.locator(".rr-sc, .sc-show").count() >= 1);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.theme), "green");
  assert.notEqual(await page.evaluate(() => document.documentElement.dataset.look), "green");
});

test("Road Ready 06: at large text Show complete scrolls, with nothing running off the side", { skip: skip() }, async t => {
  const page = await toComplete(t, "dark");
  await page.evaluate(() => { document.documentElement.style.setProperty("--sys-px", "33px"); document.documentElement.dataset.ax = "1"; });
  await page.waitForTimeout(200); /* the layout settles */
  const over = await page.evaluate(() => [...document.querySelectorAll(".rr-sc *")].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) && !e.closest(".sc-show"); }).map(e => e.className || e.tagName));
  assert.deepEqual(over, []);
  assert.ok(await page.evaluate(() => { const g = document.querySelector(".rr-sc"); return g.scrollHeight > g.clientHeight; }), "it scrolls");
});


/* Full-size lyrics (Grok, 2026-11-19, wrapping approved by Graham): in Dark and Light every line is laid out once at the current-line
   size (34 px at the default text size), wrapping between words onto a second row when it needs to, and keeps that box. Only a
   transform draws it at 26 (next) or 22 (the others), so nothing moves, reflows or rewraps when play starts or the line moves on */
test("Road Ready: lyrics are full size (5.7.0: 28, 25, 22), a long line wraps onto two rows, and nothing moves as the line you're on changes", { skip: skip() }, async t => {
  const body = "[Verse]\n" + ["Short one", "A longer line that needs two rows", "Mid length line here", "Short two"].map(l => `A       D\n${l}`).join("\n");
  const song = { id: "z", title: "Grow", artist: "A", key: "A", format: "chords", duration: 20, bpm: 80, body };
  const page = await phone(t, { ...LIB, songs: [song], settings: { ...LIB.settings, v: 6, theme: "dark", plainPlay: false, gigScore: false, countIn: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/z"; }); await page.waitForSelector("#sheet .pr"); await page.evaluate(() => document.fonts.ready); await settled(page);
  const read = () => page.evaluate(() => [...document.querySelectorAll("#sheet > .pr")].map(e => { const ends = [...e.querySelectorAll(".w")].map(w => w.getBoundingClientRect().bottom).sort((a, b) => a - b);
    const fs = parseFloat(getComputedStyle(e).fontSize), m = new DOMMatrixReadOnly(getComputedStyle(e).transform);
    return { top: Math.round(e.offsetTop), h: e.offsetHeight, px: Math.round(fs * m.a), rows: ends.reduce((n, y, i) => n + (i && y - ends[i - 1] > fs * m.a * 0.6 ? 1 : 0), 1), now: e.classList.contains("st-now"), next: e.classList.contains("st-next") }; }));
  const before = await read();
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("sheet")).fontSize), "28px", "laid out at the current-line size (5.7.0: 28)");
  assert.deepEqual(before.map(l => l.px), [25, 25, 25, 25], "the song page shows every line at 25");
  assert.equal(before[1].rows, 2, "the long line wraps onto a second row"); assert.equal(before[0].rows, 1, "a short line stays on one");
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now"); await page.waitForTimeout(400); /* real timer: the 0.25 s transform */
  const playing = await read();
  assert.deepEqual(playing.map(l => [l.top, l.h, l.rows]), before.map(l => [l.top, l.h, l.rows]), "nothing reflows or rewraps when play starts");
  /* Road Ready 05 polish: the amber bar marks the line, there is no stage light, and the rest of the page steps back */
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("st-bg")).display), "none", "no stage light in Road Ready");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".app.viewer > .shead")).visibility), "hidden", "the rest of the page steps back");
  const now = playing.find(l => l.now), next = playing.find(l => l.next), other = playing.find(l => !l.now && !l.next);
  assert.equal(now.px, 28, "the line you're on is 28"); assert.equal(next.px, 25, "the next line is 25"); assert.equal(other.px, 22, "the others are 22");
  await page.waitForFunction(() => document.querySelector("#sheet > .pr:nth-of-type(n+2).st-now, #sheet > .st-now ~ .pr") && [...document.querySelectorAll("#sheet > .pr")].findIndex(e => e.classList.contains("st-now")) >= 1, null, { timeout: 15000 });
  await page.waitForTimeout(400);
  const later = await read();
  assert.deepEqual(later.map(l => [l.top, l.h, l.rows]), before.map(l => [l.top, l.h, l.rows]), "nothing moves when the line you're on changes");
  const r = await page.evaluate(() => { const s = document.getElementById("sheet").getBoundingClientRect().right; return [...document.querySelectorAll("#sheet .w")].every(w => w.getBoundingClientRect().right <= s + 1); });
  assert.ok(r, "every word stays inside the width");
});

test("Road Ready: Louie's first-song line shows once inside the playing screen, away from the controls hint", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [LONG], settings: { ...LIB.settings, v: 6, theme: "dark", plainPlay: false, countIn: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/g"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector(".gg-first");
  assert.match(await page.innerText(".gg-first"), /first song/i);
  const box = await page.evaluate(() => { const r = document.querySelector(".gg-first").getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight }; });
  assert.ok(box.bottom < box.vh / 2, "near the top, so it never sits on the hint or Pause at the bottom");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.used?.firstLine === true);
  await page.reload(); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector("#sheet > .st-now"); await page.waitForTimeout(600); /* real timer */
  assert.equal(await page.locator(".gg-first").count(), 0, "never again");
});

test("4.108.0 Dark and Light: the song controls are an amp-style bar, Speed, a lit Pause, Loop and Tools, each a 44 px target, and they work", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [LONG], settings: { ...LIB.settings, v: 6, theme: "dark", plainPlay: false, gigScore: false, countIn: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/g"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector(".gg-bar #gg-pause");
  const ids = await page.$$eval(".gg-bar button", bs => bs.map(b => [b.id, b.getAttribute("aria-label"), b.getBoundingClientRect().width >= 44 && b.getBoundingClientRect().height >= 44]));
  assert.deepEqual(ids, [["gg-speed", "Song length: 3:20", true], ["gg-pause", "Pause", true], ["gg-loop", "Loop a section", true], ["gg-tools", "Tools", true]]);
  await page.keyboard.press("Shift"); await page.click("#gg-tools"); await page.waitForSelector(".menu[aria-label='Tools']");
  await page.keyboard.press("Escape"); await page.waitForSelector(".menu", { state: "detached" });
});

test("4.111.0 Speed shows its setting, lit when not 1.0x, on the song page and in the Gig; the dial puts it back to 1.0x in one tap", { skip: skip() }, async t => {
  const slow = { ...LONG, speed: 36 };
  const page = await phone(t, { ...LIB, songs: [slow], settings: { ...LIB.settings, v: 6, theme: "dark", speedMode: "multiplier", plainPlay: false, gigScore: false, countIn: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/g"; }); await page.waitForSelector("#pw-speed"); await settled(page);
  assert.equal((await page.innerText("#pw-speed .sp-val")).trim(), "0.8x");
  assert.equal(await page.getAttribute("#pw-speed", "aria-label"), "Speed: 0.8x");
  assert.ok(await page.$eval("#pw-speed", b => b.classList.contains("sp-off")), "lit while not at the real speed");
  await page.click("#play"); await page.waitForSelector(".gg-bar #gg-speed");
  assert.equal((await page.innerText("#gg-speed .sp-val")).trim(), "0.8x", "the Gig's Speed says the same");
  assert.ok(await page.$eval("#gg-speed", b => b.classList.contains("sp-off")));
  await page.click("#gg-speed"); await page.waitForSelector(".dial .dial-reset:not([hidden])");
  const r = await page.$eval(".dial-reset", b => { const x = b.getBoundingClientRect(); return { h: x.height, bottom: innerHeight - x.bottom, text: b.textContent }; });
  assert.equal(r.text, "Back to 1.0x"); assert.ok(r.h >= 44, "a 44 px target"); assert.ok(r.bottom < 80, "at the bottom, in thumb reach");
  await page.click(".dial-reset"); await page.waitForSelector(".dial", { state: "detached" });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs[0].speed === 45);
  await page.waitForFunction(() => document.querySelector("#pw-speed .sp-val")?.textContent === "1.0x");
  assert.ok(!(await page.$eval("#pw-speed", b => b.classList.contains("sp-off"))), "not lit at 1.0x");
  await page.click("#pw-speed"); await page.waitForSelector(".dial");
  assert.equal(await page.locator(".dial-reset:not([hidden])").count(), 0, "no Back to 1.0x when it is already 1.0x");
});

test("a saved Green Room uses the amp bar while a song plays", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [LONG], settings: { ...LIB.settings, v: 6, theme: "green", plainPlay: false, gigScore: false, countIn: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/g"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector("#gg-pause");
  assert.ok(await page.locator(".gg-bar").count() >= 1);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.theme), "green");
});

test("5.10.2 Play and Pause swap bars without the bar moving: the Gig's bar has the paused bar's size, place and control spots", { skip: skip() }, async t => {
  for (const width of [390, 320]) {
    const page = await strummingPage(t, { ...LIB, songs: [LONG], settings: { ...LIB.settings, theme: "neon", plainPlay: false } }, "#/song/g", { width });
    if (width !== 390) await page.setViewportSize({ width, height: 844 });
    await settled(page);
    const box = sel => page.evaluate(s => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); }, sel);
    const paused = { bar: await box(".app.viewer .pw.glass"), speed: await box(".player .gg-speed"), play: await box("#play"), loop: await box("#pw-loop"), tools: await box("#more") };
    await page.click("#play"); await page.waitForSelector("#gig .gg-bar");
    await page.waitForFunction(() => { const b = document.querySelector("#gig .gg-bar"); return b && getComputedStyle(b).opacity === "1"; });
    const playing = { bar: await box("#gig .gg-bar"), speed: await box("#gg-speed"), play: await box("#gg-pause"), loop: await box("#gg-loop"), tools: await box("#gg-tools") };
    for (const k of Object.keys(paused)) paused[k].forEach((v, i) => assert.ok(Math.abs(v - playing[k][i]) <= 2, `at ${width} px ${k} stays put (${paused[k]} then ${playing[k]})`));
  }
});

test("5.13.1 in a Gig, Pause and Play swap the two bars with no motion: nothing shrinks into the corner or grows back out", { skip: skip() }, async t => {
  const page = await strummingPage(t, { ...LIB, songs: [LONG], settings: { ...LIB.settings, theme: "neon", plainPlay: false, keepControls: true } }, "#/song/g");
  const moving = () => page.evaluate(() => document.getAnimations().filter(a => { const el = a.effect?.target; return el instanceof Element && (el.closest(".dock, .fold-ghost") || el.id === "play" || el.classList.contains("fold-ghost")); }).length + document.querySelectorAll(".fold-ghost").length);
  await page.click("#play"); await page.waitForSelector("#gig .gg-bar");
  assert.equal(await moving(), 0, "starting: no ghost of the bar shrinking away");
  await page.waitForTimeout(800); /* real timer: let it play */
  await page.click("#gg-pause"); await page.waitForFunction(() => document.body.classList.contains("held"));
  assert.equal(await moving(), 0, "pausing: the bar doesn't grow back out of the corner");
});
