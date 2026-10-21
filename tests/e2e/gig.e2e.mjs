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
async function strummingPage(t, lib, hash) {
  const browser2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => browser2.close());
  const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(FAKE_MIC);
  await ctx.addInitScript(json => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("tabs-v1", json); } }, JSON.stringify(lib));
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  t.after(() => assert.deepEqual(errors, [], "page errors"));
  await page.goto(base + hash); await page.waitForSelector("#play"); await settled(page);
  await page.evaluate(() => { setInterval(() => { window.__hz = 110; setTimeout(() => { window.__hz = 0; }, 90); }, 400); });
  return page;
}
const SHORT = { id: "g", title: "Short Road", artist: "Me", key: "A", format: "chords", duration: 16,
  body: "[Verse]\nA        D\nWalking down the road\nE        A\nLantern in my hand\n\n[Chorus]\nD        A\nCarry me home\nE        A\nLay me down" };
const LONG = { ...SHORT, duration: 200, body: "[Verse]\n" + Array.from({ length: 8 }, (_, i) => `A        D\nVerse line ${i + 1}`).join("\n") + "\n\n[Chorus]\n" + Array.from({ length: 8 }, (_, i) => `E        A\nChorus line ${i + 1}`).join("\n") };
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")));

test("The Gig (4.1.0, 4.2.0, 4.14.0): a scored show from Play to Show complete, with a Double set and the merch tip", { skip: skip() }, async t => {
  /* 400 fans from earlier shows: enough for the Brick wall backdrop (300), the cheapest thing not owned */
  const page = await strummingPage(t, { ...LIB, songs: [SHORT], gig: { shows: 3, fans: 400, best: {} }, merch: { own: { double: 2 } }, settings: { ...LIB.settings, gigLines: 4, plainPlay: false } }, "#/song/g");
  assert.equal(await page.getAttribute("#play", "aria-label"), "Play as a gig");
  await page.click("#play"); await page.waitForSelector("#gig");
  assert.equal(await page.getAttribute("#gig", "data-lines"), "4", "the lines you picked");
  assert.ok(await page.locator("#gg-lines > *").count() <= 4);
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
  assert.equal(await page.locator("#gg-hline > *").count(), 1, "the line you stopped on");
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

test("Gig: Lines 4, 5 and 6 from Tools while paused keep the line you stopped on; Resume plays on; Sheet goes back", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [LONG], settings: { ...LIB.settings, plainPlay: false, gigScore: false, countIn: false } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/song/g"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForSelector("#gig");
  assert.equal(await page.getAttribute("#gig", "data-lines"), "5", "five lines unless you pick");
  await page.click("#gg-pause"); await page.waitForSelector("#gg-hold:not([hidden])");
  const held = await page.innerText("#gg-hline");
  for (const n of [4, 6, 5]) {
    await page.click("#gg-tools"); await page.waitForSelector(".menu.tools");
    await page.click(`.menu [data-lines="${n}"]`); await page.waitForSelector(`#gig[data-lines="${n}"]`);
    assert.equal(await page.getAttribute(".menu [data-lines][aria-checked='true']", "data-lines"), String(n), `Lines ${n} is the one checked`);
    await page.mouse.click(200, 120); await page.waitForSelector(".menu", { state: "detached" });
    assert.ok(await page.locator("#gg-lines > *").count() <= n, `at most ${n} lines`);
    await page.waitForFunction(n => JSON.parse(localStorage.getItem("tabs-v1")).settings.gigLines === n, n);
  }
  assert.equal(await page.innerText("#gg-hline"), held, "changing Lines while paused keeps the line you stopped on");
  assert.equal(await page.locator("#gig.paused").count(), 1, "still paused");
  const at = await page.evaluate(() => document.getElementById("gg-mark").style.left);
  await page.click("#gg-resume"); await page.waitForSelector("#gg-hold[hidden]", { state: "attached" });
  assert.equal(await page.locator("#gig.paused").count(), 0);
  await page.waitForFunction(a => document.getElementById("gg-mark").style.left !== a, at, { timeout: 8000 });
  await page.click("#gg-pause"); await page.waitForSelector("#gg-hold:not([hidden])");
  await page.click("#gg-sheet"); await page.waitForFunction(() => !document.getElementById("gig"));
  assert.equal(await page.evaluate(() => location.hash), "#/song/g", "Sheet: back to the song, paused");
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
  for (let y = 410; y >= 200; y -= 30) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y }] }); await page.waitForTimeout(16); /* real timer */ }
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
  await page.mouse.click(200, 100); await page.waitForSelector('.menu', { state: 'detached' });
  await page.click("#play"); await page.waitForSelector("#gig");
  assert.equal(await page.getAttribute("#gig", "data-lines"), "full");
  assert.ok(await page.evaluate(() => document.body.classList.contains("gig-full")), "the page shows");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".app.viewer .dock")).visibility), "hidden", "the show's bar replaces the song's");
  await page.waitForFunction(() => /→/.test(document.getElementById("gg-mini").textContent), null, { timeout: 5000 });
  await page.click("#gg-pause"); await page.waitForSelector("#gg-hold:not([hidden])");
  const before = await page.evaluate(() => scrollY);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 500 }] });
  for (let y = 490; y >= 250; y -= 30) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y }] }); await page.waitForTimeout(16); /* real timer */ }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForFunction(b => scrollY > b + 100, before);
  await page.click("#gg-tools"); await page.click('.menu [data-lines="5"]');
  await page.waitForFunction(() => !document.body.classList.contains("gig-full"), null, { timeout: 3000 });
  await page.mouse.click(200, 100); await page.waitForSelector('.menu', { state: 'detached' });
  await page.click("#gg-sheet"); await page.waitForFunction(() => !document.getElementById("gig"));
  assert.equal(await page.evaluate(() => document.body.classList.contains("gig-full")), false);
});
