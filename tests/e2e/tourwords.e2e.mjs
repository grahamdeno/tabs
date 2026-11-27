// 5.7.0 (Graham, 2026-11-26): the game says "Tour", not "Leg" or "The Road". The Road tab is the Tour tab, the old Tour tab
// (the fan map) is the Map tab, and "Tour Map" is the Map. The month's tour is the month's challenge, so "Tour" means one thing.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser, settled } from "./harness.mjs";
import { roadPath } from "../../core.js";
useBrowser();

const AT = Date.now();
const legsDone = n => {
  const done = {}, data = { ...JSON.parse(JSON.stringify(LIB)), skills: { done, last: AT } };
  for (let i = 0; i < n; i++) {
    const leg = roadPath(data).legs.find(l => !l.done);
    if (!leg) break;
    for (const st of leg.stops) if (st.kind !== "box") done[st.id] = { n: 3, best: 90, at: AT - 1000 + i };
  }
  return { done, last: AT };
};
/* words a player must not see or hear; "your leg" (where the guitar rests) is fine */
const OLD = /\bLegs?\b|\bLEGS?\b|\b(?<!your )legs?\b|\bThe Road\b|\bthe Road\b|\bTour Map\b|Road Ready (light|dark)/;
const seen = page => page.evaluate(() => {
  const vis = document.body.innerText;
  const said = [...document.querySelectorAll("[aria-label]")].map(e => e.getAttribute("aria-label")).join("\n");
  const titles = [...document.querySelectorAll("[title], [data-title], [data-aria], [data-sub]")].map(e => [e.getAttribute("title"), e.dataset.title, e.dataset.aria, e.dataset.sub].filter(Boolean).join(" ")).join("\n");
  return vis + "\n" + said + "\n" + titles;
});

for (const theme of ["dark", "light"]) {
  test(`5.7.0 (${theme}): no "Leg", "legs", "The Road" or "Tour Map" on the Tour tab, Songbook, Me, Map, the challenge, Settings or the new-guitar sheet`, { skip: skip() }, async t => {
    const lib = { ...LIB, songs: LIB.songs.map((s, i) => ({ ...s, playLog: { total: i === 0 ? 6 : 1, last: AT, days: {} } })), skills: legsDone(1), settings: { ...LIB.settings, v: 6, theme } };
    const page = await phone(t, lib, { home: true });
    await page.waitForSelector(".rr-stats"); await settled(page);
    /* the new-guitar sheet for Tour 1 may open first: read it, then close it */
    if (await page.locator(".sc-next, .rd-gt").count()) {
      const sheet = await seen(page);
      assert.doesNotMatch(sheet, OLD, `the new-guitar sheet: ${sheet.match(OLD)?.[0]}`);
      assert.match(sheet, /Tour 2/, "the sheet names the next tour");
    }
    for (const [hash, wait] of [["#/", ".rr-stats"], ["#/library", "#setsbtn, .sb-head, #app .head"], ["#/you", ".rr-me"], ["#/playmap", ".tm-page"], ["#/tour", ".tq"], ["#/practice", ".rh"], ["#/settings", "[data-page]"]]) {
      await page.evaluate(h => { location.hash = h; }, hash); await page.waitForSelector(wait); await settled(page);
      const words = await seen(page);
      assert.doesNotMatch(words, OLD, `${hash}: ${words.match(OLD)?.[0]} in "${words.slice(Math.max(0, words.search(OLD) - 40), words.search(OLD) + 40)}"`);
    }
    /* Settings > Help, with Tips & gestures */
    await page.click("[data-page='help']"); await page.waitForFunction(() => document.querySelector("h1.title")?.textContent.trim() === "Help"); await settled(page);
    assert.doesNotMatch(await seen(page), OLD, "Help");
    /* the tab bar: Tour opens the neck, Gigs opens the month's challenge (5.17.2) */
    const tabs = await page.$$eval("#tabs a", as => as.map(a => [a.querySelector(".tb-l").textContent.trim(), a.getAttribute("href")]));
    assert.deepEqual(tabs.map(x => x[0]), ["Tour", "Songbook", "Rehearse", "Gigs", "Me"]);
    assert.equal(tabs[0][1], "#/"); assert.equal(tabs[3][1], "#/tour");
    /* the guitar case says Tour */
    await page.evaluate(() => { location.hash = "#/you"; }); await page.waitForSelector(".rr-me"); await settled(page);
    assert.match(await seen(page), /earned on Tour 1/);
  });
}
