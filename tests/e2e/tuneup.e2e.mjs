// 4.72.0: Tune up first, when the air has changed a lot since your last play.
import test from "node:test";
import assert from "node:assert/strict";
import { base, phone, skip, LIB, useBrowser } from "./harness.mjs";

useBrowser();

test("Tune up first: shown once a day on the song page when the humidity jumped; Tune up opens the tuner (4.72.0)", { skip: skip() }, async t => {
  const lib = { ...LIB, settings: { ...LIB.settings, place: { name: "Wilmington", lat: 34.2, lon: -77.9 }, playAir: { hum: 41, temp: 78, unit: "F", day: "2026-10-20" } } };
  const page = await phone(t, lib, { locale: "en-US" });
  let asked = "";
  await page.route("https://api.open-meteo.com/**", r => { asked = r.request().url(); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ current: { relative_humidity_2m: 84, temperature_2m: 61 } }) }); });
  await page.goto(base + "#/song/a"); await page.waitForSelector("#tuneup", { timeout: 8000 });
  assert.match(asked, /current=relative_humidity_2m,temperature_2m/); assert.match(asked, /temperature_unit=fahrenheit/);
  assert.match(await page.innerText("#tuneup"), /Tune up first[\s\S]*wetter[\s\S]*Up 43 points[\s\S]*41% → 84%[\s\S]*17° colder[\s\S]*78° → 61°[\s\S]*Not now[\s\S]*TUNE UP/i);
  await page.click("#tu-go"); await page.waitForSelector("#tuneup", { state: "detached" });
  await page.waitForFunction(() => !!document.querySelector(".tuner, #tuner, [aria-label*='Tuner' i]"));
  /* once a day */
  await page.goto(base + "#/library"); await page.goto(base + "#/song/a"); await page.waitForSelector("#play");
  await page.waitForTimeout(1500); /* real timer: the check runs 0.9 s after the page opens */
  assert.equal(await page.locator("#tuneup").count(), 0, "not again today");
});

test("4.89.0 Tune up first is a sheet: the page dimmed, solid on album art, never over another sheet or in Edit", { skip: skip() }, async t => {
  const ART = "https://is1-ssl.mzstatic.com/image/x/600x600bb.jpg";
  const lib = { ...LIB, songs: LIB.songs.map(s => s.id === "a" ? { ...s, listen: { ...(s.listen || {}), art: ART } } : s), settings: { ...LIB.settings, place: { name: "Wilmington", lat: 34.2, lon: -77.9 }, playAir: { hum: 41, temp: 78, unit: "F", day: "2026-10-20" } } };
  const page = await phone(t, lib, { locale: "en-US" });
  const img = (await import("node:fs")).readFileSync("icons/icon-192.png");
  await page.route("https://is1-ssl.mzstatic.com/**", r => r.fulfill({ status: 200, contentType: "image/png", body: img }));
  await page.route("https://api.open-meteo.com/**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ current: { relative_humidity_2m: 84, temperature_2m: 61 } }) }));
  await page.goto(base + "#/song/a"); await page.waitForSelector("body.covered");
  await page.waitForSelector("#layer #tuneup", { timeout: 8000 });
  assert.equal(await page.locator("#tu-scrim").count(), 1, "the page is dimmed behind it");
  const bg = await page.$eval("#tuneup", e => getComputedStyle(e).backgroundColor);
  assert.ok(!/rgba\([^)]*, 0?\.\d+\)/.test(bg), `solid on album art, got ${bg}`);
  /* tapping outside is Not now */
  await page.click("#tu-scrim", { position: { x: 20, y: 20 } }); await page.waitForSelector("#tuneup", { state: "detached" });
});

test("4.89.0 Tune up first waits when another sheet is open", { skip: skip() }, async t => {
  const lib = { ...LIB, settings: { ...LIB.settings, place: { name: "Wilmington", lat: 34.2, lon: -77.9 }, playAir: { hum: 41, temp: 78, unit: "F", day: "2026-10-20" } } };
  const page = await phone(t, lib, { locale: "en-US" });
  let release; const held = new Promise(r => { release = r; });
  await page.route("https://api.open-meteo.com/**", async r => { await held; r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ current: { relative_humidity_2m: 84, temperature_2m: 61 } }) }); });
  await page.goto(base + "#/song/a"); await page.waitForSelector("#play");
  await page.evaluate(() => import("/app.js").then(m => m.bandSheet(m.viewing)));
  release();
  await page.waitForTimeout(1500); /* real timer: the weather answer lands, the card must not */
  assert.equal(await page.locator("#tuneup").count(), 0);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.tuneShown || ""), "", "still due next time");
});
