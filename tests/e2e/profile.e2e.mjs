// Your playing: the profile page, opened from the library header.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser } from "./harness.mjs";
useBrowser();

test("Your playing: worked out from the songs you've played, with a passport, changes and a way back to a song", { skip: skip() }, async t => {
  const songs = LIB.songs.map((s, i) => ({ ...s, playLog: { total: i === 0 ? 6 : 1, last: Date.now() - (i === 0 ? 1 : 40) * 86400e3, days: {} } }));
  const page = await phone(t, { ...LIB, songs });
  await page.click("#youbtn");
  await page.waitForSelector(".pf-plate");
  assert.match(await page.innerText(".pf-plate"), /SONGS PLAYED/i);
  assert.match(await page.innerText(".pf-card:has(h2:text('Chord passport'))"), /chords? stamped/);
  assert.match(await page.innerText(".pf-card:has(h2:text('Your changes'))"), /is the switch you make most/);
  await page.waitForFunction(() => !!JSON.parse(localStorage.getItem("tabs-v1")).journal); /* the journal is kept */
  await page.click(".pf-song >> nth=0");
  await page.waitForSelector("#sheet");
  assert.match(await page.evaluate(() => location.hash), /#\/song\//);
  await page.evaluate(() => { location.hash = "#/you"; }); await page.waitForSelector(".pf-plate");
  await page.click("#back"); await page.waitForSelector("#youbtn");
});

test("Your playing: an empty library says how it fills in, with no share button", { skip: skip() }, async t => {
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
