// 5.17.0: the tuner's painted headstocks (Grok's art in art/tuner/) in Light and Dark, with the strings drawn by the app.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as H from "./harness.mjs";
H.useBrowser();
const json = JSON.parse(fs.readFileSync(new URL("../../art/tuner/heads.json", import.meta.url), "utf8"));

test("5.17.0 the tuner shows the painted headstock in Light and Dark, and the strings meet the posts and the nut", { skip: H.skip() }, async t => {
  for (const theme of ["neon", "festival"]) for (const mode of ["acoustic", "electric"]) {
    const ctx = await H.browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    t.after(() => ctx.close());
    const page = await ctx.newPage();
    await page.goto(H.base); await page.waitForFunction(() => !!localStorage.getItem("tabs-v1"));
    await page.evaluate(d => localStorage.setItem("tabs-v1", JSON.stringify(d)), { ...H.LIB, settings: { ...H.LIB.settings, theme, tunerMode: mode, tipsSeen: { ...H.LIB.settings.tipsSeen, tuner: true }, micExplained: true } });
    await page.reload(); await page.waitForLoadState("domcontentloaded");
    await page.goto(H.base + "#/you"); await page.waitForSelector("#pf-r-tune");
    await page.click("#pf-r-tune"); await page.waitForSelector("#tn-stage svg .tn-paint", { state: "attached", timeout: 15000 });
    const img = await page.evaluate(() => { const i = document.querySelector("#tn-stage svg .tn-paint"); return { href: i.getAttribute("href"), w: +i.getAttribute("width"), h: +i.getAttribute("height"), hidden: i.getAttribute("aria-hidden") }; });
    const j = json[mode];
    assert.match(img.href, new RegExp(`art/tuner/${j.file}`), `${theme} ${mode}: the painting`);
    assert.deepEqual([img.w, img.h], [j.width, j.height], "drawn at one image pixel per unit");
    assert.equal(img.hidden, "true", "decorative: VoiceOver reads the headstock's own name, not the picture");
    const ok = await page.evaluate(async src => { const r = await fetch(src); return r.ok && (await r.blob()).size > 1000; }, img.href);
    assert.ok(ok, "the painting loads");
    const lines = await page.$$eval("#tn-stage svg .tn-strings line[stroke-width='7']", ls => ls.map(l => ["x1", "y1", "x2", "y2"].map(k => +l.getAttribute(k))));
    assert.equal(lines.length, 6, "six strings");
    lines.forEach(([x1, y1, x2, y2], i) => {
      assert.deepEqual([x1, y1], [j.posts[i].x, j.posts[i].y], `string ${i + 1} starts at its post`);
      assert.deepEqual([x2, y2], [j.nut[i].x, j.nut[i].y], `string ${i + 1} ends at the nut`);
    });
    assert.equal(await page.locator("#tn-stage svg .tn-face").count(), 0, "no flat face under the painting");
    assert.equal(await page.getAttribute("#tn-stage svg", "aria-label"), mode === "acoustic" ? "Acoustic headstock" : "Electric headstock");
  }
});
