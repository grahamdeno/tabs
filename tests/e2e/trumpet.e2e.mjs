// 4.81.0: Trumpet. Louie asks once; the page reads a whole step up with a note on every chord; a hard key says so
// once, with Long notes and a guitar's capo; Play together on trumpet; Sing it finds a song's tune by ear.
import test from "node:test";
import assert from "node:assert/strict";
import { base, LIB, phone, settled, skip, useBrowser, FAKE_MIC, chromium } from "./harness.mjs";

useBrowser();
const ASK = { ...LIB, settings: { ...LIB.settings } };
delete ASK.settings.instrument;

test("Trumpet: Louie asks once, the chords read a whole step up with a note each, Hits, and Settings switches back", { skip: skip() }, async t => {
  const page = await phone(t, ASK);
  await page.goto(base + "#/song/b"); await page.waitForSelector(".in-pick");
  await page.click("[data-in='trumpet']"); await page.waitForSelector(".in-lv");
  assert.match(await page.innerText(".panel.inst"), /How long have you played\?[\s\S]*2 years[\s\S]*B♭ trumpet/i);
  await page.click("#in-go");
  await page.waitForSelector("#sheet.tp .tp-n");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.instrument === "trumpet");
  /* G C sounds; a trumpet reads A D, each with its note */
  assert.deepEqual(await page.$$eval("#sheet .c[data-ch]", e => e.map(x => x.dataset.ch)), ["A", "D"]);
  assert.match(await page.innerText("#csub"), /Trumpet in A/);
  const notes = await page.$$eval("#sheet .tp-n", e => e.map(x => x.textContent));
  assert.equal(notes.length, 2);
  assert.match(await page.innerText("#strip"), /YOUR PART[\s\S]*Long notes[\s\S]*Hits[\s\S]*You read in A: 3 sharps[\s\S]*NOTES/i);
  assert.ok(await page.locator("#strip .tp-card .tp-v").count() >= 1, "each note shows its valves");
  /* Hits */
  await page.click("[data-tpp='hits']");
  await page.waitForFunction(() => document.querySelector("[data-tpp='hits']")?.getAttribute("aria-pressed") === "true");
  assert.match(await page.innerText(".tp-say"), /beats 2 and 4/);
  /* no guitar shape pops up on a chord */
  await page.click("#sheet .c[data-ch] .ct");
  assert.equal(await page.locator(".shapecard").count(), 0);
  /* asked once: the next song doesn't ask */
  await page.goto(base + "#/song/a"); await page.waitForSelector("#sheet .tp-n");
  /* Settings: back to guitar */
  await page.goto(base + "#/settings/playing"); await page.waitForSelector("#s-inst");
  assert.equal(await page.locator("#s-tplv").count(), 1);
  await page.click("#s-inst [data-in='guitar']");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.instrument === "guitar");
  await page.goto(base + "#/song/b"); await page.waitForSelector("#sheet .c[data-ch] .ct"); await settled(page);
  assert.deepEqual(await page.$$eval("#sheet .c[data-ch]", e => e.map(x => x.dataset.ch)), ["G", "C"]);
  assert.equal(await page.locator(".in-pick").count(), 0, "not asked again");
});

test("Trumpet: a recording in A is a hard key once; a guitar's capo 1 puts you in C in Play together", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, instrument: "trumpet", tpLevel: "two" } });
  await page.goto(base + "#/song/a"); await page.waitForSelector("#hk-long");
  assert.match(await page.innerText(".panel.hk"), /hard key[\s\S]*recording is in A, so you read in B: 5 sharps[\s\S]*Long notes[\s\S]*capo on 1 puts you in C, no sharps or flats[\s\S]*Try it in B anyway/);
  assert.equal(await page.locator(".hk-acc span").count(), 5);
  await page.click("#hk-duet");
  await page.waitForSelector("#pt-capo");
  assert.match(await page.innerText(".pt"), /Long notes[\s\S]*Hits[\s\S]*Guitar on capo 1/);
  assert.deepEqual(await page.$$eval("#sheet .c[data-ch]", e => e.slice(0, 2).map(x => x.dataset.ch)), ["C", "F"], "the capo is on as Play together opens");
  await page.click("#pt-capo");
  await page.waitForFunction(() => document.querySelector("#sheet .c[data-ch]")?.dataset.ch === "B");
  await page.click("#pt-capo");
  await page.waitForFunction(() => document.querySelector("#sheet .c[data-ch]")?.dataset.ch === "C");
  await page.click("#pt-scrim", { position: { x: 20, y: 20 } });
  /* once per song: back on the song, it doesn't ask again */
  await page.goto(base + "#/song/b"); await page.waitForSelector("#sheet .tp-n");
  await page.goto(base + "#/song/a"); await page.waitForSelector("#sheet .tp-n"); await settled(page);
  assert.equal(await page.locator("#hk-long").count(), 0);
  assert.equal(await page.$eval("#sheet .c[data-ch]", e => e.dataset.ch), "B", "the capo was only for Play together");
  await page.click("#tp-hard"); await page.waitForSelector("#hk-long");
  await page.click("#hk-any");
});

test("Trumpet: Sing it finds the tune by ear, with the song's words; Use as Melody part gives 25 fans once", { skip: skip() }, async t => {
  const b2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => b2.close());
  const ctx = await b2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(FAKE_MIC);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.addInitScript(json => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("tabs-v1", json); } }, JSON.stringify({ ...LIB, settings: { ...LIB.settings, instrument: "trumpet" } }));
  await page.goto(base + "#/song/b"); await page.waitForSelector("#tp-ear");
  await page.click("#tp-ear"); await page.waitForSelector("#sk-pad");
  assert.match(await page.innerText(".sk2"), /HARBOR LIGHTS[\s\S]*Voice[\s\S]*Trumpet[\s\S]*Play the tune by ear/i);
  const hz = m => 440 * 2 ** ((m - 69) / 12);
  await page.click("#sk-pad"); await page.waitForSelector("#sk-rib");
  for (const m of [67, 69, 71, 72]) { await page.evaluate(f => { window.__hz = f; }, hz(m)); await page.waitForTimeout(400); /* real timer */ }
  await page.evaluate(() => { window.__hz = 0; }); await page.waitForTimeout(200); /* real timer */
  await page.click("#sk-pad"); await page.waitForSelector(".skl-tp");
  assert.match(await page.innerText(".skl"), /Lights on the water/, "the line takes the song's words");
  /* G A B C sounds: a trumpet reads A B C# D */
  assert.deepEqual(await page.$$eval(".skl-tpn b", e => e.map(x => x.textContent)), ["A", "B", "C♯", "D"]);
  await page.evaluate(() => document.activeElement?.blur());
  await page.click("#sk-done");
  await page.waitForSelector("#sheet .tp-mel");
  await page.waitForFunction(() => { const d = JSON.parse(localStorage.getItem("tabs-v1")); return d.songs.find(s => s.id === "b").tpMel?.lines?.length === 1 && d.quests?.fans === 25; });
  assert.equal(await page.getAttribute("[data-tpp='melody']", "aria-pressed"), "true");
  assert.deepEqual(errors, []);
});

/* Plays, in the page, the note the trumpet part has for the chord the song is on (as it sounds: a whole step under
   the written note), tongued twice a second */
const NOTE_PLAYER = `
setInterval(() => {
  const all = [...document.querySelectorAll("#sheet .c[data-tp]:not(.st-rep)")], i0 = Math.max(0, all.findIndex(e => e.classList.contains("st-on")));
  const el = all.slice(i0).find(e => !/st-got|st-miss/.test(e.className));
  window.__chord = el ? [440 * 2 ** ((+el.dataset.tp - 2 - 69) / 12)] : [];
}, 100);`;
test("Trumpet: the Gig hears the part's notes, shows the note and its valves", { skip: skip() }, async t => {
  const b2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => b2.close());
  const ctx = await b2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(FAKE_MIC);
  const song = { id: "g", title: "Short Road", artist: "Me", key: "G", format: "chords", duration: 16, body: "[Verse]\nG        C\nWalking down the road\nD        G\nLantern in my hand" };
  await ctx.addInitScript(json => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("tabs-v1", json); } }, JSON.stringify({ ...LIB, songs: [song], settings: { ...LIB.settings, plainPlay: false, instrument: "trumpet" } }));
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(base + "#/song/g"); await page.waitForSelector("#play"); await settled(page);
  await page.evaluate(NOTE_PLAYER);
  await page.click("#play"); await page.waitForSelector("#gig");
  await page.waitForSelector("#gg-shape.tp-now:not([hidden]) .tp-v");
  assert.match(await page.innerText("#gg-shape"), /PLAY[\s\S]*over/);
  await page.waitForFunction(() => document.querySelectorAll("#sheet .c.st-got").length >= 2, null, { timeout: 20000 });
  assert.deepEqual(errors, []);
});
