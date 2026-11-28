// 5.17.0 (curriculum Release A): the Tour shows the 19 tours in order, Coming soon stops say so and play nothing, the stops that
// have something playable open it, and Settings > Playing > Unlock all tours opens everything and gives the map back when it is turned off.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser, settled, until } from "./harness.mjs";
useBrowser();

const AT = Date.now();
const lib = (extra = {}) => ({ ...JSON.parse(JSON.stringify(LIB)), ...extra });
const OLD = /\bLegs?\b|\bLEGS?\b|\b(?<!your )legs?\b|\bThe Road\b|\bthe Road\b|\bTour Map\b/;
const legs = page => page.$$eval(".rn-lat", els => els.map(e => [e.dataset.title, e.dataset.sub]));
const states = page => page.$$eval(".rn-stop", els => els.map(e => [e.dataset.stop, ["done", "now", "open", "locked"].find(s => e.classList.contains(s)) || ""]));
const tap = (page, id) => page.evaluate(i => document.querySelector(`[data-stop="${i}"]`).click(), id);
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1") || "{}"));

test("5.17.0: the Tour names the tours in order, the main line in full, then one locked row each for lead and fingerstyle", { skip: skip() }, async t => {
  const page = await phone(t, lib(), { home: true });
  await page.waitForSelector(".rn-neck"); await settled(page);
  const l = await legs(page);
  assert.deepEqual(l.slice(0, 5), [["Tour 1", "Opening Night"], ["Tour 2", "Open Mic"], ["Tour 3", "Coffeehouse"], ["Tour 4", "Street Corner"], ["Tour 5", "The Van"]]);
  assert.deepEqual(l.slice(5, 13).map(x => x[0]), ["Tour 6", "Tour 7", "Tour 8", "Tour 9", "Tour 10", "Tour 11", "Tour 12", "Tour 13"], "the whole main line is drawn, not only the next tour");
  assert.deepEqual(l.slice(13), [["Lead route", "Tours 14 to 16"], ["Fingerstyle route", "Tours 17 to 18"]]);
  assert.equal(l.length, 15, "13 tours and the two route rows");
  const st = await states(page);
  assert.equal(st.filter(([id]) => id.startsWith("route:")).length, 2, "one stop each for the two routes");
  assert.ok(st.filter(([id]) => id.startsWith("route:")).every(([, s]) => s === "locked"), "both rows are locked");
  assert.deepEqual(st.find(([id]) => id === "c:A"), ["c:A", "now"], "5.18.0: a player who has played has Tour 1 done, so Tour 2 starts with A");
  assert.equal(st.filter(([id]) => /^k1\./.test(id) || id === "c:Em").every(([, s]) => s === "done"), true, "Tour 1 is done, mapped from Opening night");
  const words = await page.evaluate(() => document.body.innerText + "\n" + [...document.querySelectorAll("[aria-label],[data-title],[data-sub],[data-aria]")].map(e => [e.getAttribute("aria-label"), e.dataset.title, e.dataset.sub, e.dataset.aria].filter(Boolean).join(" ")).join("\n"));
  assert.doesNotMatch(words, OLD, `no old words: ${words.match(OLD)?.[0]}`);
  const kept = await stored(page);
  assert.ok(kept.curriculum?.done?.["k1.1"], "the mapping is kept in data.curriculum");
});

test("5.17.0: a Coming soon stop opens a card that says so and plays nothing; a lesson stop starts its lesson", { skip: skip() }, async t => {
  const page = await phone(t, lib(), { home: true });
  await page.waitForSelector(".rn-neck"); await settled(page);
  await tap(page, "k5.1");
  await page.waitForSelector(".rd-pop");
  const soon = await page.textContent(".rd-pop");
  assert.match(soon, /Coming soon/); assert.match(soon, /The capo/);
  assert.equal(await page.locator(".rd-pop .rd-start").count(), 0, "no Start button");
  assert.match(soon, /Coming soon: Tours 5 and up are on the way\. Until then, songs and Gigs keep counting\./, "Tour 5 says what is on the way");
  assert.doesNotMatch(soon, /Heard:|Played through:/, "a Coming soon card has no pass line");
  await tap(page, "k6.3"); await page.waitForSelector(".rd-pop");
  assert.doesNotMatch(await page.textContent(".rd-pop"), /Heard:|Played through:/, "nor does a later Coming soon card");
  await tap(page, "k1.4"); await page.waitForSelector(".rd-pop");
  const card1 = await page.textContent(".rd-pop");
  assert.match(card1, /piece of one song/); assert.match(card1, /USE ELEANOR RIGBY/, "Tour 1 offers a hand-checked song"); assert.match(card1, /Do you have a capo\?/, "and asks about a capo once");
  /* a lesson stop keeps its old id and starts the old lesson */
  await tap(page, "c:Em"); await page.waitForSelector(".rd-pop .rd-start");
  await page.click(".rd-pop .rd-start");
  await page.waitForFunction(() => location.hash === "#/practice/c%3AEm" || location.hash === "#/practice/c:Em");
  /* a locked row says when it opens */
  await page.evaluate(() => { location.hash = "#/"; }); await page.waitForSelector(".rn-neck"); await settled(page);
  await tap(page, "route:lead"); await page.waitForSelector(".rd-pop");
  assert.match(await page.textContent(".rd-pop"), /Opens after Tour 4/, "5.18.0: Street Corner opens the Lead route");
});

test("5.17.0: Unlock all tours opens every tour and stop, pays nothing, and turning it off gives the map back", { skip: skip() }, async t => {
  const start = lib({ skills: { done: { "c:Em": { n: 1, best: 0, at: AT } }, last: AT } });
  const page = await phone(t, start, { home: true });
  await page.waitForSelector(".rn-neck"); await settled(page);
  const before = await states(page), fans0 = (await stored(page)).gig?.fans || 0;
  assert.ok(before.some(([, s]) => s === "locked"), "some stops are locked to begin with");
  await page.evaluate(() => { location.hash = "#/settings"; }); await page.waitForSelector("[data-page='playing']"); await settled(page);
  await page.click("[data-page='playing']"); await page.waitForSelector("#s-unlock");
  assert.equal(await page.getAttribute("#s-unlock", "aria-checked"), "false", "off by default");
  await page.click("#s-unlock");
  await until(async () => (await stored(page)).settings?.unlockAll === true);
  assert.equal(await page.getAttribute("#s-unlock", "aria-checked"), "true");
  await page.evaluate(() => { location.hash = "#/"; }); await page.waitForSelector(".rn-neck"); await settled(page);
  const open = await states(page), l = await legs(page);
  assert.ok(open.every(([, s]) => s === "open"), `every stop is open: ${open.filter(([, s]) => s !== "open").map(x => x.join("=")).join(", ")}`);
  assert.ok(l.some(x => x[0] === "Tour 14") && l.some(x => x[0] === "Tour 18") && !l.some(x => x[0] === "Lead route"), "the lead and fingerstyle tours are drawn in full");
  /* a locked lesson plays, and Coming soon still plays nothing */
  await tap(page, "c:C"); await page.waitForSelector(".rd-pop .rd-start");
  assert.doesNotMatch(await page.textContent(".rd-pop"), /\+\d+ fans/, "no fans offered");
  await page.click(".rd-pop .rd-start");
  await page.waitForFunction(() => location.hash.startsWith("#/practice/"));
  await page.evaluate(() => { location.hash = "#/"; }); await page.waitForSelector(".rn-neck"); await settled(page);
  await tap(page, "k5.3"); await page.waitForSelector(".rd-pop.soon");
  assert.equal(await page.locator(".rd-pop .rd-start").count(), 0);
  const kept = await stored(page);
  assert.equal(kept.skills?.done?.["c:C"], undefined, "nothing was marked");
  assert.equal(kept.gig?.fans || 0, fans0);
  /* off again */
  await page.evaluate(() => { location.hash = "#/settings"; }); await page.waitForSelector("[data-page='playing']"); await settled(page);
  await page.click("[data-page='playing']"); await page.waitForSelector("#s-unlock");
  await page.click("#s-unlock");
  await until(async () => (await stored(page)).settings?.unlockAll === false);
  await page.evaluate(() => { location.hash = "#/"; }); await page.waitForSelector(".rn-neck"); await settled(page);
  assert.deepEqual(await states(page), before, "the map is exactly as it was");
});
