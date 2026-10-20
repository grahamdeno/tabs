// First-time hold hint: the first time Play glides up to the arc, a
// glass circle grows, shrinks and bounces, then a note says to hold Play.
import test from "node:test";
import assert from "node:assert/strict";
import { base, skip, LIB, phone, useBrowser } from "./harness.mjs";
useBrowser();

test("Play's first glide up shows the hold hint once", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, controls: "ring", follow: "touch", micExplained: true, countIn: false } }, { isMobile: true });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  await page.click("#play"); await page.waitForFunction(() => document.body.classList.contains("ring"), null, { timeout: 3000 }); /* 3.16.0: the ring is for while the song plays */
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); document.body.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); }); /* a touch: Play rises */
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


test("2.29.0: lifted, slide Play along the arc: the song moves, and Play springs back to its spot", { skip: skip() }, async t => {
  const body = Array.from({ length: 40 }, (_, i) => `[Verse ${i + 1}]\nG   C\nline ${i + 1} goes here`).join("\n\n");
  const page = await phone(t, { ...LIB, songs: [{ ...LIB.songs[0], body }], settings: { ...LIB.settings, controls: "ring", follow: "touch", micExplained: true, countIn: false, tipsSeen: { ...LIB.settings.tipsSeen, ringHint: true } } }, { isMobile: true });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  await page.click("#play"); await page.waitForFunction(() => document.body.classList.contains("ring"), null, { timeout: 3000 }); /* 3.16.0: the ring is for while the song plays */
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); document.body.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); }); /* a touch: Play rises */
  await page.waitForFunction(() => document.body.classList.contains("ring-up"), null, { timeout: 3000 });
  await page.waitForTimeout(400);
  const c = () => page.evaluate(() => { const r = document.getElementById("play").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const home = await c();
  const W = 390, H = 844, rr = Math.hypot(W * 0.34, H * 0.21);
  const at = a => ({ x: W + rr * Math.cos(a * Math.PI / 180), y: H + rr * Math.sin(a * Math.PI / 180) });
  const a = 180 + Math.atan2(H - home.y, W - home.x) * 180 / Math.PI;
  await page.mouse.move(home.x, home.y); await page.mouse.down();
  for (let k = 1; k <= 8; k++) { const q = at(a + k * 2); await page.mouse.move(q.x, q.y, { steps: 2 }); await page.waitForTimeout(16); }
  const mid = await c();
  assert.ok(mid.y < home.y - 20, `Play rides the arc under the thumb (${home.y} to ${mid.y})`);
  assert.equal(await page.locator(".ringx").count(), 0, "sliding never opens the menu");
  await page.mouse.up(); await page.waitForTimeout(500);
  assert.ok(await page.evaluate(() => scrollY) > 20, "the song moved forward");
  assert.equal(await page.getAttribute("#play", "aria-label"), "Pause auto-scroll", "a slide isn't a tap");
  const back = await c();
  assert.ok(Math.abs(back.x - home.x) < 3 && Math.abs(back.y - home.y) < 3, "Play is back at its spot");
});
