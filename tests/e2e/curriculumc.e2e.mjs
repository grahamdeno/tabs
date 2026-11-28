// 5.19.0 (curriculum Release C): testing up, testing out and credit. The songs are invented; the microphone is pretend.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser, settled, FAKE_MIC } from "./harness.mjs";
useBrowser();

const sheet = (...lines) => "[Verse]\n" + lines.join("\n") + "\n\n[Chorus]\n" + lines.join("\n");
const SONG = { id: "pier", title: "Pier Lights", artist: "The Cape Fear", key: "A", format: "chords", status: "learning", duration: 14, bpm: 200, body: "[Verse]\nA        D\nGrey boats lean on the wall\nE        A\nWaiting on a tide\n\n[Chorus]\nD        E\nBring the lights home\nA        A\nBring them round" };
/* fits Tour 1 (Em, with the easy shapes C to Cmaj7 not counted) */
const EM = { id: "em", title: "Slow Tide", artist: "The Cape Fear", key: "Em", format: "chords", status: "learning", duration: 14, bpm: 100, body: sheet("Em    Em    Em    Em", "la la la la la la la la", "Em    Em    Em    Em", "la la la la la la la la") };
const T1 = ["k1.1", "k1.2", "c:Em", "k1.4", "k1.5", "k1.6"];
const ALL = Array.from({ length: 13 }, (_, i) => `b:t${i + 1}`);
/* a player who has not started: Opening night at its first step, nothing done */
const rookie = (extra = {}) => {
  const d = JSON.parse(JSON.stringify(LIB));
  d.songs = [{ ...SONG }, { ...EM }];
  d.settings = { ...d.settings, capo: false };
  d.opening = { step: 0, v: 3 }; delete d.me;
  d.curriculum = { v: 1, done: {} };
  d.boxes = { opened: ALL };
  return { ...d, ...extra };
};
/* a player on Tour 2: Tour 1 done, the lessons not */
const onTour2 = (extra = {}) => {
  const d = JSON.parse(JSON.stringify(LIB));
  d.songs = [{ ...SONG }];
  d.curriculum = { v: 1, done: Object.fromEntries(T1.map(id => [id, 5])), box1: 1, settled: ["b:t1"] };
  d.boxes = { opened: ALL };
  d.guitars = { seen: ["open"] };
  return { ...d, ...extra };
};
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1") || "{}"));
const tap = (page, id) => page.evaluate(i => document.querySelector(`[data-stop="${i}"]`).click(), id);
const text = page => page.evaluate(() => document.body.innerText);

test("C1: a new player is asked once whether they have played before, and the answer is kept", { skip: skip() }, async t => {
  const page = await phone(t, rookie(), { home: true });
  await page.waitForSelector(".rd-level"); await settled(page);
  assert.match(await page.textContent(".rd-level"), /Have you played guitar before\?/);
  assert.equal(await page.isVisible("#lq-new"), true);
  assert.equal(await page.isVisible("#lq-play"), true);
  await page.click("#lq-new");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).curriculum?.asked > 0, null, { timeout: 5000 });
  await page.waitForFunction(() => !document.querySelector(".rd-level"));
  await page.reload(); await page.waitForSelector("#rd-path"); await settled(page);
  assert.equal(await page.locator(".rd-level").count(), 0, "not asked again");
  const s = await stored(page);
  assert.deepEqual(Object.keys(s.curriculum.done || {}), [], "New to guitar marks nothing done");
});

test("C1: I already play opens the levels, and without a microphone the check offers Start here anyway, which pays and marks nothing", { skip: skip() }, async t => {
  const page = await phone(t, rookie(), { home: true });
  await page.waitForSelector("#lq-play"); await settled(page);
  await page.click("#lq-play");
  await page.waitForSelector("[data-level]");
  const lv = await page.locator("[data-level]").allInnerTexts();
  assert.equal(lv.length, 2);
  assert.match(lv[0], /A few chords/); assert.match(lv[1], /Open chords and strumming/);
  await page.click('[data-level="few"]');
  await page.waitForSelector(".rd-check [data-tsong]");
  await page.click(".rd-check [data-tsong]");
  await page.waitForSelector(".rd-check [data-gocheck]");
  assert.match(await page.textContent(".rd-check"), /Test up/);
  await page.click(".rd-check [data-gocheck]");
  await page.waitForFunction(() => /needs the microphone/.test(document.body.innerText), null, { timeout: 15000 });
  assert.match(await text(page), /Testing up needs the microphone/);
  await page.click('[data-rnd="here"]');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).curriculum?.start === "t2", null, { timeout: 5000 });
  const s = await stored(page);
  /* skipping Opening night maps Tour 1 as done the way it always has (curriculumSeed, add-only, pays nothing); no later stop is marked */
  assert.deepEqual(Object.keys(s.curriculum.done || {}).filter(id => !T1.includes(id)), [], "no tour past Tour 1 is marked done");
  assert.equal(s.curriculum.tested, undefined, "nothing tested out");
  assert.equal(s.curriculum.paid, undefined, "nothing paid");
  assert.equal(s.curriculum.won, undefined, "no guitar");
});

test("C1: Unlock all tours hides Test up and the question, and writes nothing", { skip: skip() }, async t => {
  const page = await phone(t, rookie({ settings: { ...LIB.settings, unlockAll: true } }), { home: true });
  await page.waitForSelector("#rd-path, .rr-open, .rn-neck"); await settled(page);
  assert.equal(await page.locator(".rd-level").count(), 0);
  assert.equal(await page.locator("#rn-testup").count(), 0);
  const s = await stored(page);
  assert.equal(s.curriculum?.asked, undefined);
  assert.equal(s.curriculum?.tested, undefined);
});

test("C2: a stop card offers Test out, and a tour's headline card offers Test out of this tour", { skip: skip() }, async t => {
  const page = await phone(t, onTour2(), { home: true });
  await page.waitForSelector(".rn-neck"); await settled(page);
  await tap(page, "c:A"); await page.waitForSelector(".rd-pop");
  assert.match(await page.textContent(".rd-pop"), /Test out/);
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.getElementById("ck-scrim")?.click());
  await page.evaluate(() => document.querySelector(".scrim")?.click());
  await page.waitForFunction(() => !document.querySelector(".rd-pop"));
  await tap(page, "k2.6"); await page.waitForSelector(".rd-pop");
  assert.match(await page.textContent(".rd-pop"), /Test out of this tour/);
  assert.equal(await page.locator("#rn-testup").count(), 1, "Test up is at the top of the Tour");
});

test("C3: tested-out tours and stops say Tested out in words, and a lesson played later brings the check mark back and pays once", { skip: skip() }, async t => {
  const d = onTour2({ skills: { done: { "c:Em": { n: 1, best: 0, at: 5 } }, last: 5 } });
  d.curriculum.done = { ...d.curriculum.done, "c:A": 9, "c:D": 9 };
  d.curriculum.tested = { "c:A": 9, "c:D": 9, t2: 9 };
  const page = await phone(t, d, { home: true });
  await page.waitForSelector(".rn-neck"); await settled(page);
  const marks = await page.locator(".rn-tested").allInnerTexts();
  assert.ok(marks.length >= 2, "a label for each tested stop");
  assert.ok(marks.every(m => /Tested out/.test(m)));
  assert.match(await page.evaluate(() => document.querySelector('[data-stop="c:A"]').getAttribute("aria-label")), /tested out/i);
});

/* ---- the check round itself: the pretend guitar plays the chord Louie asks for ---- */
const HZ = { A: [110, 164.81, 220, 277.18, 329.63], D: [146.83, 220, 293.66, 369.99], E: [82.41, 123.47, 164.81, 207.65, 246.94, 329.63] };
const follow = page => page.evaluate(hz => { clearInterval(window.__follow); window.__follow = setInterval(() => { const n = (document.querySelector(".rnd-now")?.textContent || "").trim(); window.__chord = hz[n] || []; }, 15); }, HZ);
const quiet = page => page.evaluate(() => { clearInterval(window.__follow); window.__chord = []; });
const cardText = page => page.waitForFunction(() => { const c = document.querySelector("#round .rnd-card"); return c && !c.hidden && c.innerText.trim(); }, null, { timeout: 60000 }).then(() => page.innerText("#round .rnd-card"));
/* the pretend guitar is a real-time loop: on a busy machine a pass can miss, so play again (a failed check never costs anything) */
const passCheck = async page => {
  let c = "";
  for (let k = 0; k < 4; k++) {
    c = await cardText(page);
    if (/Tested out/.test(c)) break;
    if (k < 3) { await page.click('#round [data-rnd="again"]'); await page.waitForFunction(() => document.querySelector("#round .rnd-card")?.hidden); }
  }
  return c;
};
const withTour = (extra = {}) => onTour2({ songTour: { v: 1, legs: { t2: { pick: { title: "Pier Lights", artist: "The Cape Fear", chords: ["A", "D", "E"] }, song: "pier", skipped: [], done: [] } } }, ...extra });
const startTourCheck = async page => {
  await page.waitForSelector(".rn-neck"); await settled(page);
  await tap(page, "k2.6"); await page.waitForSelector(".rd-pop");
  await page.click('.rd-pop [data-gocheck="tour:t2"]');
  await page.waitForSelector("#round .rnd-hw", { timeout: 15000 }); await settled(page);
};

test("C2: a passed tour check tests out the tour, pays the headline once and earns the guitar once", { skip: skip() }, async t => {
  const page = await phone(t, withTour(), { home: true, prepare: p => p.addInitScript(FAKE_MIC) });
  await startTourCheck(page);
  await follow(page);
  const c = await passCheck(page);
  assert.match(c, /tested out/i, c);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).curriculum?.won?.t2, null, { timeout: 5000 });
  const s = await stored(page);
  assert.ok(s.curriculum.won.t2, "the tour's guitar is earned");
  assert.deepEqual(Object.keys(s.curriculum.paid || {}), ["k2.6"], "only the headline paid");
  assert.ok(s.curriculum.tested.t2 && s.curriculum.tested["c:A"], "the other stops are tested out");
  assert.equal(s.curriculum.done["k2.6"] > 0, true);
});

test("C1: a check that is not heard changes nothing, and after two tries a level offers the way back and Start here anyway, which marks and pays nothing", { skip: skip() }, async t => {
  const d = rookie();
  d.songTour = { v: 1, legs: { t1: { pick: { title: "Slow Tide", artist: "The Cape Fear", chords: ["Em"] }, song: "em", skipped: [], done: [] } } };
  const page = await phone(t, d, { home: true, prepare: p => p.addInitScript(FAKE_MIC) });
  await page.waitForSelector("#lq-play"); await settled(page);
  await page.click("#lq-play"); await page.waitForSelector('[data-level="few"]');
  await page.click('[data-level="few"]'); await page.waitForSelector(".rd-check [data-gocheck]");
  await page.click(".rd-check [data-gocheck]");
  await page.waitForSelector("#round .rnd-hw", { timeout: 15000 }); await settled(page);
  let c = await cardText(page);
  assert.match(c, /Louie heard 0 of/);
  assert.doesNotMatch(c, /Start here anyway/, "one try: just play again");
  await page.click('#round [data-rnd="again"]'); await page.waitForFunction(() => document.querySelector("#round .rnd-card")?.hidden);
  c = await cardText(page);
  assert.match(c, /Start here anyway/, "two tries: the choices");
  assert.match(c, /Start from Tour 1/);
  const mid = await stored(page);
  assert.equal(mid.curriculum.tested, undefined, "a failed check changes nothing");
  assert.equal(mid.curriculum.paid, undefined);
  await page.click('#round [data-rnd="here"]');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).curriculum?.start === "t2", null, { timeout: 5000 });
  const s = await stored(page);
  assert.equal(s.curriculum.tested, undefined);
  assert.equal(s.curriculum.paid, undefined, "nothing paid");
  assert.equal(s.curriculum.won, undefined, "no guitar");
});

test("C2: a stop is tested out by playing its piece once; it pays nothing then, and its first normal play pays once", { skip: skip() }, async t => {
  const d = withTour(); d.curriculum.done = { ...d.curriculum.done, "c:A": 5, "c:D": 5, "c:E": 5, "k2.4": 5 };
  d.skills = { done: Object.fromEntries(["Em", "A", "D", "E"].map(c => [`c:${c}`, { n: 1, best: 0, at: 5 }])), last: 5 };
  const page = await phone(t, d, { home: true, prepare: p => p.addInitScript(FAKE_MIC) });
  await page.waitForSelector(".rn-neck"); await settled(page);
  const fans0 = (await stored(page)).curriculum.paid || {};
  await tap(page, "k2.5"); await page.waitForSelector(".rd-pop");
  await page.click('.rd-pop [data-gocheck="stop:k2.5"]');
  await page.waitForSelector("#round .rnd-hw", { timeout: 15000 }); await settled(page);
  await follow(page);
  const c = await passCheck(page);
  assert.match(c, /Tested out/);
  assert.doesNotMatch(c, /\+\d+ fans/, "testing out a stop pays nothing");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).curriculum?.tested?.["k2.5"], null, { timeout: 5000 });
  const s = await stored(page);
  assert.equal(s.curriculum.paid?.["k2.5"], fans0["k2.5"], "nothing paid yet");
  assert.ok(s.curriculum.done["k2.5"]);
});

test("C3: after two missed rounds on a tested-out chord a refresher is offered; No thanks closes it for good", { skip: skip() }, async t => {
  const d = withTour(); d.curriculum.done = { ...d.curriculum.done, "c:A": 5, "c:D": 5, "c:E": 5, "k2.4": 5 };
  d.curriculum.tested = { "c:A": 5, t2: 5 };
  d.skills = { done: Object.fromEntries(["Em", "D", "E"].map(c => [`c:${c}`, { n: 1, best: 0, at: 5 }])), last: 5 };
  const page = await phone(t, d, { home: true, prepare: p => p.addInitScript(FAKE_MIC) });
  await page.waitForSelector(".rn-neck"); await settled(page);
  const play = async () => {
    await page.waitForSelector('.rn-stop.cur[data-stop="k2.5"]'); await page.click("#rn-now-start");
    await page.waitForSelector("#round .rnd-hw"); await settled(page);
  };
  await play();
  let c = await cardText(page);
  assert.doesNotMatch(c, /refresher/i, "not after the first miss");
  await page.click('#round [data-rnd="again"]'); await page.waitForFunction(() => document.querySelector("#round .rnd-card")?.hidden);
  c = await cardText(page);
  assert.match(c, /Want a refresher\? Tour 2 teaches A\./);
  await page.click('#round [data-rnd="nothanks"]');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).curriculum?.refresher?.A > 0, null, { timeout: 5000 });
  assert.equal(await page.locator("#round .rnd-refresh").count(), 0, "closed");
  await page.click('#round [data-rnd="again"]'); await page.waitForFunction(() => document.querySelector("#round .rnd-card")?.hidden);
  c = await cardText(page);
  assert.doesNotMatch(c, /refresher/i, "not offered again for that chord");
});
