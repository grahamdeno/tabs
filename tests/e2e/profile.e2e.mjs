// Your profile (4.16.0; Your playing before): the profile page, opened from the streak in the stat bar.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser, settled } from "./harness.mjs";
useBrowser();

test("Your profile: worked out from the songs you've played, with a passport, changes and a way back to a song", { skip: skip() }, async t => {
  const songs = LIB.songs.map((s, i) => ({ ...s, playLog: { total: i === 0 ? 6 : 1, last: Date.now() - (i === 0 ? 1 : 40) * 86400e3, days: {} } }));
  const page = await phone(t, { ...LIB, songs }, { home: true });
  await page.waitForSelector("#h-streak"); await settled(page);
  await page.click("#h-streak");
  await page.waitForSelector(".pf-player");
  assert.match(await page.innerText("h1"), /Your profile/);
  /* 4.17.0: the player card, its tiles, badges and band */
  assert.match(await page.innerText(".pf-player"), /LEVEL 1[\s\S]*\/ 100 XP/);
  assert.equal(await page.locator(".pf-tile-streak .ri-knob").count(), 1, "the streak's knob");
  assert.match(await page.innerText(".pf-tiles"), /SHOWS PLAYED[\s\S]*SONGS YOU CAN PLAY/);
  assert.ok(await page.locator(".pf-badge:not(.locked)").count() >= 1, "a song played through is a badge");
  assert.match(await page.innerText(".pf-label:has-text('BADGES')"), /\d+ of 25/);
  /* 4.19.0: the chord passport, a page per family, Learn it opens a lesson */
  assert.match(await page.innerText(".pf-passport"), /Open chords\s*\d+ of 8[\s\S]*Barre chords[\s\S]*NEXT STAMP/);
  assert.ok(await page.locator(".pf-pstamp.on").count() >= 1, "chords played are stamped");
  await page.click(".pf-pstamp.on >> nth=0"); await page.waitForSelector(".pf-stampsheet");
  assert.match(await page.innerText(".pf-stampsheet"), /Played about \d+ times?, first on/);
  await page.click("#st-x"); await page.waitForSelector(".pf-stampsheet", { state: "detached" });
  await page.waitForFunction(() => !!JSON.parse(localStorage.getItem("tabs-v1")).journal); /* the journal is kept */
  /* Your stats: four cards; a change drills in Rehearse */
  await page.click(".pf-more > summary");
  assert.match(await page.innerText(".pf-stats"), /played[\s\S]*last seven days[\s\S]*your most played change[\s\S]*your key/);
  await page.click(".pf-drill >> nth=0");
  await page.waitForFunction(() => /#\/practice\/s(%3A|:)/.test(location.hash));
  await page.evaluate(() => { location.hash = "#/you"; }); await page.waitForSelector(".pf-player"); await settled(page);
  await page.click("#pf-learn"); await page.waitForFunction(() => /#\/practice\/c(%3A|:)/.test(location.hash));
  await page.waitForSelector(".pk-lesson");
  await page.evaluate(() => { location.hash = "#/you"; }); await page.waitForSelector(".pf-player"); await settled(page);
  await page.click("#pf-map"); await page.waitForFunction(() => location.hash === "#/playmap"); /* the venue opens the Tour Map */
  await page.evaluate(() => { location.hash = "#/you"; }); await page.waitForSelector(".pf-player"); await settled(page);
  await page.click("#back"); await page.waitForSelector(".rd-path"); /* 4.0.0: back to the Road */
});

test("Your profile: an empty library says how it fills in, with no share button", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: LIB.songs.map(s => ({ ...s, playLog: undefined })) });
  await page.evaluate(() => { location.hash = "#/you"; }); await page.waitForSelector(".pf-empty");
  assert.equal(await page.locator("#pf-share").count(), 0);
});

test("Streak moment: once a day after the first song played through; tap to close; a switch turns it off", { skip: skip() }, async t => {
  /* short songs, so a real run is quick; a play only counts when most of it was played */
  const songs = LIB.songs.map(s => ({ ...s, duration: 10 }));
  const page = await phone(t, { ...LIB, songs, settings: { ...LIB.settings, countIn: false, controls: "bar", streakMoment: true } });
  await page.click(".list .row"); await page.waitForSelector("#play");
  await page.click("#play");
  await page.waitForSelector(".sk", { timeout: 15000 });
  assert.match(await page.innerText(".sk-say"), /Day one\.|days in a row/);
  assert.equal(await page.getAttribute(".sk", "role"), "dialog");
  assert.equal(await page.locator(".sk .ri-light").count(), 1, "4.16.0: the stage light, not a flame");
  await page.waitForTimeout(2600);
  assert.match(await page.innerText(".sk-num"), /^\d+$/);
  await page.click(".sk-art"); await page.waitForSelector(".sk", { state: "detached" });
  await page.click("#play"); await page.waitForTimeout(400); await page.click("#play"); await page.waitForTimeout(2200);
  assert.equal(await page.locator(".sk").count(), 0, "not again today");
  await page.evaluate(() => { location.hash = "#/settings/playing"; }); await page.waitForSelector("#s-streak");
  assert.equal(await page.getAttribute("#s-streak", "aria-checked"), "true");
  await page.click("#s-streak");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.streakMoment === false);
});

test("4.19.0: a song tried once and left three weeks ago shows in the Songbook as Worth another try", { skip: skip() }, async t => {
  const old = Date.now() - 30 * 864e5;
  const songs = [...LIB.songs.map(s => ({ ...s, playLog: { total: 5, last: Date.now(), days: {} } })), { id: "w", title: "Wagon Wheel", artist: "Old Crow", format: "chords", body: "[Verse]\nG D Em C\nla", playLog: { total: 1, last: old, days: {} } }];
  const page = await phone(t, { ...LIB, songs });
  await page.waitForSelector(".upn-c.again");
  assert.match(await page.innerText(".upn-c.again"), /WORTH ANOTHER TRY\s*Wagon Wheel\s*You left it 4 weeks ago/);
});
