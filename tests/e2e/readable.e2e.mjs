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

/* The scan from the 4.89.0 simulation: every visible text on a screen, measured against what is really behind it.
   Text on a picture, a gradient or a blur can't be measured here and is left to the eye. */
function scan() {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [r, g, b, a]; };
  const over = (top, bot) => { const a = top[3] + bot[3] * (1 - top[3]); return a ? [0, 1, 2].map(i => (top[i] * top[3] + bot[i] * bot[3] * (1 - top[3])) / a).concat(a) : [0, 0, 0, 0]; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bodyBg = parse(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1];
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
    if (el.closest("[aria-hidden=true],[hidden],svg,script,style,template,.sr-only,.leaflet-control-attribution")) continue;
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || s.visibility === "hidden" || s.display === "none") continue;
    let op = 1, img = false, bg = [0, 0, 0, 0];
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const es = getComputedStyle(e);
      op *= +es.opacity;
      if (bg[3] < 0.99) {
        if (es.backgroundImage !== "none" || (es.backdropFilter && es.backdropFilter !== "none")) img = true;
        const c = parse(es.backgroundColor);
        if (c && c[3] > 0) bg = over(bg, c);
      }
    }
    if (op < 0.05 || img || document.body.classList.contains("covered")) continue; /* hidden, or on a picture: the eye's job */
    if (bg[3] < 0.99) bg = over(bg, bodyBg);
    const fg0 = parse(s.color) || [0, 0, 0, 1], fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * op], bg);
    const size = parseFloat(s.fontSize), large = size >= 24 || (+s.fontWeight >= 700 && size >= 18.66);
    const text = el.textContent.trim().replace(/\s+/g, " ").slice(0, 30);
    const cls = `${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/)[0] : ""}`;
    if (size < 12) out.push(`${cls} "${text}" is ${size}px`);
    const cr = ratio(fg, bg);
    if (cr < (large ? 3 : 4.5) - 0.05) out.push(`${cls} "${text}" contrast ${cr.toFixed(2)}`);
  }
  /* what floats over the song is never see-through */
  for (const el of document.querySelectorAll("#tuneup, .panel, .gg-shape, .co-badge, #toast.show")) {
    const c = parse(getComputedStyle(el).backgroundColor);
    if (el.getBoundingClientRect().width && c && c[3] < 0.95) out.push(`${el.id || el.className.split(" ")[0]} is see-through`);
  }
  return out;
}
const SCREENS = [["road", "#/"], ["songbook", "#/library"], ["song", "#/song/a"], ["tools", "#/song/a", async p => { await p.click("#more"); await p.click(".menu [data-tab=play]"); }],
  ["charts", "#/charts"], ["tour", "#/tour"], ["band", "#/band"], ["profile", "#/you"], ["merch", "#/merch"], ["rehearse", "#/practice"], ["lessons", "#/practice/skills"],
  ["settings", "#/settings"], ["toast", "#/song/a", p => p.evaluate(() => import("/app.js").then(m => m.toast("River Road moved to Recently deleted", null, { label: "Undo", fn: () => {} })))]];
for (const theme of ["light", "dark"]) {
  test(`4.89.0 readable: no text under 12 px and enough contrast on the main screens (${theme})`, { skip: skip(), timeout: 240000 }, async t => {
    const problems = [];
    for (const [name, hash, act] of SCREENS) {
      const page = await phone(t, { ...LIB, settings: { ...LIB.settings, v: 6, theme } }, { colorScheme: theme === "dark" ? "dark" : "light", reducedMotion: "reduce" });
      await page.goto(base + hash); await page.waitForTimeout(700);
      if (act) { await act(page); await page.waitForTimeout(500); }
      problems.push(...(await page.evaluate(scan)).map(x => `${name}: ${x}`));
      await page.context().close();
    }
    assert.deepEqual([...new Set(problems)], []);
  });
}
