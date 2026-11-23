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
  await page.waitForSelector(".rd-neck.road .rr-hit"); await settled(page);
  await still(page);
  return page;
}
const rect = (page, sel) => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, sel);
const stopSel = id => `.rd-neck .rd-node[data-stop="${id}"]`;

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
  const head = await page.evaluate(() => { const r = document.querySelector(".rd-neck").getBoundingClientRect(); return { x: r.left + 30, y: r.top + 60 }; });
  await page.mouse.click(head.x, head.y);
  await page.waitForSelector(".rd-pop", { state: "detached" });
});

test("Painted necks: a tap inside the current stop's zone always selects the current stop and opens its card", { skip: skip() }, async t => {
  const page = await road(t);
  for (const [dx, dy] of [[-1000, 0], [150, -28], [-150, 28]]) {
    const cur = await rect(page, stopSel("c:Am")); /* measured again before every tap: the Road scrolls after a card opens */
    await page.mouse.click(Math.max(4, Math.min(386, cur.x + dx)), cur.y + dy);
    await page.waitForSelector(".rd-pop.now"); await still(page);
    assert.equal(await page.evaluate(() => document.querySelector(".rd-pop").parentElement.querySelector("[data-stop]").dataset.stop), "c:Am", `a tap ${dx}, ${dy} from the current stop`);
    const again = await rect(page, stopSel("c:Am"));
    await page.mouse.click(again.x, again.y); await page.waitForSelector(".rd-pop", { state: "detached" }); await still(page); /* the same stop again closes it */
  }
});

test("Painted necks: a locked stop opens a card with no Start button, and never takes a tap from the current stop's zone", { skip: skip() }, async t => {
  const page = await road(t);
  await page.click(stopSel("c:A")); await page.waitForSelector(".rd-pop");
  assert.equal(await page.locator(".rd-pop .rd-start").count(), 0, "a locked stop has no Start");
  assert.match(await page.innerText(".rd-pop"), /opens when you get here|Finish the stops/i);
  const cur = await rect(page, stopSel("c:Am"));
  await page.mouse.click(5, cur.y); await page.waitForSelector(".rd-pop.now");
  assert.equal(await page.locator(".rd-pop .rd-start").count(), 1, "inside the current zone the tap is the current stop's");
});

test("Painted necks: from the keyboard, Enter opens the card and moves focus to Start; Escape closes it and returns focus to the stop", { skip: skip() }, async t => {
  const page = await road(t);
  const labels = await page.evaluate(() => [...document.querySelector(".rd-neck").querySelectorAll(".rd-node")].map(b => [b.dataset.stop, b.dataset.kind, b.dataset.n, b.getAttribute("aria-label")]));
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
  for (const where of ["the page body", "the Tonight button", "the card's own Start button"]) {
    await page.click(stopSel("c:Am")); await page.waitForSelector(".rd-pop.now"); await still(page);
    await page.evaluate(w => { if (w === "the page body") document.activeElement?.blur(); else if (w === "the Tonight button") document.getElementById("rd-tonight").focus(); else document.querySelector(".rd-pop .rd-start").focus(); }, where);
    await page.keyboard.press("Escape"); await page.waitForSelector(".rd-pop", { state: "detached" });
    assert.equal(await page.evaluate(() => document.activeElement?.dataset?.stop), "c:Am", `focus is back on the stop after Escape from ${where}`);
    await still(page);
  }
  await page.keyboard.press("Escape"); /* nothing open: nothing happens */
  assert.equal(await page.locator(".rd-pop").count(), 0);
});

for (const theme of ["dark", "light"]) {
  test(`Painted necks: at 320 px wide in ${theme}, a busy inlay guitar keeps every stop on the screen and its number readable`, { skip: skip() }, async t => {
    const page = await road(t, theme, MID, { merch: { guitar: "velvetcrown", has: ["g-velvetcrown"] }, journal: { v: 1, months: { "2026-11": { plays: 400 } } } }, { viewport: { width: 320, height: 640 } });
    assert.match(await page.locator(".rd-neck").first().getAttribute("aria-label"), /Velvet Crown/);
    const out = await page.evaluate(() => {
      const lum = c => { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); };
      return [...document.querySelectorAll(".rd-neck .rd-node")].filter(b => !b.closest(".rr-peek")).map(b => {
        const r = b.getBoundingClientRect(), pearl = b.querySelector(".rr-pearl"), txt = b.querySelector(".rr-eng text, .rr-eng path");
        const a = lum(getComputedStyle(pearl).fill), e = lum(getComputedStyle(txt).fill !== "none" ? getComputedStyle(txt).fill : getComputedStyle(txt).stroke), hi = Math.max(a, e), lo = Math.min(a, e);
        return { id: b.dataset.stop, left: r.left, right: r.right, ratio: (hi + .05) / (lo + .05), font: parseFloat(getComputedStyle(b.querySelector(".rr-eng text") || b).fontSize), over: b.parentElement.querySelector(".rr-pearl.rr-over, .rr-over") !== null || b.classList.contains("rr-over") || b.parentElement.classList.contains("rr-over") };
      });
    });
    assert.ok(out.length >= 10);
    for (const s of out) { assert.ok(s.left >= 0 && s.right <= 320, `${s.id} is on the screen (${s.left}..${s.right})`); assert.ok(s.ratio >= 3, `${s.id}: number against its pearl is ${s.ratio.toFixed(2)}`); }
    const frame = await page.evaluate(() => {
      const necks = [...document.querySelectorAll(".rd-neck.road")].map(n => {
        const svg = n.querySelector("svg.rd-base"), img = svg?.querySelector("image");
        if (!img) return null;
        const vb = svg.viewBox.baseVal, x = +img.getAttribute("x"), w = +img.getAttribute("width"), y = +img.getAttribute("y"), h = +img.getAttribute("height");
        return { left: x - vb.x, right: vb.x + vb.width - (x + w), bottom: vb.y + vb.height - (y + h) };
      }).filter(Boolean);
      const peek = document.querySelector(".rr-peek-neck");
      const plate = document.querySelector(".rd-neck.road .rd-node.headline");
      return { necks, peek: peek ? getComputedStyle(peek).filter : "", plate: plate?.querySelector(".rr-eng text")?.textContent || "" };
    });
    for (const n of frame.necks) assert.ok(n.left >= -0.5 && n.right >= -0.5 && n.bottom >= -0.5, `the body stays inside the frame (${JSON.stringify(n)})`);
    assert.equal(frame.plate, "HEADLINE");
    const bright = +(frame.peek.match(/brightness\(([\d.]+)\)/) || [])[1];
    if (theme === "light") assert.ok(bright >= 0.9, `Light headstock stays painted (${frame.peek})`);
    else assert.ok(bright >= 0.7 && bright < 1, `Dark next leg stays grey, not a black shape (${frame.peek})`);
  });
}
