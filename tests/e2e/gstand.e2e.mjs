// The guitar stand cover flow on Me and the new-guitar sheet, in Dark and Light.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser, settled } from "./harness.mjs";
import { roadPath, GUITAR_SHOP } from "../../core.js";
useBrowser();

const AT = Date.now();
const legsDone = n => {
  const done = {}, data = { ...JSON.parse(JSON.stringify(LIB)), skills: { done, last: AT } };
  for (let i = 0; i < n; i++) {
    const leg = roadPath(data).legs.find(l => !l.done);
    if (!leg) break;
    for (const st of leg.stops) if (st.kind !== "box") done[st.id] = { n: 3, best: 90, at: AT - 1000 + i };
  }
  return { done, last: AT };
};
const shopIds = GUITAR_SHOP.map(g => `g-${g.id}`);
const base = (theme, extra = {}) => ({
  ...LIB,
  songs: LIB.songs.map((s, i) => ({ ...s, playLog: { total: i === 0 ? 6 : 1, last: AT, days: {} } })),
  settings: { ...LIB.settings, v: 6, theme },
  merch: { tconv: 1, lconv: 1, hlseen: 1, ...(extra.merch || {}) },
  ...extra, merch: { tconv: 1, lconv: 1, hlseen: 1, ...(extra.merch || {}) }
});
const openMe = async (t, theme, extra) => {
  const page = await phone(t, base(theme, extra), { home: true });
  await page.waitForSelector("#h-fans"); await settled(page);
  await page.evaluate(() => { location.hash = "#/you"; });
  await page.waitForSelector(".rr-me"); await settled(page);
  return page;
};
const seen = async page => page.evaluate(() => {
  const track = document.querySelector(".gs-track");
  const stage = track ? track.getBoundingClientRect() : null;
  const items = [...document.querySelectorAll(".gs-item")];
  const on = items.findIndex(el => el.classList.contains("is-on") || el.getAttribute("aria-pressed") === "true");
  const vis = el => {
    if (!el || !stage) return null;
    const r = el.querySelector("img").getBoundingClientRect();
    const left = Math.max(r.left, stage.left), right = Math.min(r.right, stage.right);
    return { shown: Math.max(0, right - left) / r.width, h: r.height, w: r.width, nw: el.querySelector("img").naturalWidth, nh: el.querySelector("img").naturalHeight,
      cx: (r.left + r.right) / 2, scx: (stage.left + stage.right) / 2 };
  };
  const pager = document.querySelector(".gs-pager");
  const pr = pager ? pager.getBoundingClientRect() : null;
  return {
    n: items.length, on, count: document.querySelector(".gs-count")?.textContent || "",
    hero: vis(items[on]), prev: vis(items[on - 1]), next: vis(items[on + 1]),
    dots: document.querySelectorAll(".gs-dots i").length,
    pagerH: pr ? pr.height : 0, pagerWrap: pager ? pager.scrollWidth > pager.clientWidth + 1 : false,
    glow: getComputedStyle(document.querySelector(".gs-glow")).backgroundImage,
    stand: !!document.querySelector(".gs-back"),
    name: document.querySelector(".gs-cap b")?.textContent || "",
    status: document.querySelector(".gs-cap small")?.textContent || ""
  };
});

test("Me (dark, 5.5.0): before any show Porch stands alone, your first guitar", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: LIB.songs.map(s => ({ ...s, playLog: undefined })), settings: { ...LIB.settings, v: 6, theme: "dark" } }, { home: true });
  await page.evaluate(() => { location.hash = "#/you"; }); await page.waitForSelector(".rr-me"); await settled(page);
  assert.match(await page.innerText(".rr-case-card"), /1 guitar\b/);
  assert.equal(await page.locator(".gs-item").count(), 1, "one guitar on the stand");
  assert.equal(await page.locator(".gs-item.is-on").getAttribute("aria-label"), "Porch, your first guitar");
  assert.match(await page.getAttribute(".gs-item.is-on img", "src"), /art\/guitars\/streak\/porch-road\.webp/, "the worn Porch, the large picture");
  assert.match(await page.innerText(".gs-cap"), /Porch[\s\S]*Your first guitar/);
  assert.equal(await page.locator(".gs-ghost").count(), 0, "no empty-stand outline: the stand is never empty");
  assert.equal(await page.locator(".rr-case-note").count(), 0, "no line about earning a first guitar");
  const stage = await page.evaluate(() => document.querySelector(".rr-case-card .gs-stage").getBoundingClientRect().height / innerHeight);
  assert.ok(stage >= 0.44 && stage <= 0.50, `the stand is ${(stage * 100).toFixed(1)}% of the screen`);
});

test("Me (dark): one guitar sits alone in the cradle, with its name", { skip: skip() }, async t => {
  /* 5.5.0: with nothing earned or bought, the one guitar is Porch, the guitar you start with */
  const page = await openMe(t, "dark", {});
  await page.waitForFunction(() => document.querySelector(".gs-item.is-on img")?.naturalWidth > 0);
  const s = await seen(page);
  assert.equal(s.n, 1);
  assert.equal(s.count, "1 of 1");
  assert.equal(s.name, "Porch");
  assert.match(s.status, /Your first guitar/);
  assert.match(await page.evaluate(() => getComputedStyle(document.querySelector(".gs-track")).touchAction), /pan-y/, "2026-11-23: a vertical swipe on the stand scrolls the page");
  assert.equal(s.prev, null); assert.equal(s.next, null);
  assert.ok(s.hero.shown > 0.95, "the one guitar is fully in view");
  assert.ok(Math.abs(s.hero.cx - s.hero.scx) < 8, "centered");
  assert.ok(Math.abs(s.hero.w / s.hero.h - s.hero.nw / s.hero.nh) < 0.05, "natural shape");
  assert.ok(s.hero.h >= 300 && s.hero.h <= 350, `hero is ${Math.round(s.hero.h)} px tall`);
});

for (const theme of ["dark", "light"]) {
  test(`Me (${theme}): six guitars, the second in the cradle, neighbours peeking, pager says 2 of 6`, { skip: skip() }, async t => {
    const page = await openMe(t, theme, { skills: legsDone(2), guitars: { seen: ["open", "switch"] }, merch: { has: shopIds.slice(0, 3) } });
    await page.waitForFunction(() => document.querySelectorAll(".gs-item").length === 6);
    await page.locator(".gs-item").nth(1).click();
    await page.waitForFunction(() => {
      const track = document.querySelector(".gs-track")?.getBoundingClientRect();
      const im = document.querySelector(".gs-item.is-on img")?.getBoundingClientRect();
      return track && im && im.height >= 300 && document.querySelector(".gs-count")?.textContent === "2 of 6" && Math.abs((im.left + im.right) / 2 - (track.left + track.right) / 2) < 8;
    });
    const s = await seen(page);
    assert.equal(s.on, 1);
    assert.equal(s.name, "Cornerstone");
    assert.ok(s.hero.shown > 0.95, "the hero is fully visible");
    assert.ok(Math.abs(s.hero.cx - s.hero.scx) < 8, "the hero is centered");
    assert.ok(s.hero.h >= 300 && s.hero.h <= 350, `hero height ${Math.round(s.hero.h)}`);
    assert.ok(Math.abs(s.hero.w / s.hero.h - s.hero.nw / s.hero.nh) < 0.05, "natural aspect");
    for (const side of [s.prev, s.next]) {
      assert.ok(side.shown >= 0.65 && side.shown <= 1.02, `a neighbour shows ${side.shown.toFixed(2)} of itself`);
      assert.ok(Math.abs(side.w / side.h - side.nw / side.nh) < 0.06, "a neighbour keeps its shape");
    }
    assert.ok(s.pagerH > 0 && s.pagerH < 40, "the pager is one line");
    assert.equal(s.pagerWrap, false);
    assert.match(s.glow, /radial-gradient/);
    assert.equal(s.stand, true);
    const stage = await page.evaluate(() => document.querySelector(".rr-case-card .gs-stage").getBoundingClientRect().height / innerHeight);
    assert.ok(stage >= 0.44 && stage <= 0.46, `${theme}: the stand is ${(stage * 100).toFixed(1)}% of the screen`);
    /* arrow key moves the count */
    await page.locator(".gs-item.is-on").focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.querySelector(".gs-count")?.textContent === "3 of 6");
    assert.equal(await page.locator(".gs-item.is-on").getAttribute("aria-label"), "Club Slab, earned on Leg 2, Chord switches");
  });
}

test("Me (dark): twenty-three guitars, the pager stays one line and follows a move to the middle", { skip: skip() }, async t => {
  const page = await openMe(t, "dark", {
    skills: legsDone(3),
    guitars: { seen: ["open", "switch", "scales", "strum", "pick", "finger", "encore"] },
    merch: { has: shopIds }
  });
  await page.waitForFunction(() => document.querySelectorAll(".gs-item").length === 23);
  await page.locator(".gs-item").nth(11).click();
  await page.waitForFunction(() => document.querySelector(".gs-count")?.textContent === "12 of 23");
  const s = await seen(page);
  assert.equal(s.n, 23);
  assert.equal(s.on, 11);
  assert.ok(s.dots <= 9, `the window is ${s.dots} dots`);
  assert.ok(s.pagerH < 40 && !s.pagerWrap, "one line, not clipped");
  assert.ok(s.prev.shown >= 0.5 && s.next.shown >= 0.5, "neighbours still peek");
  const pageW = await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth + 1);
  assert.equal(pageW, true);
});

test("New guitar sheet (dark and light): Cornerstone is in the cradle, with a neighbour, Louie and Rock on", { skip: skip() }, async t => {
  for (const theme of ["dark", "light"]) {
    const page = await phone(t, base(theme, { skills: legsDone(1), merch: { has: shopIds.slice(0, 2) } }), { home: true });
    await page.waitForSelector(".rd-gt.rr-case #gt-x");
    await page.waitForFunction(() => document.querySelector(".gs-item.is-on img")?.naturalWidth > 0);
    await page.evaluate(() => Promise.all([...document.querySelector(".rd-gt").getAnimations()].map(a => a.finished)));
    assert.equal(await page.innerText(".gs-count"), "2 of 4");
    assert.match(await page.getAttribute(".gs-item.is-on img", "src"), /cornerstone-road\.webp/);
    assert.equal(await page.innerText(".sc-label"), "Cornerstone");
    assert.equal(await page.locator(".sc-louie").count(), 1);
    assert.equal(await page.locator(".gs-back").count(), 1);
    const fit = await page.evaluate(() => {
      const b = document.querySelector("#gt-x").getBoundingClientRect();
      const hero = document.querySelector(".gs-item.is-on img").getBoundingClientRect();
      const track = document.querySelector(".gs-track").getBoundingClientRect();
      const side = document.querySelectorAll(".gs-item")[0].querySelector("img").getBoundingClientRect();
      const shown = Math.max(0, Math.min(side.right, track.right) - Math.max(side.left, track.left)) / side.width;
      return { btn: b.bottom <= innerHeight + 1 && b.top > 0, hero: hero.height, shown, look: document.documentElement.dataset.look };
    });
    assert.equal(fit.btn, true, `${theme}: Rock on is on the screen`);
    assert.ok(fit.hero >= 255 && fit.hero <= 305, `${theme}: the sheet guitar is ${Math.round(fit.hero)} px`);
    assert.ok(fit.shown >= 0.5, `${theme}: a neighbour peeks`);
    assert.equal(fit.look, theme === "light" ? "festival" : "neon");
    await page.click("#gt-x");
    await page.waitForFunction(() => !document.querySelector(".rd-gt"));
  }
});

test("2026-11-23: the guitar the headline sheet says you earned is in the Guitar case", { skip: skip() }, async t => {
  const page = await phone(t);
  const r = await page.evaluate(async () => {
    const C = await import("./core.js"), G = await import("./gstand.js");
    const data = { songs: [], sets: [], trash: [], settings: {} };
    for (const c of ["G", "C", "D", "Em", "Am", "E", "A"]) C.skillDone(data, "c:" + c);
    C.skillDone(data, "k:open");
    const gn = C.guitarNew(data);
    return { said: gn.guitar.name, inCase: G.collectionOf(data).map(g => g.name) };
  });
  assert.equal(r.said, "Cornerstone");
  assert.ok(r.inCase.includes(r.said), `the case holds ${r.said}: ${r.inCase.join(", ")}`);
});
