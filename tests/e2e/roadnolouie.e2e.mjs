// Road Ready 10b: Louie is not on the Road in any state. Green Room and Headliner keep his message as a plain card; Light and Dark
// have no message on the Road since the one-row header (Grok, 2026-11-19; his first-song line shows in the playing screen). The Gig button stays.
import test from "node:test";
import assert from "node:assert/strict";
import { phone, LIB, SONG, skip, settled, useBrowser } from "./harness.mjs";

useBrowser();

const AT = Date.now();
const MID = { done: Object.fromEntries(["G", "C", "D", "Em"].map((c, i) => ["c:" + c, { n: 3, best: 90, at: AT - 1000 + i }])), last: AT };
const lib = (theme, extra = {}) => ({ ...LIB, ...extra, settings: { ...LIB.settings, v: 6, theme } });
const { opening: _o, me: _m, ...BASE } = LIB;
const FRESH = { ...BASE, songs: [{ id: "h", title: "Harbor Lights", artist: "Sample song", sample: true, key: "A", format: "chords", body: SONG, duration: 60 }], settings: { ...LIB.settings, v: 6 } };

/* nothing of Louie: no drawing, no class, no peeking picture, and no picture of him painted on any Road element */
async function noLouie(page, what) {
  const n = await page.evaluate(() => {
    const root = document.getElementById("app");
    const painted = [...root.querySelectorAll("*")].filter(e => /louie/i.test(getComputedStyle(e).backgroundImage) || /louie/i.test(getComputedStyle(e, "::before").backgroundImage) || /louie/i.test(getComputedStyle(e, "::after").backgroundImage));
    return { drawn: root.querySelectorAll("svg.louie, .louie, .rd-peek, img[src*='louie']").length, painted: painted.length };
  });
  assert.deepEqual(n, { drawn: 0, painted: 0 }, `${what}: no Louie on the Road`);
}

for (const [look, theme] of [["Dark", "dark"], ["Light", "light"], ["Green Room", "green"], ["Headliner", "headliner"]]) {
  test(`Road Ready 10b (${look}): no Louie on the Road, and the message and the Gig button are there`, { skip: skip() }, async t => {
    const page = await phone(t, lib(theme, { skills: MID }), { home: true });
    await page.waitForSelector(".rd-path"); await settled(page);
    await noLouie(page, look);
    if (["dark", "light"].includes(theme)) assert.equal(await page.locator("#rd-bubble, .rr-say").count(), 0, `${look}: no message on the Road (one-row header)`);
    else { assert.equal(await page.locator("#rd-bubble").count(), 1, `${look}: the message is there`); assert.ok((await page.innerText("#rd-bubble")).trim().length > 0, `${look}: the message has words`); }
    assert.equal(await page.locator("#rd-tonight, .rd-tonight").count(), 1, `${look}: the Gig button is there`);
    assert.ok(await page.locator("#rd-tonight, .rd-tonight").first().isVisible(), `${look}: the Gig button shows`);
  });
}

for (const ax of [1, 2, 3]) {
  test(`Road Ready 10b (large text ${ax}): no Louie on the Road in either look, and the message and Gig button stay`, { skip: skip() }, async t => {
    for (const theme of ["dark", "light"]) {
      const page = await phone(t, lib(theme, { skills: MID }), { home: true });
      await page.waitForSelector(".rr-row .rr-stats"); await settled(page);
      await page.evaluate(a => { document.documentElement.style.setProperty("--sys-px", ["", "27px", "33px", "40px"][a]); document.documentElement.dataset.ax = String(a); }, ax);
      await settled(page);
      await noLouie(page, `${theme}, large text ${ax}`);
      assert.equal(await page.locator("#rd-bubble").count(), 0, `${theme} ${ax}: no message on the Road (one-row header)`);
      assert.equal(await page.locator("#rd-tonight").count(), 1, `${theme} ${ax}: the Gig button is there`);
    }
  });
}

test("Road Ready 10b (Opening night): no Louie on the Road, in progress or done, and no message there either", { skip: skip() }, async t => {
  for (const [what, opening] of [["in progress", undefined], ["done", { step: 6, v: 2, done: 1 }]]) {
    const page = await phone(t, opening ? { ...FRESH, opening } : FRESH, { home: true });
    await page.waitForSelector(".on-night"); await settled(page);
    await noLouie(page, `Opening night ${what}`);
    assert.equal(await page.locator("#rd-bubble").count(), 0, `Opening night ${what}: no message on the Road (one-row header)`);
  }
});

test("Road Ready 10b: sheets opened from the Road keep Louie (new guitar, Show complete)", { skip: skip() }, async t => {
  const src = (await import("node:fs")).readFileSync(new URL("../../road.js", import.meta.url), "utf8");
  for (const cls of ["rd-hl-lou", "sc-louie", "rd-gt-row"]) {
    const at = src.indexOf(cls);
    assert.ok(at > 0, `${cls} is still in road.js`);
    assert.match(src.slice(Math.max(0, at - 200), at + 400), /\$\{louie\(/, `${cls}: the sheet still draws Louie`);
  }
});
