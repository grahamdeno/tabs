// Today: the practice streak and one song for today under the library title.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser } from "./harness.mjs";
useBrowser();

const DAY = 86400000;
const key = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const log = (...ago) => ({ total: ago.length, last: Math.max(...ago.map(n => Date.now() - n * DAY)), days: Object.fromEntries(ago.map(n => [key(Date.now() - n * DAY), 1])) });
const cors = { "access-control-allow-origin": "*" };
const songs = (today = false) => [
  { ...LIB.songs[0], bpm: 120, playLog: log(...(today ? [0, 1, 2] : [1, 2])) },
  { ...LIB.songs[1], bpm: 66, playLog: log(30) }
];
const lib = (extra = {}, today = false) => ({ ...LIB, songs: songs(today), settings: { ...LIB.settings, nudge: true, place: { name: "Wilmington, North Carolina, US", lat: 34.23, lon: -77.94 }, ...extra } });

test("Today: on a rainy day a slow song that opens with a tap", { skip: skip() }, async t => {
  const page = await phone(t, lib());
  let asked = 0;
  await page.route(/api\.open-meteo\.com/, r => { asked++; r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ daily: { weather_code: [61], temperature_2m_max: [16] } }) }); });
  await page.evaluate(() => localStorage.removeItem("tabs.wx.v1"));
  await page.reload(); await page.waitForSelector("#nudge");
  assert.equal(await page.locator("#today .t-dots, #t-stat").count(), 0, "4.20.0: the streak lives in the stat bar, not here");
  const h = new Date().getHours();
  if (h < 18) assert.match(await page.innerText("#nudge"), /Rainy day, perfect for a slow song\s+Harbor Lights/i);
  await page.reload(); await page.waitForSelector("#nudge"); await page.waitForTimeout(500) /* real timer: checking no second fetch happens */;
  assert.equal(asked, 1, "weather is fetched once a day");
  await page.click("#nudge"); await page.waitForFunction(() => /#\/song\//.test(location.hash));
  assert.match(await page.evaluate(() => location.hash), /#\/song\//);
});

test("Today: a forecast that arrives late still shows when the week has no plays (2.11.2)", { skip: skip() }, async t => {
  const quiet = { ...lib(), songs: LIB.songs.slice(0, 2).map(s => ({ ...s, favorite: false, status: undefined, playLog: log(15) })) };
  const page = await phone(t, quiet);
  await page.route(/api\.open-meteo\.com/, async r => { await new Promise(res => setTimeout(res, 300)); r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ daily: { weather_code: [61], temperature_2m_max: [16] } }) }); });
  await page.evaluate(() => localStorage.removeItem("tabs.wx.v1"));
  await page.reload(); await page.waitForSelector("#nudge");
  assert.match(await page.innerText("#nudge"), /Rainy day, perfect for a slow song/i);
});

test("Today: quiet once you've played today; the setting turns the card off", { skip: skip() }, async t => {
  const page = await phone(t, lib({ place: undefined }, true));
  await page.waitForSelector("#chips");
  assert.equal(await page.locator("#nudge").count(), 0, "played today: no nudge");
  await page.evaluate(() => { location.hash = "#/settings/today"; }); await page.waitForSelector("#s-nudge");
  await page.click("#s-nudge"); await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.nudge === false);
  await page.evaluate(() => { location.hash = "#/library"; }); await page.waitForSelector("#chips");
  assert.equal(await page.locator("#nudge, .t-dots").count(), 0);
});

test("Settings: find a city for the weather, and remove it", { skip: skip() }, async t => {
  const page = await phone(t, lib({ place: undefined }));
  await page.route(/geocoding-api\.open-meteo\.com/, r => r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ results: [{ name: "Wilmington", admin1: "North Carolina", country_code: "US", latitude: 34.2257, longitude: -77.9447 }, { name: "Wilmington", admin1: "Delaware", country_code: "US", latitude: 39.74, longitude: -75.55 }] }) }));
  await page.evaluate(() => { location.hash = "#/settings/today"; }); await page.waitForSelector("#s-city");
  await page.fill("#s-city", "Wilmington");
  await page.click("#s-cityfind"); await page.waitForSelector("[data-city='1']");
  assert.equal(await page.locator("[data-city]").count(), 2);
  await page.click("[data-city='0']"); await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.place?.lat === 34.23);
  const place = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).settings.place;
  assert.deepEqual(place, { name: "Wilmington, North Carolina, US", lat: 34.23, lon: -77.94 });
  assert.match(await page.innerText(".set-group:has(#s-nudge)"), /Weather on/);
  await page.click("#s-cityremove"); await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.place === undefined);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).settings.place, undefined);
});

test("4.26.0 Songbook, slimmer: one Today strip that pages, no sets shelf, the list starts high", { skip: skip() }, async t => {
  const four = [0, 1, 2, 3].map(i => ({ ...LIB.songs[i % 2], id: "s" + i, title: ["River Road", "Harbor Lights", "Wagon Wheel", "Zombie"][i], playLog: i === 1 ? log(30) : i === 3 ? log(25) : i === 0 ? log(1, 2) : undefined }));
  /* 4.42.8: two songs worth another try, so the strip has two items whichever song is the day's request */
  const sets = [{ id: "x1", name: "Friday Gig", songs: ["s0", "s2"], when: null }, { id: "x2", name: "Porch", songs: ["s1"], when: null }];
  const page = await phone(t, { ...lib({ place: undefined }), songs: four, sets });
  await page.waitForSelector("#tdy .tdy-i");
  const items = await page.locator("#tdy .tdy-i").count(), dots = await page.locator(".tdy-dot").count();
  assert.ok(items >= 2, "the nudge and Worth another try share the strip");
  assert.equal(dots, items, "one dot for each");
  assert.equal(await page.locator(".tdy-dot.on").count(), 1);
  assert.equal(await page.locator(".shelf, #sh-all, .upn, .lib-top").count(), 0, "no sets shelf and no Up next block");
  assert.ok((await page.locator("#tdy").boundingBox()).height <= 70, "the strip is slim");
  const top = (await page.locator("#list .row").first().boundingBox()).y;
  assert.ok(top < 330, `the first song starts high (at ${Math.round(top)})`);
  assert.match(await page.innerText("#list .lib-count"), /4 songs/);
  /* tapping the last dot pages there, and the card opens its song */
  await page.click(`.tdy-dot[data-k="${items - 1}"]`);
  await page.waitForFunction(k => document.querySelectorAll(".tdy-dot")[k].classList.contains("on"), items - 1);
  const last = page.locator("#tdy .tdy-i").last();
  const goes = await last.getAttribute("data-song") || await last.getAttribute("data-id");
  await last.click(); await page.waitForFunction(() => /#\/song\//.test(location.hash));
  assert.equal(decodeURIComponent(await page.evaluate(() => location.hash)), "#/song/" + goes);
});
