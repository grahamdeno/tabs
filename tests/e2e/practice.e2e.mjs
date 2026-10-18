// The neck: the permanent practice place, Tonight's run card, and a chord lesson that listens.
import test from "node:test";
import assert from "node:assert/strict";
import { chromium, base, skip, LIB, FAKE_MIC, phone, useBrowser } from "./harness.mjs";
useBrowser();

test("Tonight's run leads to the neck, and the neck lists levels with the next lesson lit", { skip: skip() }, async t => {
  const y = new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
  const songs = LIB.songs.map(s => ({ ...s, playLog: { total: 3, last: Date.now() - 86400e3, days: { [y]: 1 } } }));
  const page = await phone(t, { ...LIB, songs }, { home: true });
  await page.waitForSelector(".rd-next");
  assert.equal(await page.locator("#rd-sound").count(), 1, "Soundcheck lamp");
  await page.click("#neckbtn");
  await page.waitForSelector(".pk-board");
  assert.equal(await page.innerText("h1.title"), "The neck");
  assert.equal(await page.locator(".pk-level").count(), 5);
  assert.equal(await page.locator(".pk-level.soon").count(), 3, "strumming, picking and fingerstyle are coming");
  assert.equal(await page.locator(".pk-fret.now").innerText().then(x => x.split("\n")[0]), "G");
  await page.click(".pk-fret.locked");
  await page.click(".pk-fret.now");
  await page.waitForSelector(".pk-strings");
  assert.match(await page.innerText("h1.title"), /G chord/);
  await page.click("#back");
  await page.waitForSelector(".pk-board");
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
  await page.waitForFunction(() => /Listening/.test(document.getElementById("pk-say").textContent));
  await page.evaluate(() => { window.__hz = 98; }); /* the low string fretted at the 3rd: G */
  await page.waitForFunction(() => document.querySelectorAll(".pk-str .gs-lamp.on").length === 1, null, { timeout: 6000 });
  await page.evaluate(() => { window.__hz = 0; });
  await page.click("#pk-self");
  await page.waitForSelector(".pf-plate");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).skills?.done?.["c:G"]?.n === 1);
  assert.deepEqual(errors, []);
});
