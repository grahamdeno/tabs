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


test("2.28.0: lifted, Play is a fader knob: slide it along the arc and the song follows; it rides with the song", { skip: skip() }, async t => {
  const body = Array.from({ length: 40 }, (_, i) => `[Verse ${i + 1}]\nG   C\nline ${i + 1} goes here`).join("\n\n");
  const page = await phone(t, { ...LIB, songs: [{ ...LIB.songs[0], body }], settings: { ...LIB.settings, controls: "ring", follow: "touch", micExplained: true, tipsSeen: { ...LIB.settings.tipsSeen, ringHint: true } } }, { isMobile: true });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  await page.mouse.click(120, 420); await page.waitForTimeout(250);
  await page.waitForFunction(() => document.body.classList.contains("ring-up"), null, { timeout: 3000 });
  await page.waitForTimeout(400);
  const c = () => page.evaluate(() => { const r = document.getElementById("play").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const start = await c();
  const W = 390, H = 844, rr = Math.hypot(W * 0.34, H * 0.21);
  const at = a => ({ x: W + rr * Math.cos(a * Math.PI / 180), y: H + rr * Math.sin(a * Math.PI / 180) });
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  for (const a of [215, 235, 250, 262, 268]) { const q = at(a); await page.mouse.move(q.x, q.y, { steps: 4 }); }
  await page.waitForTimeout(100);
  assert.equal(await page.locator(".ringx").count(), 0, "sliding never opens the menu");
  await page.mouse.up(); await page.waitForTimeout(300);
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  assert.ok(await page.evaluate(() => scrollY) > max * 0.95, "at the top end of the arc: the end of the song");
  assert.equal(await page.getAttribute("#play", "aria-label"), "Start auto-scroll", "a slide isn't a tap");
  const end = await c();
  assert.ok(end.y < start.y - 100 && end.x > start.x, `the knob rode up the arc: ${JSON.stringify(start)} to ${JSON.stringify(end)}`);
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(500);
  const back = await c();
  assert.ok(back.y > end.y + 100, "scrolling the page moves the knob back down");
  /* Hold still at the start: the menu opens, all on screen. */
  await page.mouse.move(back.x, back.y); await page.mouse.down(); await page.waitForTimeout(700);
  const items = await page.$$eval(".ringx .ri", els => els.map(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }));
  assert.ok(items.length >= 5 && items.every(Boolean), "the menu stays on screen");
  await page.mouse.up();
});
