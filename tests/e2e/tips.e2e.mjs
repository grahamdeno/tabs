// Tips & gestures: every Show me plays its demo, on screen, in both song
// layouts (2.6.6). One-hand tips explain themselves when the ring isn't in use.
import test from "node:test";
import assert from "node:assert/strict";
import { base, phone, skip, LIB, useBrowser } from "./harness.mjs";
useBrowser();

const EXPECT = {
  ring: /Hold Play/, arc: /Sweep the arc/, pull: /Pull down/, speed: /Hold the time/, setdial: /4 of 9/, rise: /rises to your thumb/,
  chord: /chord/i, line: /Tap a line/, map: /section/, nn: /Now and Next/, pause: /pause/i, search: /Search/, tap: /Tap along/, strobe: /Stripes/
};
const ONE_HAND = ["ring", "arc", "pull", "speed", "setdial", "rise"];

for (const mode of ["ring", "bar"]) test(`every Show me demos on screen (${mode === "ring" ? "Hold Play" : "Bar"} controls)`, { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, sets: [{ id: "s", name: "Gig", songIds: ["a", "b"] }], settings: { ...LIB.settings, controls: mode, follow: "touch", micExplained: true } }, { isMobile: true });
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
    if (mode === "bar" && ONE_HAND.includes(d)) assert.match(r.toast, /phone held upright/, `${d}: explains where it works`);
    else {
      assert.ok(r.c.length, `${d}: a tip shows`);
      assert.ok(r.c.every(x => x.on), `${d}: the tip is on screen`);
      assert.match(r.c.map(x => x.text).join(" "), EXPECT[d], `${d}: the right tip`);
    }
    await page.evaluate(() => { document.querySelectorAll(".coach, .coach-dim").forEach(e => e.remove()); document.getElementById("layer").innerHTML = ""; });
  }
});
