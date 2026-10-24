// Opening night (4.40.0): the first leg of the Road teaches by doing, on the sample song.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, SONG, phone, settled, useBrowser } from "./harness.mjs";
useBrowser();

const { opening: _done, ...BASE } = LIB;
const FRESH = { ...BASE, songs: [{ id: "h", title: "Harbor Lights", artist: "Sample song", sample: true, key: "A", format: "chords", body: SONG, duration: 60 }], settings: { ...LIB.settings, plainPlay: false, gigScore: false } };
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).opening || {});
const stepIs = (page, n) => page.waitForFunction(n => (JSON.parse(localStorage.getItem("tabs-v1")).opening || {}).step === n, n);

test("4.40.0 Opening night: a new player gets five steps; the microphone's reason comes first, then a chord, then the verse waits for Count me in", { skip: skip() }, async t => {
  const page = await phone(t, FRESH, { home: true });
  await page.waitForSelector(".rd-banner.on-night");
  assert.match(await page.innerText(".rd-banner"), /OPENING NIGHT/);
  assert.equal(await page.locator(".on-stop").count(), 5, "five picks");
  assert.equal(await page.locator(".rd-tonight, #rd-songbook").count(), 0, "one thing to tap: no Gig button and no Songbook bar");
  assert.equal(await page.locator(".hud .h-lab").count(), 0, "the stat bar stays quiet during the leg");
  await settled(page);
  /* 1: the reason, then Not now plays unscored */
  await page.click(".rd-node.now"); await page.click("[data-ostart]");
  await page.waitForSelector(".on-mic");
  assert.match(await page.innerText(".on-mic"), /Nothing is recorded or sent anywhere/);
  await page.click("#on-not");
  await stepIs(page, 1);
  assert.equal((await saved(page)).micOff, true, "Not now: shows aren't scored");
  /* 2: the song, a strip above Play, the chord pulses */
  await page.waitForSelector(".on-stop .rd-node.now"); await settled(page);
  await page.click(".rd-node.now"); await page.click("[data-ostart]");
  await page.waitForSelector("#on-strip"); await page.waitForSelector(".sheet .c.on-pulse .ct");
  assert.match(await page.innerText("#on-strip"), /STEP 2 OF 5[\s\S]*Tap the A/);
  await page.click(".sheet .c.on-pulse .ct");
  await stepIs(page, 2);
  assert.match(await page.innerText("#on-strip"), /STEP 3 OF 5[\s\S]*press Play/);
  /* 3: the Gig waits and says why it listens (here, that it won't) */
  await page.click("#play");
  await page.waitForSelector(".on-count");
  assert.match(await page.innerText(".on-count"), /Play each chord[\s\S]*microphone is off/);
  assert.equal(await page.evaluate(() => document.body.classList.contains("playing")), false, "nothing scrolls until Count me in");
  await page.click("#on-go");
  await page.waitForFunction(() => document.body.classList.contains("playing") && !document.querySelector(".on-count"));
});

test("4.40.0 Opening night: pause and pick up in the Gig: the step says what to do at each point", { skip: skip() }, async t => {
  const page = await phone(t, { ...FRESH, opening: { step: 3, fans: 15 } }, { home: true });
  await page.waitForSelector(".rd-node.now"); await settled(page);
  await page.click(".rd-node.now"); await page.click("[data-ostart]");
  await page.waitForSelector("#on-strip"); await page.waitForFunction(() => document.body.classList.contains("playing"));
  assert.match(await page.innerText("#on-strip"), /Tap anywhere to pause/);
  await page.click("#gg-pause");
  await page.waitForSelector("body.held");
  assert.match(await page.innerText("#gg-hsay"), /Tap Resume/);
  await page.click("#play");
  await stepIs(page, 4);
  assert.match(await page.innerText("#on-strip"), /STEP 5 OF 5[\s\S]*through to the end/);
});

test("4.40.0 Opening night: Skip asks first; afterwards the stat bar names its three doors until each is tapped", { skip: skip() }, async t => {
  const page = await phone(t, FRESH, { home: true });
  await page.waitForSelector("#on-skip"); await settled(page);
  await page.click("#on-skip");
  await page.waitForSelector("#ask-ok");
  assert.match(await page.innerText(".ask .panel"), /Skip opening night\?[\s\S]*replay it/);
  await page.click("#ask-ok");
  await page.waitForSelector(".rd-banner:not(.on-night)");
  await page.waitForFunction(() => (JSON.parse(localStorage.getItem("tabs-v1")).opening || {}).skipped > 0); /* skipped is kept */
  assert.equal(await page.locator(".hud .h-lab").count(), 3, "VENUE, STREAK and FANS");
  await page.click("#h-fans"); await page.waitForFunction(() => location.hash === "#/merch");
  await page.evaluate(() => { location.hash = "#/"; }); await page.waitForSelector(".hud");
  assert.deepEqual(await page.locator(".hud .h-lab").allInnerTexts(), ["VENUE", "STREAK"], "a door you've used loses its label");
});

test("4.40.0 Opening night: someone who already plays never sees it; Tips & gestures replays it", { skip: skip() }, async t => {
  const page = await phone(t, { ...BASE, songs: LIB.songs.map(s => ({ ...s, playLog: { total: 2, last: Date.now(), days: { "2026-10-01": 2 } } })) }, { home: true });
  await page.waitForSelector(".rd-banner");
  assert.equal(await page.locator(".on-night").count(), 0);
  await page.evaluate(() => { location.hash = "#/gestures"; }); await page.waitForSelector("#gs-opening"); await settled(page);
  await page.click("#gs-opening");
  await page.waitForSelector(".rd-banner.on-night");
  await page.waitForFunction(() => (JSON.parse(localStorage.getItem("tabs-v1")).opening || {}).replay === true);
});

test("4.45.2 Opening night: tapping the last pick scrolls its card and button above the tab bar", { skip: skip() }, async t => {
  const page = await phone(t, { ...FRESH, opening: { step: 4, fans: 20 } }, { home: true });
  await page.waitForSelector('[data-ostep="4"]');
  await page.click('[data-ostep="4"]'); await page.waitForSelector(".rd-pop");
  await page.waitForFunction(() => { const r = document.querySelector(".rd-pop").getBoundingClientRect(), b = document.getElementById("tabs").getBoundingClientRect(); return r.bottom <= b.top; }, null, { timeout: 4000 });
});
