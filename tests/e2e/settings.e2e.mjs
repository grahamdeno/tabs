// Settings menu (2.13): a short menu that opens one page per area.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser } from "./harness.mjs";
useBrowser();

test("Settings: menu rows show their state, open their page, and Back returns to the menu", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, nudge: true, place: { name: "Wilmington, North Carolina, US", lat: 34.23, lon: -77.94 } } });
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.evaluate(() => { location.hash = "#/settings"; }); await page.waitForTimeout(300);
  assert.equal(await page.locator("[data-page]").count(), 8);
  assert.match(await page.innerText("[data-page='today']"), /Wilmington/);
  assert.match(await page.innerText("[data-page='diagrams']"), /of 4 on/);
  assert.equal(await page.locator(".s-dock #s-backup").count(), 1, "Back up now is docked at the bottom");

  await page.click("[data-page='playing']"); await page.waitForTimeout(300);
  assert.match(await page.evaluate(() => location.hash), /#\/settings\/playing/);
  assert.match(await page.innerText("h1"), /Playing/);
  await page.click("#s-count"); await page.waitForTimeout(150);
  assert.match(await page.evaluate(() => location.hash), /#\/settings\/playing/, "a change keeps you on the page");
  await page.click("#back"); await page.waitForTimeout(300);
  assert.match(await page.innerText("h1"), /Settings/);

  await page.click("[data-page='keys']"); await page.waitForTimeout(300);
  assert.equal(await page.locator("#s-key").count(), 1); assert.equal(await page.locator("#s-bpmkey").count(), 1);
  await page.goto(page.url().replace(/#.*/, "#/trash")); await page.waitForTimeout(300);
  await page.click("#back"); await page.waitForTimeout(300);
  assert.match(await page.innerText("h1"), /Library and backups/, "Recently deleted goes back to its page");
  await page.evaluate(() => { location.hash = "#/settings/nope"; }); await page.waitForTimeout(300);
  assert.match(await page.innerText("h1"), /Settings/, "an unknown page shows the menu");
  assert.deepEqual(errs, []);
});

test("Settings > Look: Amp covering turns the tolex grain on and off (2.20.0)", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.evaluate(() => { location.hash = "#/settings/look"; }); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.tolex), "off", "off by default");
  await page.click("#s-tolex"); await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.tolex), "on");
  assert.match(await page.evaluate(() => getComputedStyle(document.body).backgroundImage), /svg/, "the grain is drawn");
  await page.reload(); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.tolex), "on", "kept");
});
