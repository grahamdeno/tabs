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
