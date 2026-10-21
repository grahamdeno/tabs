// Tips & gestures: every Show me plays its demo, on screen. (3.19.0: one song
// layout on a phone, so the ring's demos are gone.)
import test from "node:test";
import assert from "node:assert/strict";
import { base, phone, skip, LIB, useBrowser } from "./harness.mjs";
useBrowser();

const EXPECT = {
  pull: /Pull down/, speed: /Tools, then Speed/, setdial: /4 of 9/,
  chord: /chord/i, line: /Tap a line/, map: /section/, nn: /Now and Next/, pause: /pause/i, search: /Search/, tap: /Tap along/, meter: /Green and centered/
};
test("every Show me demos on screen", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, sets: [{ id: "s", name: "Gig", songIds: ["a", "b"] }], settings: { ...LIB.settings, micExplained: true } }, { isMobile: true });
  await page.evaluate(() => { location.hash = "#/gestures"; }); await page.waitForTimeout(400);
  const demos = await page.evaluate(() => [...document.querySelectorAll(".gs-show")].map(b => b.dataset.demo));
  assert.deepEqual([...demos].sort(), Object.keys(EXPECT).sort(), "every demo is covered here");
  for (const d of demos) {
    await page.evaluate(() => { location.hash = "#/gestures"; }); await page.waitForTimeout(350);
    await page.click(`.gs-show[data-demo='${d}']`); await page.waitForTimeout(2200);
    const r = await page.evaluate(() => {
      const c = [...document.querySelectorAll(".coach")].map(x => { const b = x.getBoundingClientRect(); return { text: x.innerText, on: b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth }; });
      const toast = document.getElementById("toast");
      return { c, toast: toast.classList.contains("show") ? toast.innerText : "" };
    });
    assert.ok(r.c.length, `${d}: a tip shows`);
    assert.ok(r.c.every(x => x.on), `${d}: the tip is on screen`);
    assert.match(r.c.map(x => x.text).join(" "), EXPECT[d], `${d}: the right tip`);
    await page.evaluate(() => { document.querySelectorAll(".coach, .coach-dim").forEach(e => e.remove()); document.getElementById("layer").innerHTML = ""; });
  }
});
