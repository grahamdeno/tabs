// 5.10.2: Graham's fixes from trying 5.10.1 on his phone (2026-11-26).
import test from "node:test";
import assert from "node:assert/strict";
import { phone, LIB, useBrowser, settled, skip } from "./harness.mjs";
useBrowser();
const SONG = { id: "g", title: "Short Road", artist: "Me", key: "A", format: "chords", duration: 200,
  body: "[Verse]\n" + Array.from({ length: 14 }, (_, i) => `A        D\nVerse line ${i + 1}`).join("\n") + "\n\n[Chorus]\nE        A\nCarry me home" };
const lib = () => ({ ...LIB, songs: [SONG, ...LIB.songs], settings: { ...LIB.settings, theme: "neon" } });
async function song(t) {
  const page = await phone(t, lib());
  await page.evaluate(() => { location.hash = "#/song/g"; }); await page.waitForSelector("#play"); await settled(page);
  return page;
}

test("5.10.2 a scroll that starts on the Songbook's search bar doesn't open the search; a tap does", { skip: skip() }, async t => {
  const page = await phone(t, lib());
  await page.evaluate(() => { location.hash = "#/library"; }); await page.waitForSelector("#q"); await settled(page);
  const b = await page.evaluate(() => { const r = document.getElementById("q").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.evaluate(({ x, y }) => { const q = document.getElementById("q"), o = { bubbles: true, pointerId: 1, pointerType: "touch", clientX: x }; q.dispatchEvent(new PointerEvent("pointerdown", { ...o, clientY: y })); q.dispatchEvent(new PointerEvent("pointerup", { ...o, clientY: y - 80 })); }, b);
  await page.waitForTimeout(200); /* real timer: nothing should happen */
  assert.equal(await page.evaluate(() => document.body.classList.contains("searching")), false, "a drag is a scroll, not a tap");
  await page.evaluate(({ x, y }) => { const q = document.getElementById("q"), o = { bubbles: true, pointerId: 1, pointerType: "touch", clientX: x, clientY: y }; q.dispatchEvent(new PointerEvent("pointerdown", o)); q.dispatchEvent(new PointerEvent("pointerup", o)); }, b);
  await page.waitForFunction(() => document.body.classList.contains("searching"));
});

test("5.10.2 the Tools sheet stays open when the page behind it scrolls; one way in (no More in the song's header)", { skip: skip() }, async t => {
  const page = await song(t);
  assert.equal(await page.locator('[aria-label="More for this song"]').count(), 0, "the header's More is gone; Tools in the bar opens the sheet");
  await page.click("#more"); await page.waitForSelector(".menu.tools");
  await page.evaluate(() => window.scrollBy(0, 120));
  await page.waitForTimeout(300); /* real timer: the sheet should still be there */
  assert.equal(await page.locator(".menu.tools").count(), 1, "a page scroll doesn't close it");
  await page.click(".menu.tools .tl-head");
  assert.equal(await page.locator(".menu.tools").count(), 1, "a tap on the sheet doesn't close it");
});

test("5.10.2 the Loop prompt is solid and above the song's header", { skip: skip() }, async t => {
  const page = await song(t);
  await page.click("#pw-loop"); await page.waitForSelector(".loopbanner");
  const st = await page.evaluate(() => { const b = getComputedStyle(document.querySelector(".loopbanner")), h = getComputedStyle(document.querySelector(".chead")); return { bg: b.backgroundColor, z: +b.zIndex, hz: +h.zIndex, blur: b.backdropFilter }; });
  assert.ok(st.z > st.hz, "on top of the header");
  assert.match(st.bg, /^rgb\(/, `a solid background (${st.bg})`);
});
