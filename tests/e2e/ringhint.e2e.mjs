// First-time hold hint (2.16): the first time Play glides up to the arc, a
// glass circle grows, shrinks and bounces, then a note says to hold Play.
import test from "node:test";
import assert from "node:assert/strict";
import { base, skip, LIB, phone, useBrowser } from "./harness.mjs";
useBrowser();

test("Play's first glide up shows the hold hint once", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, controls: "ring", follow: "touch", micExplained: true } }, { isMobile: true });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  await page.mouse.click(120, 420); await page.waitForTimeout(250); /* a touch: Play rises */
  await page.waitForFunction(() => document.body.classList.contains("ring-up"), null, { timeout: 3000 });
  await page.waitForSelector(".ring-hint", { timeout: 2000 });
  await page.waitForTimeout(450);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/hint-1.png" });
  await page.waitForTimeout(450);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/hint-2.png" });
  await page.waitForSelector(".coach", { timeout: 3000 });
  assert.equal(await page.locator(".ring-hint").count(), 0, "the circle is gone");
  assert.match(await page.innerText(".coach"), /Press and hold Play for more/);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/hint-3.png" });
  const seen = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).settings.tipsSeen.ringHint;
  assert.equal(seen, true, "once only");
});

test("no hold hint once you've opened the ring yourself", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, controls: "ring", follow: "corner", used: { ringHint: true } } }, { isMobile: true });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("tabs-v1")); d.settings.follow = "touch"; localStorage.setItem("tabs-v1", JSON.stringify(d)); });
  await page.reload(); await page.waitForTimeout(500);
  await page.mouse.click(120, 420); await page.waitForTimeout(1200);
  assert.equal(await page.locator(".ring-hint").count(), 0);
});

test("2.24.0: the time knob's pointer turns with the speed, slowest left", { skip: skip() }, async t => {
  const k = async d => {
    const page = await phone(t, { ...LIB, songs: LIB.songs.map(s => s.id === "a" ? { ...s, duration: d } : s), settings: { ...LIB.settings, controls: "ring", follow: "touch", micExplained: true, tipsSeen: { ...LIB.settings.tipsSeen, ringHint: true } } }, { isMobile: true });
    await page.goto(base + "#/song/a"); await page.waitForSelector(".rc-isl #dialbtn");
    return parseFloat(await page.evaluate(() => document.getElementById("dialbtn").style.getPropertyValue("--k")));
  };
  const slow = await k(480), fast = await k(60);
  assert.ok(slow <= -130 && fast >= 130, `pointer ${slow} to ${fast}`);
});
