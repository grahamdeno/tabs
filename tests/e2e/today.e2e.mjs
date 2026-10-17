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

test("Today: streak dots, and on a rainy day a slow song that opens with a tap", { skip: skip() }, async t => {
  const page = await phone(t, lib());
  let asked = 0;
  await page.route(/api\.open-meteo\.com/, r => { asked++; r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ daily: { weather_code: [61], temperature_2m_max: [16] } }) }); });
  await page.evaluate(() => localStorage.removeItem("tabs.wx.v1"));
  await page.reload(); await page.waitForTimeout(800);
  const text = await page.innerText("#today");
  assert.match(text, /2-day streak · 2 plays this week/);
  assert.equal(await page.locator("#today .t-dots i.on").count(), 2);
  assert.equal(await page.locator("#today .t-dots i.now").count(), 1, "today dashed until you play");
  const h = new Date().getHours();
  if (h < 18) assert.match(await page.innerText("#nudge"), /Rainy day, perfect for a slow song\s+Harbor Lights/);
  await page.reload(); await page.waitForTimeout(500);
  assert.equal(asked, 1, "weather is fetched once a day");
  await page.click("#nudge"); await page.waitForTimeout(300);
  assert.match(await page.evaluate(() => location.hash), /#\/song\//);
});

test("Today: a forecast that arrives late still shows when the week has no plays (2.11.2)", { skip: skip() }, async t => {
  const quiet = { ...lib(), songs: LIB.songs.slice(0, 2).map(s => ({ ...s, favorite: false, status: undefined, playLog: log(15) })) };
  const page = await phone(t, quiet);
  await page.route(/api\.open-meteo\.com/, async r => { await new Promise(res => setTimeout(res, 300)); r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ daily: { weather_code: [61], temperature_2m_max: [16] } }) }); });
  await page.evaluate(() => localStorage.removeItem("tabs.wx.v1"));
  await page.reload(); await page.waitForTimeout(1000);
  assert.match(await page.innerText("#nudge"), /Rainy day, perfect for a slow song/);
});

test("Today: quiet once you've played today; the setting turns it back to the weekly line", { skip: skip() }, async t => {
  const page = await phone(t, lib({ place: undefined }, true));
  assert.match(await page.innerText("#today"), /3-day streak/);
  assert.equal(await page.locator("#nudge").count(), 0, "played today: no nudge");
  assert.equal(await page.locator("#today .t-dots i.now").count(), 0);
  await page.evaluate(() => { location.hash = "#/settings/today"; }); await page.waitForTimeout(300);
  await page.click("#s-nudge"); await page.waitForTimeout(200);
  await page.evaluate(() => { location.hash = "#/"; }); await page.waitForTimeout(300);
  assert.match(await page.innerText("#today"), /This week: 3 plays across 1 song/);
  assert.equal(await page.locator(".t-dots").count(), 0);
});

test("Settings: find a city for the weather, and remove it", { skip: skip() }, async t => {
  const page = await phone(t, lib({ place: undefined }));
  await page.route(/geocoding-api\.open-meteo\.com/, r => r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ results: [{ name: "Wilmington", admin1: "North Carolina", country_code: "US", latitude: 34.2257, longitude: -77.9447 }, { name: "Wilmington", admin1: "Delaware", country_code: "US", latitude: 39.74, longitude: -75.55 }] }) }));
  await page.evaluate(() => { location.hash = "#/settings/today"; }); await page.waitForTimeout(300);
  await page.fill("#s-city", "Wilmington");
  await page.click("#s-cityfind"); await page.waitForTimeout(300);
  assert.equal(await page.locator("[data-city]").count(), 2);
  await page.click("[data-city='0']"); await page.waitForTimeout(200);
  const place = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).settings.place;
  assert.deepEqual(place, { name: "Wilmington, North Carolina, US", lat: 34.23, lon: -77.94 });
  assert.match(await page.innerText(".set-group:has(#s-nudge)"), /Weather on/);
  await page.click("#s-cityremove"); await page.waitForTimeout(200);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).settings.place, undefined);
});
