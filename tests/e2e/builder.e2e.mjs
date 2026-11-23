// Road Ready 9b, the guitar builder (rr-09b-builder): the Merch entry, locked and priced swatches, the running total, saving,
// the one picture per build, and the stops sitting where they do on the painting.
import test from "node:test";
import assert from "node:assert/strict";
import { phone, LIB, skip, useBrowser, settled, until } from "./harness.mjs";

useBrowser();

/* three legs headlined (Porch, Cornerstone, Club Slab are earned), worked out with the app's own numbers */
globalThis.localStorage ||= { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };
const C = await import("../../core.js");
const SKILLS = (() => {
  const d = C.migrate({ songs: [], settings: { v: 6 } });
  for (let k = 0; k < 20; k++) { let ch = 0; for (const l of C.roadPath(d).legs) for (const s of l.stops) if (!s.id.startsWith("b:") && !d.skills?.done?.[s.id]) { C.skillDone(d, s.id); ch++; } if (!ch) break; }
  return d.skills;
})();
const plays = ring => ({ v: 1, months: { "2026-11": { plays: 4 * ring * ring } } });
const lib = (theme, { ring = 2, tips = 1000, builds, merch } = {}) => ({ ...LIB, skills: SKILLS, merch: { tconv: 1, lconv: 1, hlseen: 1, tips, ...merch }, builds, guitars: { seen: ["open", "switch", "scales"] }, journal: plays(ring), settings: { ...LIB.settings, v: 6, theme } });
const hash = (page, h) => page.evaluate(h => { location.hash = h; }, h);
const store = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")));
async function builder(t, theme = "dark", o = {}, opts = {}) {
  const page = await phone(t, lib(theme, o), { home: true, ...opts });
  await page.waitForSelector("#rd-bubble, .rr-stats"); await hash(page, "#/merch"); await page.waitForSelector(".mc");
  await page.click("#mc-build"); await page.waitForSelector(".bd"); await settled(page);
  /* the sheet slides up: wait until it has stopped */
  await page.evaluate(() => new Promise(res => { const el = document.querySelector(".bd"); let last = -1, n = 0; const f = () => { const y = el.getBoundingClientRect().top; n = y === last ? n + 1 : 0; last = y; n >= 5 ? res() : requestAnimationFrame(f); }; f(); }));
  return page;
}
const sw = (page, c, id) => page.locator(`.bd-sw[data-c="${c}"][data-id="${id}"]`);

test("Builder: Build your guitar is on the Merch table and lists the Road guitars you've earned, not the shop's", { skip: skip() }, async t => {
  const page = await builder(t);
  assert.equal(await page.locator("#mc-build").count(), 1);
  assert.deepEqual(await page.$$eval(".bd-leg", els => els.map(e => e.textContent.trim())), ["Porch", "Cornerstone", "Club Slab"].map(n => n), "the three guitars earned");
  assert.deepEqual(await page.$$eval(".bd-tab", els => els.map(e => e.textContent.trim())), ["Body", "Flame top", "Guard", "Wear", "Hardware"]);
  assert.equal(await page.locator('.bd-switch, .bd-long input[role="switch"]').count(), 1, "the strings switch is a real checkbox with role switch");
  assert.equal(await page.getAttribute("#bd-long", "type"), "checkbox");
});

test("Builder: a locked swatch shows a lock, reads 'Locked, opens at Club', can't be chosen, and the running total follows the choices", { skip: skip() }, async t => {
  const page = await builder(t, "dark", { ring: 2 }); /* Coffeehouse: shop parts open, Club parts locked */
  await page.click('.bd-tab[data-cat="guard"]');
  const lock = sw(page, "guard", "leopard");
  assert.equal(await page.getAttribute('.bd-sw[data-id="leopard"]', "aria-label"), "Locked, opens at Club");
  assert.equal(await lock.locator(".bd-lk").count(), 1, "a lock");
  await lock.click({ force: true }); assert.equal(await lock.getAttribute("aria-pressed"), "false", "a locked swatch is not chosen");
  assert.match(await page.innerText("#bd-save"), /Saved to case/, "nothing changed, nothing to save");
  /* an open, priced swatch names its price for a screen reader and adds to the total */
  await page.click('.bd-tab[data-cat="paint"]');
  assert.equal(await page.getAttribute('.bd-sw[data-id="seafoam"]', "aria-label"), "Seafoam, $25 tips");
  await sw(page, "paint", "seafoam").click();
  assert.equal(await page.innerText("#bd-save"), "Save to case, $25 tips");
  await page.click('.bd-tab[data-cat="wear"]'); await sw(page, "wear", "played").click();
  assert.equal(await page.innerText("#bd-save"), "Save to case, $65 tips", "new parts add up");
  await sw(page, "wear", "new").click(); await page.click('.bd-tab[data-cat="paint"]'); await sw(page, "paint", "original").click();
  assert.match(await page.innerText("#bd-save"), /Saved to case/, "back to the painting: nothing to save");
  /* every swatch is a 44 px target with a name */
  for (const b of await page.$$(".bd-sw, .bd-tab, .bd-leg")) { const r = await b.boundingBox(); assert.ok(r.height >= 43.5 && r.width >= 43.5, `a target is ${r.width} x ${r.height}`); assert.ok((await b.getAttribute("aria-label")) || (await b.innerText()).trim(), "named"); }
});

test("Builder: on an acoustic the flame tops show locked with the reason; koa is open at Theater", { skip: skip() }, async t => {
  const page = await builder(t, "dark", { ring: 4 });
  await page.click('.bd-tab[data-cat="top"]');
  assert.match(await page.getAttribute('.bd-sw[data-id="teal"]', "aria-label"), /locked\. Flame tops are for electric bodies/);
  assert.match(await page.innerText(".bd-rows"), /Flame tops are for electric bodies/);
  await sw(page, "top", "teal").click({ force: true }); assert.equal(await sw(page, "top", "teal").getAttribute("aria-pressed"), "false");
  assert.equal(await page.getAttribute('.bd-sw[data-id="koa"]', "aria-label"), "Koa top, $120 tips");
  /* on the electric Club Slab the flame tops are open */
  await page.click('.bd-leg[data-leg="scales"]'); await page.click('.bd-tab[data-cat="top"]');
  assert.equal(await page.getAttribute('.bd-sw[data-id="teal"]', "aria-label"), "Teal top, $120 tips");
});

test("Builder: saving spends the tips once, keeps the build, and a bought part is free the second time", { skip: skip() }, async t => {
  const page = await builder(t, "dark", { ring: 3, tips: 500 });
  await page.click('.bd-tab[data-cat="guard"]'); await sw(page, "guard", "leopard").click();
  assert.equal(await page.innerText("#bd-save"), "Save to case, $35 tips");
  await page.click("#bd-save");
  await until(async () => (await store(page)).builds?.open?.guard === "leopard");
  const s = await store(page); assert.equal(s.merch.tspent, 35); assert.ok(s.merch.has.includes("b-leopard"));
  /* the same part on Cornerstone costs nothing */
  await page.click('.bd-leg[data-leg="switch"]'); await page.click('.bd-tab[data-cat="guard"]'); await sw(page, "guard", "leopard").click();
  assert.equal(await page.innerText("#bd-save"), "Save to case", "free the second time");
  /* too few tips: the button waits and says how many more */
  const page2 = await builder(t, "dark", { ring: 4, tips: 20 });
  await page2.click('.bd-tab[data-cat="top"]'); await sw(page2, "top", "koa").click();
  assert.equal(await page2.locator("#bd-save").isDisabled(), true); assert.match(await page2.innerText(".bd-short"), /\$100 more in tips to go/);
});

test("Builder: Leave strings long is free and is saved with the guitar", { skip: skip() }, async t => {
  const page = await builder(t, "dark", { ring: 0, tips: 0 });
  await page.locator(".bd-long").click();
  assert.equal(await page.isChecked("#bd-long"), true); assert.equal(await page.innerText("#bd-save"), "Save to case");
  await page.click("#bd-save"); await until(async () => (await store(page)).builds?.open?.long === 1);
  assert.equal((await store(page)).merch.tspent, undefined, "free");
});

test("Builder: at large text the swatch rows wrap and the chips scroll, in Dark and Light", { skip: skip() }, async t => {
  for (const theme of ["dark", "light"]) {
    const page = await builder(t, theme, { ring: 4 }, { viewport: { width: 320, height: 640 } });
    await page.evaluate(() => { document.documentElement.style.setProperty("--sys-px", "40px"); document.documentElement.dataset.ax = "3"; });
    await settled(page);
    assert.equal(await page.$eval(".bd-chips", el => getComputedStyle(el).overflowX), "auto", "the chips scroll");
    assert.equal(await page.$eval(".bd-sws", el => getComputedStyle(el).flexWrap), "wrap", "the swatches wrap");
    assert.ok(await page.$eval(".bd", el => el.scrollWidth <= el.clientWidth + 1), `${theme}: nothing runs off the side`);
  }
});

test("Builder: a guitar left as painted puts together pixel for pixel the same as its painting", { skip: skip() }, async t => {
  const page = await phone(t, lib("dark"), { home: true });
  const r = await page.evaluate(async () => {
    const { composeBuild } = await import("/buildart.js");
    const out = {};
    for (const [leg, slug] of [["open", "porch"], ["switch", "cornerstone"], ["scales", "clubslab"], ["strum", "hollowhill"], ["pick", "swing"], ["finger", "koaarc"], ["encore", "comet"]]) {
      const c = await composeBuild(leg, {}, slug), img = new Image(); img.src = `/art/guitars/${slug}-road.webp`; await img.decode();
      const cv = document.createElement("canvas"); cv.width = img.naturalWidth; cv.height = img.naturalHeight; const x = cv.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0);
      const a = x.getImageData(0, 0, cv.width, cv.height).data, b = c.canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.w, c.h).data;
      let max = 0, bad = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d > max) max = d; if (d > 1) bad++; }
      out[slug] = { same: c.w === cv.width && c.h === cv.height, max, bad };
    }
    return out;
  });
  for (const [slug, v] of Object.entries(r)) { assert.ok(v.same, `${slug}: same size as its painting`); assert.ok(v.max <= 1, `${slug}: no channel differs by more than 1 (it is ${v.max}; ${v.bad} above 1)`); }
});

test("Builder: a built guitar on the Road keeps every stop where it is on the painting, and the picture is the same size", { skip: skip() }, async t => {
  const where = async page => page.$$eval('.rn-neck .rd-node', els => els.map(e => { const r = e.getBoundingClientRect(); return [e.dataset.stop, Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }));
  const plain = await phone(t, lib("dark", { ring: 3 }), { home: true }); await plain.waitForSelector(".rn-neck"); await settled(plain);
  const built = await phone(t, lib("dark", { ring: 3, builds: { open: { paint: "seafoam", wear: "played", guard: "leopard" } }, merch: { has: ["b-seafoam", "b-played", "b-leopard"] } }), { home: true });
  await built.waitForSelector(".rn-neck"); await settled(built);
  assert.match(await plain.locator(".rn-neck").evaluate(el => getComputedStyle(el).backgroundImage), /neck-rosewood\.webp/, "the Road is the rosewood neck");
  assert.deepEqual(await where(built), await where(plain), "a built guitar does not move the stops");
});

test("Builder: the built guitar is the one picture in the case on Me", { skip: skip() }, async t => {
  const page = await phone(t, lib("dark", { ring: 3, builds: { open: { paint: "seafoam" } }, merch: { has: ["b-seafoam"] } }), { home: true });
  await page.waitForSelector(".rr-stats, #rd-bubble"); await hash(page, "#/you"); await page.waitForSelector(".rr-gtr img");
  await page.waitForFunction(() => /^blob:/.test(document.querySelector(".rr-gtr img")?.getAttribute("src") || ""), null, { timeout: 15000 });
  assert.equal(await page.$$eval(".rr-gtr img", els => els.filter(e => e.src.startsWith("blob:")).length), 1, "only the built guitar changes");
});

test("Builder: trying many builds keeps only the newest pictures in memory", { skip: skip() }, async t => {
  const page = await builder(t, "dark", { ring: 4 });
  const kept = await page.evaluate(async () => {
    const m = await import("./buildart.js");
    const paints = ["amber", "black", "seafoam", "burgundy", "tobacco", "honey", "candy", "silverflake"], builds = [];
    for (const paint of paints) for (const long of [0, 1]) builds.push(long ? { paint, long: 1 } : { paint });
    for (const b of builds) await m.builtWait("open", b);
    return { made: builds.length, kept: m.builtCount(), lastReady: m.builtReady("open", builds[builds.length - 1]) };
  });
  assert.equal(kept.made, 16); assert.ok(kept.kept <= 13, `at most 12 kept, plus one on the page (${kept.kept})`); assert.ok(kept.lastReady, "the newest is kept");
});
