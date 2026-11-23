// The neck-only Road: one rosewood board you scroll, with a lamp-lit Road knob.
import test from "node:test";
import assert from "node:assert/strict";
import { phone, LIB, skip, useBrowser, settled } from "./harness.mjs";

useBrowser();

const AT = Date.now();
const doneOf = ids => ({ done: Object.fromEntries(ids.map((id, i) => [id, { n: 3, best: 90, at: AT - 1000 + i }])), last: AT });
const OPEN = ["G", "C", "D", "Em", "Am", "E", "A"].map(c => "c:" + c);
const MID = doneOf(OPEN.slice(0, 4));
const lib = (theme, skills) => ({ ...LIB, skills, merch: { tconv: 1, lconv: 1, hlseen: 1 }, guitars: { seen: ["open"] }, settings: { ...LIB.settings, v: 6, theme } });

test("Neck-only Road: the neck is 55 to 60 percent wide, a gutter drag does not open a stop, and a tap on a stop opens its card", { skip: skip() }, async t => {
  const page = await phone(t, lib("dark", MID), { home: true });
  await page.waitForSelector(".rn-neck .rd-node.cur"); await settled(page);
  const width = await page.evaluate(() => document.querySelector(".rn-neck").getBoundingClientRect().width / innerWidth);
  assert.ok(width >= 0.55 && width <= 0.6, `neck width ${width}`);
  const lit = await page.evaluate(() => {
    const a = document.querySelector("#tabs [data-tab=road]");
    return { current: a.getAttribute("aria-current"), on: getComputedStyle(a.querySelector(".tb-on")).opacity, off: getComputedStyle(a.querySelector(".tb-off")).opacity };
  });
  assert.equal(lit.current, "page");
  assert.equal(lit.on, "1", "Road is lamp-lit");
  assert.equal(lit.off, "0");
  const gutter = await page.evaluate(() => { const n = document.querySelector(".rn-neck").getBoundingClientRect(); return { x: 12, y: n.top + 160 }; });
  await page.mouse.move(gutter.x, gutter.y);
  await page.mouse.down();
  await page.mouse.move(gutter.x, gutter.y + 120, { steps: 6 });
  await page.mouse.up();
  assert.equal(await page.locator(".rd-pop").count(), 0, "a gutter drag does not open a stop");
  await page.click(".rd-node.cur");
  await page.waitForSelector(".rd-pop");
  assert.match(await page.innerText(".rd-pop"), /Am/);
});

test("Neck-only Road: opening on the current stop keeps it on screen, and a stop near the nut stays at the top", { skip: skip() }, async t => {
  const page = await phone(t, lib("dark", MID), { home: true, viewport: { width: 390, height: 844 } });
  await page.waitForSelector(".rd-node.cur"); await settled(page);
  const box = await page.evaluate(() => {
    const stop = document.querySelector(".rd-node.cur").getBoundingClientRect();
    const header = document.querySelector("header.rr-head").getBoundingClientRect();
    const tabs = document.getElementById("tabs").getBoundingClientRect();
    return { top: stop.top, bottom: stop.bottom, header: header.bottom, tabs: tabs.top, scroll: document.getElementById("rd-path").scrollTop };
  });
  assert.ok(box.scroll > 0, "a stop down the neck is scrolled into view");
  assert.ok(box.top >= box.header - 1, "clear of the header");
  assert.ok(box.bottom <= box.tabs + 1, "clear of the tab bar");
  const fresh = await phone(t, { ...LIB, opening: undefined, me: undefined, settings: { ...LIB.settings, v: 6, theme: "dark" } }, { home: true, viewport: { width: 390, height: 844 } });
  await fresh.waitForSelector(".on-night");
  await fresh.waitForSelector(".rn-neck .rd-node.now"); await settled(fresh);
  const top = await fresh.evaluate(() => ({ scroll: document.getElementById("rd-path").scrollTop, stop: document.querySelector(".rd-node.now").getBoundingClientRect().top, header: document.querySelector("header.rr-head").getBoundingClientRect().bottom }));
  assert.equal(top.scroll, 0, "a stop near the nut pins to the top");
  assert.ok(top.stop >= top.header - 1, "and stays clear of the header");
});
