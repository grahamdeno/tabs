// Rehearse and the neck: the permanent practice place, the soundcheck, and a chord lesson that listens.
import test from "node:test";
import assert from "node:assert/strict";
import { chromium, base, skip, LIB, FAKE_MIC, phone, useBrowser, settled } from "./harness.mjs";
useBrowser();

test("Rehearse leads to the neck; All lessons lists levels with the next lesson lit", { skip: skip() }, async t => {
  const y = new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
  const songs = LIB.songs.map(s => ({ ...s, playLog: { total: 3, last: Date.now() - 86400e3, days: { [y]: 1 } } }));
  const page = await phone(t, { ...LIB, songs }, { home: true });
  await page.click("#tabs [data-tab=rehearse]"); await page.waitForSelector(".rh-list");
  await page.click("#rh-neck");
  await page.waitForSelector(".ls-card");
  assert.equal(await page.innerText("h1.title"), "The neck");
  /* 4.21.0: the lesson of the day first; every lesson is under All lessons */
  await page.click("#ls-all"); await page.waitForSelector(".pk-board");
  assert.equal(await page.locator(".pk-level").count(), 6, "with Scales (3.21.0)");
  assert.equal(await page.locator(".pk-level.soon").count(), 3, "strumming, picking and fingerstyle are coming");
  assert.equal(await page.locator(".pk-fret.now").first().innerText().then(x => x.split("\n")[0]), "G");
  await page.click(".pk-fret.locked >> nth=0");
  await page.click(".pk-fret.now >> nth=0");
  await page.waitForSelector(".pk-strings");
  assert.match(await page.innerText("h1.title"), /G chord/);
  await page.click("#back");
  await page.waitForSelector(".pk-board");
  await page.click("#back"); await page.waitForSelector(".ls-card");
});

test("a chord lesson lights a lamp for each string it hears ring clean, and the self-report finishes it", { skip: skip() }, async t => {
  const browser2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => browser2.close());
  const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(FAKE_MIC);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(base);
  await page.waitForTimeout(400);
  await page.evaluate(d => localStorage.setItem("tabs-v1", JSON.stringify(d)), LIB);
  await page.goto(base + "#/practice/c%3AG");
  await page.waitForSelector(".pk-strings");
  assert.equal(await page.locator(".pk-str").count(), 6);
  await page.click("#pk-start");
  await page.waitForFunction(() => /Pluck the low E string, fret 3/.test(document.getElementById("pk-say").textContent));
  await page.evaluate(() => { window.__hz = 98; }); /* the low string fretted at the 3rd: G */
  await page.waitForFunction(() => document.querySelectorAll(".pk-str .gs-lamp.on").length === 1, null, { timeout: 6000 });
  await page.evaluate(() => { window.__hz = 0; });
  await page.click("#pk-self");
  await page.waitForSelector(".pf-plate");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).skills?.done?.["c:G"]?.n === 1);
  assert.deepEqual(errors, []);
});

test("What I hear: the level, the pitch and the string it lights, and readings to copy", { skip: skip() }, async t => {
  const browser2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => browser2.close());
  const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", permissions: ["clipboard-read", "clipboard-write"] });
  await ctx.addInitScript(FAKE_MIC);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(base);
  await page.waitForTimeout(400);
  await page.evaluate(d => localStorage.setItem("tabs-v1", JSON.stringify(d)), LIB);
  await page.goto(base + "#/practice/skills");
  await page.click("#pk-hear");
  await page.waitForSelector("#ph-lane");
  await page.click(".ph-chords [data-c='Am']");
  assert.equal(await page.locator("#ph-strings .pk-str").count(), 6);
  await page.click("#ph-go");
  await page.waitForFunction(() => /Stop/.test(document.getElementById("ph-go").textContent));
  await page.evaluate(() => { window.__hz = 110; }); /* the open A, which Am uses */
  await page.waitForFunction(() => document.getElementById("ph-note").textContent === "A2", null, { timeout: 6000 });
  await page.waitForFunction(() => document.querySelectorAll("#ph-strings .gs-lamp.on").length === 1, null, { timeout: 6000 });
  await page.waitForTimeout(800); /* a moment waiting on the next string */
  await page.click("#ph-copy");
  await page.waitForFunction(async () => /Notes heard: A2/.test(await navigator.clipboard.readText()), null, { timeout: 4000 });
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /E3 on the D string: \d+ s, sounding/, "the string still awaited says what was heard instead");
  await page.click("#ph-go");
  assert.deepEqual(errors, []);
});

test("Rehearse (4.8.0): the soundcheck is built from the changes you dropped, and a dropped change drills from here", { skip: skip() }, async t => {
  const d = new Date(), k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const page = await phone(t, { ...LIB, rehearse: { misses: { "C>F": { n: 4, days: { [k]: 4 } }, "G>Em": { n: 2, days: { [k]: 2 } } } } }, { home: true });
  await page.click("#tabs [data-tab=rehearse]"); await page.waitForSelector(".rh-sc");
  assert.match(await page.innerText(".rh-sc"), /Soundcheck[\s\S]*C to F[\s\S]*G to Em[\s\S]*START · \+20 XP/);
  assert.equal(await page.innerText(".rh-n"), "6");
  await page.click("#rh-missed"); await page.waitForSelector(".rh-pair");
  assert.equal(await page.locator(".rh-pair").count(), 2);
  await page.click("#rh-sc"); await page.waitForSelector(".pk-pair");
  assert.match(await page.innerText("h1.title"), /C to F/, "C to F isn't on the neck, but it drills");
  await page.click("#pk-self"); await page.waitForSelector("#pk-next");
  assert.match(await page.innerText(".rd-first-t"), /One more change for today's soundcheck/);
  assert.equal(await page.innerText("#pk-next"), "Back to Rehearse");
  await page.click("#pk-next"); await page.waitForSelector(".rh-sc");
  await page.click("#rh-sc"); await page.waitForSelector(".pk-pair");
  assert.match(await page.innerText("h1.title"), /G to Em/, "on to the second");
  await page.click("#pk-self"); await page.waitForSelector("#pk-next");
  assert.match(await page.innerText(".rd-first-t"), /Soundcheck done: \+20 XP/);
  await page.click("#pk-next"); await page.waitForSelector(".rh-sc.done");
  await page.click("#rh-neck"); await page.waitForSelector(".ls-card");
  await page.click("#back"); await page.waitForSelector(".rh-list");
});

test("4.21.0 the lesson of the day: three parts from your songs, Start, and a switch lesson ticks its part", { skip: skip() }, async t => {
  const body = "[Verse]\n[C]Slip in[Dm]side the [C]eye of your [Dm]mind\n[Chorus]\n[C]So Sally [Dm]can wait";
  const songs = [{ ...LIB.songs[0], id: "dl", title: "Anger", body, status: "learning" }, LIB.songs[1]];
  const page = await phone(t, { ...LIB, songs, skills: { done: { "s:G-C": { n: 1, best: 90, at: 1 } }, last: 1 } });
  await page.evaluate(() => { location.hash = "#/practice/neck"; }); await page.waitForSelector(".ls-card");
  const card = await page.innerText(".ls-card");
  assert.match(card, /C to Dm, then the Verse/);
  assert.match(card, /Built from Anger/);
  assert.match(card, /Warm up: G to C/);
  assert.match(card, /Play the Verse at 70%/);
  assert.equal(await page.locator(".ls-step").count(), 3);
  assert.match(await page.innerText("#ls-go"), /Start lesson/);
  assert.match(await page.innerText(".ls-skills"), /Open chords[\s\S]*Switches[\s\S]*Scales/);
  await page.click(".ls-step[data-part='1']"); await page.waitForSelector("#pk-self");
  assert.match(await page.innerText("h1.title"), /C to Dm/);
  await page.click("#pk-self"); await page.waitForSelector(".pf-plate");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).rehearse?.lesson?.done?.includes(1));
  assert.match(await page.innerText(".rd-first-t"), /Part 2 of today's lesson done/);
  await page.evaluate(() => { location.hash = "#/practice/neck"; }); await page.waitForSelector(".ls-step[data-part='1'].done");
  /* part 3 opens the song in Practice mode, the Verse looped at 70% */
  await page.click(".ls-step[data-part='2']");
  await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "dl"); return s.loop && s.practice?.rate === 0.7; });
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "dl"));
  assert.equal(s.loop.a, 0, "from the Verse label");
  assert.match(s.loop.name, /Verse/);
  await page.waitForSelector("#looprow.on");
});

test("4.23.0 Your changes in Rehearse: three rows with why and landed, Drill, and Drill all three goes on to the next", { skip: skip() }, async t => {
  const d = new Date(), k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const songs = [{ ...LIB.songs[0], id: "dl", title: "Anger", body: "[V]\n[C]a [Dm]b [C]c [Dm]d [C]e [Dm]f" }, { ...LIB.songs[1], id: "pc", title: "Porch", body: "[V]\n[Em]a [Am]b [Em]c [Am]d [Em]e [Am]f" }, { ...LIB.songs[1], id: "gc", title: "Gee", body: "[V]\n[G]g [C]h [G]i [C]j [G]k [C]l" }];
  const page = await phone(t, { ...LIB, songs, rehearse: { lands: { "G>C": { n: 41, days: { [k]: 41 } } }, misses: { "G>C": { n: 2, days: { [k]: 2 } } } } }, { home: true });
  await page.click("#tabs [data-tab=rehearse]"); await page.waitForSelector(".rh-yc");
  assert.equal(await page.locator(".rh-ycr").count(), 2);
  const txt = await page.innerText(".rh-yc");
  assert.match(txt, /Your changes[\s\S]*C\s*→\s*Dm[\s\S]*In Anger/);
  assert.match(txt, /Not tried yet/);
  assert.match(txt, /Em\s*→\s*Am[\s\S]*In Porch/);
  assert.match(txt, /G to C is solid: landed 41 of 43 this week/);
  assert.match(await page.innerText("#rh-ycall"), /Drill all two/);
  await page.click("#rh-ycall"); await page.waitForSelector("#pk-self");
  assert.match(await page.innerText("h1.title"), /C to Dm/);
  await settled(page); await page.click("#pk-self"); await page.waitForSelector("#pk-next");
  assert.match(await page.innerText("#pk-next"), /Next: Em to Am/);
  await settled(page); await page.click("#pk-next"); await page.waitForSelector("#pk-self");
  assert.match(await page.innerText("h1.title"), /Em to Am/);
  await settled(page); await page.click("#pk-self"); await page.waitForSelector("#pk-next");
  assert.equal(await page.innerText("#pk-next"), "Back to Rehearse");
  /* one row drills on its own */
  await settled(page); await page.click("#pk-next"); await page.waitForSelector(".rh-yc");
  await page.click(".rh-ycd >> nth=0"); await page.waitForSelector("#pk-self");
  assert.match(await page.innerText("h1.title"), /C to Dm/);
});
