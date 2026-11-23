// Road Ready 9a, painted necks (rr-09-road): taps, the card, keyboard and readability on the painted guitar.
import test from "node:test";
import assert from "node:assert/strict";
import { phone, LIB, skip, useBrowser, settled } from "./harness.mjs";

useBrowser();

const AT = Date.now();
const doneOf = ids => ({ done: Object.fromEntries(ids.map((id, i) => [id, { n: 3, best: 90, at: AT - 1000 + i }])), last: AT });
const OPEN = ["G", "C", "D", "Em", "Am", "E", "A"].map(c => "c:" + c);
const MID = doneOf(OPEN.slice(0, 4)); /* G, C, D and Em done: Am is the current stop */
const lib = (theme, skills, extra = {}) => ({ ...LIB, skills, merch: { tconv: 1, lconv: 1, hlseen: 1, ...(extra.merch || {}) }, guitars: { seen: ["open"] }, journal: extra.journal, settings: { ...LIB.settings, v: 6, theme } });
/* the path scrolls to the current stop, and again after a card opens or closes (revealPop): wait until the stop has stopped moving */
const still = page => page.evaluate(() => new Promise(res => { const el = document.querySelector(".rd-node.cur"); let last = -1, n = 0; const f = () => { const y = el.getBoundingClientRect().top; n = y === last ? n + 1 : 0; last = y; n >= 10 ? res() : requestAnimationFrame(f); }; f(); }));
async function road(t, theme = "dark", skills = MID, extra = {}, opts = {}) {
  const page = await phone(t, lib(theme, skills, extra), { home: true, ...opts });
  await page.waitForSelector(".rn-neck .rd-node"); await settled(page);
  await still(page);
  return page;
}
const rect = (page, sel) => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, sel);
const stopSel = id => `.rn-neck .rd-node[data-stop="${id}"]`;

test("Painted necks: a tap on a finished stop opens its card and starts nothing", { skip: skip() }, async t => {
  const page = await road(t);
  const hash = await page.evaluate(() => location.hash);
  await page.click(stopSel("c:G")); await page.waitForSelector(".rd-pop");
  assert.equal(await page.locator(".rd-pop").count(), 1, "one card");
  assert.match(await page.innerText(".rd-pop"), /G chord/);
  await page.waitForTimeout(300); /* real timer: nothing starts after a beat */
  assert.equal(await page.evaluate(() => location.hash), hash, "no lesson or song started");
  assert.equal(await page.locator("#gig").count(), 0);
});

test("Painted necks: the card's Start button is at least 44 by 44, the card is on the screen and covers none of the current stop's strings row", { skip: skip() }, async t => {
  const page = await road(t);
  await page.click(stopSel("c:Am")); await page.waitForSelector(".rd-pop.now .rd-start");
  const b = await rect(page, ".rd-pop.now .rd-start"), c = await page.evaluate(() => { const r = document.querySelector(".rd-pop.now").getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: innerWidth, h: innerHeight }; });
  assert.ok(b.w >= 44 && b.h >= 44, `Start is ${b.w} by ${b.h}`);
  assert.ok(c.l >= 0 && c.r <= c.w && c.t >= 0 && c.b <= c.h, `the card is fully on screen ${JSON.stringify(c)}`);
  const stop = await rect(page, stopSel("c:Am"));
  assert.ok(c.t >= stop.y - 1, "the card opens below its stop's row, so the strings of that row stay in view");
});

test("Painted necks: tapping another stop moves the card; tapping empty space closes it", { skip: skip() }, async t => {
  const page = await road(t);
  /* a card opens below its stop and covers the stops under it, so the neighbour is the stop above */
  await page.click(stopSel("c:Em")); await page.waitForSelector(".rd-pop");
  const first = await page.evaluate(() => document.querySelector(".rd-pop").parentElement.querySelector("[data-stop]").dataset.stop);
  assert.equal(first, "c:Em");
  await page.click(stopSel("c:D"));
  await page.waitForFunction(() => document.querySelector(".rd-pop")?.parentElement.querySelector("[data-stop]").dataset.stop === "c:D");
  assert.equal(await page.locator(".rd-pop").count(), 1, "one card at a time");
  /* empty space: the painted headstock, above the hit layer */
  await page.evaluate(() => { const p = document.getElementById("rd-path"); p.style.scrollBehavior = "auto"; p.scrollTo(0, 0); });
  await page.waitForFunction(() => document.getElementById("rd-path").scrollTop === 0); await settled(page);
  const head = await page.evaluate(() => { const n = document.querySelector(".rn-neck").getBoundingClientRect(); return { x: Math.max(6, n.left / 2), y: n.top + 80 }; });
  await page.mouse.click(head.x, head.y);
  await page.waitForSelector(".rd-pop", { state: "detached" });
});

test("Painted necks: a tap in the gutter does not open a stop, and a tap on the stop does", { skip: skip() }, async t => {
  const page = await road(t);
  const gutter = await page.evaluate(() => { const n = document.querySelector(".rn-neck").getBoundingClientRect(); return { x: Math.max(8, n.left / 2), y: n.top + 180 }; });
  await page.mouse.move(gutter.x, gutter.y);
  await page.mouse.down();
  await page.mouse.move(gutter.x, gutter.y + 140, { steps: 8 });
  await page.mouse.up();
  assert.equal(await page.locator(".rd-pop").count(), 0, "a gutter drag does not open a stop");
  await page.mouse.click(gutter.x, gutter.y);
  assert.equal(await page.locator(".rd-pop").count(), 0, "a gutter tap does not open a stop");
  await page.click(stopSel("c:Am")); await page.waitForSelector(".rd-pop.now");
  assert.match(await page.innerText(".rd-pop"), /Am/);
});

test("Painted necks: a locked stop opens a card with no Start button, and never takes a tap from the current stop's zone", { skip: skip() }, async t => {
  const page = await road(t);
  await page.click(stopSel("c:A")); await page.waitForSelector(".rd-pop");
  assert.equal(await page.locator(".rd-pop .rd-start").count(), 0, "a locked stop has no Start");
  assert.match(await page.innerText(".rd-pop"), /opens when you get here|Finish the stops/i);
  const cur = await rect(page, stopSel("c:Am"));
  await page.mouse.click(5, cur.y);
  assert.equal(await page.locator(".rd-pop.now").count(), 0, "a tap in the gutter is not the current stop");
});

test("Painted necks: from the keyboard, Enter opens the card and moves focus to Start; Escape closes it and returns focus to the stop", { skip: skip() }, async t => {
  const page = await road(t);
  const labels = await page.evaluate(() => [...document.querySelector(".rn-neck").querySelectorAll(".rd-node")].map(b => [b.dataset.stop, b.dataset.kind, b.dataset.n, b.getAttribute("aria-label")]));
  assert.ok(labels.length >= 10 && labels.every(([s, k, n, a]) => s && k && n && a), "every stop is a real button with a label, id, kind and number");
  assert.deepEqual(labels.map(l => +l[2]), labels.map((_, i) => i + 1), "in order down the neck");
  await page.focus(stopSel("c:Am")); await page.keyboard.press("Enter");
  await page.waitForSelector(".rd-pop.now .rd-start");
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains("rd-start")), true, "focus is on Start");
  await page.keyboard.press("Escape"); await page.waitForSelector(".rd-pop", { state: "detached" });
  assert.equal(await page.evaluate(() => document.activeElement?.dataset?.stop), "c:Am", "focus is back on the stop");
});

test("Painted necks: on Chord switches, with lesson 2 current, a tap on finished lesson 1 opens lesson 1, and a tap on lesson 2 opens lesson 2", { skip: skip() }, async t => {
  const page = await road(t, "dark", doneOf([...OPEN, "k:open", "s:G-C"]));
  assert.equal(await page.locator(".rd-node.cur").getAttribute("data-stop"), "s:C-D");
  const shown = () => page.evaluate(() => document.querySelector(".rd-pop")?.parentElement.querySelector("[data-stop]").dataset.stop);
  /* the stops sit with empty frets between them, so the one above the current stop may start off the screen */
  await page.evaluate(s => { const el = document.querySelector(s), path = document.querySelector(".rd-path"), pr = path.getBoundingClientRect(), r = el.getBoundingClientRect(); path.scrollTop += r.top - pr.top - path.clientHeight * 0.4; }, stopSel("s:G-C"));
  await still(page);
  const first = await rect(page, stopSel("s:G-C"));
  await page.mouse.click(first.x, first.y); await page.waitForSelector(".rd-pop");
  assert.equal(await shown(), "s:G-C", "lesson 1's card, not lesson 2's");
  await page.keyboard.press("Escape"); await page.waitForSelector(".rd-pop", { state: "detached" }); await still(page);
  const cur = await rect(page, stopSel("s:C-D"));
  await page.mouse.click(cur.x, cur.y); await page.waitForSelector(".rd-pop");
  assert.equal(await shown(), "s:C-D", "lesson 2's card");
});

test("Painted necks: Escape closes the open card wherever focus is, and puts focus on the stop", { skip: skip() }, async t => {
  const page = await road(t);
  for (const where of ["the page body", "the card's own Start button"]) {
    await page.click(stopSel("c:Am")); await page.waitForSelector(".rd-pop.now"); await still(page);
    await page.evaluate(w => { if (w === "the page body") document.activeElement?.blur(); else document.querySelector(".rd-pop .rd-start").focus(); }, where);
    await page.keyboard.press("Escape"); await page.waitForSelector(".rd-pop", { state: "detached" });
    assert.equal(await page.evaluate(() => document.activeElement?.dataset?.stop), "c:Am", `focus is back on the stop after Escape from ${where}`);
    await still(page);
  }
  await page.keyboard.press("Escape"); /* nothing open: nothing happens */
  assert.equal(await page.locator(".rd-pop").count(), 0);
});

for (const theme of ["dark", "light"]) {
  test(`Painted necks: at 320 px wide in ${theme}, a busy inlay guitar keeps every stop on the screen and its number readable`, { skip: skip() }, async t => {
    const page = await road(t, theme, MID, {}, { viewport: { width: 320, height: 640 } });
    const out = await page.evaluate(() => {
      const neck = document.querySelector(".rn-neck").getBoundingClientRect();
      return [...document.querySelectorAll(".rn-neck .rd-node")].map(b => {
        const r = b.getBoundingClientRect();
        return { id: b.dataset.stop, left: r.left, right: r.right, neckL: neck.left, neckR: neck.right };
      });
    });
    assert.ok(out.length >= 10);
    for (const s of out) assert.ok(s.left >= s.neckL - 1 && s.right <= s.neckR + 1, `${s.id} stays on the neck`);
  });
}
