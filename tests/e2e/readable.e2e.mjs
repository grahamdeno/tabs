// 4.89.0 readability (docs/READABILITY-PLAN.md): what floats is never see-through, and a callout's big word reads
// in every look.
import test from "node:test";
import assert from "node:assert/strict";
import { base, phone, skip, LIB, useBrowser } from "./harness.mjs";

useBrowser();
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const rgb = s => s.match(/[\d.]+/g).map(Number);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

for (const theme of ["light", "dark", "green", "headliner"]) {
  test(`4.89.0 a callout's big word stands out from its card (${theme})`, { skip: skip() }, async t => {
    const page = await phone(t, { ...LIB, settings: { ...LIB.settings, v: 6, theme } }, { colorScheme: ["dark", "headliner"].includes(theme) ? "dark" : "light", reducedMotion: "reduce" });
    await page.goto(base + "#/song/a"); await page.waitForSelector("#play");
    await page.evaluate(() => Promise.all([import("/app.js"), import("/callout.js")]).then(([a, m]) => m.callout(a.data, { kind: "level", word: "LEVEL UP", big: "7" })));
    await page.waitForSelector(".co-badge b");
    const [fg, bg] = await page.$eval(".co-badge b", b => [getComputedStyle(b).color, getComputedStyle(b.closest(".co-badge")).backgroundColor]);
    assert.ok(ratio(rgb(fg), rgb(bg)) >= 3, `${fg} on ${bg}`);
    assert.equal(rgb(bg)[3] ?? 1, 1, "the card is solid");
  });
}
