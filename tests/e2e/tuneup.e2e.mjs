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
  assert.match(await page.innerText("#tuneup"), /Tune up first[\s\S]*wetter[\s\S]*41% to 84%[\s\S]*78° to 61°[\s\S]*Not now[\s\S]*TUNE UP/i);
  await page.click("#tu-go"); await page.waitForSelector("#tuneup", { state: "detached" });
  await page.waitForFunction(() => !!document.querySelector(".tuner, #tuner, [aria-label*='Tuner' i]"));
  /* once a day */
  await page.goto(base + "#/library"); await page.goto(base + "#/song/a"); await page.waitForSelector("#play");
  await page.waitForTimeout(1500); /* real timer: the check runs 0.9 s after the page opens */
  assert.equal(await page.locator("#tuneup").count(), 0, "not again today");
});
