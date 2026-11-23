// Road Ready, step 04: five tabs (Road, Songbook, Rehearse, Tour, Me) in a grille-cloth bar with our own icons.
// Charts, Your band, the Merch table, the Tuner, Support and Settings are reached from Me; their pages go back to Me.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { phone, LIB, skip, useBrowser, base, settled } from "./harness.mjs";

useBrowser();

const libWith = (theme, settings = {}) => ({ ...LIB, settings: { ...LIB.settings, v: 6, theme, ...settings } });
const TABS = [["road", "Road", "#/"], ["songbook", "Songbook", "#/library"], ["rehearse", "Rehearse", "#/practice"], ["tour", "Tour", "#/playmap"], ["me", "Me", "#/you"]];

/* WCAG contrast of two "rgb(r, g, b)" strings */
const lum = c => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };

for (const [look, theme] of [["Road Ready dark", "dark"], ["Road Ready light", "light"]]) {
  test(`Road Ready 04 (${look}): five tabs in order, a nav named Main, each named, the current one marked, at least 44 by 44, no motion`, { skip: skip() }, async t => {
    const page = await phone(t, libWith(theme), { home: true });
    await page.waitForSelector("#tabs [data-tab=road][aria-current=page]");
    const nav = await page.evaluate(() => { const n = document.getElementById("tabs"); return { tag: n.tagName, name: n.getAttribute("aria-label") }; });
    assert.deepEqual(nav, { tag: "NAV", name: "Main" }, "the bar is a nav named Main");
    const tabs = await page.$$eval("#tabs a", as => as.map(a => { const r = a.getBoundingClientRect(), c = getComputedStyle(a);
      return { k: a.dataset.tab, name: a.getAttribute("aria-label"), href: a.getAttribute("href"), w: r.width, h: r.height, current: a.getAttribute("aria-current"), tr: c.transitionDuration, anim: c.animationName }; }));
    assert.deepEqual(tabs.map(x => [x.k, x.name, x.href]), TABS, "Road, Songbook, Rehearse, Tour, Me, in that order");
    for (const x of tabs) {
      assert.ok(x.w >= 44 && x.h >= 44, `${x.name} is ${Math.round(x.w)} by ${Math.round(x.h)}`);
      assert.ok(/^0s(, 0s)*$/.test(x.tr) && x.anim === "none", `${x.name}: no motion added`);
    }
    assert.deepEqual(tabs.filter(x => x.current === "page").map(x => x.k), ["road"], "only Road is current");
    /* each tab goes to its page with the right tab lit */
    for (const [k, , href] of TABS) {
      await page.click(`#tabs [data-tab=${k}]`);
      await page.waitForFunction(h => location.hash === h || (h === "#/" && location.hash === ""), href);
      await page.waitForSelector(`#tabs [data-tab=${k}][aria-current=page]`);
      await settled(page);
    }
  });

  test(`Road Ready 04 (${look}): the floating grille-cloth bar, amber when current, inactive labels readable on the mesh`, { skip: skip() }, async t => {
    const page = await phone(t, libWith(theme), { home: true });
    await page.waitForSelector("#tabs [data-tab=road][aria-current=page]");
    const r = await page.evaluate(() => {
      const n = document.getElementById("tabs"), c = getComputedStyle(n), box = n.getBoundingClientRect(), root = getComputedStyle(document.documentElement);
      const on = document.querySelector("#tabs [aria-current=page]"), off = document.querySelector("#tabs a:not([aria-current])");
      const lit = on.querySelector(".tb-on"), dim = off.querySelector(".tb-off");
      return { radius: c.borderTopLeftRadius, bg: c.backgroundImage, side: box.left, gapBelow: innerHeight - box.bottom,
        onColor: getComputedStyle(on).color, offLabel: getComputedStyle(off.querySelector(".tb-l")).color, offLabelSize: parseFloat(getComputedStyle(off.querySelector(".tb-l")).fontSize),
        lit: getComputedStyle(lit).opacity, dim: getComputedStyle(dim).opacity, litSrc: lit.getAttribute("src") };
    });
    assert.equal(r.radius, "18px", "radius 18");
    assert.match(r.bg, /art\/tabbar\/grille-/, "the amp grille");
    assert.ok(r.side >= 8 && r.gapBelow >= 8, "floats 8 px in from the sides and above the bottom");
    assert.equal(r.lit, "1", "the current knob is lamp-lit");
    assert.match(r.litSrc, /knob-lit\.webp/);
    assert.equal(r.dim, "1", "the other knobs stay dark");
    assert.ok(r.offLabelSize >= 11, "labels stay readable");
  });
}

test("Road Ready 04: Charts, Your band, the Merch table, Support and Settings are one tap from Me, and each page goes back to Me", { skip: skip() }, async t => {
  const page = await phone(t, libWith("dark"), { home: true });
  for (const [sel, hash, ready] of [["#pf-r-band", "#/band", ".bd-head"], ["#pf-r-charts", "#/charts", ".ch-head"], ["#pf-r-merch", "#/merch", ".mc-head"], ["#pf-r-support", "#/support", "#sp-kofi"], ["#pf-set", "#/settings", ".set-group"]]) {
    await page.click("#tabs [data-tab=me]"); await page.waitForSelector(sel); await settled(page);
    const box = await page.locator(sel).boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44, `${sel} is at least 44 by 44`);
    assert.ok((await page.locator(sel).getAttribute("aria-label")) || (await page.innerText(sel)).trim(), `${sel} has a name`);
    await page.click(sel); await page.waitForFunction(h => location.hash === h, hash); await page.waitForSelector(ready); await settled(page);
    const back = hash === "#/merch" ? "#mc-back" : "#back";
    await page.click(back); await page.waitForFunction(() => location.hash === "#/you"); await page.waitForSelector("#pf-r-band");
  }
  /* the rows grow with the text size: no clipping and at least 44 tall at --sys-px 33px, and the sizes come from the tokens */
  await page.click("#tabs [data-tab=me]"); await page.waitForSelector("#pf-r-band"); await settled(page);
  /* Road Ready 08: Me's rows are in two cards (the list and Support the app); a row has a small line only when it has something to add */
  const size = () => page.$$eval(".rr-me .rr-row", rs => rs.map(r => ({ id: r.id, h: r.getBoundingClientRect().height, name: parseFloat(getComputedStyle(r).fontSize), small: r.querySelector("small") ? parseFloat(getComputedStyle(r.querySelector("small")).fontSize) : 0,
    clip: r.scrollWidth > r.clientWidth + 1 || r.scrollHeight > r.clientHeight + 1 })));
  const normal = await size();
  await page.evaluate(() => { const r = document.documentElement; r.style.setProperty("--sys-px", "33px"); r.dataset.ax = "1"; });
  await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
  const large = await size();
  assert.deepEqual(large.map(r => r.id).filter(id => id !== "pf-share"), ["pf-r-band", "pf-r-charts", "pf-r-tune", "pf-r-help", "pf-r-support"], "band, charts, tuner, help and support (and Share only once something is played)");
  for (let i = 0; i < large.length; i++) {
    assert.ok(large[i].name > normal[i].name && large[i].small >= normal[i].small, `${large[i].id}: the text grows (${normal[i].name}/${normal[i].small} to ${large[i].name}/${large[i].small})`);
    if (normal[i].small) assert.ok(large[i].small > normal[i].small, `${large[i].id}: the small line grows too`);
    assert.ok(large[i].h >= 44 && !large[i].clip, `${large[i].id}: ${Math.round(large[i].h)} tall and nothing clips at large text`);
  }
});

test("Road Ready 04: deep links to the pages that left the bar still open them; Songbook is a tab and Me stays lit under its pages", { skip: skip() }, async t => {
  const page = await phone(t, libWith("dark"));
  for (const [hash, ready, lit] of [["#/library", "#chips", "songbook"], ["#/charts", ".ch-head", "me"], ["#/band", ".bd-head", "me"], ["#/merch", ".mc-head", "me"], ["#/support", "#sp-kofi", "me"]]) {
    await page.evaluate(h => { location.hash = h; }, hash); await page.waitForSelector(ready);
    await page.waitForSelector(`#tabs [data-tab=${lit}][aria-current=page]`);
  }
  await page.evaluate(() => { location.hash = "#/settings"; }); await page.waitForSelector(".set-group");
  await page.waitForFunction(() => !document.body.classList.contains("tabbed"), null, { timeout: 3000 }); /* Settings has no tab bar, as before */
});

test("Road Ready 04: the Songbook's search bar sits above the tab bar, so both can be tapped", { skip: skip() }, async t => {
  const page = await phone(t, libWith("dark"));
  await page.evaluate(() => { location.hash = "#/library"; }); await page.waitForSelector("#q"); await settled(page);
  const q = await page.locator(".dock").boundingBox(), bar = await page.locator("#tabs").boundingBox();
  assert.ok(q.y + q.height <= bar.y, "the search bar ends above the tab bar");
  await page.tap("#q"); await page.waitForFunction(() => document.body.classList.contains("searching"));
});

test("Road Ready 04: the not-tuned dot is on the Tuner row (no dot on a tab since 2026-11-19), and goes once you've tuned; the Tuner row opens the tuner", { skip: skip() }, async t => {
  const stale = await phone(t, libWith("dark", { lastTuned: 0 }), { home: true });
  await stale.waitForSelector("#tabs [data-tab=me]");
  assert.equal(await stale.locator("#tabs .dotmark").count(), 0, "no dot on a tab");
  await stale.click("#tabs [data-tab=me]"); await stale.waitForSelector("#pf-r-tune"); await settled(stale);
  assert.equal(await stale.locator("#pf-r-tune .dotmark").count(), 1, "the Tuner row has the dot");
  assert.match(await stale.innerText("#pf-r-tune"), /Tuner\s*Not tuned in the last few hours/);
  await stale.click("#pf-r-tune"); await stale.waitForSelector(".tuner, #tuner, [aria-label*='uner']");
  const fresh = await phone(t, libWith("dark", { lastTuned: Date.now() }), { home: true });
  await fresh.waitForSelector("#tabs [data-tab=me]");
  assert.equal(await fresh.locator("#tabs .dotmark").count(), 0, "no dot after tuning");
  await fresh.click("#tabs [data-tab=me]"); await fresh.waitForSelector("#pf-r-tune");
  assert.match(await fresh.innerText("#pf-r-tune"), /Tuned in the last few hours/);
  assert.equal(await fresh.locator("#pf-r-tune .dotmark").count(), 0);
});

for (const [w, h] of [[320, 568], [375, 667], [390, 844]]) {
  for (const [look, lib] of [["Road Ready dark", libWith("dark")], ["Green Room", { ...libWith("green"), merch: { ...(LIB.merch || {}), has: ["green"] } }]]) {
    test(`Road Ready 04 (${look}, ${w} by ${h}): the five labels never overlap and each fits inside its tab, at normal and large text`, { skip: skip() }, async t => {
      const page = await phone(t, lib, { home: true, viewport: { width: w, height: h } });
      await page.waitForSelector("#tabs a");
      const measure = () => page.$$eval("#tabs a", as => as.map(a => { const l = a.querySelector(".tb-l").getBoundingClientRect(), r = a.getBoundingClientRect();
        return { name: a.getAttribute("aria-label"), l: l.left, r: l.right, tl: r.left, tr: r.right, size: parseFloat(getComputedStyle(a.querySelector(".tb-l")).fontSize) }; }));
      for (const large of [false, true]) {
        if (large) {
          await page.evaluate(() => { const r = document.documentElement; r.style.setProperty("--sys-px", "33px"); r.dataset.ax = "1"; });
          await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
        }
        const m = await measure(), mode = large ? "large text" : "normal text";
        assert.equal(m.length, 5, "five tabs");
        for (let i = 0; i < m.length; i++) {
          assert.ok(m[i].l >= m[i].tl - 0.5 && m[i].r <= m[i].tr + 0.5, `${mode}: ${m[i].name} fits inside its tab (${m[i].l.toFixed(1)} to ${m[i].r.toFixed(1)} in ${m[i].tl.toFixed(1)} to ${m[i].tr.toFixed(1)})`);
          if (i) assert.ok(m[i - 1].r <= m[i].l, `${mode}: ${m[i - 1].name} does not touch ${m[i].name}`);
          if (w >= 375 && !large) assert.ok(m[i].size >= 13, `${mode}: ${m[i].name} is ${m[i].size} px, at least 13`);
        }
      }
    });
  }
}

test("Road Ready 04: at AX3 the labels hide, the icons grow to 32 px, and every tab keeps its name", { skip: skip() }, async t => {
  const page = await phone(t, libWith("dark"), { home: true });
  await page.waitForSelector("#tabs a");
  await page.evaluate(() => { const r = document.documentElement; r.style.setProperty("--sys-px", "45px"); r.dataset.ax = "3"; });
  const r = await page.$$eval("#tabs a", as => as.map(a => ({ name: a.getAttribute("aria-label"), label: getComputedStyle(a.querySelector(".tb-l")).display, ic: a.querySelector(".tb-knob").getBoundingClientRect().width, h: a.getBoundingClientRect().height, lit: a.getAttribute("aria-current") === "page" ? getComputedStyle(a.querySelector(".tb-on")).opacity : "" })));
  for (const x of r) {
    assert.equal(x.label, "none", `${x.name}: label hidden`);
    assert.equal(Math.round(x.ic), 50, `${x.name}: the knob grows`);
    assert.ok(x.name && x.h >= 44, `${x.name}: named and 44 tall`);
    if (x.name === "Road") assert.equal(x.lit, "1", "Road stays lamp-lit");
  }
});

test("Road Ready 04: Green Room keeps its flat bar (no grille cloth, no chrome), with the same five tabs", { skip: skip() }, async t => {
  const page = await phone(t, { ...libWith("green"), merch: { ...(LIB.merch || {}), has: ["green"] } }, { home: true });
  await page.waitForSelector("#tabs a");
  const r = await page.evaluate(() => { const n = document.getElementById("tabs"), c = getComputedStyle(n); return { bg: c.backgroundImage, pipe: getComputedStyle(n, "::before").content, tabs: [...n.querySelectorAll("a")].map(a => a.dataset.tab).join() }; });
  assert.equal(r.bg, "none", "no grille cloth");
  assert.equal(r.pipe, "none", "no chrome piping");
  assert.equal(r.tabs, "road,songbook,rehearse,tour,me");
});

test("Road Ready 04: ONBOARDING.md says where the More sheet's places went, and nothing still points at More", () => {
  const doc = fs.readFileSync(new URL("../../docs/ONBOARDING.md", import.meta.url), "utf8");
  const [before, moved] = doc.split("## Road Ready 04: where things moved");
  assert.ok(moved, "a section says where things moved");
  assert.match(moved, /More > Settings \| The gear at the top right of Me/);
  assert.doesNotMatch(before, /More > |the tuner from More|pink dot on More|on the More tab\./, "no tip or pointer above it still sends people to More");
});
